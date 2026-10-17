/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetAssets · engines, gearboxes, propellers ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Hydrates FL_ENGINES, FL_GEARBOXES, FL_PROPELLERS from /v1/fleet/engines,
   /v1/fleet/gearboxes, /v1/fleet/propellers and wraps asset CRUD and commands.
   Commands (install, remove, move, status, swap, service) are used instead of
   raw link-field PATCH. After any command, the engine → gearbox → propeller
   chain is refetched. Starboard/Stbd positions normalize to 'Std'.

   GET    /v1/fleet/engines|gearboxes|propellers[?boat_id=]
   GET    /v1/fleet/engines|gearboxes|propellers/:id
   POST   /v1/fleet/engines|gearboxes|propellers
   PATCH  /v1/fleet/engines|gearboxes|propellers/:id
   POST   /v1/fleet/engines/:id/install    { boat_id, pos, job_id? }
   POST   /v1/fleet/gearboxes/:id/install  { engine_id }
   POST   /v1/fleet/propellers/:id/install { gearbox_id, prop_pos? }
   POST   /v1/fleet/:family/:id/status     { status, note? }
   POST   /v1/fleet/:family/:id/remove     { spare_location?, note? }
   POST   /v1/fleet/gearboxes|propellers/:id/move { spare_location, note? }
   POST   /v1/fleet/:family/:id/swap       { with_id }
   POST   /v1/fleet/engines|gearboxes/:id/service { hours }
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var state = {
    loaded: false,
    failed: false,
    loading: null
  };
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function nullable(v){ var s = text(v); return s ? s : null; }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function numOrNull(v){
    if(v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function clone(v){ return O.clone ? O.clone(v) : (v == null ? v : JSON.parse(JSON.stringify(v))); }

  function listEngines(){ return typeof FL_ENGINES !== 'undefined' && Array.isArray(FL_ENGINES) ? FL_ENGINES : []; }
  function listGearboxes(){ return typeof FL_GEARBOXES !== 'undefined' && Array.isArray(FL_GEARBOXES) ? FL_GEARBOXES : []; }
  function listPropellers(){ return typeof FL_PROPELLERS !== 'undefined' && Array.isArray(FL_PROPELLERS) ? FL_PROPELLERS : []; }

  function normalizePos(pos){
    var s = text(pos);
    if(!s) return null;
    return s.replace(/\b(?:Starboard|Stbd)\b/gi, 'Std');
  }

  function mapLogEntry(l){
    l = l || {};
    return {
      date: l.date || '',
      type: l.type || '',
      desc: l.description != null ? l.description : (l.desc || ''),
      detail: l.detail || null,
      text: l.text || null,
      hours: l.hours != null ? num(l.hours) : null,
      engineHours: l.engine_hours != null ? num(l.engine_hours) : null,
      usedHours: l.used_hours != null ? num(l.used_hours) : null,
      fromLoc: l.from_loc || null,
      toLoc: l.to_loc || null,
      incidentId: l.incident_id || null,
      outcome: l.outcome || null,
      cost: l.cost != null ? num(l.cost) : null,
      by: l.by || null
    };
  }

  function fromServerEngine(e, old){
    e = e || {}; old = old || {};
    return {
      id: e.id,
      brand: e.brand || '',
      model: e.model || '',
      serial: e.serial || '',
      hp: e.hp != null ? num(e.hp) : null,
      boatId: e.boat_id || null,
      pos: e.pos ? normalizePos(e.pos) : '',
      status: e.status || 'ready',
      baseHours: num(e.base_hours),
      serviceInterval: e.service_interval != null ? num(e.service_interval) : 100,
      buyDate: e.buy_date || null,
      price: e.price != null ? num(e.price) : null,
      note: e.note || '',
      spareLocation: e.spare_location || null,
      lastServiceHours: e.last_service_hours != null ? num(e.last_service_hours) : null,
      lastServiceDate: e.last_service_date || null,
      retired: !!e.retired,
      retiredOn: e.retired_on || null,
      retiredReason: e.retired_reason || null,
      hours: e.hours != null ? num(e.hours) : num(e.base_hours),
      service: e.service ? clone(e.service) : null,
      log: Array.isArray(e.log) ? e.log.map(mapLogEntry) : (Array.isArray(old.log) ? old.log : []),
      _fromOpsBackend: true
    };
  }

  function fromServerGearbox(g, old){
    g = g || {}; old = old || {};
    return {
      id: g.id,
      brand: g.brand || '',
      model: g.model || '',
      modelSuffix: g.model_suffix || '',
      serial: g.serial || '',
      boatId: g.boat_id || null,
      engineId: g.engine_id || null,
      onBoatId: g.on_boat_id || null,
      onBoatPos: g.on_boat_pos ? normalizePos(g.on_boat_pos) : null,
      status: g.status || 'ready',
      baseHours: num(g.base_hours),
      installHours: g.install_hours != null ? num(g.install_hours) : null,
      serviceInterval: g.service_interval != null ? num(g.service_interval) : 100,
      lastServiceHours: g.last_service_hours != null ? num(g.last_service_hours) : null,
      lastServiceDate: g.last_service_date || null,
      buyDate: g.buy_date || null,
      note: g.note || '',
      spareLocation: g.spare_location || null,
      shaftLength: g.shaft_length || '',
      rotation: g.rotation || 'Standard',
      gearRatio: g.gear_ratio || '',
      oilCapacity: g.oil_capacity || '',
      lifetimeHours: g.lifetime_hours != null ? num(g.lifetime_hours) : 0,
      service: g.service ? clone(g.service) : null,
      log: Array.isArray(g.log) ? g.log.map(mapLogEntry) : (Array.isArray(old.log) ? old.log : []),
      _fromOpsBackend: true
    };
  }

  function fromServerPropeller(p, old){
    p = p || {}; old = old || {};
    return {
      id: p.id,
      brand: p.brand || '',
      serial: p.serial || '',
      oldSerial: p.old_serial || null,
      boatId: p.boat_id || null,
      gearboxId: p.gearbox_id || null,
      propPos: p.prop_pos ? normalizePos(p.prop_pos) : null,
      diameter: p.diameter != null ? num(p.diameter) : null,
      pitch: p.pitch != null ? num(p.pitch) : null,
      size: p.size || '',
      blades: p.blades || '3',
      material: p.material || 'Stainless',
      rotation: p.rotation || 'Standard',
      hubSize: p.hub_size || '',
      cupping: p.cupping || 'no',
      cost: p.cost != null ? num(p.cost) : 0,
      installHours: p.install_hours != null ? num(p.install_hours) : null,
      status: p.status || 'active',
      buyDate: p.buy_date || null,
      note: p.note || '',
      spareLocation: p.spare_location || null,
      log: Array.isArray(p.log) ? p.log.map(mapLogEntry) : (Array.isArray(old.log) ? old.log : []),
      _fromOpsBackend: true
    };
  }

  function replaceProjection(target, rows, mapper){
    var byId = {};
    target.forEach(function(x){ if(x && x.id) byId[x.id] = x; });
    var mapped = (rows || []).map(function(s){ return mapper(s, byId[s.id] || null); });
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function upsertInList(target, row, mapper){
    var idx = target.findIndex(function(x){ return x && x.id === row.id; });
    var mapped = mapper(row, idx >= 0 ? target[idx] : null);
    if(idx < 0) target.push(mapped);
    else target[idx] = mapped;
    return mapped;
  }

  function refetchChain(){
    return Promise.all([
      O.get('/v1/fleet/engines'),
      O.get('/v1/fleet/gearboxes'),
      O.get('/v1/fleet/propellers')
    ]).then(function(res){
      replaceProjection(listEngines(), (res[0] && res[0].engines) || [], fromServerEngine);
      replaceProjection(listGearboxes(), (res[1] && res[1].gearboxes) || [], fromServerGearbox);
      replaceProjection(listPropellers(), (res[2] && res[2].propellers) || [], fromServerPropeller);
      state.loaded = true;
      state.failed = false;
      return true;
    });
  }

  function loadAll(force){
    if(!enabled()) return Promise.resolve(false);
    if(state.loaded && !force) return Promise.resolve(true);
    if(state.loading) return state.loading;
    state.loading = refetchChain().catch(function(e){
      state.failed = true;
      O.fail('Could not load drivetrain assets from operation-backend', e);
      throw e;
    }).finally(function(){
      state.loading = null;
    });
    return state.loading;
  }

  function fetchAssetDetail(family, id){
    var path = '/v1/fleet/' + family + '/' + enc(id);
    return O.get(path).then(function(res){
      if(family === 'engines') return upsertInList(listEngines(), res, fromServerEngine);
      if(family === 'gearboxes') return upsertInList(listGearboxes(), res, fromServerGearbox);
      return upsertInList(listPropellers(), res, fromServerPropeller);
    });
  }

  // Build create or PATCH bodies — PATCH excludes server-owned links, status, hours, logs, and service baselines
  function toEngineFactsBody(d, isCreate){
    d = d || {};
    var body = {
      brand: nullable(d.brand),
      model: nullable(d.model),
      serial: nullable(d.serial),
      hp: numOrNull(d.hp),
      buy_date: nullable(d.buyDate != null ? d.buyDate : d.buy_date),
      price: numOrNull(d.price),
      base_hours: num(d.baseHours != null ? d.baseHours : d.base_hours),
      service_interval: parseInt(d.serviceInterval != null ? d.serviceInterval : d.service_interval, 10) || 100,
      note: nullable(d.note),
      spare_location: nullable(d.spareLocation != null ? d.spareLocation : d.spare_location)
    };
    if(isCreate){
      if(d.status) body.status = text(d.status);
      var bid = nullable(d.boatId != null ? d.boatId : d.boat_id);
      if(bid){
        body.boat_id = bid;
        body.pos = normalizePos(d.pos);
      }
    }
    return body;
  }

  function toGearboxFactsBody(d, isCreate){
    d = d || {};
    var body = {
      brand: nullable(d.brand),
      model: nullable(d.model),
      model_suffix: nullable(d.modelSuffix != null ? d.modelSuffix : d.model_suffix),
      serial: nullable(d.serial),
      buy_date: nullable(d.buyDate != null ? d.buyDate : d.buy_date),
      base_hours: num(d.baseHours != null ? d.baseHours : d.base_hours),
      note: nullable(d.note),
      shaft_length: nullable(d.shaftLength != null ? d.shaftLength : d.shaft_length),
      rotation: nullable(d.rotation),
      gear_ratio: nullable(d.gearRatio != null ? d.gearRatio : d.gear_ratio),
      oil_capacity: nullable(d.oilCapacity != null ? d.oilCapacity : d.oil_capacity),
      service_interval: parseInt(d.serviceInterval != null ? d.serviceInterval : d.service_interval, 10) || 100,
      last_service_date: nullable(d.lastServiceDate != null ? d.lastServiceDate : d.last_service_date),
      spare_location: nullable(d.spareLocation != null ? d.spareLocation : d.spare_location)
    };
    if(isCreate){
      if(d.status) body.status = text(d.status);
      var eid = nullable(d.engineId != null ? d.engineId : d.engine_id);
      if(eid && d.status !== 'spare') body.engine_id = eid;
    }
    return body;
  }

  function toPropellerFactsBody(d, isCreate){
    d = d || {};
    var diam = numOrNull(d.diameter);
    var pitch = numOrNull(d.pitch);
    var body = {
      brand: nullable(d.brand),
      serial: nullable(d.serial),
      old_serial: nullable(d.oldSerial != null ? d.oldSerial : d.old_serial),
      diameter: diam,
      pitch: pitch,
      size: (diam != null && pitch != null) ? (diam + '×' + pitch) : nullable(d.size),
      blades: nullable(d.blades),
      material: nullable(d.material),
      rotation: nullable(d.rotation),
      hub_size: nullable(d.hubSize != null ? d.hubSize : d.hub_size),
      cupping: nullable(d.cupping),
      cost: num(d.cost),
      buy_date: nullable(d.buyDate != null ? d.buyDate : d.buy_date),
      note: nullable(d.note),
      spare_location: nullable(d.spareLocation != null ? d.spareLocation : d.spare_location)
    };
    if(d.propPos !== undefined || d.prop_pos !== undefined){
      body.prop_pos = normalizePos(d.propPos != null ? d.propPos : d.prop_pos);
    }
    if(isCreate){
      if(d.status) body.status = text(d.status);
      var gid = nullable(d.gearboxId != null ? d.gearboxId : d.gearbox_id);
      if(gid && d.status !== 'spare') body.gearbox_id = gid;
    }
    return body;
  }

  function toInstallEngineBody(boatId, pos, jobId){
    var body = { boat_id: text(boatId), pos: normalizePos(pos) };
    if(nullable(jobId)) body.job_id = nullable(jobId);
    return body;
  }
  function toInstallGearboxBody(engineId){
    return { engine_id: text(engineId) };
  }
  function toInstallPropellerBody(gearboxId, propPos){
    var body = { gearbox_id: text(gearboxId) };
    if(propPos !== undefined && propPos !== null) body.prop_pos = normalizePos(propPos);
    return body;
  }
  function toStatusBody(status, note){
    var body = { status: text(status) };
    if(nullable(note)) body.note = nullable(note);
    return body;
  }
  function toRemoveOrMoveBody(spareLocation, note){
    var body = {};
    if(spareLocation !== undefined) body.spare_location = nullable(spareLocation);
    if(nullable(note)) body.note = nullable(note);
    return body;
  }
  function toSwapBody(withId){
    return { with_id: text(withId) };
  }
  function toServiceBody(hours){
    return { hours: num(hours) };
  }

  function redrawAssets(){
    try{ if(typeof window.flRenderAsset === 'function') window.flRenderAsset(); }catch(_){}
    try{ if(typeof window.flRenderEngList === 'function' && document.getElementById('fl-engs-pink-wrap')) window.flRenderEngList(); }catch(_){}
    try{ if(typeof window.flRenderGbList === 'function' && document.getElementById('fl-gbs-pink-wrap')) window.flRenderGbList(); }catch(_){}
    try{ if(typeof window.flRenderPropList === 'function' && document.getElementById('fl-props-pink-wrap')) window.flRenderPropList(); }catch(_){}
    try{ if(typeof window.flRenderEquip === 'function' && document.getElementById('fl-equip-modal-body')) window.flRenderEquip(); }catch(_){}
  }

  function runAssetCommand(family, id, cmd, body, errTitle){
    return O.queue(function(){
      return O.post('/v1/fleet/' + family + '/' + enc(id) + '/' + cmd, body);
    }).then(function(detail){
      return refetchChain().then(function(){
        if(detail && detail.id) fetchAssetDetail(family, detail.id).catch(function(){});
        O.wrote('fleet-asset-' + cmd);
        redrawAssets();
        return detail;
      });
    }, function(e){
      O.fail(errTitle || ('Could not run ' + cmd + ' on ' + family), e);
      throw e;
    });
  }

  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsFleetAssets = true;
    window[name] = w;
  }

  wrap('flEngHours', function(orig, id){
    var e = listEngines().find(function(x){ return x && x.id === id; });
    if(e && e._fromOpsBackend && typeof e.hours === 'number') return e.hours;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flEngServiceState', function(orig, e){
    if(e && e._fromOpsBackend && e.service){
      var s = e.service;
      return {
        curH: num(s.current_hours),
        interval: num(s.interval),
        base: num(s.base),
        since: num(s.since),
        next: s.next,
        left: s.left,
        pct: num(s.pct),
        overdue: !!s.overdue
      };
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flGbLifetimeHours', function(orig, g){
    if(g && g._fromOpsBackend && typeof g.lifetimeHours === 'number') return g.lifetimeHours;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flGbServiceState', function(orig, g){
    if(g && g._fromOpsBackend && g.service){
      var s = g.service;
      return {
        life: num(s.current_hours),
        interval: num(s.interval),
        base: num(s.base),
        since: num(s.since),
        next: s.next,
        left: s.left,
        pct: num(s.pct),
        overdue: !!s.overdue,
        defaulted: !!s.defaulted,
        attached: !!s.attached
      };
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flSaveEngine', function(){
    var d = function(id){ return document.getElementById(id); };
    var brand = d('fl-eng-brand') ? d('fl-eng-brand').value : '';
    var model = d('fl-eng-model') ? d('fl-eng-model').value.trim() : '';
    var serial = d('fl-eng-serial') ? d('fl-eng-serial').value.trim() : '';
    if(!model || !serial){ alert('กรุณาระบุ รุ่น และ Serial'); return null; }
    var status = (typeof flStValues !== 'undefined' && typeof flSelSts !== 'undefined') ? flStValues[flSelSts.eng] : 'ready';
    var boatId = d('fl-eng-boat-sel') ? (d('fl-eng-boat-sel').value || null) : null;
    var pos = d('fl-eng-pos-sel') ? normalizePos(d('fl-eng-pos-sel').value) : null;
    var spareLoc = (status === 'spare' || status === 'fixing') && d('fl-eng-spare-loc') ? d('fl-eng-spare-loc').value : null;
    var input = {
      brand: brand,
      model: model,
      serial: serial,
      hp: d('fl-eng-hp') ? d('fl-eng-hp').value : null,
      buyDate: d('fl-eng-buydate') ? d('fl-eng-buydate').value : null,
      price: d('fl-eng-price') ? d('fl-eng-price').value : null,
      baseHours: d('fl-eng-base-hours') ? d('fl-eng-base-hours').value : 0,
      serviceInterval: d('fl-eng-svc') ? d('fl-eng-svc').value : 100,
      note: d('fl-eng-note') ? d('fl-eng-note').value : '',
      status: status,
      boatId: boatId,
      pos: pos,
      spareLocation: spareLoc
    };
    var editId = typeof flEditEngId !== 'undefined' ? flEditEngId : null;
    if(!editId){
      return O.queue(function(){
        return O.post('/v1/fleet/engines', toEngineFactsBody(input, true));
      }).then(function(){
        return refetchChain().then(function(){
          if(typeof window.closeModal === 'function') window.closeModal('fl-modal-engine');
          O.wrote('fleet-engine-create');
          redrawAssets();
        });
      }).catch(function(e){ O.fail('Could not create engine', e); return null; });
    }
    var cur = listEngines().find(function(x){ return x && x.id === editId; }) || {};
    /* the edit is a sequence (facts -> status -> install/remove) with no rollback · track which steps landed
       so a refusal mid-way can say so and the lists can be re-synced to what the server now holds */
    var landed = [], planned = ['details'];
    function step(label, call){ return function(){ return call().then(function(r){ landed.push(label); return r; }); }; }
    return O.queue(function(){
      var p = step('details', function(){ return O.patch('/v1/fleet/engines/' + enc(editId), toEngineFactsBody(input, false)); })();
      if(status && status !== cur.status){
        planned.push('status');
        p = p.then(step('status', function(){ return O.post('/v1/fleet/engines/' + enc(editId) + '/status', toStatusBody(status)); }));
      }
      if(boatId && (boatId !== cur.boatId || pos !== cur.pos)){
        planned.push('install');
        p = p.then(step('install', function(){ return O.post('/v1/fleet/engines/' + enc(editId) + '/install', toInstallEngineBody(boatId, pos)); }));
      } else if(!boatId && cur.boatId){
        planned.push('remove');
        p = p.then(step('remove', function(){ return O.post('/v1/fleet/engines/' + enc(editId) + '/remove', toRemoveOrMoveBody(spareLoc)); }));
      }
      return p;
    }).then(function(){
      return refetchChain().then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-engine');
        O.wrote('fleet-engine-update');
        redrawAssets();
      });
    }, function(e){
      /* refused mid-sequence · the server kept whatever it accepted (no rollback, that would be a second
         write nobody asked for): show its message + what already saved, re-sync the lists, and leave the
         modal open re-filled with the server's current values */
      var err = e;
      if(landed.length){
        err = new Error(((e && e.message) || 'refused') + ' | Already saved: ' + landed.join(', ') +
          '. Refused: ' + (planned[landed.length] || 'update') +
          (planned.length > landed.length + 1 ? '. Not attempted: ' + planned.slice(landed.length + 1).join(', ') : '') + '.');
        if(e && e.status) err.status = e.status;
        if(e && e.code) err.code = e.code;
      }
      O.fail('Could not update engine', err);
      return refetchChain().then(function(){
        redrawAssets();
        if(typeof window.flOpenAddEngineModal === 'function') window.flOpenAddEngineModal(editId);
        return null;
      }, function(){ return null; });
    }).catch(function(e){ O.fail('Could not update engine', e); return null; });
  });

  wrap('flSaveGearbox', function(){
    var d = function(id){ return document.getElementById(id); };
    var status = (typeof flStValues !== 'undefined' && typeof flSelSts !== 'undefined') ? flStValues[flSelSts.gb] : 'ready';
    var engineId = d('fl-gb-engine-sel') ? (d('fl-gb-engine-sel').value || null) : null;
    if(status === 'spare') engineId = null;
    var editId = typeof flEditGbId !== 'undefined' ? flEditGbId : null;
    var cur = editId ? (listGearboxes().find(function(x){ return x && x.id === editId; }) || {}) : {};
    var spareLoc = status === 'spare' ? (d('fl-gb-spare-loc') ? d('fl-gb-spare-loc').value : null) : (engineId ? null : (cur.spareLocation || null));
    var input = {
      brand: d('fl-gb-brand') ? d('fl-gb-brand').value : '',
      model: d('fl-gb-model') ? d('fl-gb-model').value : '',
      modelSuffix: d('fl-gb-suffix') ? d('fl-gb-suffix').value : '',
      serial: d('fl-gb-serial') ? d('fl-gb-serial').value : '',
      buyDate: d('fl-gb-buydate') ? d('fl-gb-buydate').value : null,
      baseHours: d('fl-gb-base-hours') ? d('fl-gb-base-hours').value : 0,
      note: d('fl-gb-note') ? d('fl-gb-note').value : '',
      shaftLength: d('fl-gb-shaft') ? d('fl-gb-shaft').value : '',
      rotation: d('fl-gb-rotation') ? d('fl-gb-rotation').value : 'Standard',
      gearRatio: d('fl-gb-ratio') ? d('fl-gb-ratio').value : '',
      oilCapacity: d('fl-gb-oil-cap') ? d('fl-gb-oil-cap').value : '',
      serviceInterval: d('fl-gb-svc-interval') ? d('fl-gb-svc-interval').value : 100,
      lastServiceDate: d('fl-gb-last-svc') ? d('fl-gb-last-svc').value : null,
      status: status,
      engineId: engineId,
      spareLocation: spareLoc
    };
    if(!editId){
      return O.queue(function(){
        return O.post('/v1/fleet/gearboxes', toGearboxFactsBody(input, true));
      }).then(function(){
        return refetchChain().then(function(){
          if(typeof window.closeModal === 'function') window.closeModal('fl-modal-gearbox');
          O.wrote('fleet-gearbox-create');
          redrawAssets();
        });
      }).catch(function(e){ O.fail('Could not create gearbox', e); return null; });
    }
    return O.queue(function(){
      var p = O.patch('/v1/fleet/gearboxes/' + enc(editId), toGearboxFactsBody(input, false));
      if(status && status !== cur.status){
        p = p.then(function(){ return O.post('/v1/fleet/gearboxes/' + enc(editId) + '/status', toStatusBody(status)); });
      }
      if(engineId && engineId !== cur.engineId){
        p = p.then(function(){ return O.post('/v1/fleet/gearboxes/' + enc(editId) + '/install', toInstallGearboxBody(engineId)); });
      } else if(!engineId && cur.engineId && status !== 'spare'){
        p = p.then(function(){ return O.post('/v1/fleet/gearboxes/' + enc(editId) + '/remove', toRemoveOrMoveBody(spareLoc)); });
      }
      return p;
    }).then(function(){
      return refetchChain().then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-gearbox');
        O.wrote('fleet-gearbox-update');
        redrawAssets();
      });
    }).catch(function(e){ O.fail('Could not update gearbox', e); return null; });
  });

  wrap('flSavePropeller', function(){
    var d = function(id){ return document.getElementById(id); };
    var status = (typeof flPropStValues !== 'undefined' && typeof flSelSts !== 'undefined') ? flPropStValues[flSelSts.prop] : 'active';
    var gearboxId = d('fl-prop-gb-sel') ? (d('fl-prop-gb-sel').value || null) : null;
    if(status === 'spare') gearboxId = null;
    var editId = typeof flEditPropId !== 'undefined' ? flEditPropId : null;
    var cur = editId ? (listPropellers().find(function(x){ return x && x.id === editId; }) || {}) : {};
    var spareLoc = (status === 'spare' || status === 'fixing') ? (d('fl-prop-spare-loc') ? d('fl-prop-spare-loc').value : null) : (gearboxId ? null : (cur.spareLocation || null));
    var input = {
      brand: d('fl-prop-brand') ? d('fl-prop-brand').value : '',
      serial: d('fl-prop-serial') ? d('fl-prop-serial').value : '',
      diameter: d('fl-prop-diameter') ? d('fl-prop-diameter').value : null,
      pitch: d('fl-prop-pitch') ? d('fl-prop-pitch').value : null,
      blades: d('fl-prop-blades') ? d('fl-prop-blades').value : '3',
      material: d('fl-prop-material') ? d('fl-prop-material').value : 'Stainless',
      rotation: d('fl-prop-rotation') ? d('fl-prop-rotation').value : 'Standard',
      hubSize: d('fl-prop-hub') ? d('fl-prop-hub').value : '',
      cupping: d('fl-prop-cup') ? d('fl-prop-cup').value : 'no',
      cost: d('fl-prop-cost') ? d('fl-prop-cost').value : 0,
      buyDate: d('fl-prop-buydate') ? d('fl-prop-buydate').value : null,
      note: d('fl-prop-note') ? d('fl-prop-note').value : '',
      status: status,
      gearboxId: gearboxId,
      spareLocation: spareLoc
    };
    if(!editId){
      return O.queue(function(){
        return O.post('/v1/fleet/propellers', toPropellerFactsBody(input, true));
      }).then(function(){
        return refetchChain().then(function(){
          if(typeof window.closeModal === 'function') window.closeModal('fl-modal-propeller');
          O.wrote('fleet-propeller-create');
          redrawAssets();
        });
      }).catch(function(e){ O.fail('Could not create propeller', e); return null; });
    }
    return O.queue(function(){
      var p = O.patch('/v1/fleet/propellers/' + enc(editId), toPropellerFactsBody(input, false));
      if(status && status !== cur.status){
        p = p.then(function(){ return O.post('/v1/fleet/propellers/' + enc(editId) + '/status', toStatusBody(status)); });
      }
      if(gearboxId && gearboxId !== cur.gearboxId){
        p = p.then(function(){ return O.post('/v1/fleet/propellers/' + enc(editId) + '/install', toInstallPropellerBody(gearboxId)); });
      } else if(!gearboxId && cur.gearboxId && status !== 'spare'){
        p = p.then(function(){ return O.post('/v1/fleet/propellers/' + enc(editId) + '/remove', toRemoveOrMoveBody(spareLoc)); });
      }
      return p;
    }).then(function(){
      return refetchChain().then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-propeller');
        O.wrote('fleet-propeller-update');
        redrawAssets();
      });
    }).catch(function(e){ O.fail('Could not update propeller', e); return null; });
  });

  /* "Add new spare" (flSaveAddSpare, 05-fleet.js): a gearbox or propeller with a serial, brand, note and a place.
     Legacy invented the id and the other fields in the browser; now POST /v1/fleet/{gearboxes,propellers} with the
     same defaults legacy used (Honda, BF250D Gearbox, 15.5×17, Stainless, 3 blades, hub 4.75, cupping no, cost 8500). */
  wrap('flSaveAddSpare', function(){
    var d = function(id){ return document.getElementById(id); };
    var type = d('fl-add-spare-type') ? d('fl-add-spare-type').value : '';
    var serial = d('fl-add-spare-serial') ? d('fl-add-spare-serial').value.trim() : '';
    if(!serial){ alert('กรุณากรอก serial'); return null; }
    var brand = (d('fl-add-spare-brand') ? d('fl-add-spare-brand').value.trim() : '') || 'Honda';
    var note = d('fl-add-spare-note') ? d('fl-add-spare-note').value.trim() : '';
    var loc = d('fl-add-spare-loc') ? d('fl-add-spare-loc').value : '';
    var status = String(loc).indexOf('shop:') === 0 ? 'fixing' : 'spare';
    var today = O.today();
    var path, body, title;
    if(type === 'gearbox'){
      path = '/v1/fleet/gearboxes'; title = 'Could not add spare gearbox';
      body = toGearboxFactsBody({
        brand: brand, model: (d('fl-add-spare-model') ? d('fl-add-spare-model').value.trim() : '') || 'BF250D Gearbox',
        serial: serial, buyDate: today, baseHours: 0, note: note, status: status, spareLocation: loc
      }, true);
    } else {
      path = '/v1/fleet/propellers'; title = 'Could not add spare propeller';
      var size = (d('fl-add-spare-size') ? d('fl-add-spare-size').value.trim() : '') || '15.5×17';
      var m = size.match(/^([\d.]+)[×x]([\d.]+)$/);
      body = toPropellerFactsBody({
        brand: brand, serial: serial, diameter: m ? parseFloat(m[1]) : 15.5, pitch: m ? parseFloat(m[2]) : 17,
        blades: '3', material: 'Stainless', rotation: d('fl-add-spare-rotation') ? d('fl-add-spare-rotation').value : 'Standard',
        hubSize: '4.75', cupping: 'no', cost: 8500, buyDate: today, note: note, status: status, spareLocation: loc
      }, true);
    }
    return O.queue(function(){
      return O.post(path, body);
    }).then(function(){
      return refetchChain().then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-add-spare');
        O.wrote(type === 'gearbox' ? 'fleet-gearbox-create' : 'fleet-propeller-create');
        redrawAssets();
      });
    }).catch(function(e){ O.fail(title, e); return null; });
  });

  wrap('flSaveAssignEng', function(){
    var selEl = document.getElementById('fl-assign-eng-sel');
    var posEl = document.getElementById('fl-assign-eng-pos');
    var engId = selEl ? selEl.value : '';
    var pos = posEl ? normalizePos(posEl.value) : '';
    var boatId = typeof _assignBoatId !== 'undefined' ? _assignBoatId : null;
    var replaceId = typeof _replaceEngId !== 'undefined' ? _replaceEngId : null;
    if(!engId){ alert('กรุณาเลือกเครื่องยนต์'); return null; }
    if(!boatId || !pos) return null;

    var occupied = listEngines().find(function(e){
      return e && e.boatId === boatId && normalizePos(e.pos) === pos && e.id !== engId && e.id !== replaceId;
    });
    if(occupied){
      if(!confirm('ตำแหน่ง "' + pos + '" มีเครื่อง ' + (occupied.serial || occupied.model || occupied.id) + ' อยู่แล้ว ต้องการถอดออกเป็น Spare แล้วติดตั้งเครื่องใหม่หรือไม่?')) return null;
    }

    return O.queue(function(){
      var p = Promise.resolve();
      if(occupied){
        p = p.then(function(){ return O.post('/v1/fleet/engines/' + enc(occupied.id) + '/remove', { spare_location: 'คลังกลาง' }); });
      }
      if(replaceId && replaceId !== engId){
        p = p.then(function(){ return O.post('/v1/fleet/engines/' + enc(replaceId) + '/remove', { spare_location: 'คลังกลาง' }); });
      }
      return p.then(function(){
        return O.post('/v1/fleet/engines/' + enc(engId) + '/install', toInstallEngineBody(boatId, pos));
      });
    }).then(function(){
      return refetchChain().then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-assign-eng');
        if(typeof window.flRenderBoatList === 'function') window.flRenderBoatList();
        if(typeof window.flSelBoat === 'function') window.flSelBoat(boatId);
        O.wrote('fleet-engine-install');
        redrawAssets();
      });
    }).catch(function(e){ O.fail('Could not assign engine', e); return null; });
  });

  wrap('flUnassignEng', function(orig, engId, boatId){
    if(!confirm('ถอดเครื่องยนต์นี้ออกจากเรือ?')) return null;
    return runAssetCommand('engines', engId, 'remove', { spare_location: 'คลังกลาง' }, 'Could not remove engine').then(function(){
      if(typeof window.flSelBoat === 'function' && boatId) window.flSelBoat(boatId);
    }).catch(function(){ return null; });
  });

  wrap('flEquipSwapDo', function(orig, targetId){
    var sw = typeof _flSwap !== 'undefined' ? _flSwap : null;
    if(!sw || !sw.id || !targetId || sw.id === targetId){
      if(typeof _flSwap !== 'undefined') _flSwap = null;
      if(typeof window.flRenderEquip === 'function') window.flRenderEquip();
      return null;
    }
    var family = sw.type === 'eng' ? 'engines' : sw.type === 'gb' ? 'gearboxes' : 'propellers';
    return runAssetCommand(family, sw.id, 'swap', toSwapBody(targetId), 'Could not swap ' + family).then(function(){
      if(typeof _flSwap !== 'undefined') _flSwap = null;
      if(typeof window.flRenderEquip === 'function') window.flRenderEquip();
    }).catch(function(){ return null; });
  });

  wrap('flEquipRemove', function(orig, type, id){
    var list = type === 'eng' ? listEngines() : type === 'gb' ? listGearboxes() : listPropellers();
    var o = list.find(function(x){ return x && x.id === id; });
    if(!o) return null;
    if(!confirm('ถอด ' + (o.serial || o.id) + ' เก็บเป็น Spare?')) return null;
    var family = type === 'eng' ? 'engines' : type === 'gb' ? 'gearboxes' : 'propellers';
    return runAssetCommand(family, id, 'remove', {}, 'Could not remove ' + family).then(function(){
      if(typeof window.flRenderEquip === 'function') window.flRenderEquip();
    }).catch(function(){ return null; });
  });

  wrap('flConfirmMove', function(){
    var ctx = typeof flMoveCtx !== 'undefined' ? flMoveCtx : null;
    if(!ctx || !ctx.assetId) return null;
    var sel = document.querySelector('input[name="fl-move-loc"]:checked');
    if(!sel){ alert('กรุณาเลือก location'); return null; }
    var newLoc = sel.value;
    var noteEl = document.getElementById('fl-move-note');
    var note = noteEl ? noteEl.value.trim() : '';
    var family = ctx.assetType === 'gearbox' ? 'gearboxes' : 'propellers';
    return runAssetCommand(family, ctx.assetId, 'move', toRemoveOrMoveBody(newLoc, note), 'Could not move spare').then(function(){
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-move');
    }).catch(function(){ return null; });
  });

  wrap('flChangeEngStatus', function(orig, id, newSt){
    if(!id || !newSt) return null;
    return runAssetCommand('engines', id, 'status', toStatusBody(newSt), 'Could not change engine status').catch(function(){ return null; });
  });

  wrap('flEngMarkService', function(orig, engId){
    var e = listEngines().find(function(x){ return x && x.id === engId; });
    if(!e) return null;
    var curH = typeof window.flEngHours === 'function' ? (window.flEngHours(engId) || 0) : (e.baseHours || 0);
    var ans = prompt('Log engine service (oil change).\nEngine hours at service time:', String(curH));
    if(ans === null) return null;
    var h = parseFloat(ans);
    if(isNaN(h) || h < 0){ alert('Please enter a valid hour reading.'); return null; }
    return runAssetCommand('engines', engId, 'service', toServiceBody(h), 'Could not record engine service').catch(function(){ return null; });
  });

  wrap('flGbMarkService', function(orig, gbId){
    var g = listGearboxes().find(function(x){ return x && x.id === gbId; });
    if(!g) return null;
    var life = typeof window.flGbLifetimeHours === 'function' ? (window.flGbLifetimeHours(g) || 0) : 0;
    var ans = prompt('Log gearbox oil service.\nGearbox lifetime hours at service time:', String(life));
    if(ans === null) return null;
    var h = parseFloat(ans);
    if(isNaN(h) || h < 0){ alert('Please enter a valid hour reading.'); return null; }
    return runAssetCommand('gearboxes', gbId, 'service', toServiceBody(h), 'Could not record gearbox service').catch(function(){ return null; });
  });

  wrap('flGbSetInterval', function(orig, gbId, val){
    var v = parseInt(val, 10);
    if(isNaN(v) || v <= 0){ alert('Enter a positive interval (hours).'); return null; }
    return O.queue(function(){
      return O.patch('/v1/fleet/gearboxes/' + enc(gbId), { service_interval: v });
    }).then(function(){
      return refetchChain().then(function(){
        O.wrote('fleet-gearbox-interval');
        redrawAssets();
      });
    }).catch(function(e){ O.fail('Could not update gearbox interval', e); return null; });
  });

  O.onChange(function(change){
    if(!change) return;
    if(['fleet_engine', 'fleet_gearbox', 'fleet_propeller', 'fleet_job', 'fleet_incident'].indexOf(change.entity_type) >= 0){
      state.loaded = false;
    }
  });

  var api = {
    load: function(){ return loadAll(true); },
    ensureLoaded: function(){ return loadAll(false); },
    refetchChain: refetchChain,
    fetchDetail: fetchAssetDetail,
    installEngine: function(id, boatId, pos, jobId){ return runAssetCommand('engines', id, 'install', toInstallEngineBody(boatId, pos, jobId)); },
    installGearbox: function(id, engineId){ return runAssetCommand('gearboxes', id, 'install', toInstallGearboxBody(engineId)); },
    installPropeller: function(id, gearboxId, propPos){ return runAssetCommand('propellers', id, 'install', toInstallPropellerBody(gearboxId, propPos)); },
    setStatus: function(family, id, st, note){ return runAssetCommand(family, id, 'status', toStatusBody(st, note)); },
    remove: function(family, id, loc, note){ return runAssetCommand(family, id, 'remove', toRemoveOrMoveBody(loc, note)); },
    move: function(family, id, loc, note){ return runAssetCommand(family, id, 'move', toRemoveOrMoveBody(loc, note)); },
    swap: function(family, id, withId){ return runAssetCommand(family, id, 'swap', toSwapBody(withId)); },
    service: function(family, id, hours){ return runAssetCommand(family, id, 'service', toServiceBody(hours)); }
  };

  O.fleetAssets = api;
  window.laOpsFleetAssets = api;
  window.__laOpsFleetAssetsCompat = {
    normalizePos: normalizePos,
    fromServerEngine: fromServerEngine,
    fromServerGearbox: fromServerGearbox,
    fromServerPropeller: fromServerPropeller,
    toEngineFactsBody: toEngineFactsBody,
    toGearboxFactsBody: toGearboxFactsBody,
    toPropellerFactsBody: toPropellerFactsBody,
    toInstallEngineBody: toInstallEngineBody,
    toInstallGearboxBody: toInstallGearboxBody,
    toInstallPropellerBody: toInstallPropellerBody,
    toStatusBody: toStatusBody,
    toRemoveOrMoveBody: toRemoveOrMoveBody,
    toSwapBody: toSwapBody,
    toServiceBody: toServiceBody
  };

  if(enabled()) loadAll(false).catch(function(){});
})();
