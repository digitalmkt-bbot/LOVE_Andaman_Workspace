/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetBoats · boat assignments, certificates, documents, readiness ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Hydrates BOATS with full server fields (capacity, license_pax,
   registered_persons, name_th, documents, status_log, status_effective,
   blocked_by, pier_today, at_shop), loads per-boat assignments, and wraps
   pier assignment creation/cancellation and document renewal.

   GET  /v1/boats
   GET  /v1/boats/:id
   GET  /v1/fleet/availability?from=&to=&boat_id=
   GET  /v1/boats/:id/assignments
   POST /v1/boats/:id/assignments
   POST /v1/boats/:id/assignments/:asn_id/cancel
   GET  /v1/fleet/certificates
   GET  /v1/boats/:id/documents
   POST /v1/boats/:id/documents/renew
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var state = {
    loaded: false,
    failed: false,
    loading: null,
    availability: {},
    certificates: null
  };
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function nullable(v){ var s = text(v); return s ? s : null; }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function clone(v){ return O.clone ? O.clone(v) : (v == null ? v : JSON.parse(JSON.stringify(v))); }

  function listBoats(){ return typeof BOATS !== 'undefined' && Array.isArray(BOATS) ? BOATS : []; }

  function mapStatusLogEntry(e){
    e = e || {};
    return {
      id: e.id || null,
      s: e.status || e.s || 'available',
      from: e.from_date || e.from || '',
      to: e.to_date != null ? e.to_date : (e.to != null ? e.to : null),
      loc: e.loc || null,
      province: e.province || null,
      locType: e.loc_type || e.locType || null,
      detail: e.detail || null,
      note: e.note || null,
      reason: e.reason || null,
      projectId: e.project_id || e.projectId || null,
      ovrJobs: Array.isArray(e.planned_over) ? e.planned_over.slice() : null
    };
  }

  function mapDocEntry(d){
    d = d || {};
    return {
      name: d.name || '',
      exp: d.expires_on != null ? d.expires_on : (d.exp != null ? d.exp : null),
      renewStatus: d.renew_status != null ? d.renew_status : (d.renewStatus != null ? d.renewStatus : null),
      docType: d.doc_type || null,
      status: d.status || null,
      daysLeft: d.days_left != null ? d.days_left : null,
      current: d.current != null ? !!d.current : true
    };
  }

  function mapAssignment(a){
    a = a || {};
    return {
      id: a.id,
      boatId: a.boat_id || a.boatId || null,
      type: a.type || 'temporary',
      fromPier: a.from_pier || a.fromPier || '',
      toPier: a.to_pier || a.toPier || '',
      startDate: a.start_date || a.startDate || '',
      endDate: a.end_date || a.endDate || '',
      reason: a.reason || '',
      cost: num(a.cost),
      status: a.status || (a.cancelled ? 'cancelled' : 'planned'),
      cancelled: !!a.cancelled,
      cancelledAt: a.cancelled_at || null,
      cancelledBy: a.cancelled_by || null,
      createdDate: a.created_date || a.createdDate || ''
    };
  }

  function mapBoat(s, local){
    s = s || {};
    local = local || {};
    var o = Object.assign({}, local, {
      id: s.id,
      name: s.name || local.name || '',
      cap: s.capacity != null ? num(s.capacity) : num(local.cap),
      capacity: s.capacity != null ? num(s.capacity) : num(local.cap),
      pier: s.pier != null ? s.pier : (local.pier || null),
      pierToday: s.pier_today != null ? s.pier_today : null,
      atShop: s.at_shop != null ? s.at_shop : null,
      statusEffective: s.status_effective || null,
      blockedBy: Array.isArray(s.blocked_by) ? clone(s.blocked_by) : [],
      ownership: s.ownership || local.ownership || 'own',
      retired: s.retired != null ? !!s.retired : !!local.retired,
      retiredOn: s.retired_on || null,
      retiredReason: s.retired_reason || null,
      unretiredOn: s.unretired_on || null,
      charterCeiling: s.charter_ceiling != null ? s.charter_ceiling : local.charterCeiling
    });
    if(s.license_pax != null) o.licensePax = num(s.license_pax);
    else if(s.license_pax === null) delete o.licensePax;
    if(s.registered_persons != null) o.totalcap = num(s.registered_persons);
    else if(s.registered_persons === null && local.totalcap === undefined) o.totalcap = null;
    if(s.name_th !== undefined) o.nameTh = s.name_th || '';
    if(s.type !== undefined && s.type !== null) o.type = s.type;
    if(s.crew !== undefined && s.crew !== null) o.crew = num(s.crew);
    if(s.fish_crew !== undefined && s.fish_crew !== null) o.fishCrew = num(s.fish_crew);
    if(s.engine_count !== undefined && s.engine_count !== null) o.engineCount = num(s.engine_count);
    if(s.color !== undefined && s.color !== null) o.color = s.color;
    ['brand','model','vessel_use','material','reg','callsign','imo','build_year','homeport_city','homeport','owner','owner_addr','note'].forEach(function(k){
      if(s[k] !== undefined) o[k] = s[k];
    });
    if(s.vessel_use !== undefined) o.vesselUse = s.vessel_use;
    if(s.build_year !== undefined) o.buildYear = s.build_year;
    if(s.homeport_city !== undefined) o.homeportCity = s.homeport_city;
    if(s.owner_addr !== undefined) o.ownerAddr = s.owner_addr;
    ['gt','nt','dwt','loa','beam','depth','draft','lbp','bhp'].forEach(function(k){
      if(s[k] !== undefined) o[k] = s[k];
    });
    if(Array.isArray(s.documents)) o.docs = s.documents.map(mapDocEntry);
    else if(!Array.isArray(o.docs)) o.docs = [];
    if(Array.isArray(s.status_log)) o.log = s.status_log.map(mapStatusLogEntry);
    else if(!Array.isArray(o.log)) o.log = [{ s: 'available', from: O.today(), to: null }];
    if(!Array.isArray(o.assignments)) o.assignments = [];
    o._fromOpsBackend = true;
    return o;
  }

  function upsertBoat(s){
    var boats = listBoats();
    var idx = boats.findIndex(function(b){ return b && b.id === s.id; });
    var mapped = mapBoat(s, idx >= 0 ? boats[idx] : null);
    if(idx < 0) boats.push(mapped);
    else boats[idx] = mapped;
    return mapped;
  }

  function applyAssignments(boatId, res){
    var b = listBoats().find(function(x){ return x && x.id === boatId; });
    if(!b || !res) return null;
    var rows = Array.isArray(res.assignments) ? res.assignments.map(mapAssignment) : [];
    // Legacy keeps assignments in oldest-first order
    b.assignments = rows.slice().reverse();
    if(res.pier_today !== undefined) b.pierToday = res.pier_today;
    // IMPORTANT: pier_today must never overwrite home pier (b.pier)
    return b.assignments;
  }

  function fetchBoatDetail(boatId){
    return Promise.all([
      O.get('/v1/boats/' + enc(boatId)),
      O.get('/v1/boats/' + enc(boatId) + '/assignments').catch(function(){ return null; })
    ]).then(function(res){
      var mapped = upsertBoat(res[0]);
      if(res[1]) applyAssignments(boatId, res[1]);
      return mapped;
    });
  }

  function loadAll(force){
    if(!enabled()) return Promise.resolve(false);
    if(state.loaded && !force) return Promise.resolve(true);
    if(state.loading) return state.loading;
    state.loading = Promise.all([
      O.get('/v1/boats'),
      O.get('/v1/fleet/certificates').catch(function(){ return null; })
    ]).then(function(res){
      var serverBoats = (res[0] && res[0].boats) || [];
      var existing = listBoats();
      var byId = {};
      existing.forEach(function(b){ if(b && b.id) byId[b.id] = b; });
      var next = serverBoats.map(function(s){ return mapBoat(s, byId[s.id] || null); });
      existing.length = 0;
      Array.prototype.push.apply(existing, next);
      if(res[1]) state.certificates = res[1];
      return Promise.all(next.map(function(b){
        return O.get('/v1/boats/' + enc(b.id) + '/assignments').then(function(asnRes){
          applyAssignments(b.id, asnRes);
        }).catch(function(){});
      })).then(function(){
        state.loaded = true;
        state.failed = false;
        return true;
      });
    }).catch(function(e){
      state.failed = true;
      O.fail('Could not load fleet boats from operation-backend', e);
      throw e;
    }).finally(function(){
      state.loading = null;
    });
    return state.loading;
  }

  function loadAvailability(from, to, boatId){
    if(!enabled()) return Promise.resolve(null);
    var q = { from: from || O.today(), to: to || from || O.today() };
    if(boatId) q.boat_id = boatId;
    return O.get('/v1/fleet/availability', q).then(function(res){
      var days = (res && res.days) || [];
      days.forEach(function(d){
        if(!d || !d.boat_id || !d.service_date) return;
        state.availability[d.boat_id + '::' + d.service_date] = d;
      });
      return res;
    });
  }

  function toAssignmentBody(input){
    input = input || {};
    return {
      type: text(input.type) || 'temporary',
      from_pier: text(input.from_pier != null ? input.from_pier : input.fromPier),
      to_pier: text(input.to_pier != null ? input.to_pier : input.toPier),
      start_date: text(input.start_date != null ? input.start_date : input.startDate),
      end_date: text(input.end_date != null ? input.end_date : input.endDate),
      reason: nullable(input.reason),
      cost: Math.max(0, Math.round(num(input.cost) * 100) / 100)
    };
  }

  function toRenewDocBody(name, docState, expiresOn){
    var body = {
      name: text(name),
      state: text(docState)
    };
    if(nullable(expiresOn)) body.expires_on = nullable(expiresOn);
    return body;
  }

  function redrawBoats(){
    try{ if(typeof window.flRenderBoatDetailPink === 'function') window.flRenderBoatDetailPink(); }catch(_){}
    try{ if(typeof window.renderBoats === 'function') window.renderBoats(); }catch(_){}
    try{ if(typeof window.renderBoatDetailPink === 'function') window.renderBoatDetailPink(); }catch(_){}
    try{ if(typeof window.flRenderDocsList === 'function' && document.getElementById('fl-docs-pink-wrap')) window.flRenderDocsList(); }catch(_){}
  }

  function createAssignmentServer(boatId, input){
    var body = toAssignmentBody(input);
    return O.queue(function(){
      return O.post('/v1/boats/' + enc(boatId) + '/assignments', body);
    }).then(function(res){
      return fetchBoatDetail(boatId).then(function(){
        O.wrote('boat-assignment-create');
        redrawBoats();
        return res;
      });
    }, function(e){
      O.fail('Could not save boat assignment', e);
      throw e;
    });
  }

  function cancelAssignmentServer(boatId, asnId){
    return O.queue(function(){
      return O.post('/v1/boats/' + enc(boatId) + '/assignments/' + enc(asnId) + '/cancel', {});
    }).then(function(res){
      return fetchBoatDetail(boatId).then(function(){
        O.wrote('boat-assignment-cancel');
        redrawBoats();
        return res;
      });
    }, function(e){
      O.fail('Could not cancel boat assignment', e);
      throw e;
    });
  }

  function renewDocumentServer(boatId, name, docState, expiresOn){
    var body = toRenewDocBody(name, docState, expiresOn);
    return O.queue(function(){
      return O.post('/v1/boats/' + enc(boatId) + '/documents/renew', body);
    }).then(function(res){
      return Promise.all([
        fetchBoatDetail(boatId),
        O.get('/v1/fleet/certificates').then(function(c){ state.certificates = c; }).catch(function(){})
      ]).then(function(){
        O.wrote('boat-document-renew');
        redrawBoats();
        return res;
      });
    }, function(e){
      O.fail('Could not renew boat document', e);
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
    w.__opsFleetBoats = true;
    window[name] = w;
  }

  // Prevent legacy flSave() from writing localStorage in operations mode across all Fleet screens
  wrap('flSave', function(){ return; });

  wrap('getBoatCurrentPier', function(orig, b, ds){
    if(!b) return 'tublamu';
    var today = O.today();
    var targetDate = ds || today;
    if(targetDate === today && b._fromOpsBackend){
      if(b.atShop && b.statusEffective && b.statusEffective !== 'available') return 'shop';
      if(b.pierToday && (!Array.isArray(b.assignments) || !b.assignments.length)) return b.pierToday;
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flSaveAssignment', function(){
    var boatId = typeof _pierAsnBoatId !== 'undefined' ? _pierAsnBoatId : null;
    if(!boatId){ alert('No boat selected'); return null; }
    var b = listBoats().find(function(x){ return x && x.id === boatId; });
    if(!b){ alert('Boat not found'); return null; }
    var d = function(id){ return document.getElementById(id); };
    var fromPier = d('asn-from') ? d('asn-from').value : '';
    var toPier = d('asn-to') ? d('asn-to').value : '';
    if(fromPier === toPier){ alert('From และ To ต้องต่างกัน'); return null; }
    var type = d('asn-type') ? d('asn-type').value : 'temporary';
    var startDate = d('asn-start') ? d('asn-start').value : '';
    var endDate = d('asn-end') ? d('asn-end').value : '';
    if(!startDate || !endDate){ alert('กรุณาระบุวันเริ่ม-วันจบ'); return null; }
    if(endDate < startDate){ alert('วันจบต้องหลังวันเริ่ม'); return null; }
    var reason = d('asn-reason') ? d('asn-reason').value.trim() : '';
    var cost = d('asn-cost') ? (parseFloat(d('asn-cost').value) || 0) : 0;

    return createAssignmentServer(boatId, {
      type: type,
      from_pier: fromPier,
      to_pier: toPier,
      start_date: startDate,
      end_date: endDate,
      reason: reason,
      cost: cost
    }).then(function(res){
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-assignment');
      var st = (res && res.assignment && res.assignment.status) || 'saved';
      if(typeof window.flShowToast === 'function' && typeof PIER_LABELS !== 'undefined'){
        window.flShowToast('บันทึก Assignment: ' + (PIER_LABELS[fromPier] || fromPier) + ' → ' + (PIER_LABELS[toPier] || toPier) + ' (' + st + ')');
      }
      if(typeof _pierAsnBoatId !== 'undefined') _pierAsnBoatId = null;
      return res;
    }).catch(function(){ return null; });
  });

  wrap('flCancelAssignment', function(orig, boatId, asnId){
    if(!confirm('ยกเลิก assignment นี้?')) return null;
    return cancelAssignmentServer(boatId, asnId).then(function(res){
      if(typeof window.flShowToast === 'function') window.flShowToast('ยกเลิก Assignment เรียบร้อย');
      return res;
    }).catch(function(){ return null; });
  });

  wrap('depSave', function(){
    var boatId = typeof _depBoatId !== 'undefined' ? _depBoatId : null;
    var docName = typeof _depDocName !== 'undefined' ? _depDocName : '';
    var st = typeof _depSt !== 'undefined' ? _depSt : '';
    if(!boatId || !docName || !st) return null;
    var expEl = document.getElementById('dep-exp-input');
    var expVal = expEl ? text(expEl.value) : '';
    if(st === 'ok' && !expVal){
      alert('กรุณาระบุวันหมดอายุใหม่');
      return null;
    }
    return renewDocumentServer(boatId, docName, st, expVal || null).then(function(res){
      if(typeof window.depClose === 'function') window.depClose();
      return res;
    }).catch(function(){ return null; });
  });

  /* legacy confirmType / confirmName (04-data-core.js): the boat's type or name is a client fact, sent with
     PATCH /v1/boats/{id}. The edit box closes only when the server has said yes; a refusal keeps it open. */
  function saveBoatFact(boatId, body, title){
    return O.queue(function(){
      return O.patch('/v1/boats/' + enc(boatId), body);
    }).then(function(){
      return fetchBoatDetail(boatId);
    }).then(function(b){
      O.wrote('boat');
      redrawBoats();
      return b;
    }).catch(function(e){
      O.fail(title, e);
      return null;
    });
  }
  function selectedBoatId(){ return typeof selBoatId !== 'undefined' ? selBoatId : null; }

  wrap('confirmType', function(orig){
    var boatId = selectedBoatId();
    var sel = document.getElementById('bdp-type-sel');
    if(!boatId || !sel) return undefined;
    var type = sel.value;
    return saveBoatFact(boatId, { type: type }, 'Could not save boat type').then(function(b){
      if(!b) return b;
      var mt = document.getElementById('bdp-meta-type'); if(mt) mt.textContent = type;
      if(typeof window.cancelType === 'function') window.cancelType();
      return b;
    });
  });

  wrap('confirmName', function(orig){
    var boatId = selectedBoatId();
    var inp = document.getElementById('bdp-name-inp');
    if(!boatId || !inp) return undefined;
    var v = inp.value.trim();
    // legacy: an empty name keeps the old one, nothing is sent
    if(!v){
      if(typeof window.cancelName === 'function') window.cancelName();
      redrawBoats();
      return undefined;
    }
    return saveBoatFact(boatId, { name: v }, 'Could not save boat name').then(function(b){
      if(!b) return b;
      var nt = document.getElementById('bdp-name-text'); if(nt) nt.textContent = v;
      if(typeof window.cancelName === 'function') window.cancelName();
      return b;
    });
  });

  wrap('flRenderDocsList', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    if(!state.loaded){
      return loadAll(false).then(function(){ return orig.apply(self, args); }).catch(function(){});
    }
    return orig.apply(self, args);
  });

  O.onChange(function(change){
    if(!change) return;
    if(['boat', 'fleet_assignment', 'fleet_job', 'fleet_project'].indexOf(change.entity_type) >= 0){
      state.loaded = false;
    }
  });

  var api = {
    load: function(){ return loadAll(true); },
    ensureLoaded: function(){ return loadAll(false); },
    refetchBoat: fetchBoatDetail,
    loadAvailability: loadAvailability,
    createAssignment: createAssignmentServer,
    cancelAssignment: cancelAssignmentServer,
    renewDocument: renewDocumentServer,
    certificates: function(){ return state.certificates; }
  };

  O.fleetBoats = api;
  window.laOpsFleetBoats = api;
  window.__laOpsFleetBoatsCompat = {
    mapBoat: mapBoat,
    mapStatusLogEntry: mapStatusLogEntry,
    mapDocEntry: mapDocEntry,
    mapAssignment: mapAssignment,
    toAssignmentBody: toAssignmentBody,
    toRenewDocBody: toRenewDocBody
  };

  if(enabled()) loadAll(false).catch(function(){});
})();
