/* ══════════════════════════════════════════════════════════════════════════
   §opsDeploy (2026-10-05) · Boat Operation ⇄ /operations/deployments
   ──────────────────────────────────────────────────────────────────────────
   A deployment = one boat on one route on one date, with that day's seats.
   Client side that is TRIPS[date][boatId].route + boatCapFor(boatId, date).

   GET    /operations/deployments?from=&to=        → TRIPS + BOAT_CAP_OVR
   POST   /operations/deployments                  ← assign / move / change cap
   DELETE /operations/deployments/{date}/{boatId}  ← unassign

   Twelve functions write TRIPS (assign, unassign, copy week, templates,
   swaps, ranges…) and they all end in save('operations'); per-day seat
   changes end in boatCapPersist(). Both are wrapped: after they run, the
   new TRIPS is diffed against what the server last confirmed, and only the
   difference is sent. If the server refuses, the calls already made are
   undone and TRIPS / BOAT_CAP_OVR go back to the last confirmed state.

   TRIPS cells the server doesn't hold (type charter + charterBookingId,
   boatLockId) are rebuilt from bookings after load; the deployment itself
   (boat on route) is still sent for them, since a charter needs its boat
   deployed.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var BACK = 30, AHEAD = 180;
  var ready = false;              // never diff against a TRIPS the server didn't fill · seeds would be pushed as real
  var synced = {};                // 'date::boat' → {route, capacity}
  var snapTrips = null, snapCap = null;

  function key(d, b){ return d + '::' + b; }
  /* the deployment's NORMAL seats, never the day override (js/ops/49 owns that on the server):
     what the server holds if known, else the boat's own cap */
  function capFor(boatId, date){
    var had = synced[key(date, boatId)];
    if(had && had.capacity > 0) return Math.round(had.capacity);
    var b = (typeof getBoat === 'function') ? getBoat(boatId) : null;
    return b ? Math.round(+b.cap || 0) : 0;
  }
  function trips(){ return (typeof TRIPS !== 'undefined') ? TRIPS : null; }
  function capOvr(){ return (typeof BOAT_CAP_OVR !== 'undefined') ? BOAT_CAP_OVR : null; }

  function desired(){
    var out = {}, T = trips(); if(!T) return out;
    Object.keys(T).forEach(function(d){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      Object.keys(T[d] || {}).forEach(function(b){
        var cell = T[d][b]; if(!cell || !cell.route) return;
        var cap = capFor(b, d); if(!(cap > 0)) return;           // server wants a positive capacity
        out[key(d, b)] = { route: cell.route, capacity: cap, date: d, boat: b,
          type: (cell.type === 'early' || cell.type === 'normal') ? cell.type : null };   // the Early / Normal pick (a client fact); a charter cell is not one
      });
    });
    return out;
  }

  function snapshot(){ snapTrips = O.clone(trips() || {}); snapCap = O.clone(capOvr() || {}); }
  function rollback(){
    if(trips() && snapTrips) O.restoreInPlace(trips(), snapTrips);
    if(capOvr() && snapCap) O.restoreInPlace(capOvr(), snapCap);
    rerender();
  }
  function rerender(){
    if(O.busy()) return;
    var v = O.activeView();
    try{
      if(v === 'operation' && typeof renderOp === 'function') renderOp();
      else if(v === 'booking' && typeof bookingV2Render === 'function') bookingV2Render();
      else if(v === 'boatassign' && typeof renderBoatAssign === 'function') renderBoatAssign();
    }catch(_){}
  }

  /* §opsAnyway · the server refuses 409 and the person decides: a boat with bookings on it is pulled,
     moved or shrunk (legacy's confirm in boatSetRoute / boatRemove), or a boat that is not ready that day
     is deployed. OK resends with the flag; Cancel ends the sync and the screen rolls back. */
  function pulled(e){ return e.message.replace(/\. Send remove_anyway.*$/, '') + '\n\nเปลี่ยน/ถอดเรือลำนี้? — booking เหล่านั้นจะถูกติดธง ⚠ ให้จัดเรือใหม่ (หน้าจัดเรือ + Daily Fleet Log)'; }
  var DEP_RULES = {
    seats_sold: { flag: 'remove_anyway', ask: pulled },
    boat_not_ready: { flag: 'deploy_anyway', ask: function(e){ return e.message.replace(/\. Send deploy_anyway.*$/, '') + '\n\nใส่เรือลำนี้ลงเส้นทางต่อไหม?'; } }
  };
  function postDep(x){
    var b = (typeof getBoat === 'function') ? getBoat(x.boat) : null;
    var body = { boat_id: x.boat, route_id: x.route, service_date: x.date, capacity: x.capacity };
    if(x.sendType) body.trip_type = x.sendType;      // only when the person picked it: otherwise the server keeps the stored type or takes the route name's default
    if(b && +b.totalcap > 0) body.registered_persons = +b.totalcap;
    return O.anyway(function(f){ return O.post('/operations/deployments', Object.assign({}, body, f)); }, DEP_RULES);
  }
  function delDep(d, b){
    return O.anyway(function(f){
      return O.del('/operations/deployments/' + encodeURIComponent(d) + '/' + encodeURIComponent(b) + (f.remove_anyway ? '?remove_anyway=true' : ''));
    }, { seats_sold: DEP_RULES.seats_sold });
  }

  /* un-queued · callers already hold the queue */
  /* §opsBoatMove · calls that must run after this sync deploys a boat and before it removes one
     (Boat Operation "replace boat" moves the bookings A → B: B must be deployed first, and A then
     leaves with no bookings on it). Each entry: {ops: [{label, run, undo}], onFail(err)}. */
  var between = [];
  function addBetween(entry){
    if(!ready){ try{ entry.onFail && entry.onFail(new Error('Boat Operation has not loaded from operation-backend')); }catch(_){} return; }
    between.push(entry); schedule();
  }

  /* 409 route_closed (a land route, or a day the programme is closed; no override, as legacy): the server judges each day on its own, so
     in a bulk form (copy week, templates, ranges, swaps) that repeats the write the closed days are left out and the rest goes through,
     as the server's own range form does. The closed cell goes back to what the server holds, and the server's message is shown. */
  function isClosed(e){ return !!(e && e.status === 409 && e.code === 'route_closed'); }
  function leaveCell(k, d, b){
    var T = trips(), had = synced[k];
    if(!T || !T[d]) return;
    if(had && T[d][b]) T[d][b].route = had.route; else delete T[d][b];
  }

  function syncNow(){
    if(!ready || !O.enabled()) return Promise.resolve(false);
    var want = desired(), ops = [], removes = [], skipped = {}, skippedMsg = [];
    var mid = between.splice(0);
    Object.keys(want).forEach(function(k){
      var w = want[k], had = synced[k];
      // trip_type goes when the person changed it from what the server holds (or picked Early for a new deployment)
      w.sendType = w.type && ((had && had.type && had.type !== w.type) || (!had && w.type === 'early')) ? w.type : null;
      if(had && had.route === w.route && had.capacity === w.capacity && !w.sendType) return;
      ops.push({ label: 'deploy ' + w.boat + ' → ' + w.route + ' on ' + w.date,
        run: function(){
          return postDep(w).catch(function(e){
            if(!isClosed(e)) throw e;
            skipped[k] = true; skippedMsg.push(e.message); leaveCell(k, w.date, w.boat);
            return null;
          });
        },
        undo: function(){ if(skipped[k]) return null; return had ? postDep({ boat: w.boat, date: w.date, route: had.route, capacity: had.capacity, sendType: w.sendType ? had.type : null }) : delDep(w.date, w.boat); } });
    });
    Object.keys(synced).forEach(function(k){
      if(want[k]) return;
      var had = synced[k], p = k.split('::');
      removes.push({ label: 'remove ' + p[1] + ' on ' + p[0],
        run: function(){ return delDep(p[0], p[1]).catch(function(e){ if(e.status === 404) return null; throw e; }); },
        undo: function(){ return postDep({ boat: p[1], date: p[0], route: had.route, capacity: had.capacity }); } });
    });
    mid.forEach(function(m){ ops = ops.concat(m.ops || []); });
    var deployN = ops.length;
    ops = ops.concat(removes);
    if(!ops.length) return Promise.resolve(false);
    return O.runBatch(ops).then(function(){
      var before = synced;
      synced = {}; Object.keys(want).forEach(function(k){
        if(skipped[k]){ if(before[k]) synced[k] = before[k]; return; }
        synced[k] = { route: want[k].route, capacity: want[k].capacity, type: want[k].type || (before[k] && before[k].type) || null };
      });
      snapshot();
      O.wrote('deployments');
      lastResult = { deployed: deployN - Object.keys(skipped).length, skipped: Object.keys(skipped).length };   // §copyWeekCount
      if(skippedMsg.length){
        O.toast({ kind: 'error', title: 'Boat Operation: ' + skippedMsg.length + ' day' + (skippedMsg.length === 1 ? '' : 's') + ' not saved', status: 'HTTP 409', sub: skippedMsg.join(' · '), dur: 12000 });
        rerender();
      }
      return true;
    }, function(err){
      mid.forEach(function(m){ try{ m.onFail && m.onFail(err); }catch(_){} });   // bookings back first, so rollback's redraw shows them
      rollback();
      throw err;
    });
  }
  var lastResult = null;   // §copyWeekCount · what the last sync that wrote anything did: {deployed (saved on the server), skipped (days the server left out)}
  function sync(){ return O.queue(syncNow).catch(function(e){ O.fail('Boat Operation not saved', e); return false; }); }

  var timer = null;
  function schedule(){ if(!ready) return; clearTimeout(timer); timer = setTimeout(sync, 250); }

  function canEdit(){ return typeof window.laCanEditArea !== 'function' || window.laCanEditArea('operations'); }
  function wrap(name, when){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(){
      var ret = orig.apply(this, arguments);
      try{ if(O.enabled() && canEdit() && when(arguments)) schedule(); }catch(_){}
      return ret;
    };
    w.__ops = true; window[name] = w;
  }
  wrap('save', function(a){ return a[0] === 'operations'; });          // save() bare = seed/migration/load · not a user change
  wrap('boatCapPersist', function(){ return true; });
  /* legacy getCellType: a cell is charter, early or normal. Here the Early / Normal answer is the deployment's
     stored trip_type (GET /operations/deployments, set with POST /operations/deployments {trip_type}); the server
     takes the route name's "Early" as the default for a new deployment. Charter still comes from the booking. */
  (function(){
    var orig = window.getCellType;
    if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(op, route){
      if(O.enabled() && op && !op.charterBookingId && (op.type === 'early' || op.type === 'normal')) return op.type;
      return orig.apply(this, arguments);
    };
    w.__ops = true; window.getCellType = w;
  })();

  /* §opsPastDay · Q49 (decided) · server rule (POST/DELETE /operations/deployments): a date before today (Asia/Bangkok)
     is 409 past_date for everyone except an admin correcting history. So in ops mode an admin passes the legacy
     past-day guard (the screen is editable, the server still judges); everyone else stays blocked, with the server's text. */
  (function(){
    var isPast = window.bop2IsPast, guard = window.bop2GuardPast;
    if(typeof isPast !== 'function' || isPast.__ops) return;
    function admin(){ return O.enabled() && typeof window.laIsAdmin === 'function' && window.laIsAdmin(); }
    var wi = function(ds){ return admin() ? false : isPast.apply(this, arguments); };
    wi.__ops = true; window.bop2IsPast = wi;
    if(typeof guard === 'function'){
      var wg = function(ds, silent){
        if(O.enabled() && !admin() && isPast.call(this, ds)){
          if(!silent) alert(ds + ' is in the past: a deployment can\'t change. Past days are closed and reported; ask an admin to correct it');
          return true;
        }
        return guard.apply(this, arguments);
      };
      wg.__ops = true; window.bop2GuardPast = wg;
    }
  })();

  function load(){
    var from = O.shift(O.today(), -BACK), to = O.shift(O.today(), AHEAD);
    return O.get('/operations/deployments', { from: from, to: to }).then(function(j){
      var rows = (j && j.deployments) || [];
      var T = trips(), C = capOvr();
      if(T) Object.keys(T).forEach(function(k){ delete T[k]; });       // seeds / demo cells are not deployments
      if(C) Object.keys(C).forEach(function(k){ delete C[k]; });
      synced = {};
      rows.forEach(function(r){
        if(!T) return;
        (T[r.service_date] = T[r.service_date] || {})[r.boat_id] = { route: r.route_id, type: (r.trip_type === 'early' || r.trip_type === 'normal') ? r.trip_type : 'normal', booked: 0 };
        var b = (typeof getBoat === 'function') ? getBoat(r.boat_id) : null;
        if(C && b && +b.cap !== +r.capacity) C[r.service_date + '::' + r.boat_id] = { cap: r.capacity, reason: 'operation-backend', by: '', at: '' };
        synced[key(r.service_date, r.boat_id)] = { route: r.route_id, capacity: +r.capacity, type: r.trip_type || null };
      });
      ready = true;
      snapshot();
      try{ console.log('[ops] deployments · ' + rows.length + ' for ' + from + ' → ' + to); }catch(_){}
    });
  }

  /* after bookings load · charter cells point at their booking again (the server's deployment
     has no notion of "chartered"; it derives it from the charter booking, so does this) */
  function markCharters(bookings){
    var T = trips(); if(!T) return;
    (bookings || []).forEach(function(bk){
      if(!bk || ['cancelled', 'cancelled_weather', 'rejected'].indexOf(bk.status) >= 0) return;
      (bk.trips || []).forEach(function(t){
        if(t.bookingMode !== 'charter' || !t.charterBoatId) return;
        var days = [t.date];
        try{ if(typeof bkOvnSpanDates === 'function') days = bkOvnSpanDates(t); }catch(_){}
        days.forEach(function(d){
          var cell = T[d] && T[d][t.charterBoatId]; if(!cell) return;
          cell.type = 'charter'; cell.charterBookingId = bk.id;
        });
      });
    });
    snapshot();
  }

  /* §copyWeekCount (Q27, 2026-10-17) · Boat Operation "Copy view -> next week/month" told the person "Copied N assignments" with the
     browser's own count, before anything was sent. A closed day is refused by the server and left out (isClosed), so N could be too high.
     In ops mode the alert now waits for the sync and reports the server-saved count: N less the days the server left out. If the sync
     failed, the red toast already says so and the success alert is not shown. Legacy mode: untouched. */
  (function(){
    var orig = window.bop2CopyWeekToNext;
    if(typeof orig !== 'function' || orig.__opsCopy) return;
    var w = function(){
      if(!O.enabled() || !ready) return orig.apply(this, arguments);
      var realAlert = window.alert, msg = null;
      window.alert = function(m){ msg = String(m); };
      var ret;
      try{ ret = orig.apply(this, arguments); } finally { window.alert = realAlert; }
      if(msg === null) return ret;                       // cancelled at the confirm
      var m = /^Copied (d+) assignments/.exec(msg), copied = m ? +m[1] : 0;
      clearTimeout(timer); lastResult = null;
      sync().then(function(){
        var r = lastResult;
        if(!r){ if(copied === 0) realAlert.call(window, msg); return; }   // nothing sent: a failed sync already toasted
        var saved = Math.max(0, copied - r.skipped);
        realAlert.call(window, r.skipped
          ? msg.replace(/^Copied d+ assignments/, 'Copied ' + saved + ' assignments') + ' Not saved ' + r.skipped + ' (closed day).'
          : msg);
      });
      return ret;
    };
    w.__opsCopy = true; window.bop2CopyWeekToNext = w;
  })();

  /* §opsAdopt (w5-a) · the server wrote these deployments itself (POST /operations/deployments/swap, POST /operations/boat-replacements):
     take its answer into TRIPS and into what is "confirmed", so the next sync diffs against it and sends nothing for them.
     changes: [{date, boat, remove: true} | {date, boat, route, capacity, type}] */
  function adopt(changes){
    var T = trips(); if(!T) return;
    (changes || []).forEach(function(c){
      var k = key(c.date, c.boat);
      if(c.remove){
        if(T[c.date]){ delete T[c.date][c.boat]; if(!Object.keys(T[c.date]).length) delete T[c.date]; }
        delete synced[k];
      } else {
        (T[c.date] = T[c.date] || {})[c.boat] = { route: c.route, type: (c.type === 'early' || c.type === 'normal') ? c.type : 'normal', booked: 0 };
        synced[k] = { route: c.route, capacity: +c.capacity || capFor(c.boat, c.date), type: c.type || null };
      }
    });
    snapshot();
  }

  /* ── days outside the loaded window (-30/+180): read when a screen shows them, added to TRIPS beside what is there ──
     Boat Operation, job sheets and park tickets looked empty past the window. One read per month asked for, never twice;
     the screen is drawn again when it lands. A cell already in TRIPS (a local edit not yet sent) is kept. */
  var farDone = {}, farBusy = {};
  function monthOf(d){ return String(d || '').slice(0, 7); }
  function inWindow(d){ return d >= O.shift(O.today(), -BACK) && d <= O.shift(O.today(), AHEAD); }
  function ensureDays(dates){
    if(!ready || !O.enabled()) return null;
    var months = {};
    (dates || []).forEach(function(d){ if(/^\d{4}-\d{2}-\d{2}$/.test(d || '') && !inWindow(d) && !farDone[monthOf(d)] && !farBusy[monthOf(d)]) months[monthOf(d)] = 1; });
    var list = Object.keys(months);
    if(!list.length) return null;
    return Promise.all(list.map(function(m){
      farBusy[m] = 1;
      var from = m + '-01', to = m + '-' + String(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate()).padStart(2, '0');
      return O.get('/operations/deployments', { from: from, to: to }).then(function(j){
        var T = trips();
        ((j && j.deployments) || []).forEach(function(r){
          if(!T) return;
          if(T[r.service_date] && T[r.service_date][r.boat_id]) return;
          (T[r.service_date] = T[r.service_date] || {})[r.boat_id] = { route: r.route_id, type: (r.trip_type === 'early' || r.trip_type === 'normal') ? r.trip_type : 'normal', booked: 0 };
          synced[key(r.service_date, r.boat_id)] = { route: r.route_id, capacity: +r.capacity, type: r.trip_type || null };
        });
        farDone[m] = 1;
      }).catch(function(e){ try{ console.warn('[ops] deployments ' + m + ' · ' + (e && e.message)); }catch(_){} })
        .then(function(){ delete farBusy[m]; });
    })).then(function(){ snapshot(); rerender(); });
  }
  // Boat Operation shows a week or a month and a selected day: ask for those; the other screens call laOps.deployments.ensureDays(...)
  [['bop2GetDates', function(out){ return out; }]].forEach(function(p){
    var orig = window[p[0]]; if(typeof orig !== 'function' || orig.__opsFar) return;
    var w = function(){ var out = orig.apply(this, arguments); try{ if(Array.isArray(out) && out.length) ensureDays([out[0], out[out.length - 1]]); }catch(_){} return out; };
    w.__opsFar = true; window[p[0]] = w;
  });
  ['bop2SelectCell', 'bop2SelectDate'].forEach(function(n){
    var orig = window[n]; if(typeof orig !== 'function' || orig.__opsFar) return;
    var w = function(a, b){ try{ ensureDays([n === 'bop2SelectCell' ? b : a]); }catch(_){} return orig.apply(this, arguments); };
    w.__opsFar = true; window[n] = w;
  });

  // the pier screens that show one day (park tickets, job cards, check-in) keep it in _poDate
  ['renderPierPark', 'renderPierJob', 'renderPierCheckin'].forEach(function(n){
    var orig = window[n]; if(typeof orig !== 'function' || orig.__opsFar) return;
    var w = function(){ try{ if(typeof _poDate === 'string') ensureDays([_poDate]); }catch(_){} return orig.apply(this, arguments); };
    w.__opsFar = true; window[n] = w;
  });

  O.deployments = { adopt: adopt, load: load, sync: sync, syncNow: syncNow, markCharters: markCharters, addBetween: addBetween, ensureDays: ensureDays, isReady: function(){ return ready; } };
})();
