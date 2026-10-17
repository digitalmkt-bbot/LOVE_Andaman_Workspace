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
      openEnd: a.open_end != null ? !!a.open_end : null,      // the server's word for "no return date yet" (asnEndOf / asnIsOpen)
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
    // the server's three panels (active / planned / past) for the day it was read, by assignment id
    if(res.active !== undefined || Array.isArray(res.planned) || Array.isArray(res.past)){
      var ids = function(l){ return Array.isArray(l) ? l.map(function(x){ return x && x.id; }) : []; };
      b._asnPanels = { day: O.today(), active: res.active && res.active.id ? res.active.id : null, planned: ids(res.planned), past: ids(res.past) };
    }
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

  /* GET /v1/fleet/certificates serves, for each boat, the current document per type with doc_type, status and days_left
     (idx = its place in the boat's documents). Copy them onto the boat's docs so flDocStatus / flDocCurrent can use them. */
  function overlayCertificates(){
    var rows = (state.certificates && state.certificates.boats) || [];
    rows.forEach(function(r){
      var b = listBoats().find(function(x){ return x && x.id === r.boat_id; });
      if(!b || !Array.isArray(b.docs)) return;
      var cells = Object.keys(r.cells || {}).map(function(k){ return r.cells[k]; }).concat(r.others || []);
      cells.forEach(function(c){
        var d = c && b.docs[c.idx];
        if(!d || d.name !== c.name) return;
        d.docType = c.doc_type || null;
        d.status = c.status || null;
        d.daysLeft = c.days_left != null ? c.days_left : null;
        d.current = !!c.current;
      });
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
      if(res[1]){ state.certificates = res[1]; overlayCertificates(); }
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
        overlayCertificates();
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

  /* legacy asnEndOf / asnIsOpen / getActiveAssignment / getPlannedAssignments / getPastAssignments: which move
     covers today, which are planned, which are past, and whether a move has no return date. The server decides
     (GET /v1/boats/{id}/assignments: active, planned, past, open_end; fleet-assignments.ts assignmentPanels).
     The panels are the server's for the day they were read; on another day, or for a boat the server has not
     answered for, the browser's own rule stays. */
  function panelRows(b, key){
    var P = b && b._asnPanels;
    if(!P || P.day !== O.today() || !Array.isArray(b.assignments)) return null;
    var byId = {}; b.assignments.forEach(function(a){ if(a) byId[a.id] = a; });
    var want = key === 'active' ? (P.active ? [P.active] : []) : P[key];
    var rows = want.map(function(id){ return byId[id]; });
    return rows.every(Boolean) ? rows : null;
  }
  wrap('getActiveAssignment', function(orig, b){
    var r = panelRows(b, 'active');
    if(r) return r[0];
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('getPlannedAssignments', function(orig, b){
    var r = panelRows(b, 'planned');
    if(r) return r;
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('getPastAssignments', function(orig, b){
    var r = panelRows(b, 'past');
    if(r) return r;
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('asnEndOf', function(orig, a){
    if(a && a.openEnd === true) return '9999-12-31';
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('asnIsOpen', function(orig, a){
    if(a && a.openEnd != null) return !!a.openEnd && a.status !== 'cancelled';
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

  /* legacy flAsnSetEnd: the same prompt and the same format / start-date alerts, then POST …/assignments/{id}/set-end
     {end_date}. The server's status (active / completed / planned) comes back with the boat read again. A refusal
     (permanent move, already ended, cancelled) is the server's message as a red toast. */
  wrap('flAsnSetEnd', function(orig, boatId, asnId){
    var b = boatNamed(boatId);
    if(!b || !b.assignments) return null;
    var a = b.assignments.find(function(x){ return x && x.id === asnId; });
    if(!a) return null;
    var today = O.today();
    var v = prompt('Return date (YYYY-MM-DD): last day ' + b.name + ' stays at ' + ((typeof PIER_LABELS !== 'undefined' && PIER_LABELS[a.toPier]) || a.toPier) + ', then back to ' + ((typeof PIER_LABELS !== 'undefined' && PIER_LABELS[a.fromPier]) || a.fromPier), today);
    if(v == null) return null;
    var d = String(v).trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d + 'T00:00'))){ alert('Date format must be YYYY-MM-DD'); return null; }
    if(d < a.startDate){ alert('Return date must be on or after the start date (' + a.startDate + ')'); return null; }
    return O.queue(function(){
      return O.post('/v1/boats/' + enc(boatId) + '/assignments/' + enc(asnId) + '/set-end', { end_date: d });
    }).then(function(res){
      return fetchBoatDetail(boatId).then(function(){
        O.wrote('boat-assignment-set-end');
        try{ if(typeof window.flRenderBoatDetailPink === 'function') window.flRenderBoatDetailPink(); }catch(_){}
        redrawBoats();
        if(typeof window.flShowToast === 'function') window.flShowToast('ตั้งวันกลับ ' + d + ' · ' + b.name);
        return res;
      });
    }).catch(function(e){ O.fail('Could not set the return date', e); return null; });
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

  /* ── boat colour, retire-undo, status timeline ── legacy wrote b.color / b.log into the browser blob
     (save('config')) and flSave() was a no-op here, so none of it reached the server. Server first: the
     screen changes only when the server has taken the write, then the boat is read again. */
  function boatNamed(id){ return listBoats().find(function(x){ return x && x.id === id; }) || null; }
  function renderTimelineFor(id){
    try{ var b = boatNamed(id); if(b && typeof window.renderTimeline === 'function') window.renderTimeline(b); }catch(_){}
  }

  wrap('flSetBoatColor', function(orig, id, hex){
    if(!boatNamed(id)) return null;
    if(!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return null;
    return O.queue(function(){
      return O.patch('/v1/boats/' + enc(id), { color: hex });
    }).then(function(res){
      return fetchBoatDetail(id).then(function(){
        O.wrote('boat-color');
        try{ if(typeof window.flRenderBoatList === 'function') window.flRenderBoatList(); }catch(_){}
        redrawBoats();
        return res;
      });
    }).catch(function(e){ O.fail('Could not change boat colour', e); return null; });
  });

  wrap('flUnretireBoat', function(orig, boatId){
    var b = boatNamed(boatId);
    if(!b) return null;
    if(!confirm('กู้คืนเรือ ' + b.name + ' กลับมาใช้งาน?')) return null;
    return O.queue(function(){
      return O.post('/v1/boats/' + enc(boatId) + '/restore', {});
    }).then(function(res){
      return fetchBoatDetail(boatId).then(function(){
        O.wrote('boat-restore');
        redrawBoats();
        return res;
      });
    }).catch(function(e){ O.fail('Could not restore boat', e); return null; });
  });

  wrap('delStatus', function(orig, bid, slid){
    if(!confirm('ลบ Status นี้?')) return null;
    if(!boatNamed(bid)) return null;
    return O.queue(function(){
      return O.del('/v1/boats/' + enc(bid) + '/status-log/' + enc(slid));
    }).then(function(){
      return fetchBoatDetail(bid).then(function(){
        O.wrote('boat-status-delete');
        renderTimelineFor(bid);
        redrawBoats();
        return null;
      });
    }).catch(function(e){ O.fail('Could not delete status', e); return null; });
  });

  /* legacy saveStatus: the same checks and alerts, in the same order, then the entry goes to the server.
     POST a new entry, PATCH the one being edited (editingSlId). An available entry that would sit on a
     started job's days is 409 open_work: the person is asked (legacy's question, with the job numbers),
     and a yes sends plan_ahead: true, as legacy's "วางล่วงหน้า" did. The server adds the planned-over
     mark to the note, so the browser does not. */
  wrap('saveStatus', function(orig){
    var b = boatNamed(typeof selBoatId !== 'undefined' ? selBoatId : null);
    if(!b) return null;
    var d = function(id){ return document.getElementById(id); };
    var from = d('fm-st-from').value;
    var to = d('fm-st-to').value;
    if(!from){ alert('กรุณาระบุวันที่เริ่ม'); return null; }
    if(!to){ alert('กรุณาระบุวันที่สิ้นสุด'); return null; }
    if(to < from){ alert('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม'); return null; }
    var province = d('fm-st-province').value;
    var locType = d('fm-st-loctype').value;
    var detail = d('fm-st-locdetail').value.trim();
    if(!province){ alert('กรุณาเลือกจังหวัด'); return null; }
    if(!locType){ alert('กรุณาเลือกประเภทสถานที่'); return null; }
    var reason = '';
    if(selSt === 'unavailable'){
      reason = d('fm-st-reason') ? d('fm-st-reason').value : '';
      if(!reason){ alert('กรุณาเลือกเหตุผลที่ไม่พร้อมใช้งาน'); return null; }
    }
    var note = d('fm-st-note').value.trim();
    var entry = {
      status: selSt,
      from_date: from,
      to_date: to,
      loc: typeof fmtLoc === 'function' ? fmtLoc(province, locType, detail) : detail,
      province: province,
      loc_type: locType,
      detail: detail || null,
      note: note || null,
      reason: reason || null
    };
    var editing = (typeof editingSlId !== 'undefined' && editingSlId) ? editingSlId : null;
    function send(extra){
      var body = Object.assign({}, entry, extra || {});
      return O.queue(function(){
        if(editing) return O.patch('/v1/boats/' + enc(b.id) + '/status-log/' + enc(editing), body);
        return O.post('/v1/boats/' + enc(b.id) + '/status-log', body);
      });
    }
    function askPlanAhead(){
      var blk = (typeof boatJobBlock === 'function') ? boatJobBlock(b.id, from, true) : null;
      var nos = blk ? blk.nos : '';
      return 'เรือลำนี้ยังมีใบงานที่ไม่ถูกปิด\n\n    ' + nos
        + '\n\nถ้าเรือกลับมาวิ่งได้จริงแล้ว ควรไปปิดที่ใบงาน (Maintenance / Project)'
        + '\nต้นทุนจะได้เข้าใบงานครบ และเรือจะกลับมาเองโดยไม่ต้องมาแก้ตรงนี้'
        + '\n\nถ้าบันทึกต่อ = วางเรือล่วงหน้า · ช่วง ' + from + ' ถึง ' + (to || 'ไม่กำหนด')
        + '\nเรือจะรับงานได้ในช่วงนี้ โดยไม่ต้องรอปิดใบข้างบน'
        + '\nใบที่เปิดใหม่หลังจากนี้ ยังกันเรือตามปกติ'
        + '\n\nยืนยันบันทึก?';
    }
    return O.anyway(send, { open_work: { flag: 'plan_ahead', ask: askPlanAhead } }, {}).then(function(){
      return fetchBoatDetail(b.id).then(function(){
        O.wrote('boat-status-log');
        if(typeof window.closeModal === 'function') window.closeModal('status-modal');
        renderTimelineFor(b.id);
        redrawBoats();
        return null;
      });
    }).catch(function(e){
      if(e && e.declined) return null;
      O.fail('Could not save status', e);
      return null;
    });
  });

  /* legacy bsCleanupLog edited b.log in memory and called save() (browser only), so the clean-up was lost on reload.
     The same question and the same clean-up still run (orig); then what it changed is sent to the server: an entry it
     removed is DELETE …/status-log/{id}, an entry whose end date it moved is PATCH {to_date}. Removals go first. The
     boat is read again afterwards, so the screen shows what the server holds; a refusal is the server's message
     (for example an entry with no province or no end date cannot be edited). */
  wrap('bsCleanupLog', function(orig, bid){
    var b = boatNamed(bid);
    if(!b || !Array.isArray(b.log)) return null;
    var before = {};
    b.log.forEach(function(e){ if(e && e.id) before[e.id] = e.to == null ? null : e.to; });
    var res = orig.apply(this, [].slice.call(arguments, 1));
    var after = {};
    (b.log || []).forEach(function(e){ if(e && e.id) after[e.id] = e; });
    var gone = [], moved = [];
    Object.keys(before).forEach(function(id){
      if(!after[id]) gone.push(id);
      else if((after[id].to == null ? null : after[id].to) !== before[id] && after[id].to != null) moved.push(after[id]);
    });
    if(!gone.length && !moved.length) return res;
    return O.queue(function(){
      var chain = Promise.resolve();
      gone.forEach(function(id){ chain = chain.then(function(){ return O.del('/v1/boats/' + enc(bid) + '/status-log/' + enc(id)); }); });
      moved.forEach(function(e){ chain = chain.then(function(){ return O.patch('/v1/boats/' + enc(bid) + '/status-log/' + enc(e.id), { to_date: e.to }); }); });
      return chain;
    }).then(function(){
      O.wrote('boat-status-cleanup');
    }).catch(function(e){
      O.fail('Could not clean up the status log', e);
    }).then(function(){
      return fetchBoatDetail(bid).then(function(){
        renderTimelineFor(bid);
        redrawBoats();
        return null;
      });
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

  /* legacy confirmCap (04-data-core.js): a whole number above 0 sets the boat's seats, anything else is dropped.
     Server first: PATCH /v1/boats/{id} {capacity}. A day that would carry more passengers than the new seats is
     409 seats_sold: the person is asked with the server's own text, and a yes sends capacity_anyway: true. The
     edit box stays open when the server refuses. */
  wrap('confirmCap', function(orig){
    var boatId = selectedBoatId();
    var inp = document.getElementById('bdp-cap-inp');
    if(!boatId || !inp) return undefined;
    var v = parseInt(inp.value, 10);
    if(!(v > 0)){
      if(typeof window.cancelCap === 'function') window.cancelCap();
      return undefined;
    }
    function send(extra){
      return O.queue(function(){ return O.patch('/v1/boats/' + enc(boatId), Object.assign({ capacity: v }, extra || {})); });
    }
    return O.anyway(send, { seats_sold: { flag: 'capacity_anyway' } }, {}).then(function(){
      return fetchBoatDetail(boatId);
    }).then(function(b){
      O.wrote('boat');
      var cv = document.getElementById('bdp-cap-val'); if(cv) cv.textContent = v;
      if(typeof window.cancelCap === 'function') window.cancelCap();
      redrawBoats();
      return b;
    }).catch(function(e){
      if(e && e.declined) return null;
      O.fail('Could not save boat seats', e);
      return null;
    });
  });

  /* legacy saveBoat (04-data-core.js): the boat form. Legacy pushed the boat into BOATS and called save('config')
     (browser only, flSave is a no-op here), so a new or edited boat was lost on reload. Server first:
     POST /v1/boats for a new boat, PATCH /v1/boats/{id} for an edit (window._editBoatId). The form's facts go as
     typed; the id, the total persons on a new boat (licence + crew + fishing crew, legacy fmCalcTotal), the
     status entry from the status pick and the capacity-on-deployments rule are the server's. A seat count that
     would leave a day over-sold is 409 seats_sold: the person is asked with the server's text, a yes sends
     capacity_anyway: true. The modal stays open (and the edit id kept) when the server refuses. */
  wrap('saveBoat', function(orig){
    var d = function(id){ return document.getElementById(id); };
    var g = function(id){ var el = d(id); return el && el.value != null ? String(el.value).trim() : ''; };
    var name = g('fm-boat-name'); if(!name) return null;
    var wholeOrNull = function(id){ var v = parseInt(d(id) && d(id).value, 10); return isNaN(v) ? null : v; };
    var measure = function(id){ var v = parseFloat(d(id) && d(id).value); return isNaN(v) ? null : v; };
    var editId = window._editBoatId || null;
    var stMap = ['available', 'fixing', 'unavailable'];
    var docs = (typeof fmBoatDocs !== 'undefined' && Array.isArray(fmBoatDocs) ? fmBoatDocs : []).map(function(x){
      var o = { name: x.name, expires_on: x.exp || null };
      if(x.renewStatus === 'processing' || x.renewStatus === 'done') o.renew_status = x.renewStatus;
      return o;
    });
    var body = {
      name: name, name_th: g('fm-boat-nameth') || null, type: d('fm-boat-type') ? d('fm-boat-type').value : null,
      engine_count: parseInt(g('fm-boat-engcount'), 10) || 4,
      vessel_use: d('fm-boat-use') ? d('fm-boat-use').value : null,
      pier: g('fm-boat-pier'),
      capacity: parseInt(g('fm-boat-cap'), 10) || 40,
      license_pax: wholeOrNull('fm-boat-licensepax'), crew: wholeOrNull('fm-boat-crew'), fish_crew: wholeOrNull('fm-boat-fishcrew'),
      brand: g('fm-boat-brand') || null, model: g('fm-boat-model') || null,
      reg: g('fm-boat-reg') || null, callsign: g('fm-boat-callsign') || null, imo: g('fm-boat-imo') || null,
      build_year: g('fm-boat-year') || null, material: d('fm-boat-material') ? (d('fm-boat-material').value || null) : null,
      homeport_city: g('fm-boat-port') || null,
      gt: measure('fm-boat-gt'), nt: measure('fm-boat-nt'), dwt: measure('fm-boat-dwt'),
      loa: measure('fm-boat-loa'), beam: measure('fm-boat-beam'), depth: measure('fm-boat-depth'),
      draft: measure('fm-boat-draft'), lbp: measure('fm-boat-lbp'), bhp: measure('fm-boat-bhp'),
      owner: g('fm-boat-owner') || null, homeport: g('fm-boat-homeport') || null, owner_addr: g('fm-boat-owneraddr') || null,
      ownership: (typeof fmBoatOwn !== 'undefined' && fmBoatOwn === 1) ? 'charter' : 'own',
      note: g('fm-boat-note') || null, documents: docs,
      status: stMap[typeof fmBoatSt !== 'undefined' ? fmBoatSt : 0] || 'available'
    };
    // the total persons (a read-only box, fmCalcTotal shows it while typing): a new boat gets licence + crew +
    // fishing crew from the server; an edit sends the box, as the server only works it out on create
    if(editId) body.registered_persons = wholeOrNull('fm-boat-totalcap');
    function send(extra){
      return O.queue(function(){
        if(editId) return O.patch('/v1/boats/' + enc(editId), Object.assign({}, body, extra || {}));
        return O.post('/v1/boats', body);
      });
    }
    return O.anyway(send, { seats_sold: { flag: 'capacity_anyway' } }, {}).then(function(saved){
      var id = (saved && saved.id) || editId;
      return (id ? fetchBoatDetail(id) : Promise.resolve(null)).then(function(){
        window._editBoatId = null;
        O.wrote('boat');
        if(typeof window.closeModal === 'function') window.closeModal('boat-modal');
        if(typeof window.renderBoats === 'function') window.renderBoats();
        if(typeof window.flRenderBoatList === 'function'){
          window.flRenderBoatList();
          if(editId && typeof window.flSelBoat === 'function') window.flSelBoat(editId);
        }
        return saved;
      });
    }).catch(function(e){
      if(e && e.declined) return null;
      O.fail('Could not save the boat', e);
      return null;
    });
  });

  wrap('flRenderDocsList', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    if(!state.loaded){
      return loadAll(false).then(function(){ return orig.apply(self, args); }).catch(function(){});
    }
    return orig.apply(self, args);
  });

  /* Document type, status and "which copy is current" are the server's (GET /v1/boats/:id/documents, fleet-certificates.ts):
     doc_type, status (processing/na/exp/warn30/warn90/ok), days_left, current. mapDocEntry keeps them as
     docType / status / daysLeft / current. A document without them keeps the legacy calculation. */
  wrap('flDocStatus', function(orig, doc){
    if(doc && typeof doc === 'object' && doc.status) return doc.status;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flDocCurrent', function(orig, boat, typeId){
    var docs = (boat && boat.docs) || [];
    if(!docs.some(function(d){ return d && d.docType; }) || String(typeId).indexOf('other_') === 0){
      return orig.apply(this, [].slice.call(arguments, 1));
    }
    var hit = null;
    docs.forEach(function(d){
      if(!hit && d && d.docType === typeId && d.current !== false) hit = d;
    });
    return hit;
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
