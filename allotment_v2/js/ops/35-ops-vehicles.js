/* ════════════════════════════════════════════════════════════════════════
   §opsVehicles (2026-10-13) · Transfer Fleet (renderVehicles) writes on operation-backend
   ────────────────────────────────────────────────────────────────────────
   Reads are 35-ops-van-jobs.js (GET /operations/van-days → SB_VEHICLES). This file writes:

   vehFormSave (new / edit) · vehAdd (opens the form) → POST /operations/vans · PATCH /operations/vans/{id}
   vehSetField / vehSetColor / vehSetColorLive          → PATCH  /operations/vans/{id}
   vehDelete                                            → DELETE /operations/vans/{id}   (409 van_in_use: set it inactive)
   vehDaySetRoute / vehDayToggleRoute / vehDayClearRoutes / vehDaySetZone / vehDaySetStatus / vehStatusCycleDay
                                                        → PUT    /operations/van-days/{date}/{van}
   vehStatusAdd / vehStatusSet / vehStatusDel           → POST|PATCH|DELETE /operations/vans/{id}/status-ranges[/{range}]
   vehZoneAdd / vehZoneSet / vehZoneDel                 → POST|PATCH|DELETE /operations/vans/{id}/zone-ranges[/{range}]
   renderVehicles                                       → loads the vans for the screen's dates first

   Server first: nothing changes on screen until the server has answered; a refusal is a red toast
   and the screen is redrawn from the unchanged local state. The van id is the server's (vehNN).
   Not on the server (still local): a van's per-day cost (vanCostSet) and its history list `log`
   (the server keeps its own at GET /operations/vans/{id}/log).
   Legacy mode (!O.enabled()): every wrapped function delegates to the original.
   Classic script · loads right after 35-ops-van-jobs.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var V = O.vanJobs; if(!V) return;

  var DEBOUNCE_MS = 700;
  var originals = {};
  var WRAPPED = ['renderVehicles', 'vehAdd', 'vehFormSave', 'vehSetField', 'vehDelete', 'vehSetColor', 'vehSetColorLive',
    'vehDaySetZone', 'vehDaySetRoute', 'vehDayToggleRoute', 'vehDayClearRoutes', 'vehDaySetStatus', 'vehStatusCycleDay',
    'vehStatusAdd', 'vehStatusSet', 'vehStatusDel', 'vehZoneAdd', 'vehZoneSet', 'vehZoneDel'];
  WRAPPED.forEach(function(n){ if(typeof window[n] === 'function') originals[n] = window[n]; });
  function wrap(name, opsFn){
    var orig = originals[name];
    window[name] = function(){
      if(!O.enabled()) return orig ? orig.apply(this, arguments) : undefined;
      return opsFn.apply(this, arguments);
    };
  }

  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }
  function failCode(e){ return (e && (e.code || e.status)) || 'error'; }
  function guard(){ return typeof window.laGuardEdit !== 'function' || !!window.laGuardEdit('operations'); }
  function fn(name){ return typeof window[name] === 'function' ? window[name] : null; }
  function call(name){ var f = fn(name); return f ? f.apply(window, Array.prototype.slice.call(arguments, 1)) : undefined; }
  function list(){ try{ return typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : null; }catch(_){ return null; } }
  function formState(){ try{ return typeof _vehForm !== 'undefined' ? _vehForm : null; }catch(_){ return null; } }
  function vehOf(id){ var l = list(); if(!l) return null; for(var i = 0; i < l.length; i++){ if(l[i] && l[i].id === id) return l[i]; } return null; }
  function elById(id){ return typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null; }
  function rerender(){ if(fn('renderVehicles') && elById('vehicles-host')) call('renderVehicles'); }
  function redrawLists(){
    if(fn('renderVanJobs') && elById('vanjobs-host')) call('renderVanJobs');
    rerender();
  }

  var timers = {};
  function later(key, f){
    if(timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(function(){ delete timers[key]; f(); }, DEBOUNCE_MS);
  }
  function send(method, path, body){
    return O.queue(function(){ return O.call(method, path, body); });
  }

  /* ════ A van → SB_VEHICLES, in place (the list is never re-bound) ════ */
  var KEEP = ['dayRoute', 'dayStatus', 'dayZone', 'statusRanges', 'zoneOverrides'];
  function applyVan(van){
    var l = list(); if(!l || !van) return null;
    var old = vehOf(van.id);
    var fresh = V.vehicleOf(van, old);
    if(!old){ l.push(fresh); return fresh; }
    KEEP.forEach(function(k){ fresh[k] = old[k]; });
    if(old.costPerDay !== undefined) fresh.costPerDay = old.costPerDay;
    Object.keys(old).forEach(function(k){ delete old[k]; });
    Object.keys(fresh).forEach(function(k){ old[k] = fresh[k]; });
    return old;
  }
  function removeVan(id){
    var l = list(); if(!l) return;
    for(var i = l.length - 1; i >= 0; i--){ if(l[i] && l[i].id === id) l.splice(i, 1); }
    V.dropVan(id);
  }

  /* ════ Load the vans behind the screen ════ */
  var MODALS = ['veh-form-modal', 'veh-status-modal', 'veh-zone-modal', 'veh-day-modal', 'veh-color-pop'];
  function screenDates(){
    var out = [];
    function add(d){ if(d && /^\d{4}-\d{2}-\d{2}$/.test(d) && out.indexOf(d) < 0) out.push(d); }
    try{ if(typeof _vehDate !== 'undefined') add(_vehDate); }catch(_){}
    try{ if(typeof _vehMonth !== 'undefined') add(_vehMonth + '-15'); }catch(_){}
    try{ if(typeof _vehCalMonth !== 'undefined') add(_vehCalMonth + '-15'); }catch(_){}
    if(!out.length) add(O.today());
    return out;
  }
  wrap('renderVehicles', function(){
    var r = originals.renderVehicles ? originals.renderVehicles.apply(this, arguments) : undefined;
    var dates = screenDates();
    var loaded = false;
    dates.reduce(function(p, d){
      return p.then(function(){ return V.loadVans(d); }).then(function(j){ if(j) loaded = true; });
    }, Promise.resolve()).then(function(){
      if(!loaded || (O.busy && O.busy())) return;
      for(var i = 0; i < MODALS.length; i++){ if(elById(MODALS[i])) return; }
      if(O.activeView && O.activeView() && O.activeView() !== 'vehicles') return;
      if(originals.renderVehicles) originals.renderVehicles();
    }).catch(function(e){ console.warn('[ops] vans did not load · ' + (e && e.message)); });
    return r;
  });

  /* ════ The catalogue: add, edit, delete ════ */
  function vanBody(d){
    return {
      name: String(d.name || '').trim(), plate: d.plate || null, type: d.type || 'van', capacity: Math.max(1, parseInt(d.capacity, 10) || 1),
      ownership: d.ownership || 'own', partner_name: d.ownership === 'own' ? null : (d.partnerName || null),
      zone_base: d.zoneBase || null, driver: d.driver || null, driver_phone: d.driverPhone || null,
      active: d.active !== false, color: d.color || null
    };
  }
  var saving = false;
  wrap('vehAdd', function(){
    /* the server needs a name: legacy's blank row is the form here */
    if(!guard()) return;
    call('vehFormOpen', null);
  });
  wrap('vehFormSave', function(){
    var d = formState(); if(!d) return;
    if(!(d.name || '').trim()){ alert('Please enter a vehicle name'); return; }
    if(!guard() || saving) return;
    saving = true;
    var id = d.id, body = vanBody(d);
    send(id ? 'PATCH' : 'POST', id ? '/operations/vans/' + enc(id) : '/operations/vans', body).then(function(van){
      saving = false;
      applyVan(van);
      call('vehFormClose');
      rerender();
    }, function(e){
      saving = false;
      O.fail('Vehicle not saved · ' + failCode(e), e);
    });
  });

  var FIELDS = { name: 'name', plate: 'plate', type: 'type', capacity: 'capacity', ownership: 'ownership', partnerName: 'partner_name',
    zoneBase: 'zone_base', driver: 'driver', driverPhone: 'driver_phone', active: 'active', note: 'note', color: 'color' };
  var REDRAW_FIELDS = { ownership: 1, active: 1, zoneBase: 1 };
  wrap('vehSetField', function(id, field, val){
    if(!guard()){ rerender(); return; }
    var v = vehOf(id); if(!v) return;
    var key = FIELDS[field];
    if(!key){ O.toast({ kind: 'error', title: 'Vehicle not saved', status: 'REFUSED', sub: 'Unknown field ' + field, dur: 7000 }); rerender(); return; }
    var value = val;
    if(field === 'active') value = !!val;
    else if(field === 'capacity') value = Math.max(1, parseInt(val, 10) || 1);
    else if(typeof val === 'string') value = val.trim() || null;
    var go = function(){
      send('PATCH', '/operations/vans/' + enc(id), (function(b){ b[key] = value; return b; })({})).then(function(van){
        applyVan(van);
        if(REDRAW_FIELDS[field]) rerender();
      }, function(e){ O.fail('Vehicle not saved · ' + failCode(e), e); rerender(); });
    };
    if(field === 'active' || field === 'capacity' || field === 'ownership' || field === 'zoneBase' || field === 'type') go();
    else later('veh|' + id + '|' + field, go);
  });
  wrap('vehDelete', function(id){
    if(!guard()) return;
    var v = vehOf(id); if(!v) return;
    if(!confirm('Delete vehicle "' + (v.name || id) + '"?')) return;
    send('DELETE', '/operations/vans/' + enc(id)).then(function(){
      removeVan(id);
      rerender();
    }, function(e){ O.fail('Vehicle not deleted · ' + failCode(e), e); });
  });
  function putColor(vid, hex, close){
    send('PATCH', '/operations/vans/' + enc(vid), { color: hex || null }).then(function(van){
      applyVan(van);
      if(close) call('vehColorClose');
      redrawLists();
    }, function(e){ O.fail('Vehicle colour not saved · ' + failCode(e), e); if(close) call('vehColorClose'); });
  }
  wrap('vehSetColor', function(vid, hex){
    if(!vehOf(vid)) return;
    if(timers['color|' + vid]){ clearTimeout(timers['color|' + vid]); delete timers['color|' + vid]; }
    putColor(vid, hex, true);
  });
  wrap('vehSetColorLive', function(vid, hex){
    if(!vehOf(vid) || !/^#[0-9a-fA-F]{6}$/.test(hex || '')) return;
    later('color|' + vid, function(){ putColor(vid, String(hex).toLowerCase(), false); });
  });

  /* ════ A van's day: routes, status, zone ════ */
  function applyCell(v, c){
    if(!v || !c) return;
    var date = c.service_date;
    v.dayRoute = v.dayRoute || {}; v.dayStatus = v.dayStatus || {}; v.dayZone = v.dayZone || {};
    if(c.route_ids && c.route_ids.length) v.dayRoute[date] = c.route_ids.slice(); else delete v.dayRoute[date];
    if(c.status) v.dayStatus[date] = c.status; else delete v.dayStatus[date];
    if(c.zone) v.dayZone[date] = c.zone; else delete v.dayZone[date];
    V.putCell(c);
  }
  function putDay(id, date, body, title, after){
    if(!guard()) return;
    var v = vehOf(id); if(!v || !date) return;
    send('PUT', '/operations/van-days/' + enc(date) + '/' + enc(id), body).then(function(c){
      applyCell(vehOf(id), c);
      if(after) after();
      else { call('_vehDayRefresh', id, date); }
    }, function(e){ O.fail(title + ' · ' + failCode(e), e); call('_vehDayRefresh', id, date); });
  }
  function routesAfter(id, date){ return function(){ call('_vehDayRefresh', id, date); call('_vehSumRefresh'); }; }
  wrap('vehDaySetZone', function(id, date, z){ putDay(id, date, { zone: z || null }, 'Van zone not saved'); });
  wrap('vehDaySetRoute', function(id, date, rid){ putDay(id, date, { route_ids: rid ? [rid] : [] }, 'Van route not saved', routesAfter(id, date)); });
  wrap('vehDayToggleRoute', function(id, date, rid){
    var v = vehOf(id); if(!v || !rid) return;
    var arr = (fn('_vehDayRoutes') ? call('_vehDayRoutes', v, date) : []).slice();
    var i = arr.indexOf(rid);
    if(i >= 0) arr.splice(i, 1); else arr.push(rid);
    putDay(id, date, { route_ids: arr }, 'Van route not saved', routesAfter(id, date));
  });
  wrap('vehDayClearRoutes', function(id, date){ putDay(id, date, { route_ids: [] }, 'Van route not saved', routesAfter(id, date)); });
  wrap('vehDaySetStatus', function(id, date, s){ putDay(id, date, { status: s || null }, 'Van status not saved'); });
  wrap('vehStatusCycleDay', function(id, date){
    var v = vehOf(id); if(!v) return;
    var order = ['', 'available', 'maintenance', 'off'];
    var cur = (v.dayStatus && v.dayStatus[date]) || '';
    var nx = order[(order.indexOf(cur) + 1) % order.length];
    putDay(id, date, { status: nx || null }, 'Van status not saved', function(){ call('renderVehicles'); });
  });

  /* ════ Date ranges: status (พร้อม/ซ่อม/หยุด) and temporary zone ════ */
  var KINDS = {
    status: {
      path: 'status-ranges', mine: 'statusRanges', open: 'vehStatusOpen', title: 'Van status range',
      toLocal: function(r){ return { id: r.id, s: r.status, from: r.from_date, to: r.to_date || '', note: r.note || '' }; },
      cols: { s: 'status', from: 'from_date', to: 'to_date', note: 'note' }
    },
    zone: {
      path: 'zone-ranges', mine: 'zoneOverrides', open: 'vehZoneOpen', title: 'Van zone range',
      toLocal: function(r){ return { id: r.id, zone: r.zone, from: r.from_date || '', to: r.to_date || '' }; },
      cols: { zone: 'zone', from: 'from_date', to: 'to_date' }
    }
  };
  function addRange(kind, id, body){
    if(!guard()) return;
    var v = vehOf(id), K = KINDS[kind]; if(!v) return;
    send('POST', '/operations/vans/' + enc(id) + '/' + K.path, body).then(function(r){
      var mine = vehOf(id); if(!mine) return;
      (mine[K.mine] = mine[K.mine] || []).push(K.toLocal(r));
      V.putRange(kind, r);
      call(K.open, id);
    }, function(e){ O.fail(K.title + ' not added · ' + failCode(e), e); call(K.open, id); });
  }
  function setRange(kind, id, i, field, val){
    if(!guard()) return;
    var v = vehOf(id), K = KINDS[kind]; if(!v) return;
    var cur = (v[K.mine] || [])[i], col = K.cols[field];
    if(!cur || !col) return;
    if(!cur.id){ O.toast({ kind: 'error', title: K.title + ' not saved', status: 'REFUSED', sub: 'This range is not on the server · reload the page', dur: 7000 }); return; }
    var body = {}; body[col] = (typeof val === 'string' && val.trim() === '') ? null : val;
    var go = function(){
      send('PATCH', '/operations/vans/' + enc(id) + '/' + K.path + '/' + enc(cur.id), body).then(function(r){
        var mine = vehOf(id); if(!mine) return;
        var row = (mine[K.mine] || []).filter(function(x){ return x.id === r.id; })[0];
        if(row) Object.assign(row, K.toLocal(r));
        V.putRange(kind, r);
      }, function(e){ O.fail(K.title + ' not saved · ' + failCode(e), e); call(K.open, id); });
    };
    if(field === 'note') later(kind + '|' + id + '|' + cur.id + '|' + field, go); else go();
  }
  function delRange(kind, id, i){
    if(!guard()) return;
    var v = vehOf(id), K = KINDS[kind]; if(!v) return;
    var cur = (v[K.mine] || [])[i]; if(!cur) return;
    if(!cur.id){ v[K.mine].splice(i, 1); call(K.open, id); return; }
    send('DELETE', '/operations/vans/' + enc(id) + '/' + K.path + '/' + enc(cur.id)).then(function(){
      var mine = vehOf(id);
      if(mine) mine[K.mine] = (mine[K.mine] || []).filter(function(x){ return x.id !== cur.id; });
      V.dropRange(kind, cur.id);
      call(K.open, id);
    }, function(e){ O.fail(K.title + ' not deleted · ' + failCode(e), e); call(K.open, id); });
  }
  wrap('vehStatusAdd', function(id){
    var t = fn('bookingV2LocalYMD') ? call('bookingV2LocalYMD', new Date()) : O.today();
    addRange('status', id, { status: 'maintenance', from_date: t, to_date: t, note: null });
  });
  wrap('vehStatusSet', function(id, i, f, val){ setRange('status', id, i, f, val); });
  wrap('vehStatusDel', function(id, i){ delRange('status', id, i); });
  wrap('vehZoneAdd', function(id){
    var v = vehOf(id); if(!v) return;
    addRange('zone', id, { zone: v.zoneBase === 'PK' ? 'KL' : 'PK', from_date: null, to_date: null });
  });
  wrap('vehZoneSet', function(id, i, f, val){ setRange('zone', id, i, f, val); });
  wrap('vehZoneDel', function(id, i){ delRange('zone', id, i); });

  O.vehicles = { applyVan: applyVan, applyCell: applyCell };
})();
