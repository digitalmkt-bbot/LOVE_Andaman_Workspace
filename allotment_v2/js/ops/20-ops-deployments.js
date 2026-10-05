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
  function capFor(boatId, date){
    var c = 0;
    try{ c = (typeof boatCapFor === 'function') ? boatCapFor(boatId, date) : 0; }catch(_){}
    if(!(c > 0)){ var b = (typeof getBoat === 'function') ? getBoat(boatId) : null; c = b ? (+b.cap || 0) : 0; }
    return Math.round(c);
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
        out[key(d, b)] = { route: cell.route, capacity: cap, date: d, boat: b };
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

  function postDep(x){
    var b = (typeof getBoat === 'function') ? getBoat(x.boat) : null;
    var body = { boat_id: x.boat, route_id: x.route, service_date: x.date, capacity: x.capacity };
    if(b && +b.totalcap > 0) body.registered_persons = +b.totalcap;
    return O.post('/operations/deployments', body);
  }
  function delDep(d, b){ return O.del('/operations/deployments/' + encodeURIComponent(d) + '/' + encodeURIComponent(b)); }

  /* un-queued · callers already hold the queue */
  function syncNow(){
    if(!ready || !O.enabled()) return Promise.resolve(false);
    var want = desired(), ops = [];
    Object.keys(want).forEach(function(k){
      var w = want[k], had = synced[k];
      if(had && had.route === w.route && had.capacity === w.capacity) return;
      ops.push({ label: 'deploy ' + w.boat + ' → ' + w.route + ' on ' + w.date,
        run: function(){ return postDep(w); },
        undo: function(){ return had ? postDep({ boat: w.boat, date: w.date, route: had.route, capacity: had.capacity }) : delDep(w.date, w.boat); } });
    });
    Object.keys(synced).forEach(function(k){
      if(want[k]) return;
      var had = synced[k], p = k.split('::');
      ops.push({ label: 'remove ' + p[1] + ' on ' + p[0],
        run: function(){ return delDep(p[0], p[1]).catch(function(e){ if(e.status === 404) return null; throw e; }); },
        undo: function(){ return postDep({ boat: p[1], date: p[0], route: had.route, capacity: had.capacity }); } });
    });
    if(!ops.length) return Promise.resolve(false);
    return O.runBatch(ops).then(function(){
      synced = {}; Object.keys(want).forEach(function(k){ synced[k] = { route: want[k].route, capacity: want[k].capacity }; });
      snapshot();
      O.wrote('deployments');
      return true;
    }, function(err){
      rollback();
      throw err;
    });
  }
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
        (T[r.service_date] = T[r.service_date] || {})[r.boat_id] = { route: r.route_id, type: 'normal', booked: 0 };
        var b = (typeof getBoat === 'function') ? getBoat(r.boat_id) : null;
        if(C && b && +b.cap !== +r.capacity) C[r.service_date + '::' + r.boat_id] = { cap: r.capacity, reason: 'operation-backend', by: '', at: '' };
        synced[key(r.service_date, r.boat_id)] = { route: r.route_id, capacity: +r.capacity };
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

  O.deployments = { load: load, sync: sync, syncNow: syncNow, markCharters: markCharters, isReady: function(){ return ready; } };
})();
