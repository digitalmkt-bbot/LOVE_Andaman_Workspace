/* ═════════════════════════════════════════════════════════════════════════
   §opsW5cVans (2026-10-18, wave 5 group c) · van rules the browser still decided, now the server's answer
   ─────────────────────────────────────────────────────────────────────────
   Backend guides: operation-backend README "Vans and the month matrix" (zone_on, usable), "Van board" (pool, return_unarranged),
   "Van groups" (stop_seats), "Van stops", "Van job orders" (round, special_request). docs/walk/w5-c.md has the per-function table.
   Classic script, loads after 77-ops-van-job-list.js, before 90-ops-boot.js. Legacy mode (!O.enabled()): every wrapper delegates.

   Reads are cached by what has been written: a counter (`stamp`) goes up when this tab writes to vans, groups, stops, trips or bookings
   (a wrapper of laOpsFetch, the one door of every call) and when the change feed says someone else wrote. An answer read before the
   last write is "old": the legacy rule answers until the new one is here (it is asked for at once), so a screen never mixes the two.

     vehEffectiveZone / _vehUsableOn      zone_on / usable of GET /operations/van-days (the day cell of that van)
     vanVehiclesForZone                   (calls the two above)
     vanVehiclesForRoute                  GET /operations/van-board routes[].pool.outbound
     bookingV2RetInfo(...).alert          GET /operations/van-board routes[].return_unarranged (the other fields stay the booking's)
     bookingV2VanGroupConflicts           none in ops mode: a group has ONE van_id on the server, a mixed group cannot exist
     vanJobsSreqFinal                     booking.special_request (job_note else notes)
     vjRoundAll / vjRoundPick / vehDayRoundN   jobs[].round {no, of, time} of GET /operations/van-jobs?date=
     vsFor                                the order the server sent the stops in (manual sequence, then time, untimed last)
     vsSeatsOfVan                         the group's stop_seats (outbound leg)
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function wrapGlobal(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW5c) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r = fn.apply(this, [orig, this].concat([].slice.call(arguments)));
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW5c = true; w.__orig = orig; window[name] = w;
  }
  /* after: fn(result, args) → a new result (or undefined to keep it) */
  function wrapAfter(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW5c) return;
    var w = function(){
      var r = orig.apply(this, arguments);
      if(!enabled()) return r;
      var n = fn.call(this, r, [].slice.call(arguments));
      return n === undefined ? r : n;
    };
    w.__opsW5c = true; w.__orig = orig; window[name] = w;
  }
  function store(name){
    try{ if(name === 'SB_VEHICLES') return typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : null;
         if(name === 'VAN_STOPS') return typeof VAN_STOPS !== 'undefined' ? VAN_STOPS : null; }catch(_){}
    return null;
  }

  /* ── the write counter ── */
  var stamp = 0;
  var STOP_WRITE = /\/operations\/van-stops(?!\/[^/]+\/check-in)/;
  var MOVES = /\/operations\/(van-|vans|trip-ops|deployments)|\/v1\/bookings/;
  var CHECKIN = /\/checkins\//;
  var base = window.laOpsFetch;
  if(typeof base === 'function' && !base.__opsW5c){
    var f = function(path, opts){
      var p = base.apply(this, arguments);
      var m = String((opts && opts.method) || 'GET').toUpperCase(), s = String(path || '');
      if(m !== 'GET' && MOVES.test(s) && !CHECKIN.test(s)){
        var scope = STOP_WRITE.test(s) ? stopScope(s, opts) : null;       // read before the write changes anything
        p.then(function(r){
          stamp++;
          if(scope && r && r.ok) setTimeout(function(){ reloadStopDays(scope); }, 0);
        }, function(){ stamp++; });
      }
      return p;
    };
    f.__opsW5c = true; window.laOpsFetch = f;
  }
  O.onWrite(function(kind){ if(!/^(trip-checkin|booking-meals|booking-insurance)/.test(String(kind || ''))) stamp++; });
  O.onChange(function(){ stamp++; });

  /* a stop was written: the day is read again (groups: stop_seats; stops: the server's order) */
  function reloadStopDays(scope){
    var V = O.vanJobs; if(!V || !V.loadDay || !O.vans || !O.vans.load) return;
    var days = {};
    Object.keys(scope).forEach(function(k){ days[scope[k].date] = (days[scope[k].date] || []).concat(scope[k].route); });
    Object.keys(days).forEach(function(d){
      Promise.all(days[d].map(function(r){ return O.vans.load(d, r); })).then(function(){ if(V.dropDay) V.dropDay(d); return V.loadDay(d); });
    });
  }
  /* the day and programme a stop write touches: the group it names (POST / PATCH) and the group it is in now (PATCH / DELETE) */
  function stopScope(path, opts){
    var out = {}, S = store('VAN_STOPS');
    var add = function(d, r){ if(d && r) out[d + '|' + r] = { date: d, route: r }; };
    try{
      var body = opts && opts.body ? JSON.parse(opts.body) : null;
      if(body && body.group_id && O.vans && O.vans.groupInfo){ var gi = O.vans.groupInfo(body.group_id); if(gi) add(gi.date, gi.routeId); }
    }catch(_){}
    var m = /\/operations\/van-stops\/([^/?]+)/.exec(path);
    if(m && S) Object.keys(S).forEach(function(k){ if(S[k] && S[k]._opsId === m[1]){ var p = k.split('::'); add(p[0], p[1]); } });
    return out;
  }

  /* ── 1. a van on a day: zone_on and usable from the month matrix ── */
  var VD = null;                          // { from, to, stamp, cells: {'van|date': cell} }
  var vdBusy = false, vdFailed = 0;
  function cellOf(vanId, date){
    if(!vanId || !date) return null;
    if(VD && VD.stamp === stamp && VD.from <= date && date <= VD.to) return VD.cells[vanId + '|' + date] || null;
    askDays(date);
    return null;
  }
  function askDays(date){
    if(vdBusy || Date.now() - vdFailed < 4000) return;
    var from = O.shift(date, -20), to = O.shift(date, 40), at = stamp;
    vdBusy = true;
    O.get('/operations/van-days', { from: from, to: to }).then(function(j){
      var cells = {};
      ((j && j.days) || []).forEach(function(c){ cells[c.van_id + '|' + c.service_date] = c; });
      VD = { from: from, to: to, stamp: at, cells: cells }; vdBusy = false;
    }, function(){ vdFailed = Date.now(); vdBusy = false; });
  }
  wrapGlobal('vehEffectiveZone', function(orig, self, v, date){
    if(!v || !date) return undefined;
    var c = cellOf(v.id, date);
    return (c && c.zone_on) ? c.zone_on : undefined;
  });
  wrapGlobal('_vehUsableOn', function(orig, self, v, date){
    if(!v || !date) return undefined;
    var c = cellOf(v.id, date);
    return (c && typeof c.usable === 'boolean') ? c.usable : undefined;
  });

  /* ── 2. the outbound pool of a route and the return alert, from the van board ── */
  function boardOf(date){ return (typeof window.laOpsVanBoardFresh === 'function') ? window.laOpsVanBoardFresh(date) : null; }
  wrapGlobal('vanVehiclesForRoute', function(orig, self, date, routeId){
    var b = boardOf(date); if(!b) return undefined;
    var r = (b.routes || []).filter(function(x){ return x && x.route_id === routeId; })[0];
    if(!r || !r.pool || !Array.isArray(r.pool.outbound)) return undefined;
    var all = store('SB_VEHICLES') || [], ids = r.pool.outbound;
    var list = all.filter(function(v){ return v && ids.indexOf(v.id) >= 0; });
    return list.length === ids.length ? list : undefined;            // a van the browser does not know: legacy's pool
  });
  wrapAfter('bookingV2RetInfo', function(ri, a){
    var bk = a[0], date = a[1]; if(!ri || !bk || !bk.opsId) return undefined;
    var b = boardOf(date); if(!b) return undefined;
    var hit = false;
    (b.routes || []).forEach(function(r){ (r.return_unarranged || []).forEach(function(x){ if(x && x.booking_id === bk.opsId) hit = true; }); });
    return Object.assign({}, ri, { alert: hit });
  });
  /* a group has one van_id on the server: "members of one group on different vans" cannot exist (the van board lists the real
     problems: van_not_in_pool, over_capacity_groups) */
  wrapGlobal('bookingV2VanGroupConflicts', function(){ return []; });

  /* ── 3. the special request ── */
  wrapGlobal('vanJobsSreqFinal', function(orig, self, b){
    if(b && b.opsId && typeof b.specialRequest === 'string') return b.specialRequest;
    return undefined;
  });

  /* ── 4. rounds: the day's jobs, each with round {no, of, time} ── */
  var JB = {};                            // date -> { stamp, jobs, busy, legacy }
  function jobsFor(date, legacyJson){
    var e = JB[date];
    if(e && !e.busy && e.stamp === stamp) return e.jobs;
    if(e && e.busy) return null;
    var at = stamp, cur = JB[date] = { stamp: -1, jobs: null, busy: true, legacy: legacyJson || '' };
    O.get('/operations/van-jobs', { date: date }).then(function(j){
      JB[date] = { stamp: at, jobs: (j && j.jobs) || [], busy: false, legacy: cur.legacy };
      var s = roundMap(JB[date].jobs);
      if(cur.legacy && JSON.stringify(s) !== cur.legacy && O.vanJobs && O.vanJobs.redraw) O.vanJobs.redraw();
    }, function(){ JB[date] = { stamp: -1, jobs: null, busy: false, legacy: '', failedAt: Date.now() }; });
    return null;
  }
  /* legacy's shape: { 'van~route': { group: earliest pickup time } }, plus the server's own round of each group (not enumerable) */
  function roundMap(jobs){
    var A = {}, srv = {};
    (jobs || []).forEach(function(j){
      if(!j || !j.group_id || !j.van_id) return;
      var k = j.van_id + '~' + j.route_id, g = +j.group_number || 0; if(!g) return;
      (A[k] = A[k] || {})[g] = (j.round && j.round.time) || '';
      if(j.round) (srv[k] = srv[k] || {})[g] = j.round;
    });
    Object.keys(A).forEach(function(k){ Object.defineProperty(A[k], '__srv', { value: srv[k] || null, enumerable: false }); });
    return A;
  }
  wrapGlobal('vjRoundAll', function(orig, self, date){
    if(!date) return undefined;
    var e = JB[date];
    if(e && e.failedAt && Date.now() - e.failedAt < 5000) return undefined;
    var jobs = jobsFor(date, '');
    if(jobs) return roundMap(jobs);
    var legacy = orig.call(self, date);                                  // until the day's jobs are here
    if(JB[date] && JB[date].busy) JB[date].legacy = JSON.stringify(legacy);
    return legacy;
  });
  wrapGlobal('vjRoundPick', function(orig, self, m, g){
    var s = m && m.__srv && m.__srv[+g || 0];
    if(!s) return undefined;
    var gs = Object.keys(m).sort(function(a, b){ var x = m.__srv[a], y = m.__srv[b]; return (x ? x.no : 99) - (y ? y.no : 99); });
    return { no: +s.no, tot: +s.of, tm: m[String(+g || 0)] || '', all: gs, tms: gs.map(function(x){ return m[x] || ''; }) };
  });

  /* ── 5. van stops: the server's order, and the seats the guides take ── */
  wrapGlobal('vsFor', function(orig, self, date, routeId){
    var S = store('VAN_STOPS'); if(!S || typeof window.vsParse !== 'function') return undefined;
    var out = [], srv = true;
    Object.keys(S).forEach(function(k){
      var p = window.vsParse(k); if(p.date !== date) return; if(routeId && p.routeId !== routeId) return;
      var v = S[k]; if(!v || typeof v !== 'object') return;
      if(!v._opsId) srv = false;
      out.push(Object.assign({}, v, { _k: k, id: p.id, date: p.date, routeId: p.routeId }));
    });
    return srv ? out : undefined;           // every stop came from the server: its order (35-ops-van-jobs.js puts them in that order)
  });
  wrapGlobal('vsSeatsOfVan', function(orig, self, date, routeId, vanId, grp, isRet){
    if(isRet || !grp || !O.vans || !O.vans.serverIdOf || !O.vans.groupInfo) return undefined;
    var sid = O.vans.serverIdOf(date, routeId, +grp); if(!sid) return undefined;
    var gi = O.vans.groupInfo(sid);
    if(!gi || gi.stopSeats == null || (vanId && gi.vanId && gi.vanId !== vanId)) return undefined;
    return gi.stopSeats;
  });

  O.w5cVans = { stamp: function(){ return stamp; }, cellOf: cellOf, roundMap: roundMap };
})();
