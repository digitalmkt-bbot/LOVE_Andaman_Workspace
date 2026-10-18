/* ══════════════════════════════════════════════════════════════════════════
   §opsCapOverrides (2026-10-13) · a boat's seats for ONE day ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   GET    /v1/boats/{id}/capacity-overrides?from=&to=   list (overrideDay rows)
   PUT    /v1/boats/{id}/capacity-overrides/{date}      {capacity, reason}
   DELETE /v1/boats/{id}/capacity-overrides/{date}      remove (404 = already gone)

   Legacy kept BOAT_CAP_OVR['date::boat'] in localStorage and (js/ops/20) faked
   it through the deployment's capacity. Now the server owns it: the licence
   ceiling, "same as normal removes it", reason required, past days frozen and
   the act-capunlock permission are all the server's answer (400/403/409), shown
   as the server's message. BOAT_CAP_OVR stays only as the read cache that
   boatCapFor() reads; it is filled from the server and changed only after the
   server accepted the write.

   Wrapped legacy globals: boatCapSet, _bcapSave, _bcapClear (modal buttons).
   The modal itself (boatCapModalOpen) is unchanged.
   Load: chained after laOps.deployments.load() (boot calls that one).
   Classic script · loads after 37-ops-boat-assign.js, before 90-ops-boot.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var BACK = 14, AHEAD = 200;
  var originals = {};
  ['boatCapSet', '_bcapSave', '_bcapClear'].forEach(function(n){ if(typeof window[n] === 'function') originals[n] = window[n]; });
  function wrap(name, opsFn){
    var orig = originals[name];
    window[name] = function(){
      if(!O.enabled()) return orig ? orig.apply(this, arguments) : undefined;
      return opsFn.apply(this, arguments);
    };
  }

  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }
  function key(boatId, date){ return String(date || '') + '::' + String(boatId || ''); }
  function cache(){ return (typeof BOAT_CAP_OVR !== 'undefined') ? BOAT_CAP_OVR : null; }
  function path(boatId, date){ return '/v1/boats/' + enc(boatId) + '/capacity-overrides' + (date ? '/' + enc(date) : ''); }

  /* put one server day into the read cache: an override shows, a plain day does not */
  function applyDay(day){
    var C = cache(); if(!C || !day) return;
    var k = key(day.boat_id, day.service_date);
    if(day.overridden) C[k] = { cap: day.capacity, reason: day.reason || '', by: day.set_by || '', at: day.set_at || '', srv: 1, normal: day.normal, ceiling: day.ceiling };   // w5c: the server's normal / ceiling too (82-ops-w5c-boats.js boatCapInfo)
    else delete C[k];
  }
  function forget(boatId, date){ var C = cache(); if(C) delete C[key(boatId, date)]; }

  function put(boatId, date, capacity, reason){
    var body = { capacity: Math.round(+capacity) };
    var r = reason == null ? '' : String(reason).trim();
    if(r) body.reason = r;
    return O.queue(function(){ return O.call('PUT', path(boatId, date), body); }).then(function(day){
      applyDay(day); O.wrote('capacity-override'); return day;
    });
  }
  function remove(boatId, date){
    return O.queue(function(){
      return O.call('DELETE', path(boatId, date)).catch(function(e){ if(e && e.status === 404) return null; throw e; });
    }).then(function(){ forget(boatId, date); O.wrote('capacity-override'); return true; });
  }

  /* GET every boat that is deployed in the window; replaces the server-sourced cache entries */
  function boatIds(){
    var ids = {}, T = (typeof TRIPS !== 'undefined') ? TRIPS : null;
    if(T) Object.keys(T).forEach(function(d){ Object.keys(T[d] || {}).forEach(function(b){ ids[b] = 1; }); });
    return Object.keys(ids);
  }
  function load(){
    var from = O.shift(O.today(), -BACK), to = O.shift(O.today(), AHEAD);
    var C = cache();
    return Promise.all(boatIds().map(function(id){
      return O.get(path(id), { from: from, to: to }).then(function(j){ return (j && j.overrides) || []; });
    })).then(function(lists){
      if(C) Object.keys(C).forEach(function(k){ if(C[k] && C[k].srv) delete C[k]; });
      var n = 0;
      lists.forEach(function(rows){ rows.forEach(function(d){ applyDay(d); if(d.overridden) n++; }); });
      try{ console.log('[ops] capacity overrides · ' + n + ' for ' + from + ' -> ' + to); }catch(_){}
      return n;
    });
  }

  function rerender(){
    if(O.busy && O.busy()) return;
    var v = O.activeView();
    try{
      if(v === 'operation' && typeof renderOp === 'function') renderOp();
      else if(v === 'booking' && typeof bookingV2Render === 'function') bookingV2Render();
      else if(v === 'boatassign' && typeof renderBoatAssign === 'function') renderBoatAssign();
    }catch(_){}
  }
  function finish(){
    if(typeof boatCapModalClose === 'function') boatCapModalClose();
    var f = window._bcapAfter; window._bcapAfter = null;
    if(typeof f === 'function'){ try{ f(); }catch(_){} }
  }

  /* boatCapSet(boat, date, cap|null, reason) · null clears. Resolves true, or false after a toast */
  wrap('boatCapSet', function(boatId, date, cap, reason){
    var p = (cap == null || cap === '') ? remove(boatId, date) : put(boatId, date, cap, reason);
    return p.then(function(){ return true; }, function(e){ O.fail('Boat seats not saved', e); return false; });
  });

  /* modal Save · the server decides everything (licence, same-as-normal, reason, permission) */
  wrap('_bcapSave', function(boatId, date){
    var el = document.getElementById('bcap-val'), r = document.getElementById('bcap-reason');
    var v = el ? parseInt(el.value, 10) : NaN;
    if(isNaN(v)){ alert('Enter the number of seats first'); return null; }
    return put(boatId, date, v, r ? r.value : '').then(function(){ finish(); rerender(); }, function(e){
      O.fail('Boat seats not saved', e);        // modal stays open so the reason / number can be fixed
    });
  });
  wrap('_bcapClear', function(boatId, date){
    return remove(boatId, date).then(function(){ finish(); rerender(); }, function(e){ O.fail('Boat seats not cleared', e); });
  });

  /* boot calls deployments.load(); the overrides ride on it so TRIPS names the boats first */
  if(O.deployments && typeof O.deployments.load === 'function' && !O.deployments.load.__cap){
    var baseLoad = O.deployments.load;
    // w5-a: CS's embed token may not read /v1/boats/{id}/capacity-overrides: the deployments still load, the day overrides are left out
    var chained = function(){ return baseLoad.apply(this, arguments).then(function(r){ if(window.__laEmbedToken) return r; return load().then(function(){ return r; }); }); };
    chained.__cap = true;
    O.deployments.load = chained;
  }

  /* a boat assign that raised the day (raise_capacity in 37) made an override on the server */
  var reloadTimer = null;
  if(O.onWrite) O.onWrite(function(kind){
    if(kind !== 'trip-boat' || !O.enabled()) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(function(){ load().then(rerender, function(){}); }, 400);
  });

  O.capOverrides = { load: load, put: put, remove: remove, applyDay: applyDay };
})();
