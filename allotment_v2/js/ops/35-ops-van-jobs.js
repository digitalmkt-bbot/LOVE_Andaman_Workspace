/* ════════════════════════════════════════════════════════════════════════
   §opsVanJobs (2026-10-12) · ใบงานรถ (Van Jobs) + เช็คอินรถ (Van Check-in) on operation-backend
   ────────────────────────────────────────────────────────────────────────
   Loads (each screen's date, on render · at most once per 5 s per date):
   GET  /operations/van-days?from=&to=        → SB_VEHICLES (vans, day routes/status/zone, ranges)
                                                + VANJOB_DRIVER (driver / phone / plate of the day)
   GET  /operations/van-groups (34-ops-vans)  → the day's groups, so a stop finds its group
   GET  /operations/van-stops?service_date=   → VAN_STOPS for that date
   GET  /operations/van-jobs?date=            → VANJOB_SENT for that date
   GET  /operations/pickup-names-th           → VANJOB_PICKUP_TH
   booking.jobNote (from GET /v1/bookings)    → VANJOB_SREQ

   Writes (server first: local state changes from the server's answer; typing is debounced):
   vanJobsSetDriver / vanJobsResetDriver → PUT    /operations/van-days/{date}/{van}
   vanJobsToggleSent                     → PUT|DELETE /operations/van-jobs/{date}/{key}/sent
   vanJobsSetSreq / vanJobsResetSreq     → PATCH  /v1/bookings/{id} {job_note} (versioned)
   vanJobsSetPickupTh                    → PUT    /operations/pickup-names-th
   vsSave (new / edit stop)              → POST   /operations/van-stops · PATCH /operations/van-stops/{id}
                                           409 van_over_capacity → ask, resend with seats_anyway
   vsDel                                 → DELETE /operations/van-stops/{id}
   vsCheck                               → PUT|DELETE /operations/van-stops/{id}/check-in

   Not on the server, so still local: the driver-arrived stamp (vck_arrive), sheet highlights and
   the sheet template. The Transfer Fleet page's own edits (vans, day routes, ranges) are written by
   35-ops-vehicles.js, which loads right after this file and uses this file's loaders via O.vanJobs.

   Legacy job key "van~route[~group]" ⇄ server key (group id, or "van~route" for a return-only van).
   Legacy mode (!O.enabled()): every wrapped function delegates to the original.
   Classic script · loads after 34-ops-vans.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var DEBOUNCE_MS = 700;
  var originals = {};
  var WRAPPED = ['renderVanJobs', 'renderVanCheckin', 'bookingV2OpsVansDay', 'vanJobsGetPickupTh',
    'vanJobsSetDriver', 'vanJobsResetDriver', 'vanJobsToggleSent', 'vanJobsSetSreq', 'vanJobsResetSreq',
    'vanJobsSetPickupTh', 'vckArrWait', 'vsSave', 'vsDel', 'vsSetVan', 'vsCheck', 'vckArrAll', 'vckArrSave', 'vckArrToggle'];
  WRAPPED.forEach(function(n){ if(typeof window[n] === 'function') originals[n] = window[n]; });
  function wrap(name, opsFn){
    var orig = originals[name];
    window[name] = function(){
      if(!O.enabled()) return orig ? orig.apply(this, arguments) : undefined;
      return opsFn.apply(this, arguments);
    };
  }

  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }
  function str(x){ return x == null ? '' : String(x); }
  function canEdit(){ return typeof window.laCanEditArea !== 'function' || window.laCanEditArea('operations'); }
  function failCode(e){ return (e && (e.code || e.status)) || 'error'; }
  function refuse(title, sub){ O.toast({ kind: 'error', title: title, status: 'REFUSED', sub: sub || '', dur: 7000 }); return null; }

  /* the legacy stores are top-level `let`s in 08-app.js · changed in place, never re-bound */
  function store(name){
    try{
      switch(name){
        case 'SB_VEHICLES': return typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : null;
        case 'VAN_STOPS': return typeof VAN_STOPS !== 'undefined' ? VAN_STOPS : null;
        case 'VANJOB_DRIVER': return typeof VANJOB_DRIVER !== 'undefined' ? VANJOB_DRIVER : null;
        case 'VANJOB_SENT': return typeof VANJOB_SENT !== 'undefined' ? VANJOB_SENT : null;
        case 'VANJOB_SREQ': return typeof VANJOB_SREQ !== 'undefined' ? VANJOB_SREQ : null;
        case 'VANJOB_PICKUP_TH': return typeof VANJOB_PICKUP_TH !== 'undefined' ? VANJOB_PICKUP_TH : null;
      }
    }catch(_){}
    return null;
  }
  function clearObj(o){ Object.keys(o).forEach(function(k){ delete o[k]; }); }
  function allBookings(){ return (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : []; }

  /* redraw the screen on show (unless someone is typing in it) · the un-wrapped renders, so no new load */
  function redraw(){
    try{
      if(O.busy && O.busy()) return;
      var view = O.activeView ? O.activeView() : '';
      if(view === 'vanjobs' && originals.renderVanJobs) originals.renderVanJobs();
      else if(view === 'vancheckin' && originals.renderVanCheckin) originals.renderVanCheckin();
      else if(typeof bookingV2RenderKeep === 'function') bookingV2RenderKeep();
    }catch(_){}
  }

  /* debounced writes · one timer per key, the last value wins */
  var timers = {};
  function later(key, fn){
    if(timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(function(){ delete timers[key]; fn(); }, DEBOUNCE_MS);
  }

  /* ════ Vans + the month matrix → SB_VEHICLES, VANJOB_DRIVER ════ */
  var cells = {};          // 'van|date' -> server day cell
  var statusRanges = {};   // range id -> range
  var zoneRanges = {};     // range id -> range
  var vansWindow = null;   // {from, to, at}

  function vehicleOf(v, old){
    var veh = {
      id: v.id, name: v.name || '', plate: v.plate || '', type: v.type || 'van', capacity: +v.capacity || 0,
      ownership: v.ownership || 'own', partnerName: v.partner_name || '', zoneBase: v.zone_base || '',
      driver: v.driver || '', driverPhone: v.driver_phone || '', active: v.active !== false, note: v.note || '',
      dayRoute: {}, dayStatus: {}, dayZone: {}, statusRanges: [], zoneOverrides: []
    };
    if(v.color) veh.color = v.color;
    if(old && Array.isArray(old.log)) veh.log = old.log;
    return veh;
  }
  function byIdAsc(a, b){ return (+a.id || 0) - (+b.id || 0); }

  function applyVans(j){
    var list = store('SB_VEHICLES'); if(!list) return;
    var old = {}; list.forEach(function(v){ if(v && v.id) old[v.id] = v; });
    var vans = (j && j.vans) || [];
    var byVan = {};
    var next = vans.map(function(v){ var veh = vehicleOf(v, old[v.id]); byVan[v.id] = veh; return veh; });
    (j.status_ranges || []).forEach(function(r){ statusRanges[r.id] = r; });
    (j.zone_ranges || []).forEach(function(r){ zoneRanges[r.id] = r; });
    Object.keys(statusRanges).map(function(k){ return statusRanges[k]; }).sort(byIdAsc).forEach(function(r){
      var veh = byVan[r.van_id]; if(veh) veh.statusRanges.push({ id: r.id, s: r.status, from: r.from_date, to: r.to_date || '', note: r.note || '' });
    });
    Object.keys(zoneRanges).map(function(k){ return zoneRanges[k]; }).sort(byIdAsc).forEach(function(r){
      var veh = byVan[r.van_id]; if(veh) veh.zoneOverrides.push({ id: r.id, zone: r.zone, from: r.from_date || '', to: r.to_date || '' });
    });
    (j.days || []).forEach(function(c){ cells[c.van_id + '|' + c.service_date] = c; });
    var drivers = store('VANJOB_DRIVER');
    if(drivers) clearObj(drivers);
    Object.keys(cells).forEach(function(k){
      var c = cells[k], veh = byVan[c.van_id]; if(!veh) return;
      if(c.route_ids && c.route_ids.length) veh.dayRoute[c.service_date] = c.route_ids.slice();
      if(c.status) veh.dayStatus[c.service_date] = c.status;
      if(c.zone) veh.dayZone[c.service_date] = c.zone;
      if(drivers && (c.driver || c.driver_phone || c.plate)) drivers[c.service_date + '::' + c.van_id] = { driver: c.driver || '', phone: c.driver_phone || '', plate: c.plate || '' };
    });
    list.length = 0;
    next.forEach(function(v){ list.push(v); });
  }
  function loadVans(date){
    var now = Date.now();
    if(vansWindow && vansWindow.from <= date && date <= vansWindow.to && now - vansWindow.at < 60000) return Promise.resolve(null);
    var from = O.shift(date, -31), to = O.shift(date, 31);
    return O.get('/operations/van-days', { from: from, to: to }).then(function(j){
      vansWindow = { from: from, to: to, at: Date.now() };
      applyVans(j || {});
      return j;
    });
  }

  /* ════ Thai pickup names → VANJOB_PICKUP_TH ════ */
  var namesAt = 0, thByKey = {};
  function nameKey(name){ return str(name).trim().toLowerCase(); }
  function loadNames(){
    if(namesAt && Date.now() - namesAt < 300000) return Promise.resolve(null);
    return O.get('/operations/pickup-names-th').then(function(j){
      namesAt = Date.now();
      var th = store('VANJOB_PICKUP_TH');
      if(th) clearObj(th);
      thByKey = {};
      ((j && j.names) || []).forEach(function(n){
        if(th) th[str(n.name).trim()] = n.name_th;
        thByKey[nameKey(n.name)] = n.name_th;
      });
      return j;
    });
  }
  /* the server keys a name trimmed and lower-cased, so "Patong" and "patong" are one place */
  wrap('vanJobsGetPickupTh', function(name){
    var th = store('VANJOB_PICKUP_TH') || {};
    var k = str(name).trim();
    return th[k] || thByKey[nameKey(k)] || '';
  });
  wrap('vanJobsSetPickupTh', function(el){
    if(!el || !canEdit()) return;
    var name = str(el.getAttribute('data-pk')).trim(); if(!name) return;
    var v = str(el.value).trim();
    later('pk|' + nameKey(name), function(){
      O.queue(function(){ return O.call('PUT', '/operations/pickup-names-th', { name: name, name_th: v || null }); }).then(function(){
        var th = store('VANJOB_PICKUP_TH');
        if(th){ if(v) th[name] = v; else delete th[name]; }
        if(v) thByKey[nameKey(name)] = v; else delete thByKey[nameKey(name)];
      }, function(e){ O.fail('Thai pickup name not saved · ' + failCode(e), e); });
    });
  });

  /* ════ Driver of the day → PUT /operations/van-days/{date}/{van} ════ */
  var DRIVER_FIELD = { driver: 'driver', phone: 'driver_phone', plate: 'plate' };
  var driverDraft = {};    // 'date::van' -> {driver_phone: '…', …} typed but not sent yet
  function putDriver(date, vanId, body){
    return O.queue(function(){ return O.call('PUT', '/operations/van-days/' + enc(date) + '/' + enc(vanId), body); }).then(function(c){
      if(c && c.van_id){
        cells[c.van_id + '|' + c.service_date] = c;
        var drivers = store('VANJOB_DRIVER');
        if(drivers){
          var k = c.service_date + '::' + c.van_id;
          if(c.driver || c.driver_phone || c.plate) drivers[k] = { driver: c.driver || '', phone: c.driver_phone || '', plate: c.plate || '' };
          else delete drivers[k];
        }
      }
      return c;
    });
  }
  wrap('vanJobsSetDriver', function(date, vanId, field, el){
    var key = DRIVER_FIELD[field];
    if(!key || !date || !vanId || !el || !canEdit()) return;
    var k = date + '::' + vanId;
    var draft = driverDraft[k] = driverDraft[k] || {};
    draft[key] = str(el.value).trim() || null;
    later('drv|' + k, function(){
      var body = driverDraft[k]; delete driverDraft[k];
      putDriver(date, vanId, body).catch(function(e){ O.fail('Driver not saved · ' + failCode(e), e); redraw(); });
    });
  });
  wrap('vanJobsResetDriver', function(date, vanId){
    if(!date || !vanId || !canEdit()) return;
    var k = date + '::' + vanId;
    if(timers['drv|' + k]){ clearTimeout(timers['drv|' + k]); delete timers['drv|' + k]; }
    delete driverDraft[k];
    putDriver(date, vanId, { driver: null, driver_phone: null, plate: null }).then(redraw, function(e){ O.fail('Driver not reset · ' + failCode(e), e); });
  });

  /* ════ "Sent to the driver" → /operations/van-jobs/{date}/{key}/sent ════ */
  var jobKeys = {};        // 'date::legacyKey' -> server job key
  var dayRead = {};        // date -> the day read (jobs, warnings); the sheet renderer (35-ops-van-job-sheet.js) takes rounds from it
  function legacyKeysOf(job){
    var base = job.van_id + '~' + job.route_id;
    if(!job.group_id) return [base];
    var keys = [base + '~' + job.group_number];
    if(!job.round || !(job.round.of > 1)) keys.push(base);
    return keys;
  }
  function applyJobs(date, j){
    dayRead[date] = j || { date: date, jobs: [] };
    var sent = store('VANJOB_SENT');
    var prefix = date + '::';
    Object.keys(jobKeys).forEach(function(k){ if(k.indexOf(prefix) === 0) delete jobKeys[k]; });
    if(sent) Object.keys(sent).forEach(function(k){ if(k.indexOf(prefix) === 0) delete sent[k]; });
    ((j && j.jobs) || []).forEach(function(job){
      legacyKeysOf(job).forEach(function(lk){
        jobKeys[prefix + lk] = job.key;
        if(sent && job.sent && job.sent.at) sent[prefix + lk] = job.sent.at;
      });
    });
  }
  function loadJobs(date){
    return O.get('/operations/van-jobs', { date: date }).then(function(j){ applyJobs(date, j); return j; });
  }
  wrap('vanJobsToggleSent', function(date, key){
    if(!date || !key || !canEdit()) return null;
    var sent = store('VANJOB_SENT') || {};
    var on = !sent[date + '::' + key];
    var serverKey = jobKeys[date + '::' + key];
    var go = serverKey ? Promise.resolve(serverKey) : loadJobs(date).then(function(){ return jobKeys[date + '::' + key]; });
    return go.then(function(sk){
      if(!sk){ redraw(); return refuse('Not marked sent', 'The server has no job for this van on ' + date + ' · reload the page'); }
      return O.queue(function(){ return O.call(on ? 'PUT' : 'DELETE', '/operations/van-jobs/' + enc(date) + '/' + enc(sk) + '/sent'); })
        .then(function(){ return loadJobs(date); })
        .then(function(){ var sy = window.scrollY; redraw(); try{ window.scrollTo(0, sy); }catch(_){} });
    }).catch(function(e){ O.fail('Sent mark not saved · ' + failCode(e), e); redraw(); });
  });

  /* ════ Special request → booking job_note ════ */
  function syncSreq(){
    var sreq = store('VANJOB_SREQ'); if(!sreq) return;
    clearObj(sreq);
    allBookings().forEach(function(b){ if(b && b.id && b.jobNote != null) sreq[b.id] = b.jobNote; });
  }
  function byClientId(id){ return allBookings().find(function(b){ return b && b.id === id; }) || null; }
  function putJobNote(b, note){
    if(!b.opsId) return Promise.reject(new Error('Booking is not saved to operation-backend yet'));
    return O.queue(function(){ return O.bookingWrite('PATCH', '/v1/bookings/' + enc(b.opsId), b, { job_note: note }); }).then(function(j){
      b.jobNote = (j && j.job_note !== undefined) ? j.job_note : note;
      if(j && j.special_request !== undefined) b.specialRequest = j.special_request || '';   // w5c: the server's job_note-else-notes
      syncSreq();
      return j;
    });
  }
  wrap('vanJobsSetSreq', function(el){
    if(!el || !canEdit()) return;
    var id = el.getAttribute('data-bk'); var b = byClientId(id); if(!b) return;
    var v = str(el.value);
    later('sreq|' + id, function(){
      putJobNote(b, v).catch(function(e){ O.fail('Special request not saved · ' + failCode(e), e); syncSreq(); redraw(); });
    });
  });
  wrap('vanJobsResetSreq', function(id){
    var b = byClientId(id); if(!b || !canEdit()) return;
    if(timers['sreq|' + id]){ clearTimeout(timers['sreq|' + id]); delete timers['sreq|' + id]; }
    putJobNote(b, null).then(redraw, function(e){ O.fail('Special request not reset · ' + failCode(e), e); });
  });

  /* ════ Van stops → VAN_STOPS ════ */
  function stopKey(s){ return s.service_date + '::' + s.route_id + '::' + s.id; }
  function localStop(s){
    var g = (s.group_id && O.vans && O.vans.groupInfo) ? O.vans.groupInfo(s.group_id) : null;
    return {
      kind: s.kind === 'cargo' ? 'cargo' : 'staff', label: s.label || '', pax: +s.pax || 0,
      time: s.time || '', place: s.place || '', zone: s.area || '', areaId: s.area_id || '',
      leg: s.leg || 'out', phone: s.phone || '', note: s.note || '',
      vanId: g ? g.vanId : null, vanGroup: g ? g.number : 0, vanSeq: +s.sequence || 0,
      ck: s.checked_in ? { at: s.checked_in.at, by: s.checked_in.by || '', n: +s.checked_in.seats || 0 } : null,
      by: s.created_by || '', at: s.created_at || '', editBy: s.updated_by || '', editAt: s.updated_at || '',
      _opsId: s.id
    };
  }
  function putStop(s){ var vs = store('VAN_STOPS'); if(vs && s && s.id) vs[stopKey(s)] = localStop(s); }
  function loadStops(date){
    return O.get('/operations/van-stops', { service_date: date }).then(function(j){
      var vs = store('VAN_STOPS');
      if(vs) Object.keys(vs).forEach(function(k){ if(k.indexOf(date + '::') === 0) delete vs[k]; });
      ((j && j.stops) || []).forEach(putStop);
      return j;
    });
  }
  function stopIdOf(k){ var p = str(k).split('::'); return p[2] || ''; }
  function stopBody(rec){
    return {
      kind: rec.kind === 'cargo' ? 'cargo' : 'staff', label: str(rec.label).trim(),
      pax: rec.kind === 'cargo' ? 0 : (parseInt(rec.pax, 10) || 0),
      time: str(rec.time).trim() || null, place: str(rec.place).trim(),
      area_id: str(rec.areaId).trim() || null, area: str(rec.zone).trim() || null,
      leg: (rec.leg === 'ret' || rec.leg === 'both') ? rec.leg : 'out',
      phone: str(rec.phone).trim() || null, note: str(rec.note).trim() || null
    };
  }
  function sendStop(id, body){
    return O.queue(function(){ return id ? O.patch('/operations/van-stops/' + enc(id), body) : O.post('/operations/van-stops', body); });
  }
  wrap('vsSave', function(rec){
    if(!rec || !rec.date || !rec.routeId || !canEdit()) return null;
    var num = +rec.vanGroup || 0;
    var groupId = num && O.vans && O.vans.serverIdOf ? O.vans.serverIdOf(rec.date, rec.routeId, num) : null;
    if(!groupId) return refuse('Stop not saved', 'Pick the van group first: a stop rides a group\'s van');
    var body = stopBody(rec); body.group_id = groupId;
    var id = rec.id || '';
    sendStop(id, body).catch(function(e){
      if(e && e.code === 'van_over_capacity' && window.confirm(e.message + '\n\nAdd anyway?')){
        body.seats_anyway = true;
        return sendStop(id, body);
      }
      throw e;
    }).then(function(s){
      if(!s) return;
      if(id && stopKey(s) !== rec.date + '::' + rec.routeId + '::' + id){ var vs = store('VAN_STOPS'); if(vs) delete vs[rec.date + '::' + rec.routeId + '::' + id]; }
      putStop(s); redraw();
    }, function(e){ O.fail('Stop not saved · ' + failCode(e), e); });
    return null;
  });
  wrap('vsDel', function(k){
    var id = stopIdOf(k); if(!id || !canEdit()) return;
    O.queue(function(){ return O.del('/operations/van-stops/' + enc(id)); }).then(function(){
      var vs = store('VAN_STOPS'); if(vs) delete vs[k];
      redraw();
    }, function(e){ O.fail('Stop not deleted · ' + failCode(e), e); });
  });
  wrap('vsSetVan', function(){
    return refuse('Stop not moved', 'Edit the stop and pick its van group instead');
  });
  wrap('vsCheck', function(k, on){
    var id = stopIdOf(k); if(!id || !canEdit()) return;
    O.queue(function(){ return O.call(on === false ? 'DELETE' : 'PUT', '/operations/van-stops/' + enc(id) + '/check-in'); }).then(function(s){
      putStop(s); redraw();
    }, function(e){ O.fail('Stop check-in not saved · ' + failCode(e), e); });
  });

  /* ════ Driver arrived at the first pickup (Van Check-in) · vck_arrive ⇄ /operations/van-arrivals ════
     Legacy kept one mark per "date::van~route" in the blob. vckArrAll answers from a cache the day's GET
     fills; the toggle asks the server first (PUT = mark: the time and the login are the server's; DELETE =
     unmark). The server flows the van's untouched rows to Standby (PUT, answers moved_to_standby) / back to Wait
     (DELETE) in the same transaction, so the browser rule vckArrFlow is not run here; the day's bookings are
     re-read when rows moved, so the rows show their new status. */
  var arrMap = {}, arrDays = {};
  function arrKey(date, van, route){ return date + '::' + van + '~' + route; }
  function arrPut(date, a){
    arrMap[arrKey(date, a.van_id, a.route_id)] = { at: a.arrived_hm || '', by: a.arrived_by || '', ts: a.arrived_at || '',
      waited: (a.waited_minutes == null ? null : +a.waited_minutes), readAt: Date.now() };
  }
  function loadArrivals(date){
    return O.get('/operations/van-arrivals', { date: date }).then(function(j){
      Object.keys(arrMap).forEach(function(k){ if(k.indexOf(date + '::') === 0) delete arrMap[k]; });
      ((j && j.arrivals) || []).forEach(function(a){ arrPut(date, a); });
      arrDays[date] = true;
      // the server's rule (a warning, nothing blocked) · legacy's VCK_WAIT_RULE is a top-level var, so a window property
      if(j && +j.wait_rule_minutes > 0) window.VCK_WAIT_RULE = +j.wait_rule_minutes;
      return j;
    });
  }
  wrap('vckArrAll', function(){ return arrMap; });
  /* minutes waited: the server's `waited_minutes` (today only, else null) as of the read, moved on by the
     minutes since that read so an open screen keeps counting; the rule and the "today" test are the server's */
  wrap('vckArrWait', function(date, gk){
    var m = /^([^~]+)~(.+)$/.exec(str(gk)); if(!m) return null;
    var a = arrMap[arrKey(date, m[1], m[2])]; if(!a || !a.at || a.waited == null) return null;
    return a.waited + Math.floor((Date.now() - a.readAt) / 60000);
  });
  wrap('vckArrSave', function(){ return null; });          // nothing is kept in the blob any more
  wrap('vckArrToggle', function(date, gk, vanName){
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return;
    var m = /^([^~]+)~(.+)$/.exec(str(gk)); if(!m || !date) return;
    var key = arrKey(date, m[1], m[2]), cur = arrMap[key], on = !cur;
    if(cur){
      if(!confirm('ยกเลิกการบันทึก "ถึงจุดรับแล้ว"?' + String.fromCharCode(10)
         + (vanName || '') + ' · บันทึกไว้ ' + (cur.at || '') + ' โดย ' + (cur.by || '')
         + String.fromCharCode(10, 10)
         + 'นาฬิการอลูกค้าจะหยุดนับ · แถวที่เป็น Standby อยู่จะกลับเป็น "รอ"')) return;
    }
    var path = '/operations/van-arrivals/' + enc(date) + '/' + enc(m[1]) + '/' + enc(m[2]);
    O.queue(function(){ return on ? O.call('PUT', path) : O.call('DELETE', path); }).then(function(a){
      if(on && a) arrPut(date, a); else delete arrMap[key];
      O.wrote('van-arrival');       // w5-d: the rows it moved to Standby (or back to wait) are the server's; the held Van Check-in answer is stale
      // PUT answers how many rows went to Standby; DELETE (204) answers nothing and sends Standby rows back to Wait
      var moved = on ? (a && +a.moved_to_standby || 0) : 1;
      var again = moved && typeof window.bookingV2EnsureOpsRange === 'function'
        ? window.bookingV2EnsureOpsRange({ from: date, to: date, refresh: true }) : null;
      var done = function(){ if(typeof window.renderVanCheckin === 'function') window.renderVanCheckin(); };
      done();
      if(again) again.then(done, function(){});
    }, function(e){
      if(!on && e && e.status === 404){ delete arrMap[key]; redraw(); return; }
      O.fail('Arrival not saved · ' + failCode(e), e);
    });
  });

  /* ════ The day's load, behind each screen's render ════ */
  var dayAt = {}, dayLoading = {};
  function loadDay(date){
    if(!O.enabled() || !date) return Promise.resolve(null);
    var now = Date.now();
    if(dayAt[date] && now - dayAt[date] < 5000) return dayLoading[date];
    dayAt[date] = now;
    // §vanKeep · groups land only on bookings already in the browser, so the day's bookings come first
    var books = (typeof bookingV2OpsEnsureDay === 'function') ? bookingV2OpsEnsureDay(date) : null;
    var groups = Promise.resolve(books).catch(function(){}).then(function(){
      return (O.vans && O.vans.loadDay) ? O.vans.loadDay(date) : null;
    });
    dayLoading[date] = Promise.all([
      loadVans(date).catch(function(e){ console.warn('[ops] vans did not load · ' + (e && e.message)); }),
      loadNames().catch(function(e){ console.warn('[ops] Thai pickup names did not load · ' + (e && e.message)); }),
      Promise.resolve(groups)
    ]).then(function(){
      return Promise.all([
        loadStops(date).catch(function(e){ console.warn('[ops] van stops did not load · ' + (e && e.message)); }),
        loadJobs(date).catch(function(e){ console.warn('[ops] van jobs did not load · ' + (e && e.message)); }),
        loadArrivals(date).catch(function(e){ console.warn('[ops] van arrivals did not load · ' + (e && e.message)); })
      ]);
    }).then(function(){ syncSreq(); redraw(); });
    return dayLoading[date];
  }

  wrap('renderVanJobs', function(){
    syncSreq();
    var r = originals.renderVanJobs ? originals.renderVanJobs.apply(this, arguments) : undefined;
    try{ if(typeof _vanJobsDate !== 'undefined') loadDay(_vanJobsDate); }catch(_){}
    return r;
  });
  wrap('renderVanCheckin', function(){
    var r = originals.renderVanCheckin ? originals.renderVanCheckin.apply(this, arguments) : undefined;
    try{ if(typeof _vanCkDate !== 'undefined') loadDay(_vanCkDate); }catch(_){}
    return r;
  });
  /* by-trip Van mode shows the day's stops too · load them with the groups */
  wrap('bookingV2OpsVansDay', function(date){ return loadDay(date); });

  /* the Transfer Fleet adapter (35-ops-vehicles.js) keeps these caches in step with what it writes */
  O.vanJobs = {
    loadDay: loadDay, legacyKeysOf: legacyKeysOf,
    loadJobs: loadJobs, redraw: redraw,
    jobKey: function(date, legacyKey){ return jobKeys[date + '::' + legacyKey] || null; },
    dayRead: function(date){ return dayRead[date] || null; },
    loadVans: loadVans, vehicleOf: vehicleOf,
    putCell: function(c){ if(c && c.van_id) cells[c.van_id + '|' + c.service_date] = c; },
    cellOf: function(vanId, date){ return cells[vanId + '|' + date] || null; },      // w5-d: status_on / zone_on / usable of the day (83-ops-fleet-server.js)
    putRange: function(kind, r){ (kind === 'zone' ? zoneRanges : statusRanges)[r.id] = r; },
    dropRange: function(kind, id){ delete (kind === 'zone' ? zoneRanges : statusRanges)[id]; },
    dropVan: function(vanId){
      Object.keys(cells).forEach(function(k){ if(k.indexOf(vanId + '|') === 0) delete cells[k]; });
      [statusRanges, zoneRanges].forEach(function(m){ Object.keys(m).forEach(function(k){ if(m[k].van_id === vanId) delete m[k]; }); });
    },
    invalidate: function(){ vansWindow = null; },
    dropDay: function(d){ if(d) delete dayAt[d]; }   // §opsCheckinLive · the next render of that day asks the server again
  };
})();
