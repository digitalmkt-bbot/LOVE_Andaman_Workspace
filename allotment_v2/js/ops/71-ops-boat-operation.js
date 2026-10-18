/* ════════════════════════════════════════════════════════════════════════
   §opsBoatOperation (2026-10-18) · Boat Operation's fleet panel ⇄ operation-backend (decision Q48)
   ────────────────────────────────────────────────────────────────────────
   The Boat Operation screen asks "is this boat ready, where is it, which boats are free" for every cell. The rules
   are the server's now (operation-backend todo/w2-days-boats-model.md):

     GET /v1/fleet/boat-operation?from=&to=&pier=all   → per date: assigned[], available[], unavailable[] (legacy's reason
                                                        text), free_by_pier{}      bop2FleetStatus, bop2FreeByPier
     GET /v1/fleet/availability?from=&to=               → per boat and date: status, stored_status, blocked_by, not_chartered,
                                                        current_pier, shop_location, ovn_hold   getStoredStatus, getCurStatus,
                                                        boatEffStatus, getBoatCurrentPier

   How: the visible range is read once (62 days at most per call, queued behind any write in flight). Until the
   answer arrives, and after any write that could change it, legacy's own computation runs unchanged. Once it is here:
     · bop2FleetStatus / bop2FreeByPier return the server's lists (same shapes as legacy's, boats are the browser's objects);
     · inside Boat Operation only (a counter set by the wrappers below), getStoredStatus / getCurStatus / boatEffStatus /
       getBoatCurrentPier answer from the availability rows. bop2OpenCellPopover, bop2AssignBoatOptsFor, bop2CanPlace,
       bop2RenderHeatmapRow and bop2RouteDaysNeedingBoats run inside that counter, so they read the server's answers
       without being rewritten. The Boats screen is outside it and keeps legacy's status (decision Q3).
   Nothing is sent. Outside ops mode nothing here runs. Classic script · loads after 22-ops-fleet-boats.js and 68-ops-fleet-views.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var MAX_DAYS = 62;
  var scope = 0;            // > 0 while a Boat Operation function runs
  var epoch = 0;            // bumped by every write; an answer from an older epoch is dropped
  var rec = {};             // date → { epoch, avail: {boatId → row}, panel: day | null }
  var inflight = {};        // date → epoch
  var failedAt = {};        // date → epoch of a failed read (not asked again until the next write)
  var wanted = [];          // the dates the last draw needed
  var timer = null;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function inScope(){ return scope > 0 && enabled(); }
  function sc(fn, self, args){ scope++; try{ return fn.apply(self, args); } finally { scope--; } }

  function fresh(ds){ var r = rec[ds]; return (r && r.epoch === epoch) ? r : null; }
  function rowOf(boatId, ds){ var r = fresh(ds); return r && r.avail ? (r.avail[boatId] || null) : null; }
  function dayOf(ds){ var r = fresh(ds); return r ? r.panel : null; }
  function boatOf(id){ return (typeof BOATS !== 'undefined' && Array.isArray(BOATS)) ? (BOATS.find(function(b){ return b && b.id === id; }) || null) : null; }
  function routeOf(id){ return (typeof ROUTES !== 'undefined' && Array.isArray(ROUTES)) ? (ROUTES.find(function(r){ return r && r.id === id; }) || null) : null; }
  function clientBookingId(id){
    if(!id) return id;
    var list = (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [];
    var b = list.find(function(x){ return x && x.opsId === id; });
    return b ? b.id : id;
  }

  /* ── reads ── */
  function redraw(){
    if(!enabled() || O.busy() || O.activeView() !== 'operation') return;
    if(typeof window.renderOp === 'function'){ try{ window.renderOp(); }catch(_){} }
  }
  function runsOf(dates){
    var d = dates.slice().sort(), out = [], cur = null;
    d.forEach(function(x){
      if(cur && O.shift(cur.to, 1) === x && cur.n < MAX_DAYS){ cur.to = x; cur.n++; }
      else { cur = { from: x, to: x, n: 1 }; out.push(cur); }
    });
    return out;
  }
  /* ask for the dates not here yet · calls within a tick are joined into one request per 62 days
     then: 'none' = nothing to draw when the answer lands; a function = run it; absent = draw Boat Operation again */
  var pending = [], thens = [], flushT = null;
  function ensure(dates, then){
    if(!enabled()) return;
    var any = false;
    dates.forEach(function(d){
      if(!d || fresh(d) || inflight[d] === epoch || failedAt[d] === epoch || pending.indexOf(d) >= 0) return;
      pending.push(d); any = true;
    });
    if(!any) return;
    if(then !== 'none') thens.push(then || redraw);
    if(!flushT) flushT = setTimeout(flush, 0);
  }
  function flush(){
    flushT = null;
    var need = pending; pending = [];
    var cbs = thens; thens = [];
    if(!enabled() || !need.length) return;
    need = need.filter(function(d){ return !fresh(d) && inflight[d] !== epoch; });
    var jobs = runsOf(need).map(function(run){
      var e = epoch, ds = [];
      for(var x = run.from; x <= run.to; x = O.shift(x, 1)) { ds.push(x); inflight[x] = e; }
      return O.queue(function(){
        return Promise.all([
          O.get('/v1/fleet/availability', { from: run.from, to: run.to }),
          O.get('/v1/fleet/boat-operation', { from: run.from, to: run.to, pier: 'all' })
        ]);
      }).then(function(res){
        ds.forEach(function(d){ if(inflight[d] === e) delete inflight[d]; });
        if(e !== epoch) return false;               // a write came in meanwhile: the next draw asks again
        var av = {}, panels = {};
        ((res[0] && res[0].days) || []).forEach(function(r){ ((av[r.service_date] = av[r.service_date] || {})[r.boat_id]) = r; });
        ((res[1] && res[1].days) || []).forEach(function(p){ panels[p.date] = p; });
        ds.forEach(function(d){ rec[d] = { epoch: e, avail: av[d] || {}, panel: panels[d] || null }; });
        return true;
      }, function(err){
        ds.forEach(function(d){ if(inflight[d] === e) delete inflight[d]; failedAt[d] = e; });
        try{ console.warn('[ops] boat operation fleet panel did not load · legacy figures kept · ' + (err && err.message)); }catch(_){}
        return false;
      });
    });
    Promise.all(jobs).then(function(r){
      if(!r.some(Boolean)) return;
      var seen = [];
      cbs.forEach(function(f){ if(seen.indexOf(f) < 0){ seen.push(f); try{ f(); }catch(_){} } });
    });
  }

  /* any write could change a status, a pier, a deployment or a seat count: the answers are old until read again */
  function stale(){
    epoch++;
    clearTimeout(timer);
    if(!enabled()) return;
    timer = setTimeout(function(){ if(wanted.length && O.activeView() === 'operation') ensure(wanted); }, 300);
  }
  O.onWrite(stale);
  O.onChange(stale);

  function wrapGlobal(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsBop) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig, this].concat([].slice.call(arguments)));
    };
    w.__opsBop = true;
    window[name] = w;
  }
  /* the browser edits TRIPS and the day's seats first and sends later: from that moment the answers are old */
  (function(){
    ['save', 'boatCapPersist'].forEach(function(n){
      var orig = window[n];
      if(typeof orig !== 'function' || orig.__opsBopStale) return;
      var w = function(){
        var ret = orig.apply(this, arguments);
        try{ if(enabled() && (n !== 'save' || arguments[0] === 'operations')) stale(); }catch(_){}
        return ret;
      };
      w.__opsBopStale = true; w.__ops = orig.__ops; window[n] = w;
    });
  })();

  /* ── the status primitives, inside Boat Operation only ── */
  function copy(r){ var c = {}; if(r) Object.keys(r).forEach(function(k){ c[k] = r[k]; }); return c; }
  var JOB_KIND = { project: 'prj', job: 'mj' };
  function jobBlockOf(row){
    return (row.blocked_by || []).map(function(j){ return { no: j.no || '', t: j.status || 'unavailable', kind: JOB_KIND[j.kind] || 'mj', r: j.reason || '' }; });
  }

  wrapGlobal('getStoredStatus', function(orig, self, boat, ds){
    var r = orig.call(self, boat, ds);
    if(!inScope() || !boat || !ds) return r;
    var row = rowOf(boat.id, ds); if(!row || row.stored_status == null) return r;
    if(r && (r.s || 'available') === row.stored_status) return r;
    var c = copy(r); c.s = row.stored_status; return c;
  });
  wrapGlobal('boatEffStatus', function(orig, self, boat, ds){
    var r = orig.call(self, boat, ds);
    if(!inScope() || !boat || !ds || boat.retired) return r;
    var row = rowOf(boat.id, ds); if(!row || row.status == null) return r;
    var nc = !!row.not_chartered;
    if(r && (r.s || 'available') === row.status && !!r.noCharter === nc) return r;
    var c = copy(r);
    c.baseS = (r && r.baseS) || row.stored_status || 'available';
    c.s = row.status;
    if(nc) c.noCharter = true; else delete c.noCharter;
    var jb = jobBlockOf(row);
    if(jb.length){ c.jobBlock = jb; c.jobBlockNos = jb.map(function(j){ return j.no; }).join(' · '); }
    else { delete c.jobBlock; delete c.jobBlockNos; }
    return c;
  });
  wrapGlobal('getBoatCurrentPier', function(orig, self, b, ds){
    if(inScope() && b){
      var row = rowOf(b.id, ds || (typeof TODAY_STR !== 'undefined' ? TODAY_STR : O.today()));
      if(row && row.current_pier) return row.current_pier;
    }
    return orig.call(self, b, ds);
  });

  /* ── the fleet panel ── */
  function pierOk(p){
    var sel = (typeof _bop2 !== 'undefined' && _bop2) ? _bop2.pier : 'all';
    return !sel || sel === 'all' || p === sel;
  }
  wrapGlobal('bop2FleetStatus', function(orig, self, dateStr){
    var day = enabled() ? dayOf(dateStr) : null;
    if(!day) return sc(orig, self, [dateStr]);
    var out = { assigned: [], available: [], unavailable: [] }, ok = true;
    (day.assigned || []).forEach(function(a){
      if(!pierOk(a.pier)) return;
      var b = boatOf(a.boat_id), route = routeOf(a.route_id); if(!b || !route){ ok = false; return; }
      out.assigned.push({ boat: b, route: route, type: a.type, charterBookingId: clientBookingId(a.charter_booking_id) || undefined,
        seats: +a.seats || 0, capacity: +a.capacity > 0 ? +a.capacity : b.cap, isCharter: !!a.is_charter });
    });
    (day.available || []).forEach(function(a){
      if(!pierOk(a.pier)) return;
      var b = boatOf(a.boat_id); if(!b){ ok = false; return; }
      out.available.push({ boat: b });
    });
    (day.unavailable || []).forEach(function(u){
      if(!pierOk(u.pier)) return;
      var b = boatOf(u.boat_id); if(!b){ ok = false; return; }
      if(u.reason_code === 'not_chartered') out.unavailable.push({ boat: b, reason: u.reason });
      else if(u.reason_code === 'ovn_hold' && u.ovn_hold) out.unavailable.push({ boat: b, reason: u.reason,
        ovnHold: { bkId: clientBookingId(u.ovn_hold.booking_id), from: u.ovn_hold.from, to: u.ovn_hold.to, routeId: u.ovn_hold.route_id || '' } });
      else out.unavailable.push({ boat: b, reason: u.reason, overdue: !!u.overdue, jobNos: u.job_nos || [] });
    });
    return ok ? out : sc(orig, self, [dateStr]);   // a boat the browser does not know: legacy's own list
  });
  wrapGlobal('bop2FreeByPier', function(orig, self, dateStr){
    var day = enabled() ? dayOf(dateStr) : null;
    if(!day || !day.free_by_pier) return sc(orig, self, [dateStr]);
    var out = {}, ok = true;
    Object.keys(day.free_by_pier).forEach(function(p){
      var list = [];
      (day.free_by_pier[p] || []).forEach(function(x){ var b = boatOf(x.boat_id); if(b) list.push(b); else ok = false; });
      if(list.length) out[p] = list;
    });
    return ok ? out : sc(orig, self, [dateStr]);
  });

  /* ── functions that only need the answers to be here while they run ── */
  wrapGlobal('renderOp', function(orig, self){
    try{
      var dates = (typeof bop2GetDates === 'function') ? bop2GetDates().slice() : [];
      var sel = (typeof _bop2 !== 'undefined' && _bop2) ? _bop2.selDate : '';
      if(sel && dates.indexOf(sel) < 0) dates.push(sel);
      wanted = dates; ensure(dates);
    }catch(_){}
    return sc(orig, self, [].slice.call(arguments, 2));
  });
  wrapGlobal('bop2OpenCellPopover', function(orig, self, routeId, dateStr){
    ensure([dateStr]);
    return sc(orig, self, [].slice.call(arguments, 2));
  });
  wrapGlobal('bop2CanPlace', function(orig, self, boat, routeId, ds){
    ensure([ds], 'none');                // a bulk form reads many days: the legacy rule answers until each day is here
    return sc(orig, self, [boat, routeId, ds]);
  });
  wrapGlobal('bop2AssignBoatOptsFor', function(orig, self, pier, ds){
    var day = ds || ((typeof _bop2 !== 'undefined' && _bop2 && _bop2.selDate) || (typeof TODAY_STR !== 'undefined' ? TODAY_STR : O.today()));
    ensure([day], function(){ if(document.getElementById('bop2ar-boat') && typeof window.bop2UpdateAssignBoatOpts === 'function') window.bop2UpdateAssignBoatOpts(); });
    return sc(orig, self, [].slice.call(arguments, 2));
  });
  wrapGlobal('bop2RenderHeatmapRow', function(orig, self){ return sc(orig, self, [].slice.call(arguments, 2)); });
  wrapGlobal('bop2RouteDaysNeedingBoats', function(orig, self){ return sc(orig, self, [].slice.call(arguments, 2)); });

  O.boatOperation = { run: function(fn, self, args){ return sc(fn, self, args || []); }, ensure: ensure, day: dayOf, row: rowOf, isFresh: function(ds){ return !!fresh(ds); },
    rows: function(ds){ var r = fresh(ds); return r && r.avail ? r.avail : null; } };   // w4-f5: rows = every boat's availability row of the date (ops/77-ops-ovn-hold.js reads ovn_hold from them)
})();
