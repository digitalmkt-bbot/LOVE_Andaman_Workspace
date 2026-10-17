/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetJobs · incidents and maintenance jobs ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Hydrates FL_INCIDENTS and FL_MAINT from /v1/fleet/incidents and /v1/fleet/jobs
   and wraps incident/job CRUD and lifecycle commands. Every command response
   or refetch replaces the affected incident/job plus dependent boat/assets
   (via O.fleetBoats / O.fleetAssets). Preserves
   `boatStatus || (setFixing === false ? 'available' : 'fixing')` behavior.

   Incidents:
     GET    /v1/fleet/incidents?status=&boat_id=
     GET    /v1/fleet/incidents/:id
     POST   /v1/fleet/incidents
     PATCH  /v1/fleet/incidents/:id
     DELETE /v1/fleet/incidents/:id
     POST   /v1/fleet/incidents/:id/log
     POST   /v1/fleet/incidents/:id/swap

   Jobs:
     GET    /v1/fleet/jobs?status=&boat_id=&incident_id=
     GET    /v1/fleet/jobs/:id
     POST   /v1/fleet/jobs
     PATCH  /v1/fleet/jobs/:id
     DELETE /v1/fleet/jobs/:id
     POST   /v1/fleet/jobs/:id/start|close|reset-service|boat-status|assets|log|split|steps|steps/template
     DELETE /v1/fleet/jobs/:id/assets/:idx
     PATCH  /v1/fleet/jobs/:id/steps/:idx
     DELETE /v1/fleet/jobs/:id/steps/:idx
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var state = {
    loaded: false,
    failed: false,
    loading: null,
    nextIncNo: null,
    nextJobNo: null
  };
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function nullable(v){ var s = text(v); return s ? s : null; }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }

  function listIncidents(){ return typeof FL_INCIDENTS !== 'undefined' && Array.isArray(FL_INCIDENTS) ? FL_INCIDENTS : []; }
  function listJobs(){ return typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT) ? FL_MAINT : []; }

  function mapProgressLine(l){
    l = l || {};
    return {
      date: l.date || '',
      text: l.text || '',
      by: l.by || '',
      createdOn: l.created_on || null
    };
  }

  function mapDamagedAsset(a){
    a = a || {};
    var o = {
      type: a.type,
      id: a.asset_id || a.id || null,
      assetId: a.asset_id || a.id || null,
      label: a.label || '',
      swapped: !!a.swapped,
      swappedTo: a.swapped_to || null,
      swappedOn: a.swapped_on || null
    };
    if(a.type === 'engine' && o.id) o.engId = o.id;
    if(a.type === 'gearbox' && o.id) o.gbId = o.id;
    if(a.type === 'propeller' && o.id) o.propId = o.id;
    return o;
  }

  function fromServerIncident(i){
    i = i || {};
    return {
      id: i.id,
      no: i.no || '',
      boatId: i.boat_id || '',
      date: i.date || '',
      time: i.time || '',
      title: i.title || '',
      detail: i.detail || '',
      remark: i.remark || '',
      priority: i.priority != null ? num(i.priority) : 5,
      severity: i.severity || 'critical',
      type: 'incident',
      status: i.status || 'open',
      shownStatus: i.shown_status || i.status || 'open',
      maintId: i.job_id || null,
      jobId: i.job_id || null,
      relatedMaintIds: Array.isArray(i.related_job_ids) ? i.related_job_ids.slice() : [],
      closedDate: i.closed_on || null,
      quickFix: !!i.quick_fix,
      resolvedDate: i.resolved_on || null,
      damagedAssets: Array.isArray(i.damaged_assets) ? i.damaged_assets.map(mapDamagedAsset) : [],
      progressLog: Array.isArray(i.progress_log) ? i.progress_log.map(mapProgressLine) : [],
      _fromOpsBackend: true
    };
  }

  function mapJobAsset(a){
    a = a || {};
    var aid = a.asset_id || a.engId || a.gbId || a.propId || a.id || null;
    var o = {
      type: a.type,
      assetId: aid,
      label: a.label || '',
      detail: a.detail || '',
      status: a.status || 'fixing',
      addDate: a.added_on || a.addDate || null
    };
    if(a.type === 'engine' && aid) o.engId = aid;
    if(a.type === 'gearbox' && aid) o.gbId = aid;
    if(a.type === 'propeller' && aid) o.propId = aid;
    return o;
  }

  function mapJobPart(p){
    p = p || {};
    return {
      id: p.id || null,
      invId: p.inv_id != null ? p.inv_id : (p.invId || null),
      name: p.name || '',
      qty: num(p.qty),
      unit: p.unit || 'ชิ้น',
      cost: num(p.cost),
      location: p.location || null,
      date: p.date || null,
      late: !!p.late,
      lateBy: p.late_by || null
    };
  }

  function mapJobStep(s){
    s = s || {};
    return {
      t: s.text != null ? s.text : (s.t || ''),
      d: s.done ? 1 : 0,
      by: s.done_by || s.by || null,
      at: s.done_on || s.at || null
    };
  }

  function fromServerJob(j){
    j = j || {};
    var setFixing = j.set_fixing !== undefined ? !!j.set_fixing : (j.boat_status ? j.boat_status !== 'available' : true);
    var boatStatus = j.boat_status || (setFixing === false ? 'available' : 'fixing');
    return {
      id: j.id,
      no: j.no || '',
      boatId: j.boat_id || '',
      type: j.type || 'corrective',
      title: j.title || '',
      detail: j.detail || '',
      location: j.location || '',
      status: j.status || 'pending',
      startDate: j.start_date || '',
      endDate: j.end_date || null,
      incidentId: j.incident_id || null,
      boatStatus: boatStatus,
      boatStatusReason: j.boat_status_reason || null,
      setFixing: setFixing,
      outcome: j.outcome || null,
      closeNote: j.close_note || null,
      awaitingInvoice: !!j.awaiting_invoice,
      parentProjectId: j.parent_project_id || null,
      cost: j.cost != null ? num(j.cost) : num(j.legacy_cost),
      partsCost: j.parts_cost != null ? num(j.parts_cost) : 0,
      memoCost: j.memo_cost != null ? num(j.memo_cost) : 0,
      partsCovered: j.parts_covered != null ? num(j.parts_covered) : 0,
      boardLane: j.board_lane || null,
      lane: j.lane || null,
      silentDays: j.silent_days != null ? num(j.silent_days) : null,      // null = the server did not say: flBoardSilent / flBoardBlocks fall back to the browser rule
      blocksBoat: j.blocks_boat != null ? !!j.blocks_boat : null,
      owner: j.owner || '',
      due: j.due_date || '',
      dueDate: j.due_date || null,
      parked: j.parked_on || null,
      parkedOn: j.parked_on || null,
      pinned: !!j.pinned,
      pinnedAt: j.pinned_on || null,
      assets: Array.isArray(j.assets) ? j.assets.map(mapJobAsset) : [],
      parts: Array.isArray(j.parts) ? j.parts.map(mapJobPart) : [],
      progressLog: Array.isArray(j.progress_log) ? j.progress_log.map(mapProgressLine) : [],
      subs: Array.isArray(j.steps) ? j.steps.map(mapJobStep) : [],
      _fromOpsBackend: true
    };
  }

  function replaceIncidents(rows){
    var mapped = (rows || []).map(fromServerIncident);
    var target = listIncidents();
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function upsertIncident(row){
    var mapped = fromServerIncident(row);
    var target = listIncidents();
    var idx = target.findIndex(function(x){ return x && x.id === mapped.id; });
    if(idx < 0) target.unshift(mapped);
    else target[idx] = mapped;
    return mapped;
  }

  function removeIncidentLocal(id){
    var target = listIncidents();
    var idx = target.findIndex(function(x){ return x && x.id === id; });
    if(idx >= 0) target.splice(idx, 1);
  }

  function replaceJobs(rows){
    var mapped = (rows || []).map(fromServerJob);
    var target = listJobs();
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function upsertJob(row){
    var mapped = fromServerJob(row);
    var target = listJobs();
    var idx = target.findIndex(function(x){ return x && x.id === mapped.id; });
    if(idx < 0) target.unshift(mapped);
    else target[idx] = mapped;
    return mapped;
  }

  function removeJobLocal(id){
    var target = listJobs();
    var idx = target.findIndex(function(x){ return x && x.id === id; });
    if(idx >= 0) target.splice(idx, 1);
  }

  function refetchAll(boatId){
    var tasks = [
      O.get('/v1/fleet/incidents').then(function(r){
        replaceIncidents((r && r.incidents) || []);
        if(r && r.next_no) state.nextIncNo = r.next_no;
      }),
      O.get('/v1/fleet/jobs').then(function(r){
        replaceJobs((r && r.jobs) || []);
        if(r && r.next_no) state.nextJobNo = r.next_no;
      })
    ];
    if(O.fleetAssets && typeof O.fleetAssets.refetchChain === 'function'){
      tasks.push(O.fleetAssets.refetchChain().catch(function(){}));
    }
    if(boatId && O.fleetBoats && typeof O.fleetBoats.refetchBoat === 'function'){
      tasks.push(O.fleetBoats.refetchBoat(boatId).catch(function(){}));
    } else if(O.fleetBoats && typeof O.fleetBoats.load === 'function'){
      tasks.push(O.fleetBoats.load().catch(function(){}));
    }
    return Promise.all(tasks);
  }

  function loadAll(force){
    if(!enabled()) return Promise.resolve(false);
    if(state.loaded && !force) return Promise.resolve(true);
    if(state.loading) return state.loading;
    state.loading = Promise.all([
      O.get('/v1/fleet/incidents'),
      O.get('/v1/fleet/jobs')
    ]).then(function(res){
      replaceIncidents((res[0] && res[0].incidents) || []);
      if(res[0] && res[0].next_no) state.nextIncNo = res[0].next_no;
      replaceJobs((res[1] && res[1].jobs) || []);
      if(res[1] && res[1].next_no) state.nextJobNo = res[1].next_no;
      state.loaded = true;
      state.failed = false;
      return true;
    }).catch(function(e){
      state.failed = true;
      O.fail('Could not load incidents and maintenance jobs from operation-backend', e);
      throw e;
    }).finally(function(){
      state.loading = null;
    });
    return state.loading;
  }

  function redrawJobs(){
    try{ if(typeof window.flRenderIncident === 'function' && document.getElementById('fl-inc-list')) window.flRenderIncident(); }catch(_){}
    try{ if(typeof window.flRenderMaint === 'function' && document.getElementById('fl-maint-list')) window.flRenderMaint(); }catch(_){}
    try{ if(typeof window.flBoardRefresh === 'function' && document.getElementById('fl-board')) window.flBoardRefresh(); }catch(_){}
    try{ if(typeof window.renderBoats === 'function') window.renderBoats(); }catch(_){}
    try{ if(typeof window.flRenderEngList === 'function' && document.getElementById('fl-engs-pink-wrap')) window.flRenderEngList(); }catch(_){}
  }

  function toDamagedAssetPayload(a){
    a = a || {};
    var type = text(a.type);
    if(type === 'engine' || type === 'gearbox' || type === 'propeller'){
      return { type: type, asset_id: text(a.asset_id || a.assetId || a.engId || a.gbId || a.propId || a.id) };
    }
    return { type: type || 'hull', label: text(a.label) };
  }

  function toIncidentCreateBody(d){
    d = d || {};
    var body = {
      no: text(d.no),
      boat_id: text(d.boat_id != null ? d.boat_id : d.boatId),
      date: text(d.date),
      time: nullable(d.time),
      title: text(d.title),
      detail: nullable(d.detail),
      remark: nullable(d.remark),
      priority: parseInt(d.priority, 10) || 5,
      damaged_assets: (d.damaged_assets || d.damagedAssets || []).map(toDamagedAssetPayload)
    };
    if(d.quick_fix !== undefined || d.quickFix !== undefined) body.quick_fix = !!(d.quick_fix != null ? d.quick_fix : d.quickFix);
    if(nullable(d.cause)) body.cause = nullable(d.cause);
    return body;
  }

  function toIncidentPatchBody(d){
    d = d || {};
    var body = {};
    if(d.no !== undefined) body.no = text(d.no);
    if(d.boat_id !== undefined || d.boatId !== undefined) body.boat_id = text(d.boat_id != null ? d.boat_id : d.boatId);
    if(d.date !== undefined) body.date = text(d.date);
    if(d.time !== undefined) body.time = nullable(d.time);
    if(d.title !== undefined) body.title = text(d.title);
    if(d.detail !== undefined) body.detail = nullable(d.detail);
    if(d.remark !== undefined) body.remark = nullable(d.remark);
    if(d.priority !== undefined) body.priority = parseInt(d.priority, 10) || 5;
    if(d.damaged_assets !== undefined || d.damagedAssets !== undefined){
      body.damaged_assets = (d.damaged_assets || d.damagedAssets || []).map(toDamagedAssetPayload);
    }
    return body;
  }

  function toJobCreateBody(d){
    d = d || {};
    var boatStatus = d.boat_status || d.boatStatus || (d.setFixing === false ? 'available' : 'fixing');
    var body = {
      boat_id: text(d.boat_id != null ? d.boat_id : d.boatId),
      title: text(d.title),
      type: text(d.type) || 'corrective',
      boat_status: boatStatus
    };
    if(d.no) body.no = text(d.no);
    if(d.nos) body.nos = d.nos;
    if(d.per_asset !== undefined) body.per_asset = !!d.per_asset;
    if(d.create_anyway !== undefined) body.create_anyway = !!d.create_anyway;
    if(nullable(d.detail)) body.detail = nullable(d.detail);
    if(nullable(d.location)) body.location = nullable(d.location);
    if(nullable(d.start_date != null ? d.start_date : d.startDate)) body.start_date = nullable(d.start_date != null ? d.start_date : d.startDate);
    if(nullable(d.incident_id != null ? d.incident_id : d.incidentId)) body.incident_id = nullable(d.incident_id != null ? d.incident_id : d.incidentId);
    if(nullable(d.parent_project_id != null ? d.parent_project_id : d.parentProjectId)) body.parent_project_id = nullable(d.parent_project_id != null ? d.parent_project_id : d.parentProjectId);
    if(boatStatus === 'unavailable' && nullable(d.boat_status_reason != null ? d.boat_status_reason : d.boatStatusReason)){
      body.boat_status_reason = nullable(d.boat_status_reason != null ? d.boat_status_reason : d.boatStatusReason);
    }
    if(Array.isArray(d.assets)){
      body.assets = d.assets.map(toDamagedAssetPayload);
    }
    return body;
  }

  function toJobCloseBody(outcome, note, awaitingInvoice, resetService){
    var body = {
      outcome: text(outcome) || 'success',
      note: nullable(note) || ''
    };
    if(awaitingInvoice !== undefined) body.awaiting_invoice = !!awaitingInvoice;
    if(resetService !== undefined) body.reset_service = !!resetService;
    return body;
  }

  function computeNextNo(prefix, list){
    var max = (list || []).reduce(function(m, item){
      var n = parseInt(String((item && item.no) || '').replace(new RegExp('^' + prefix + '-'), ''), 10) || 0;
      return Math.max(m, n);
    }, 0);
    return prefix + '-' + String(max + 1).padStart(3, '0');
  }

  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsFleetJobs = true;
    window[name] = w;
  }

  /* Job board (legacy flBoardSilent / flBoardBlocks / flBoardLane): the days since the last log line, whether the
     job holds its boat, and the board lane are the server's answers on each job (silent_days, blocks_boat, lane;
     fleet-jobs.ts silentDays / jobLane), read with the job list. The browser rule stays for a job the server
     did not send (a draft not saved yet). flBoardScan's header counts are built from these, so they follow. */
  wrap('flBoardSilent', function(orig, m){
    if(m && m._fromOpsBackend && m.silentDays != null) return m.silentDays;
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('flBoardBlocks', function(orig, m){
    if(m && m._fromOpsBackend && m.blocksBoat != null) return !!m.blocksBoat;
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('flBoardLane', function(orig, m){
    if(m && m._fromOpsBackend && m.lane) return m.lane;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flMaintCalcCost', function(orig, id){
    var m = listJobs().find(function(x){ return x && x.id === id; });
    if(m && m._fromOpsBackend && typeof m.cost === 'number') return m.cost;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flSaveIncident', function(){
    var d = function(id){ return document.getElementById(id); };
    var boatId = d('fl-inc-boat') ? d('fl-inc-boat').value : '';
    var date = d('fl-inc-date') ? d('fl-inc-date').value : '';
    var time = d('fl-inc-time') ? d('fl-inc-time').value : '';
    var title = d('fl-inc-title') ? d('fl-inc-title').value.trim() : '';
    if(!boatId || !date || !title){ alert('กรุณากรอกข้อมูลให้ครบ'); return null; }

    var damagedAssets = [];
    [].slice.call(document.querySelectorAll('.dmg-engine-cb:checked')).forEach(function(cb){
      damagedAssets.push({ type: 'engine', asset_id: cb.value });
    });
    [].slice.call(document.querySelectorAll('.dmg-gearbox-cb:checked')).forEach(function(cb){
      damagedAssets.push({ type: 'gearbox', asset_id: cb.value });
    });
    [].slice.call(document.querySelectorAll('.dmg-propeller-cb:checked')).forEach(function(cb){
      damagedAssets.push({ type: 'propeller', asset_id: cb.value });
    });
    var hullRaw = d('fl-inc-dmg-hull') ? d('fl-inc-dmg-hull').value.trim() : '';
    if(hullRaw){
      hullRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean).forEach(function(label){
        damagedAssets.push({ type: 'hull', label: label });
      });
    }
    var remark = d('fl-inc-remark') ? d('fl-inc-remark').value.trim() : '';
    var detail = d('fl-inc-detail-input') ? d('fl-inc-detail-input').value.trim() : '';
    var priority = d('fl-inc-priority') ? (parseInt(d('fl-inc-priority').value, 10) || 5) : 5;
    var editId = typeof _editingIncId !== 'undefined' ? _editingIncId : null;

    if(editId){
      var patchBody = toIncidentPatchBody({
        boatId: boatId, date: date, time: time, title: title, detail: detail, remark: remark, priority: priority, damagedAssets: damagedAssets
      });
      return O.queue(function(){
        return O.patch('/v1/fleet/incidents/' + enc(editId), patchBody);
      }).then(function(res){
        upsertIncident(res);
        if(typeof _editingIncId !== 'undefined') _editingIncId = null;
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-incident');
        O.wrote('fleet-incident-patch');
        redrawJobs();
        return res;
      }).catch(function(e){ O.fail('Could not update incident', e); return null; });
    }

    var isQuickFix = !!(d('fl-inc-quickfix') && d('fl-inc-quickfix').checked);
    var cause = d('fl-inc-cause') ? d('fl-inc-cause').value : '';
    var no = computeNextNo('INC', listIncidents());
    var createBody = toIncidentCreateBody({
      no: no, boatId: boatId, date: date, time: time, title: title, detail: detail, remark: remark,
      priority: priority, damagedAssets: damagedAssets, quickFix: isQuickFix, cause: cause
    });

    return O.queue(function(){
      return O.post('/v1/fleet/incidents', createBody);
    }).then(function(res){
      return refetchAll(boatId).then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-incident');
        if(typeof window.flShowToast === 'function') window.flShowToast((isQuickFix ? 'Quick Fix' : 'Incident') + ' logged: ' + (res && res.no || no));
        O.wrote('fleet-incident-create');
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not create incident', e); return null; });
  });

  wrap('flDeleteIncident', function(orig, id){
    if(!id) return null;
    if(!confirm('ลบ Incident นี้?')) return null;
    return O.queue(function(){
      return O.del('/v1/fleet/incidents/' + enc(id));
    }).then(function(){
      removeIncidentLocal(id);
      O.wrote('fleet-incident-delete');
      redrawJobs();
    }).catch(function(e){ O.fail('Could not delete incident', e); return null; });
  });

  wrap('flAddIncLog', function(orig, incId){
    var inp = document.getElementById('log-text-' + incId);
    var byInp = document.getElementById('log-by-' + incId);
    var txt = inp ? inp.value.trim() : '';
    if(!txt) return null;
    var by = byInp ? byInp.value.trim() : '';
    return O.queue(function(){
      return O.post('/v1/fleet/incidents/' + enc(incId) + '/log', { text: txt, by: by });
    }).then(function(res){
      upsertIncident(res);
      if(inp) inp.value = '';
      O.wrote('fleet-incident-log');
      redrawJobs();
      return res;
    }).catch(function(e){ O.fail('Could not add incident log', e); return null; });
  });

  wrap('flSaveCreateJob', function(){
    var d = function(id){ return document.getElementById(id); };
    var boatId = d('job-boat') ? d('job-boat').value : '';
    var title = d('job-title') ? d('job-title').value.trim() : '';
    var startDate = d('job-start-date') ? d('job-start-date').value : O.today();
    if(!boatId || !title){ alert('กรุณาเลือกเรือและกรอกชื่องาน'); return null; }

    var activeJobs = listJobs().filter(function(m){ return m && m.boatId === boatId && m.status !== 'done'; });
    var createAnyway = false;
    if(activeJobs.length > 0){
      var jobList = activeJobs.map(function(m){ return '• ' + m.no + ' (' + (m.status === 'inprogress' ? 'In Progress' : 'Pending') + ')'; }).join('\n');
      if(!confirm('เรือนี้มี Job ที่ยังเปิดอยู่:\n' + jobList + '\n\nต้องการสร้าง Job ใหม่เพิ่มหรือไม่?')) return null;
      createAnyway = true;
    }

    var incId = d('job-incident') ? (d('job-incident').value || null) : null;
    var inc = incId ? listIncidents().find(function(x){ return x && x.id === incId; }) : null;
    if(inc && inc.damagedAssets && inc.damagedAssets.length > 1 && !window._flJobMode){
      if(typeof window.flOpenJobChoiceModal === 'function'){ window.flOpenJobChoiceModal(inc); return null; }
    }
    var chosenMode = window._flJobMode;
    window._flJobMode = null;

    var jType = typeof _jobType !== 'undefined' && _jobType ? _jobType : 'corrective';
    var setFixingEl = d('job-fixing');
    var boatStatus = typeof _jobBoatStatus !== 'undefined' && _jobBoatStatus ? _jobBoatStatus
      : (setFixingEl && setFixingEl.checked === false ? 'available' : (jType === 'scheduled' ? 'unavailable' : jType === 'preventive' ? 'available' : 'fixing'));
    var reasonEl = d('job-status-reason');
    var boatStatusReason = boatStatus === 'unavailable' ? ((reasonEl && reasonEl.value) || 'scheduled_maint') : null;
    var detail = d('job-detail') ? d('job-detail').value.trim() : '';
    var location = d('job-location') ? d('job-location').value.trim() : '';
    var projId = typeof _projCreateForId !== 'undefined' && _projCreateForId ? _projCreateForId : null;

    var maxNo = listJobs().reduce(function(m, item){
      var n = parseInt(String((item && item.no) || '').replace(/^MJ-/, ''), 10) || 0;
      return Math.max(m, n);
    }, 0);

    var assets = [];
    if(!incId){
      [].slice.call(document.querySelectorAll('.job-asset-eng-cb:checked')).forEach(function(cb){
        assets.push({ type: 'engine', asset_id: cb.value });
      });
      [].slice.call(document.querySelectorAll('.job-asset-gb-cb:checked')).forEach(function(cb){
        assets.push({ type: 'gearbox', asset_id: cb.value });
      });
      [].slice.call(document.querySelectorAll('.job-asset-prop-cb:checked')).forEach(function(cb){
        assets.push({ type: 'propeller', asset_id: cb.value });
      });
      var hullRaw = d('job-asset-hull') ? d('job-asset-hull').value.trim() : '';
      if(hullRaw){
        hullRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean).forEach(function(label){
          assets.push({ type: 'hull', label: label });
        });
      }
    }

    var body = toJobCreateBody({
      boat_id: boatId,
      title: title,
      type: jType,
      detail: detail,
      location: location,
      start_date: startDate,
      incident_id: incId,
      boat_status: boatStatus,
      boat_status_reason: boatStatusReason,
      parent_project_id: projId,
      create_anyway: createAnyway
    });

    if(inc && inc.damagedAssets && inc.damagedAssets.length > 1){
      if(chosenMode === 'split'){
        body.per_asset = true;
        body.nos = inc.damagedAssets.map(function(_, idx){ return 'MJ-' + String(maxNo + idx + 1).padStart(3, '0'); });
      } else {
        body.per_asset = false;
        body.no = 'MJ-' + String(maxNo + 1).padStart(3, '0');
      }
    } else {
      body.no = 'MJ-' + String(maxNo + 1).padStart(3, '0');
      if(!incId && assets.length) body.assets = assets;
    }

    return O.queue(function(){
      return O.post('/v1/fleet/jobs', body);
    }).then(function(res){
      var created = (res && res.jobs) || [];
      created.forEach(upsertJob);
      return refetchAll(boatId).then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-create-job');
        if(created[0] && typeof _selMaintId !== 'undefined') _selMaintId = created[0].id;
        O.wrote('fleet-job-create');
        redrawJobs();
        return created;
      });
    }).catch(function(e){ O.fail('Could not create maintenance job', e); return null; });
  });

  wrap('flMaintStart', function(orig, id, opt){
    var m = listJobs().find(function(x){ return x && x.id === id; });
    if(!m) return null;
    var body = Object.assign({}, opt || {});
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(id) + '/start', body);
    }).then(function(res){
      upsertJob(res);
      return refetchAll(m.boatId).then(function(){
        O.wrote('fleet-job-start');
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not start maintenance job', e); return null; });
  });

  wrap('flMaintClose', function(orig, id, outcome, note, awaitInvoice){
    var m = listJobs().find(function(x){ return x && x.id === id; });
    if(!m) return null;
    var body = toJobCloseBody(outcome || 'success', note || '', awaitInvoice);
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(id) + '/close', body).catch(function(e){
        if(e && e.code === 'reset_service_choice'){
          var reset = confirm('Service (oil change) - reset the service-hour baseline for engines/gearboxes on this job?');
          return O.post('/v1/fleet/jobs/' + enc(id) + '/close', toJobCloseBody(outcome || 'success', note || '', awaitInvoice, reset));
        }
        throw e;
      });
    }).then(function(res){
      upsertJob(res);
      return refetchAll(m.boatId).then(function(){
        O.wrote('fleet-job-close');
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not close maintenance job', e); return null; });
  });

  wrap('flDeleteMaint', function(orig, id){
    if(!id) return null;
    if(!confirm('ลบ Maintenance Job นี้?')) return null;
    return O.queue(function(){
      return O.del('/v1/fleet/jobs/' + enc(id));
    }).then(function(){
      removeJobLocal(id);
      O.wrote('fleet-job-delete');
      redrawJobs();
    }).catch(function(e){ O.fail('Could not delete maintenance job', e); return null; });
  });

  wrap('flMaintServiceResetManual', function(orig, jobId){
    var m = listJobs().find(function(x){ return x && x.id === jobId; });
    if(!m) return null;
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(jobId) + '/reset-service', {});
    }).then(function(res){
      upsertJob(res);
      return refetchAll(m.boatId).then(function(){
        O.wrote('fleet-job-reset-service');
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not reset service hours', e); return null; });
  });

  wrap('flSaveEditBoatStatus', function(){
    var jobId = typeof _ebsJobId !== 'undefined' ? _ebsJobId : null;
    var m = jobId ? listJobs().find(function(x){ return x && x.id === jobId; }) : null;
    if(!m) return null;
    var d = function(id){ return document.getElementById(id); };
    var status = typeof _ebsNewStatus !== 'undefined' ? _ebsNewStatus : null;
    if(!status) return null;
    var effDate = d('ebs-date') ? d('ebs-date').value : O.today();
    var reason = status === 'unavailable' && d('ebs-reason') ? d('ebs-reason').value : null;
    var note = d('ebs-note') ? d('ebs-note').value.trim() : '';
    var body = { status: status, effective_date: effDate };
    if(reason) body.reason = reason;
    if(note) body.note = note;
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(jobId) + '/boat-status', body);
    }).then(function(res){
      upsertJob(res);
      return refetchAll(m.boatId).then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-edit-boat-status');
        O.wrote('fleet-job-boat-status');
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not change job boat status', e); return null; });
  });

  wrap('flMaintAddAsset', function(orig, jobId, type){
    var m = listJobs().find(function(x){ return x && x.id === jobId; });
    if(!m) return null;
    var dtlEl = document.getElementById('asset-dtl-' + jobId + '-' + type);
    var detail = dtlEl ? dtlEl.value.trim() : '';
    var sel = document.getElementById('asset-sel-' + jobId + '-' + type);
    var lblEl = document.getElementById('asset-lbl-' + jobId + '-' + type);
    var body = { type: type };
    if(detail) body.detail = detail;
    if(type === 'engine' || (sel && sel.value)){
      var aid = sel ? sel.value : '';
      if(!aid){ alert('กรุณาเลือก'); return null; }
      body.asset_id = aid;
    } else {
      var lbl = lblEl ? lblEl.value.trim() : '';
      if(!lbl){ alert('กรุณากรอกชื่อ/รายละเอียด'); return null; }
      body.label = lbl;
    }
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(jobId) + '/assets', body);
    }).then(function(res){
      upsertJob(res);
      return refetchAll(m.boatId).then(function(){
        O.wrote('fleet-job-asset-add');
        if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not add asset to job', e); return null; });
  });

  wrap('flMaintRemoveAsset', function(orig, jobId, idx){
    var m = listJobs().find(function(x){ return x && x.id === jobId; });
    if(!m) return null;
    return O.queue(function(){
      return O.del('/v1/fleet/jobs/' + enc(jobId) + '/assets/' + enc(idx));
    }).then(function(res){
      upsertJob(res);
      return refetchAll(m.boatId).then(function(){
        O.wrote('fleet-job-asset-remove');
        if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not remove asset from job', e); return null; });
  });

  /* ── board lane, board log, work-board note, asset prompt ──
     Legacy changed m.boardLane and m.progressLog in the browser only (flSave was a no-op here). Server first:
     PATCH …/jobs/{id} {board_lane}, POST …/jobs/{id}/log {text, by}. The log line also goes onto the linked
     incident on the server, as legacy's flPushLog did. */
  wrap('flBoardLog', function(orig, m, text){
    if(!m || !m.id) return null;
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(m.id) + '/log', { text: String(text || ''), by: 'บอร์ดงานเรือ' });
    }).then(function(res){
      upsertJob(res);
      O.wrote('fleet-job-log');
      return res;
    }).catch(function(e){ O.fail('Could not add job log', e); return null; });
  });

  /* moves each job to the lane (one PATCH each), then writes its log line through the wrapped flBoardLog
     (its own queue entry: a queued fn must not queue again) */
  function moveJobsToLane(list, to, label, suffix){
    return O.queue(function(){
      return list.reduce(function(p, m){
        return p.then(function(){
          return O.patch('/v1/fleet/jobs/' + enc(m.id), { board_lane: to }).then(function(res){ upsertJob(res); });
        });
      }, Promise.resolve());
    }).then(function(){
      return list.reduce(function(p, m){
        return p.then(function(){ return window.flBoardLog(m, 'ย้ายไปเลน "' + label + '"' + suffix); });
      }, Promise.resolve());
    }).then(function(){
      O.wrote('fleet-job-lane');
      redrawJobs();
      return null;
    }, function(e){
      O.fail('Could not move the job on the board', e);
      redrawJobs();
      return null;
    });
  }

  wrap('flBoardDrop', function(orig, ev, el){
    ev.preventDefault(); el.classList.remove('drop');
    if(!flBoardCanEdit()) return null;
    var to = el.getAttribute('data-lane'); if(!to) return null;
    var L = FL_BOARD_LANES.filter(function(x){ return x.id === to; })[0];
    var label = L ? L.t : to;
    if(_flBoardGrpDrag){
      var bid = _flBoardGrpDrag; _flBoardGrpDrag = '';
      var mv = flBoardJobs().filter(function(x){ return x.boatId === bid && flBoardLane(x) !== to; });
      if(!mv.length) return null;
      return moveJobsToLane(mv, to, label, ' · ยกทั้งลำ').then(function(){
        var bt = (typeof getBoat === 'function') ? getBoat(bid) : null;
        if(typeof window.flShowToast === 'function') window.flShowToast(((bt && bt.name) || bid) + ' · ย้าย ' + mv.length + ' ใบ → ' + label);
        return null;
      });
    }
    var id = _flBoardDrag || (ev.dataTransfer ? ev.dataTransfer.getData('text/plain') : '');
    var m = listJobs().filter(function(x){ return x && x.id === id; })[0];
    if(!m) return null;
    if(flBoardLane(m) === to) return null;
    return moveJobsToLane([m], to, label, '').then(function(){
      if(typeof window.flShowToast === 'function') window.flShowToast((m.no || '') + ' → ' + label);
      return null;
    });
  });

  /* the board card's Save (owner, due date, note) and Park. Legacy set m.owner / m.dueDate / m.parked in the browser.
     Server first: PATCH …/jobs/{id} {owner, due_date} for what changed (the server writes the change line itself), then the
     note through the wrapped flBoardLog (POST …/log; the server frees a lane dragged to decide or wait). The card closes
     when the server has said yes. */
  wrap('flBoardSaveCard', function(orig){
    var m = window._flBoardCur ? window._flBoardCur() : null;
    if(!m || !window.flBoardCanEdit()) return null;
    var own = (document.getElementById('fl-bd-own') || {}).value || '';
    var due = (document.getElementById('fl-bd-due') || {}).value || '';
    var nt = ((document.getElementById('fl-bd-note') || {}).value || '').trim();
    var patch = {};
    if(String(m.owner || '') !== String(own)) patch.owner = own.trim();
    if(String(m.dueDate || '') !== String(due)) patch.due_date = due || null;
    if(!nt && !Object.keys(patch).length){ window.flBoardPopClose(); return null; }
    var step = Object.keys(patch).length
      ? O.queue(function(){ return O.patch('/v1/fleet/jobs/' + enc(m.id), patch); }).then(function(res){ upsertJob(res); })
      : Promise.resolve();
    return step.then(function(){
      return nt ? window.flBoardLog(m, nt) : null;
    }).then(function(){
      O.wrote('fleet-job-board-card');
      window.flBoardPopClose(); redrawJobs();
      if(typeof window.flShowToast === 'function') window.flShowToast(nt ? ((m.no || '') + ' · บันทึกแล้ว') : ((m.no || '') + ' · อัปเดตแล้ว'));
      return null;
    }).catch(function(e){ O.fail('Could not save the board card', e); redrawJobs(); return null; });
  });

  wrap('flBoardPark', function(orig){
    var m = window._flBoardCur ? window._flBoardCur() : null;
    if(!m || !window.flBoardCanEdit()) return null;
    return O.queue(function(){
      return O.patch('/v1/fleet/jobs/' + enc(m.id), { parked: true });
    }).then(function(res){
      upsertJob(res);
      O.wrote('fleet-job-park');
      window.flBoardPopClose(); redrawJobs();
      if(typeof window.flShowToast === 'function') window.flShowToast((m.no || '') + ' · พักไว้แล้ว · ไม่นับในบอร์ด');
      return res;
    }).catch(function(e){ O.fail('Could not park the job', e); return null; });
  });

  /* link / unlink a Scheduled job to a Project: legacy's checks and prompts are kept, the link is PATCH …/jobs/{id}
     {parent_project_id}. The server writes the job's line and the project's line. */
  wrap('flMaintLinkProjectPick', function(orig, mjId){
    var m = listJobs().find(function(x){ return x && x.id === mjId; });
    if(!m){ alert('MJ not found'); return null; }
    if(m.type !== 'scheduled'){
      alert('Only Scheduled MJs can be linked to a Project.\n\nCorrective / Preventive jobs are independent.');
      return null;
    }
    var projects = typeof FL_PROJECTS !== 'undefined' && Array.isArray(FL_PROJECTS) ? FL_PROJECTS : [];
    var candidates = projects.filter(function(p){ return p.boatId === m.boatId && p.status !== 'completed'; });
    if(!candidates.length){ alert('No open projects for this boat. Create one from the Projects page first.'); return null; }
    var list = candidates.map(function(p, i){ return (i + 1) + '. ' + p.no + ' · ' + p.name + ' (' + p.status + ')'; }).join('\n');
    var pick = prompt('Link ' + (m.no || m.id) + ' to which project?\n\n' + list + '\n\nEnter number:');
    if(!pick) return null;
    var proj = candidates[parseInt(pick, 10) - 1];
    if(!proj){ alert('Invalid choice'); return null; }
    return O.queue(function(){
      return O.patch('/v1/fleet/jobs/' + enc(mjId), { parent_project_id: proj.id });
    }).then(function(res){
      upsertJob(res);
      O.wrote('fleet-job-project-link');
      if(O.fleetDaily && typeof O.fleetDaily.load === 'function') return O.fleetDaily.load().catch(function(){});
    }).then(function(){
      if(typeof window.flRenderMaintDetailPink === 'function') window.flRenderMaintDetailPink();
      redrawJobs();
      if(typeof window.flShowToast === 'function') window.flShowToast('Linked to ' + proj.no);
      return null;
    }).catch(function(e){ O.fail('Could not link the job to the project', e); return null; });
  });

  wrap('flMaintUnlinkProject', function(orig, mjId){
    var m = listJobs().find(function(x){ return x && x.id === mjId; });
    if(!m || !m.parentProjectId) return null;
    var projects = typeof FL_PROJECTS !== 'undefined' && Array.isArray(FL_PROJECTS) ? FL_PROJECTS : [];
    var proj = projects.find(function(p){ return p.id === m.parentProjectId; });
    if(!confirm('Unlink ' + (m.no || m.id) + ' from project ' + (proj ? proj.no : '') + '?')) return null;
    var projNo = proj ? proj.no : m.parentProjectId;
    return O.queue(function(){
      return O.patch('/v1/fleet/jobs/' + enc(mjId), { parent_project_id: null });
    }).then(function(res){
      upsertJob(res);
      O.wrote('fleet-job-project-unlink');
      if(typeof window.flRenderMaintDetailPink === 'function') window.flRenderMaintDetailPink();
      redrawJobs();
      if(typeof window.flShowToast === 'function') window.flShowToast('Unlinked from ' + projNo);
      return res;
    }).catch(function(e){ O.fail('Could not unlink the job from the project', e); return null; });
  });

  /* "add every engine of the boat to this job" (flEngAddAllToJob) and "one job per engine" (flEngSplitIntoJobs).
     The engines still to add are the boat's engines that are not on the job (engines come from the server, FL_ENGINES). */
  function enginesToAdd(m){
    var all = typeof FL_ENGINES !== 'undefined' && Array.isArray(FL_ENGINES) ? FL_ENGINES : [];
    var onJob = {};
    (m.assets || []).forEach(function(a){ if(a && (a.engId || (a.type === 'engine' && a.assetId))) onJob[a.engId || a.assetId] = true; });
    return all.filter(function(e){ return e && e.boatId === m.boatId && !onJob[e.id]; });
  }

  /* no bulk endpoint: one POST …/assets per engine, in order, then the chain is read again. A refusal stops the rest. */
  wrap('flEngAddAllToJob', function(orig, jobId){
    var m = listJobs().find(function(x){ return x && x.id === jobId; });
    if(!m) return null;
    var toAdd = enginesToAdd(m);
    if(!toAdd.length){ alert('เครื่องยนต์ทั้งหมดอยู่ในรายการแล้ว'); return null; }
    return O.queue(function(){
      return toAdd.reduce(function(p, e){
        return p.then(function(){ return O.post('/v1/fleet/jobs/' + enc(jobId) + '/assets', { type: 'engine', asset_id: e.id }); });
      }, Promise.resolve());
    }).then(function(){
      return refetchAll(m.boatId);
    }).then(function(){
      O.wrote('fleet-job-asset-add');
      if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
      redrawJobs();
      return null;
    }).catch(function(e){
      O.fail('Could not add the engines to the job', e);
      return refetchAll(m.boatId).then(function(){ redrawJobs(); }, function(){});
    });
  });

  /* POST …/split {by:'boat_engines', nos}: the server needs one MJ number per NEW job (the first engine joins this job
     when it has no engine yet), numbered after the highest MJ number the browser holds, as flSplitExistingJob does. */
  wrap('flEngSplitIntoJobs', function(orig, jobId){
    var m = listJobs().find(function(x){ return x && x.id === jobId; });
    if(!m) return null;
    var toAdd = enginesToAdd(m);
    if(!toAdd.length){ alert('เครื่องยนต์ทั้งหมดอยู่ในรายการแล้ว'); return null; }
    var hasOwnEngine = (m.assets || []).some(function(a){ return a && (a.engId || (a.type === 'engine' && a.assetId)); });
    var fresh = toAdd.length - (hasOwnEngine ? 0 : 1);
    var maxNo = listJobs().reduce(function(mx, item){
      var n = parseInt(String((item && item.no) || '').replace(/^MJ-/, ''), 10) || 0;
      return Math.max(mx, n);
    }, 0);
    var nos = [];
    for(var i = 0; i < fresh; i++) nos.push('MJ-' + String(maxNo + i + 1).padStart(3, '0'));
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(jobId) + '/split', { by: 'boat_engines', nos: nos });
    }).then(function(res){
      return refetchAll(m.boatId).then(function(){
        O.wrote('fleet-job-split');
        if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
        redrawJobs();
        if(typeof window.flShowToast === 'function') window.flShowToast('แยกเป็น ' + toAdd.length + ' งาน (1 งาน/เครื่อง)');
        return res;
      });
    }).catch(function(e){ O.fail('Could not split the job', e); return null; });
  });

  /* "Add work" form (flnSave / flnSaveJob). Legacy drove the report and job forms and read the lists at once; in ops
     flSaveIncident / flSaveCreateJob answer a promise, so it saw nothing and stopped with "not saved". The same steps
     now wait for each answer: report, then job, then owner / due (PATCH …/jobs/{id}), then start, then the parts memo.
     The new rows are found by the id the server answered. A step that fails stops the rest and says what was saved. */
  function flnHide(id, on){ var el = document.getElementById(id); if(el) el.style.display = on ? 'none' : ''; }
  function flnSet(id, v){ var el = document.getElementById(id); if(el) el.value = v; }
  function flnPatchOwnerDue(F, jobs){
    if(!F.owner && !F.due) return Promise.resolve();
    var body = {};
    if(F.owner) body.owner = F.owner;
    if(F.due) body.due_date = F.due;
    return jobs.reduce(function(p, m){
      return p.then(function(){ return O.queue(function(){ return O.patch('/v1/fleet/jobs/' + enc(m.id), body); }).then(upsertJob); });
    }, Promise.resolve());
  }
  function flnFinish(F, inc, jobs, note){
    var boat = F.boat;
    var key = jobs.length ? ('mj:' + jobs[0].id) : (F.next === 'quick' ? '' : (inc ? 'inc:' + inc.id : ''));
    window.flnClose();
    FLW.boat = boat; FLW.stage = -1; FLW.bf = (FLW.bf === 'down') ? 'work' : FLW.bf; FLW.item = key;
    try{ window.flRenderWork(); }catch(_){}
    var label = inc ? (inc.no || 'the report') : (jobs[0] && jobs[0].no) || 'the job';
    if(typeof window.flShowToast === 'function') window.flShowToast('Saved ' + label + (inc && jobs.length ? (' and ' + (jobs[0].no || 'the job')) : '') + '.' + note);
  }
  function flnStopped(F, inc, jobs, err){
    try{ console.error('[flnForm] save failed', err); }catch(_){}
    F.busy = false;
    var made = inc || jobs[0];
    alert('Saving stopped part-way. ' + (made
      ? ((inc ? ('The report ' + (inc.no || '') + ' was saved' + (jobs.length ? (' and the job ' + (jobs[0].no || '') + ' was created') : '')) : ('The job ' + (jobs[0].no || '') + ' was created')) + '. Check it on Fleet Work before trying again.')
      : 'Nothing was saved.'));
    if(made){ window.flnClose(); try{ window.flRenderWork(); }catch(_){} }
    return null;
  }

  wrap('flnSave', function(){
    var F = typeof FLN !== 'undefined' ? FLN : null; if(!F || F.busy) return null;
    window.flnSync();
    if(F.kind === 'job'){ window.flnSaveJob(); return null; }
    if(!F.boat || !F.date || !F.title){ alert('Please fill in the boat, the date and what is wrong.'); return null; }
    if(F.next === 'job' && F.jstatus === 'unavailable' && !F.reason){ alert('Please choose why the boat is unavailable.'); return null; }
    F.busy = true;
    var nA = window.flnAssetList().length, inc = null, jobs = [], note = '';
    flnHide('fl-modal-incident', 1);
    var step1;
    try{
      window.flOpenAddIncidentModal(null, { boatId: F.boat, quickFix: F.next === 'quick' });
      flnSet('fl-inc-boat', F.boat); window.flIncUpdateDmgDropdowns(F.boat);
      flnSet('fl-inc-date', F.date); flnSet('fl-inc-time', F.time); flnSet('fl-inc-title', F.title); flnSet('fl-inc-detail-input', F.detail);
      flnSet('fl-inc-remark', F.by); flnSet('fl-inc-priority', String(F.prio)); flnSet('fl-inc-dmg-hull', F.hull); flnSet('fl-inc-cause', F.cause);
      Object.keys(F.assets).forEach(function(k){ var p = k.split('|'), cb = document.querySelector('.dmg-' + p[0] + '-cb[value="' + p[1] + '"]'); if(cb) cb.checked = true; });
      step1 = Promise.resolve(window.flSaveIncident());
    }catch(err){ step1 = Promise.reject(err); }
    return step1.then(function(res){
      try{ window.closeModal('fl-modal-incident'); }catch(_){}
      flnHide('fl-modal-incident', 0);
      if(!res || !res.id){ F.busy = false; alert('The report was not saved. Check the form and try again.'); return null; }
      inc = (typeof FL_INCIDENTS !== 'undefined' ? FL_INCIDENTS : []).find(function(x){ return x && x.id === res.id; }) || fromServerIncident(res);
      if(F.next !== 'job') return flnFinish(F, inc, jobs, note);
      flnHide('fl-modal-create-job', 1);
      var step2;
      try{
        try{ _projCreateForId = null; }catch(_){}
        window.flOpenCreateJobModal(inc.id);
        flnSet('job-title', F.jtitle || F.title); flnSet('job-location', F.loc);
        if(typeof window.selectJobStatusByValue === 'function') window.selectJobStatusByValue(F.jstatus);
        flnSet('job-status-reason', F.jstatus === 'unavailable' ? F.reason : '');
        if(nA > 1) window._flJobMode = 'single';
        step2 = Promise.resolve(window.flSaveCreateJob());
      }catch(err){ step2 = Promise.reject(err); }
      return step2.then(function(){
        window._flJobMode = null;
        try{ window.closeModal('fl-modal-create-job'); window.closeModal('fl-modal-job-choice'); }catch(_){}
        flnHide('fl-modal-create-job', 0);
        jobs = listJobs().filter(function(m){ return m && m.incidentId === inc.id; });
        if(!jobs.length){ note = ' The job was not created, so the report waits at stage Reported.'; return flnFinish(F, inc, jobs, note); }
        return flnPatchOwnerDue(F, jobs).then(function(){
          return F.start ? window.flMaintStart(jobs[0].id) : null;
        }).then(function(){
          if(F.parts){
            if(window._flStartGear) note = ' Finish the start dialog first, then request parts from the job.';
            else window.flMaintCreateMemo(jobs[0].id, true);
          }
          return flnFinish(F, inc, jobs, note);
        });
      }, function(err){
        window._flJobMode = null;
        try{ window.closeModal('fl-modal-create-job'); window.closeModal('fl-modal-job-choice'); }catch(_){}
        flnHide('fl-modal-create-job', 0);
        throw err;
      });
    }, function(err){
      try{ window.closeModal('fl-modal-incident'); }catch(_){}
      flnHide('fl-modal-incident', 0);
      throw err;
    }).catch(function(err){ return flnStopped(F, inc, jobs, err); });
  });

  wrap('flnSaveJob', function(){
    var F = typeof FLN !== 'undefined' ? FLN : null; if(!F || F.busy) return null;
    if(!F.boat || !F.title){ alert('Please fill in the boat and the job title.'); return null; }
    if(F.jstatus === 'unavailable' && !F.reason){ alert('Please choose why the boat is unavailable.'); return null; }
    F.busy = true;
    var jobs = [], note = '', CB = { engine: 'job-asset-eng-cb', gearbox: 'job-asset-gb-cb', propeller: 'job-asset-prop-cb' };
    var n0 = listJobs().map(function(m){ return m && m.id; });
    flnHide('fl-modal-create-job', 1);
    var step1;
    try{
      try{ _projCreateForId = null; }catch(_){}
      window.flOpenCreateJobModal();
      flnSet('job-boat', F.boat);
      var card = document.querySelector('.job-type-card[data-type="' + F.jtype + '"]'); if(card) window.selectJobType(F.jtype, card);
      if(F.jtype === 'preventive'){
        Object.keys(F.assets).forEach(function(k){ var p = k.split('|'), cb = document.querySelector('.' + CB[p[0]] + '[value="' + p[1] + '"]'); if(cb) cb.checked = true; });
        flnSet('job-asset-hull', F.hull);
      }
      flnSet('job-title', F.title); flnSet('job-detail', F.detail); flnSet('job-location', F.loc); flnSet('job-start-date', F.date || O.today());
      if(typeof window.selectJobStatusByValue === 'function') window.selectJobStatusByValue(F.jstatus);
      flnSet('job-status-reason', F.jstatus === 'unavailable' ? F.reason : '');
      step1 = Promise.resolve(window.flSaveCreateJob());
    }catch(err){ step1 = Promise.reject(err); }
    return step1.then(function(created){
      try{ window.closeModal('fl-modal-create-job'); }catch(_){}
      flnHide('fl-modal-create-job', 0);
      var first = created && created[0];
      var job = first ? listJobs().find(function(m){ return m && m.id === first.id; }) : null;
      if(!job) job = listJobs().find(function(m){ return m && n0.indexOf(m.id) < 0; }) || null;
      if(!job){ F.busy = false; alert('The job was not saved. Check the form and try again.'); return null; }
      jobs = [job];
      return flnPatchOwnerDue(F, jobs).then(function(){
        return F.start ? window.flMaintStart(job.id) : null;
      }).then(function(){
        if(F.parts){ if(window._flStartGear) note = ' Finish the start dialog first, then request parts from the job.'; else window.flMaintCreateMemo(job.id, true); }
        var boat = F.boat;
        window.flnClose();
        FLW.boat = boat; FLW.stage = -1; FLW.bf = (FLW.bf === 'down') ? 'work' : FLW.bf; FLW.item = 'mj:' + job.id;
        try{ window.flRenderWork(); }catch(_){}
        if(typeof window.flShowToast === 'function') window.flShowToast('Saved ' + (job.no || 'the job') + '.' + note);
        return null;
      });
    }, function(err){
      try{ window.closeModal('fl-modal-create-job'); }catch(_){}
      flnHide('fl-modal-create-job', 0);
      throw err;
    }).catch(function(err){ return flnStopped(F, null, jobs, err); });
  });

  /* the work board's note box (flw-note): a job's line, or an incident's when the item is "inc:…" */
  wrap('flwAct', function(orig, a, id, x){
    if(a !== 'note') return orig.apply(this, [].slice.call(arguments, 1));
    if(typeof window.flBoardCanEdit === 'function' && !window.flBoardCanEdit()) return null;
    var el = document.getElementById('flw-note');
    var t = el ? String(el.value || '').trim() : '';
    if(!t){ if(el) el.focus(); return null; }
    var by = (typeof window.flBoardWho === 'function' ? window.flBoardWho() : '') || '';
    var isInc = String((typeof FLW !== 'undefined' && FLW.item) || '').indexOf('inc:') === 0;
    var path, body = { text: t };
    if(isInc){ path = '/v1/fleet/incidents/' + enc(id) + '/log'; body.by = by || 'Fleet Work'; }
    else { path = '/v1/fleet/jobs/' + enc(id) + '/log'; if(by) body.by = by; }
    return O.queue(function(){
      return O.post(path, body);
    }).then(function(res){
      if(isInc) upsertIncident(res); else upsertJob(res);
      O.wrote(isInc ? 'fleet-incident-log' : 'fleet-job-log');
      if(typeof window.flwAfter === 'function') window.flwAfter();
      return res;
    }).catch(function(e){ O.fail('Could not add note', e); return null; });
  });

  /* legacy's three prompts (kind, then the list or the hull label) are kept as they were. An engine,
     gearbox or propeller is sent by its id; a hull item by its label. */
  wrap('flMaintAddAssetPrompt', function(orig, jobId){
    var m = listJobs().find(function(x){ return x && x.id === jobId; });
    if(!m) return null;
    var choice = prompt('เพิ่ม asset ประเภทไหน?\n\n  e = engine (เครื่องยนต์)\n  g = gearbox (เกียร์)\n  p = propeller (ใบจักร)\n  h = hull (ตัวเรือ)', 'e');
    if(!choice) return null;
    var c = choice.toLowerCase().trim();
    var type = c.startsWith('e') ? 'engine' : c.startsWith('g') ? 'gearbox' : c.startsWith('p') ? 'propeller' : c.startsWith('h') ? 'hull' : null;
    if(!type){ alert('ประเภทไม่ถูกต้อง'); return null; }
    var body;
    if(type === 'hull'){
      var lbl = prompt('รายการซ่อมตัวเรือ:', '');
      if(!lbl) return null;
      body = { type: 'hull', label: lbl };
    } else {
      var engines = typeof FL_ENGINES !== 'undefined' ? FL_ENGINES : [];
      var gearboxes = typeof FL_GEARBOXES !== 'undefined' ? FL_GEARBOXES : [];
      var propellers = typeof FL_PROPELLERS !== 'undefined' ? FL_PROPELLERS : [];
      var list = type === 'engine' ? engines.filter(function(e){ return e.boatId === m.boatId; })
        : type === 'gearbox' ? gearboxes.filter(function(g){ return g.boatId === m.boatId; })
        : propellers.filter(function(p){
            var gb = gearboxes.find(function(g){ return g.id === p.gearboxId; });
            return gb && gb.boatId === m.boatId;
          });
      if(!list.length){ alert('ไม่มี ' + type + ' ในเรือนี้'); return null; }
      var opts = list.map(function(x, i){ return (i + 1) + '. ' + x.serial + (x.pos ? ' (' + x.pos + ')' : ''); }).join('\n');
      var pickStr = prompt('เลือก ' + type + ':\n' + opts + '\n\n(พิมพ์เลข):', '1');
      if(!pickStr) return null;
      var idx = parseInt(pickStr, 10) - 1;
      if(isNaN(idx) || idx < 0 || idx >= list.length){ alert('เลือกไม่ถูกต้อง'); return null; }
      body = { type: type, asset_id: list[idx].id };
    }
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(jobId) + '/assets', body);
    }).then(function(res){
      upsertJob(res);
      return refetchAll(m.boatId).then(function(){
        O.wrote('fleet-job-asset-add');
        if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not add asset to job', e); return null; });
  });

  wrap('flMaintAddLog', function(orig, jobId){
    var inp = document.getElementById('maint-log-text-' + jobId);
    var dateInp = document.getElementById('maint-log-date-' + jobId);
    var byInp = document.getElementById('maint-log-by-' + jobId);
    var txt = inp ? inp.value.trim() : '';
    if(!txt) return null;
    var body = { text: txt };
    if(dateInp && dateInp.value) body.date = dateInp.value;
    if(byInp && byInp.value.trim()) body.by = byInp.value.trim();
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(jobId) + '/log', body);
    }).then(function(res){
      upsertJob(res);
      if(inp) inp.value = '';
      O.wrote('fleet-job-log');
      if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
      redrawJobs();
      return res;
    }).catch(function(e){ O.fail('Could not add job log', e); return null; });
  });

  /* "Repair location" on a job (flMaintSetRepairLoc).  Legacy set m.location, moved the job's spare/fixing engines
     (e.spareLocation) and added a log line, then flSave (a no-op here): none of it survived a reload.  Server first:
     PATCH the job's location, PATCH each such engine's spare_location (only a filled-in place moves engines, as in
     legacy), add the log line, then re-read the chain; a refusal at any step is a red toast and the screen is re-read
     so it shows what the server holds. */
  wrap('flMaintSetRepairLoc', function(orig, jobId){
    var m = listJobs().find(function(x){ return x && x.id === jobId; });
    if(!m) return null;
    var inp = document.getElementById('fl-maint-reploc-' + jobId);
    var val = inp ? inp.value.trim() : '';
    var engs = !val ? [] : (m.assets || []).filter(function(a){ return a && a.engId; }).map(function(a){
      return typeof window.flGetEng === 'function' ? window.flGetEng(a.engId) : null;
    }).filter(function(e){ return e && (!e.boatId || e.status === 'fixing'); });
    var chain = O.queue(function(){ return O.patch('/v1/fleet/jobs/' + enc(jobId), { location: val }); }).then(upsertJob);
    engs.forEach(function(e){
      chain = chain.then(function(){ return O.queue(function(){ return O.patch('/v1/fleet/engines/' + enc(e.id), { spare_location: val }); }); });
    });
    return chain.then(function(){
      return O.queue(function(){
        return O.post('/v1/fleet/jobs/' + enc(jobId) + '/log', { text: '📍 ตั้งสถานที่ซ่อม: ' + (val || '-') + (engs.length ? ' (อัปเดตเครื่อง ' + engs.length + ' ตัว)' : ''), by: 'ระบบ' });
      });
    }).then(function(res){
      if(res) upsertJob(res);
      return engs.length && O.fleetAssets && O.fleetAssets.refetchChain ? O.fleetAssets.refetchChain() : null;
    }).then(function(){
      O.wrote('fleet-job-location');
      redrawJobs();
      if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
    }).catch(function(e){
      O.fail('Could not set repair location', e);
      return refetchAll(m.boatId).then(function(){ redrawJobs(); }, function(){});
    });
  });

  wrap('flMaintTogglePin', function(orig, id, ev){
    if(ev && ev.stopPropagation) ev.stopPropagation();
    var m = listJobs().find(function(x){ return x && x.id === id; });
    if(!m) return null;
    return O.queue(function(){
      return O.patch('/v1/fleet/jobs/' + enc(id), { pinned: !m.pinned });
    }).then(function(res){
      upsertJob(res);
      O.wrote('fleet-job-pin');
      redrawJobs();
      return res;
    }).catch(function(e){ O.fail('Could not update job pin', e); return null; });
  });

  wrap('flBoardSubTick', function(orig, ev, id, idx, on){
    if(ev && ev.stopPropagation) ev.stopPropagation();
    return O.queue(function(){
      return O.patch('/v1/fleet/jobs/' + enc(id) + '/steps/' + enc(idx), { done: !!on });
    }).then(function(res){
      upsertJob(res);
      O.wrote('fleet-job-step-tick');
      redrawJobs();
      return res;
    }).catch(function(e){ O.fail('Could not update job step', e); return null; });
  });

  wrap('flBoardSubAdd', function(orig, id){
    var el = document.getElementById('fl-bd-ns');
    var t = el ? el.value.trim() : '';
    if(!t) return null;
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(id) + '/steps', { text: t });
    }).then(function(res){
      upsertJob(res);
      if(el) el.value = '';
      O.wrote('fleet-job-step-add');
      redrawJobs();
      return res;
    }).catch(function(e){ O.fail('Could not add job step', e); return null; });
  });

  wrap('flBoardSubDel', function(orig, ev, id, idx){
    if(ev && ev.stopPropagation) ev.stopPropagation();
    return O.queue(function(){
      return O.del('/v1/fleet/jobs/' + enc(id) + '/steps/' + enc(idx));
    }).then(function(res){
      upsertJob(res);
      O.wrote('fleet-job-step-del');
      redrawJobs();
      return res;
    }).catch(function(e){ O.fail('Could not delete job step', e); return null; });
  });

  wrap('flBoardSubSplit', function(orig, ev, id){
    if(ev && ev.stopPropagation) ev.stopPropagation();
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(id) + '/steps/template', {});
    }).then(function(res){
      upsertJob(res);
      O.wrote('fleet-job-step-template');
      redrawJobs();
      return res;
    }).catch(function(e){ O.fail('Could not apply step template', e); return null; });
  });

  wrap('flSplitExistingJob', function(orig, jobId){
    var m = listJobs().find(function(x){ return x && x.id === jobId; });
    if(!m) return null;
    var engines = (m.assets || []).filter(function(a){ return a.type === 'engine' && (a.assetId || a.engId); });
    if(engines.length < 2) return null;
    var maxNo = listJobs().reduce(function(mx, item){
      var n = parseInt(String((item && item.no) || '').replace(/^MJ-/, ''), 10) || 0;
      return Math.max(mx, n);
    }, 0);
    var nos = engines.slice(1).map(function(_, i){ return 'MJ-' + String(maxNo + i + 1).padStart(3, '0'); });
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(jobId) + '/split', { by: 'job_engines', nos: nos });
    }).then(function(res){
      return refetchAll(m.boatId).then(function(){
        O.wrote('fleet-job-split');
        redrawJobs();
        return res;
      });
    }).catch(function(e){ O.fail('Could not split job', e); return null; });
  });

  O.onChange(function(change){
    if(!change) return;
    if(['fleet_incident', 'fleet_job', 'boat', 'fleet_engine', 'fleet_gearbox', 'fleet_propeller'].indexOf(change.entity_type) >= 0){
      state.loaded = false;
    }
  });

  var api = {
    load: function(){ return loadAll(true); },
    ensureLoaded: function(){ return loadAll(false); },
    refetchAll: refetchAll,
    createIncident: function(body){ return O.queue(function(){ return O.post('/v1/fleet/incidents', toIncidentCreateBody(body)); }).then(function(r){ upsertIncident(r); return r; }); },
    patchIncident: function(id, body){ return O.queue(function(){ return O.patch('/v1/fleet/incidents/' + enc(id), toIncidentPatchBody(body)); }).then(function(r){ upsertIncident(r); return r; }); },
    swapIncidentAsset: function(id, body){ return O.queue(function(){ return O.post('/v1/fleet/incidents/' + enc(id) + '/swap', body); }).then(function(r){ upsertIncident(r); return refetchAll(r.boat_id).then(function(){ return r; }); }); },
    createJob: function(body){ return O.queue(function(){ return O.post('/v1/fleet/jobs', toJobCreateBody(body)); }).then(function(r){ ((r && r.jobs) || []).forEach(upsertJob); return r; }); },
    startJob: function(id, body){ return O.queue(function(){ return O.post('/v1/fleet/jobs/' + enc(id) + '/start', body || {}); }).then(function(r){ upsertJob(r); return r; }); },
    closeJob: function(id, outcome, note, awaitingInvoice, resetService){ return O.queue(function(){ return O.post('/v1/fleet/jobs/' + enc(id) + '/close', toJobCloseBody(outcome, note, awaitingInvoice, resetService)); }).then(function(r){ upsertJob(r); return r; }); }
  };

  O.fleetJobs = api;
  window.laOpsFleetJobs = api;
  window.__laOpsFleetJobsCompat = {
    fromServerIncident: fromServerIncident,
    fromServerJob: fromServerJob,
    toIncidentCreateBody: toIncidentCreateBody,
    toIncidentPatchBody: toIncidentPatchBody,
    toJobCreateBody: toJobCreateBody,
    toJobCloseBody: toJobCloseBody
  };

  if(enabled()) loadAll(false).catch(function(){});
})();
