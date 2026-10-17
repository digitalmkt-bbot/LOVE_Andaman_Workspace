/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetDaily · projects, daily log, safety, fuel budgets, reports ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Hydrates FL_PROJECTS, FL_DAILY, FL_FUEL_PRICE, FL_DR_LOCK, FL_SAFETY, and
   monthly fuel budgets from operation-backend.
   - A daily-log response replaces the cache for only that date.
   - Server pier locks are honored.
   - Server project-completion and safety-replacement side effects are never
     recreated client-side: the returned/refetched server objects replace
     the affected projections.

   Projects:
     GET|POST /v1/fleet/projects
     GET|PATCH /v1/fleet/projects/:id
     POST /v1/fleet/projects/:id/start|hold|resume|cancel|reopen|work-done|bill-back|complete
     POST|PATCH|DELETE /v1/fleet/projects/:id/plan[/:item_id]
     POST|DELETE /v1/fleet/projects/:id/vendor-visits[/:visit_id]
     POST|PATCH|DELETE /v1/fleet/projects/:id/documents[/:doc_id]

   Daily Log:
     GET   /v1/fleet/daily-log?from=&to=
     PATCH /v1/fleet/daily-log/:date/boats/:boat_id
     PUT   /v1/fleet/daily-log/:date/boats/:boat_id/water|issues
     POST|PUT|DELETE /v1/fleet/daily-log/:date/boats/:boat_id/extras[/:extra_id]
     POST|PUT|DELETE /v1/fleet/daily-log/:date/piers/:pier/requests[/:request_id]
     PUT   /v1/fleet/daily-log/:date/fuel-prices
     POST  /v1/fleet/daily-log/:date/piers/:pier/lock|unlock

   Safety:
     GET  /v1/fleet/safety-categories
     GET|POST /v1/fleet/safety
     GET|PATCH|DELETE /v1/fleet/safety/:id
     POST|PATCH|DELETE /v1/fleet/safety/:id/inspections[/:insp_id]
     POST /v1/fleet/safety/:id/replace

   Budgets & Reports:
     GET|PUT /v1/fleet/fuel-budgets[/:month]
     GET /v1/fleet/dashboard?date=
     GET /v1/fleet/repair-history?boat_id=
     GET /v1/fleet/reports/cost?period=
     GET /v1/fleet/reports/upkeep?month=
     GET /v1/fleet/reports/fuel?month=
     GET /v1/fleet/reports/memo-spend?from=&to=
     GET /v1/fleet/insights?period=
     GET /v1/fleet/reports/fleet?from=&to=
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var state = {
    loaded: false,
    failed: false,
    loading: null,
    waterByKey: {},
    bookedByKey: {},          // 'date|boat' → the server's pax_booked for that boat-day (flBoatBookingsFor)
    issuesByKey: {},
    extrasByKey: {},
    requestsByKey: {},
    issueItems: [],
    fuelBudgets: {},
    safetyCategories: [],
    reports: {}
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
    return Number.isFinite(n) ? n : null;
  }
  function clone(v){ return O.clone ? O.clone(v) : (v == null ? v : JSON.parse(JSON.stringify(v))); }

  function listProjects(){ return typeof FL_PROJECTS !== 'undefined' && Array.isArray(FL_PROJECTS) ? FL_PROJECTS : []; }
  function listSafety(){ return typeof FL_SAFETY !== 'undefined' && Array.isArray(FL_SAFETY) ? FL_SAFETY : []; }
  function mapDaily(){ return typeof FL_DAILY !== 'undefined' && FL_DAILY ? FL_DAILY : {}; }
  function mapFuelPrice(){ return typeof FL_FUEL_PRICE !== 'undefined' && FL_FUEL_PRICE ? FL_FUEL_PRICE : {}; }
  function mapDrLock(){ return typeof FL_DR_LOCK !== 'undefined' && FL_DR_LOCK ? FL_DR_LOCK : {}; }

  function fromServerProject(p, old){
    p = p || {}; old = old || {};
    return {
      id: p.id,
      no: p.no || '',
      name: p.name || '',
      boatId: p.boat_id || null,
      type: p.type || 'drydock',
      vendor: p.vendor || '',
      planFrom: p.plan_from || '',
      planTo: p.plan_to || null,
      originalPlanTo: p.original_plan_to || null,
      actualFrom: p.actual_from || null,
      actualTo: p.actual_to || null,
      status: p.status || 'planned',
      plannedBudget: num(p.planned_budget),
      budget: num(p.planned_budget),
      notes: p.notes || '',
      phase: p.phase || null,
      phaseIndex: p.phase_index != null ? num(p.phase_index) : 0,
      phases: Array.isArray(p.phases) ? clone(p.phases) : [],
      holdReason: p.hold_reason || null,
      holdSince: p.hold_since || null,
      cancelReason: p.cancel_reason || null,
      cancelledOn: p.cancelled_on || null,
      workDoneOn: p.work_done_on || null,
      billNote: p.bill_note || null,
      noCost: p.no_cost ? clone(p.no_cost) : null,
      billClosedOn: p.bill_closed_on || null,
      cost: p.cost != null ? num(p.cost) : 0,
      costBreakdown: p.cost_breakdown ? clone(p.cost_breakdown) : null,
      billGate: p.bill_gate ? clone(p.bill_gate) : null,
      health: p.health ? clone(p.health) : null,
      plan: (Array.isArray(p.plan) ? p.plan : []).map(function(it){
        return { id: it.id, text: it.text || '', done: !!it.done, addedAt: it.added_at || null, doneDate: it.done_date || null };
      }),
      docs: (Array.isArray(p.documents) ? p.documents : []).map(function(d){
        return {
          id: d.id, name: d.name || '', attId: d.attachment_id || null, url: d.attachment_id ? window.laOpsAttachments.viewUrl(d.attachment_id) : (d.url || ''),
          mime: d.mime || null, size: d.size || null, note: d.note || '',
          type: d.type || null, phase: d.phase || null, status: d.status || 'required',
          addedAt: d.added_at || null, by: d.by || null
        };
      }),
      vendorVisits: (Array.isArray(p.vendor_visits) ? p.vendor_visits : []).map(function(v){
        return { id: v.id, vendor: v.vendor || '', role: v.role || '', date: v.date || '', by: v.by || null };
      }),
      log: Array.isArray(p.log) ? clone(p.log) : (old.log || []),
      _fromOpsBackend: true
    };
  }

  function replaceProjects(rows){
    var target = listProjects();
    var byId = {};
    target.forEach(function(x){ if(x && x.id) byId[x.id] = x; });
    var mapped = (rows || []).map(function(s){ return fromServerProject(s, byId[s.id] || null); });
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function upsertProject(row){
    var target = listProjects();
    var idx = target.findIndex(function(x){ return x && x.id === row.id; });
    var mapped = fromServerProject(row, idx >= 0 ? target[idx] : null);
    if(idx < 0) target.unshift(mapped);
    else target[idx] = mapped;
    return mapped;
  }

  // Replace cache for ONLY the given date
  function applyDailyDay(day){
    if(!day || !day.date) return null;
    var ds = day.date;
    var daily = mapDaily();
    var fp = mapFuelPrice();
    var locks = mapDrLock();

    var dayBoats = {};
    // Clear previous subresource caches for this date only
    Object.keys(state.waterByKey).forEach(function(k){ if(k.indexOf(ds + '|') === 0) delete state.waterByKey[k]; });
    Object.keys(state.bookedByKey).forEach(function(k){ if(k.indexOf(ds + '|') === 0) delete state.bookedByKey[k]; });
    Object.keys(state.issuesByKey).forEach(function(k){ if(k.indexOf(ds + '|') === 0) delete state.issuesByKey[k]; });
    Object.keys(state.extrasByKey).forEach(function(k){ if(k.indexOf(ds + '|') === 0) delete state.extrasByKey[k]; });
    Object.keys(state.requestsByKey).forEach(function(k){ if(k.indexOf(ds + '|') === 0) delete state.requestsByKey[k]; });

    (Array.isArray(day.boats) ? day.boats : []).forEach(function(b){
      if(!b || !b.boat_id) return;
      var bid = b.boat_id;
      var trips = {};
      var meters = b.meters || {};
      Object.keys(meters).forEach(function(tType){
        trips[tType] = { engines: Object.assign({}, meters[tType] || {}) };
      });
      dayBoats[bid] = {
        fuel: b.fuel_litres != null ? num(b.fuel_litres) : null,
        paxActual: b.pax_actual != null ? num(b.pax_actual) : null,
        trips: trips,
        fuelPriceEff: b.fuel_price || null,
        flags: Array.isArray(b.flags) ? b.flags.slice() : []
      };
      if(b.pax_booked != null) state.bookedByKey[ds + '|' + bid] = num(b.pax_booked);
      if(b.water){
        state.waterByKey[ds + '|' + bid] = { o: b.water.open, c: b.water.close, by: b.water.by, at: b.water.at };
      }
      if(b.issues && typeof b.issues === 'object'){
        state.issuesByKey[ds + '|' + bid] = Object.assign({}, b.issues);
      }
      if(Array.isArray(b.extras)){
        state.extrasByKey[ds + '|' + bid] = b.extras.map(function(x){
          return { id: x.id, n: x.name, q: x.qty, u: x.unit };
        });
      }
    });

    daily[ds] = dayBoats;
    fp[ds] = Object.assign({}, day.fuel_prices || {});

    var dayLocks = {};
    var srvLocks = day.locks || {};
    Object.keys(srvLocks).forEach(function(pier){
      if(srvLocks[pier]) dayLocks[pier] = true;
    });
    locks[ds] = dayLocks;

    var srvReqs = day.requests || {};
    Object.keys(srvReqs).forEach(function(pier){
      var list = srvReqs[pier] || [];
      state.requestsByKey[ds + '|' + pier] = list.map(function(r){
        return {
          id: r.id,
          name: r.name,
          pax: r.pax,
          fuel: r.fuel,
          price: r.price,
          eng: r.engine_hours,
          wo: r.water_open,
          wc: r.water_close,
          iss: r.issues || {}
        };
      });
    });

    return dayBoats;
  }

  function applyDailyRange(res){
    res = res || {};
    if(Array.isArray(res.issue_items)) state.issueItems = clone(res.issue_items);
    (Array.isArray(res.days) ? res.days : []).forEach(applyDailyDay);
    return res;
  }

  function fromServerSafety(s){
    s = s || {};
    return {
      id: s.id,
      boatId: s.boat_id || '',
      category: s.category || 'life_jacket',
      name: s.name || '',
      brand: s.brand || '',
      model: s.model || '',
      serial: s.serial || '',
      qty: s.qty != null ? num(s.qty) : 1,
      installDate: s.install_date || null,
      expiryDate: s.expiry_date || null,
      nextPM: s.next_pm || null,
      lastInspect: s.last_inspect || null,
      status: s.status || 'active',
      location: s.location || '',
      note: s.note || '',
      state: s.state ? clone(s.state) : null,
      lifeJacketShortfall: s.life_jacket_shortfall ? clone(s.life_jacket_shortfall) : null,
      inspections: (Array.isArray(s.inspections) ? s.inspections : []).map(function(i){
        return {
          id: i.id,
          date: i.date || '',
          inspector: i.inspector || '',
          by: i.inspector || '',
          result: i.result || 'pass',
          findings: i.findings || '',
          note: i.findings || '',
          nextDue: i.next_due || null
        };
      }),
      log: Array.isArray(s.log) ? clone(s.log) : [],
      _fromOpsBackend: true
    };
  }

  function replaceSafety(rows){
    var target = listSafety();
    var mapped = (rows || []).map(fromServerSafety);
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function upsertSafety(row){
    var target = listSafety();
    var idx = target.findIndex(function(x){ return x && x.id === row.id; });
    var mapped = fromServerSafety(row);
    if(idx < 0) target.push(mapped);
    else target[idx] = mapped;
    return mapped;
  }

  function removeSafetyLocal(id){
    var target = listSafety();
    var idx = target.findIndex(function(x){ return x && x.id === id; });
    if(idx >= 0) target.splice(idx, 1);
  }

  function loadDailyWindow(from, to){
    var f = from || O.shift(O.today(), -14);
    var t = to || O.today();
    return O.get('/v1/fleet/daily-log', { from: f, to: t }).then(applyDailyRange);
  }

  function loadAll(force){
    if(!enabled()) return Promise.resolve(false);
    if(state.loaded && !force) return Promise.resolve(true);
    if(state.loading) return state.loading;
    state.loading = Promise.all([
      O.get('/v1/fleet/projects'),
      O.get('/v1/fleet/safety'),
      O.get('/v1/fleet/fuel-budgets').catch(function(){ return { budgets: [] }; }),
      O.get('/v1/fleet/safety-categories').catch(function(){ return { categories: [] }; }),
      loadDailyWindow().catch(function(){ return null; })
    ]).then(function(res){
      replaceProjects((res[0] && res[0].projects) || []);
      replaceSafety((res[1] && res[1].items) || []);
      var budgets = (res[2] && res[2].budgets) || [];
      state.fuelBudgets = {};
      budgets.forEach(function(b){ if(b && b.month && b.amount != null) state.fuelBudgets[b.month] = num(b.amount); });
      state.safetyCategories = (res[3] && res[3].categories) || [];
      // inspection cadence per category is the server's (pm_months); the screens read pmMonths / pmYears
      if(typeof FL_SAFETY_CATEGORIES !== 'undefined' && FL_SAFETY_CATEGORIES){
        state.safetyCategories.forEach(function(c){
          if(c && c.id && c.pm_months > 0 && FL_SAFETY_CATEGORIES[c.id]){
            FL_SAFETY_CATEGORIES[c.id].pmMonths = num(c.pm_months);
            FL_SAFETY_CATEGORIES[c.id].pmYears = num(c.pm_months) / 12;
          }
        });
      }
      state.loaded = true;
      state.failed = false;
      return true;
    }).catch(function(e){
      state.failed = true;
      O.fail('Could not load fleet projects/daily/safety from operation-backend', e);
      throw e;
    }).finally(function(){
      state.loading = null;
    });
    return state.loading;
  }

  function refetchAfterProjectCascade(boatId){
    var tasks = [
      O.get('/v1/fleet/projects').then(function(r){ replaceProjects((r && r.projects) || []); })
    ];
    if(O.fleetJobs && typeof O.fleetJobs.load === 'function'){
      tasks.push(O.fleetJobs.load().catch(function(){}));
    }
    if(boatId && O.fleetBoats && typeof O.fleetBoats.refetchBoat === 'function'){
      tasks.push(O.fleetBoats.refetchBoat(boatId).catch(function(){}));
    }
    return Promise.all(tasks);
  }

  function redrawDailyAndProjects(){
    try{ if(typeof window.flRenderProjects === 'function' && document.getElementById('fl-proj-wrap')) window.flRenderProjects(); }catch(_){}
    try{ if(typeof window.flRenderDR === 'function' && document.getElementById('fl-dr-wrap')) window.flRenderDR(); }catch(_){}
    try{ if(typeof window.flRenderSafetyList === 'function' && document.getElementById('fl-safety-pink-wrap')) window.flRenderSafetyList(); }catch(_){}
    try{ if(typeof window.renderBoats === 'function') window.renderBoats(); }catch(_){}
  }

  function toProjectBody(d, isPatch){
    d = d || {};
    var body = {
      name: text(d.name),
      boat_id: nullable(d.boat_id != null ? d.boat_id : d.boatId),
      type: text(d.type) || 'drydock',
      vendor: nullable(d.vendor),
      plan_from: text(d.plan_from != null ? d.plan_from : d.planFrom),
      plan_to: nullable(d.plan_to != null ? d.plan_to : d.planTo),
      planned_budget: Math.max(0, num(d.planned_budget != null ? d.planned_budget : (d.plannedBudget != null ? d.plannedBudget : d.budget))),
      notes: nullable(d.notes)
    };
    if(!isPatch) body.no = text(d.no);
    if(d.phase !== undefined) body.phase = nullable(d.phase);
    if(d.bill_note !== undefined || d.billNote !== undefined) body.bill_note = nullable(d.bill_note != null ? d.bill_note : d.billNote);
    return body;
  }

  function toBoatDayPatchBody(input){
    input = input || {};
    var body = {};
    if(input.fuel_litres !== undefined || input.fuel !== undefined){
      var f = numOrNull(input.fuel_litres !== undefined ? input.fuel_litres : input.fuel);
      body.fuel_litres = (f != null && f > 0) ? f : null;
    }
    if(input.pax_actual !== undefined || input.paxActual !== undefined){
      var p = numOrNull(input.pax_actual !== undefined ? input.pax_actual : input.paxActual);
      body.pax_actual = p != null ? Math.max(0, Math.round(p)) : null;
    }
    if(input.meters !== undefined){
      body.meters = input.meters;
    }
    return body;
  }

  function toSafetyBody(d){
    d = d || {};
    var body = {
      boat_id: text(d.boat_id != null ? d.boat_id : d.boatId),
      category: text(d.category),
      name: text(d.name),
      brand: nullable(d.brand),
      model: nullable(d.model),
      serial: nullable(d.serial),
      qty: Math.max(1, Math.round(num(d.qty || 1))),
      install_date: nullable(d.install_date != null ? d.install_date : d.installDate),
      expiry_date: nullable(d.expiry_date != null ? d.expiry_date : d.expiryDate),
      next_pm: nullable(d.next_pm != null ? d.next_pm : d.nextPM),
      last_inspect: nullable(d.last_inspect != null ? d.last_inspect : d.lastInspect),
      status: text(d.status) || 'active',
      location: nullable(d.location),
      note: nullable(d.note)
    };
    return body;
  }

  function toSafetyReplaceBody(d){
    d = d || {};
    var source = text(d.source) || 'inventory';
    var body = {
      reason: text(d.reason) || 'broken',
      description: nullable(d.description),
      date: nullable(d.date) || O.today(),
      source: source,
      serial: nullable(d.serial != null ? d.serial : d.newSerial),
      install_date: nullable(d.install_date != null ? d.install_date : d.installDate),
      installer: nullable(d.installer),
      labour: Math.max(0, num(d.labour)),
      incident_no: text(d.incident_no != null ? d.incident_no : d.incNo),
      job_no: text(d.job_no != null ? d.job_no : d.mjNo)
    };
    if(source === 'inventory'){
      body.item_id = text(d.item_id != null ? d.item_id : d.newInventoryId);
      if(nullable(d.warehouse)) body.warehouse = nullable(d.warehouse);
    } else {
      body.brand = nullable(d.brand != null ? d.brand : d.newBrand);
      body.model = nullable(d.model != null ? d.model : d.newModel);
      body.supplier = nullable(d.supplier);
      body.price = Math.max(0, num(d.price != null ? d.price : d.newPrice));
      body.memo_no = text(d.memo_no != null ? d.memo_no : d.moNo);
    }
    if(nullable(d.expiry_date != null ? d.expiry_date : d.expiryDate)){
      body.expiry_date = nullable(d.expiry_date != null ? d.expiry_date : d.expiryDate);
    }
    if(d.allow_negative || d.allowNegative) body.allow_negative = true;
    if(d.serial_anyway || d.serialAnyway) body.serial_anyway = true;
    return body;
  }

  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsFleetDaily = true;
    window[name] = w;
  }

  // ── Daily Fleet Log wrappers ──

  wrap('flDRLocked', function(orig, ds, pierKey){
    var locks = mapDrLock();
    if(locks[ds] && locks[ds][pierKey]) return true;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flSaveFuel', function(orig, ds, bid, val){
    if(window.flDRLocked && window.flDRLocked(ds, (typeof getBoatCurrentPier === 'function' && typeof getBoat === 'function' && getBoat(bid)) ? getBoatCurrentPier(getBoat(bid), ds) : '')){
      O.fail('Daily log is locked', new Error('Unlock the pier day before editing'));
      return null;
    }
    var body = toBoatDayPatchBody({ fuel_litres: parseFloat(val) || null });
    return O.queue(function(){
      return O.patch('/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid), body);
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-fuel');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not save fuel', e); return null; });
  });

  wrap('flSavePaxActual', function(orig, ds, bid, val){
    var v = parseInt(val, 10);
    var pax = (val === '' || isNaN(v)) ? null : Math.max(0, v);
    var body = toBoatDayPatchBody({ pax_actual: pax });
    return O.queue(function(){
      return O.patch('/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid), body);
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-pax');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not save actual pax', e); return null; });
  });

  wrap('flSaveMeter', function(orig, ds, bid, type, engId, val){
    var v = parseFloat(val);
    var reading = (val === '' || isNaN(v)) ? null : v;
    var meters = {};
    meters[type || 'normal'] = {};
    meters[type || 'normal'][engId] = reading;
    var body = toBoatDayPatchBody({ meters: meters });
    return O.queue(function(){
      return O.patch('/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid), body);
    }).then(function(day){
      applyDailyDay(day);
      if(O.fleetAssets && typeof O.fleetAssets.refetchChain === 'function'){
        O.fleetAssets.refetchChain().catch(function(){});
      }
      O.wrote('fleet-daily-meter');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not save engine meter', e); return null; });
  });

  wrap('flSaveFuelPrice', function(orig, ds, pierKey, val){
    var v = parseFloat(val);
    var body = {};
    body[pierKey] = (val === '' || isNaN(v)) ? null : v;
    return O.queue(function(){
      return O.call('PUT', '/v1/fleet/daily-log/' + enc(ds) + '/fuel-prices', body);
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-fuel-price');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not save fuel price', e); return null; });
  });

  wrap('flDRSetLock', function(orig, ds, pierKey, val){
    var cmd = val ? 'lock' : 'unlock';
    return O.queue(function(){
      return O.post('/v1/fleet/daily-log/' + enc(ds) + '/piers/' + enc(pierKey) + '/' + cmd, {});
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-' + cmd);
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not ' + cmd + ' daily log', e); return null; });
  });

  wrap('flWaterGet', function(orig, ds, bid){
    var k = String(ds || '') + '|' + String(bid || '');
    if(state.waterByKey[k]) return state.waterByKey[k];
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flWaterSet', function(orig, ds, bid, which, val){
    var cur = window.flWaterGet ? window.flWaterGet(ds, bid) : {};
    var v = (val === '' || val == null || isNaN(+val)) ? null : +val;
    var body = {
      open: which === 'o' ? v : (cur.o != null ? cur.o : null),
      close: which === 'c' ? v : (cur.c != null ? cur.c : null)
    };
    return O.queue(function(){
      return O.call('PUT', '/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid) + '/water', body);
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-water');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not save water meter', e); return null; });
  });

  wrap('flIssueItems', function(orig){
    if(state.issueItems && state.issueItems.length) return state.issueItems;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flIssueGet', function(orig, ds, bid, itemId){
    var k = String(ds || '') + '|' + String(bid || '');
    if(state.issuesByKey[k] && state.issuesByKey[k][itemId] !== undefined) return state.issuesByKey[k][itemId];
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flIssueSet', function(orig, ds, bid, itemId, val){
    var v = (val === '' || val == null || isNaN(+val) || +val <= 0) ? null : +val;
    var body = {};
    body[itemId] = v;
    return O.queue(function(){
      return O.call('PUT', '/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid) + '/issues', body);
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-issues');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not save issued item', e); return null; });
  });

  wrap('flExtraGet', function(orig, ds, bid){
    var k = String(ds || '') + '|' + String(bid || '');
    if(state.extrasByKey[k]) return state.extrasByKey[k];
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flExtraSet', function(orig, ds, bid, id, name, qty, unit){
    var body = { name: text(name), qty: numOrNull(qty), unit: nullable(unit) };
    return O.queue(function(){
      if(id) return O.call('PUT', '/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid) + '/extras/' + enc(id), body);
      return O.post('/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid) + '/extras', body);
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-extra');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not save extra item', e); return null; });
  });

  wrap('flExtraDel', function(orig, ds, bid, id){
    return O.queue(function(){
      return O.del('/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid) + '/extras/' + enc(id));
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-extra-del');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not delete extra item', e); return null; });
  });

  wrap('flReqGet', function(orig, ds, pierKey){
    var k = String(ds || '') + '|' + String(pierKey || '');
    if(state.requestsByKey[k]) return state.requestsByKey[k];
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flReqSet', function(orig, ds, pierKey, id, data){
    data = data || {};
    var body = {
      name: text(data.name),
      pax: numOrNull(data.pax),
      fuel: numOrNull(data.fuel),
      price: numOrNull(data.price),
      engine_hours: numOrNull(data.eng != null ? data.eng : data.engine_hours),
      water_open: numOrNull(data.wo != null ? data.wo : data.water_open),
      water_close: numOrNull(data.wc != null ? data.wc : data.water_close),
      issues: data.iss || data.issues || {}
    };
    return O.queue(function(){
      if(id) return O.call('PUT', '/v1/fleet/daily-log/' + enc(ds) + '/piers/' + enc(pierKey) + '/requests/' + enc(id), body);
      return O.post('/v1/fleet/daily-log/' + enc(ds) + '/piers/' + enc(pierKey) + '/requests', body);
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-request');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not save pier request', e); return null; });
  });

  wrap('flReqDel', function(orig, ds, pierKey, id){
    return O.queue(function(){
      return O.del('/v1/fleet/daily-log/' + enc(ds) + '/piers/' + enc(pierKey) + '/requests/' + enc(id));
    }).then(function(day){
      applyDailyDay(day);
      O.wrote('fleet-daily-request-del');
      redrawDailyAndProjects();
      return day;
    }).catch(function(e){ O.fail('Could not delete pier request', e); return null; });
  });

  // ── Projects wrappers (do NOT recreate server side effects in browser) ──

  /* flRenderProjects ran flProjMigrate(false) on every draw: the legacy sweeps that auto-link scheduled jobs to a
     project on the same boat, auto-CREATE a project for any still-unlinked scheduled job or dry-dock boat-log entry,
     and unlink/back-fill one-shot fields.  In ops mode they edited FL_MAINT / FL_PROJECTS in memory only (flSave is a
     no-op), so the screen showed phantom projects with browser-made ids that the server never had and that vanished
     on reload.  The server owns parent_project_id (PATCH /v1/fleet/jobs/:id links and unlinks, both logs written),
     and the projects themselves come from GET /v1/fleet/projects.  The re-scan button reaches the same function. */
  wrap('flProjMigrate', function(){ return { created: 0, linked: 0, skipped: 'operation-backend owns project links' }; });

  wrap('flProjSaveModal', function(){
    var d = function(id){ return document.getElementById(id); };
    var editId = d('fl-proj-edit-id') ? (d('fl-proj-edit-id').value || null) : null;
    var name = d('fl-proj-name') ? d('fl-proj-name').value.trim() : '';
    var planFrom = d('fl-proj-from') ? d('fl-proj-from').value : '';
    if(!name){ alert('Project name is required'); return null; }
    if(!planFrom){ alert('Planned start is required'); return null; }
    var projects = listProjects();
    var maxNo = projects.reduce(function(mx, p){
      var n = parseInt(String((p && p.no) || '').replace(/^PRJ-/, ''), 10) || 0;
      return Math.max(mx, n);
    }, 0);
    var input = {
      no: editId ? undefined : ('PRJ-' + String(maxNo + 1).padStart(3, '0')),
      name: name,
      boatId: d('fl-proj-boat') && d('fl-proj-boat').value !== '__none__' ? (d('fl-proj-boat').value || null) : null,
      type: d('fl-proj-type') ? d('fl-proj-type').value : 'drydock',
      vendor: d('fl-proj-vendor') ? d('fl-proj-vendor').value.trim() : '',
      planFrom: planFrom,
      planTo: d('fl-proj-to') ? (d('fl-proj-to').value || null) : null,
      plannedBudget: d('fl-proj-budget') ? (parseFloat(d('fl-proj-budget').value) || 0) : 0,
      notes: d('fl-proj-notes') ? d('fl-proj-notes').value.trim() : ''
    };
    return O.queue(function(){
      if(editId) return O.patch('/v1/fleet/projects/' + enc(editId), toProjectBody(input, true));
      return O.post('/v1/fleet/projects', toProjectBody(input, false));
    }).then(function(res){
      upsertProject(res);
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-project');
      O.wrote('fleet-project-save');
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not save project', e); return null; });
  });

  function runProjectCmd(id, cmd, body, title){
    var p = listProjects().find(function(x){ return x && x.id === id; });
    var boatId = p ? p.boatId : null;
    return O.queue(function(){
      return O.post('/v1/fleet/projects/' + enc(id) + '/' + cmd, body || {});
    }).then(function(res){
      upsertProject(res);
      return refetchAfterProjectCascade(boatId).then(function(){
        O.wrote('fleet-project-' + cmd);
        redrawDailyAndProjects();
        return res;
      });
    }).catch(function(e){ O.fail(title || ('Could not ' + cmd + ' project'), e); return null; });
  }

  wrap('flProjStart', function(orig, id){
    return runProjectCmd(id, 'start', {}, 'Could not start project');
  });

  wrap('flProjHold', function(orig, id){
    var reason = prompt('Reason for putting project on hold:');
    if(reason === null) return null;
    reason = text(reason);
    if(!reason){ alert('Reason required'); return null; }
    return runProjectCmd(id, 'hold', { reason: reason }, 'Could not put project on hold');
  });

  wrap('flProjResume', function(orig, id){
    return runProjectCmd(id, 'resume', {}, 'Could not resume project');
  });

  wrap('flProjCancel', function(orig, id){
    var reason = prompt('Reason for cancelling project:');
    if(reason === null) return null;
    reason = text(reason);
    if(!reason){ alert('Reason required'); return null; }
    return runProjectCmd(id, 'cancel', { reason: reason, unlink_jobs: true }, 'Could not cancel project');
  });

  wrap('flProjReopen', function(orig, id){
    return runProjectCmd(id, 'reopen', {}, 'Could not reopen project');
  });

  /* vendor visit: the project answers (the server computes its cost and log line) */
  wrap('flProjAddVendorVisit', function(orig, projId){
    var p = listProjects().find(function(x){ return x && x.id === projId; });
    if(!p) return null;
    var vendor = prompt('Vendor / contractor name:', p.vendor || '');
    if(!vendor) return null;
    var role = prompt('Role / purpose (e.g. inspection · paint quote · sea trial):', '') || '';
    var body = { vendor: vendor.trim() };
    if(role.trim()) body.role = role.trim();
    return runProjectCmd(projId, 'vendor-visits', body, 'Could not add vendor visit');
  });

  /* "Close at ฿0" (the no-cost choice): the reason in the note is the server's no_cost_reason. Legacy set
     p.noCost in the browser and then posted complete with nothing, so the reason was lost. */
  wrap('flProjBillGo', function(orig){
    var id = typeof _prjBillId !== 'undefined' ? _prjBillId : null;
    var pick = typeof _prjBillPick !== 'undefined' ? _prjBillPick : 'wait';
    var known = id && listProjects().some(function(x){ return x && x.id === id; });
    if(!known || pick === 'wait') return orig.apply(this, [].slice.call(arguments, 1));
    var note = (document.getElementById('prj-bill-note') || {}).value || '';
    var reason = String(note).trim();
    if(!reason){
      alert('ปิดแบบไม่มีค่าใช้จ่าย ต้องเขียนเหตุผลไว้ในหมายเหตุ\n\nเช่น "งานในประกัน" · "ช่างบริษัททำเอง" · "อู่ไม่คิดเงิน"');
      return null;
    }
    if(typeof window.flProjBillClose_ === 'function') window.flProjBillClose_();
    return runProjectCmd(id, 'complete', { no_cost_reason: reason }, 'Could not complete project');
  });

  /* issue items (the list of things issued to boats): name, unit, pier, off. The list is read from the daily
     log, so after a save the daily window is read again. "off" is sent as true/false (the switch-off
     flag the screen sends as 1/0). */
  wrap('flIssueSetItem', function(orig, id, field, val){
    var body = null;
    if(field === 'off') body = { off: !!val };
    else if(field === 'name' || field === 'unit' || field === 'pier'){ body = {}; body[field] = String(val || '').trim(); }
    if(!body) return orig.apply(this, [].slice.call(arguments, 1));
    return O.queue(function(){
      return O.patch('/v1/fleet/issue-items/' + enc(id), body);
    }).then(function(){
      return loadDailyWindow().then(function(){
        O.wrote('fleet-issue-items');
        redrawDailyAndProjects();
        if(typeof window.flRenderDR === 'function') window.flRenderDR();
        return null;
      });
    }).catch(function(e){ O.fail('Could not save the issue item', e); return null; });
  });

  wrap('flProjWorkDone', function(orig, id, note){
    return runProjectCmd(id, 'work-done', note ? { note: text(note) } : {}, 'Could not mark project work done');
  });

  wrap('flProjBillBack', function(orig, id){
    return runProjectCmd(id, 'bill-back', {}, 'Could not return project to work');
  });

  wrap('flProjMarkComplete', function(orig, id){
    return runProjectCmd(id, 'complete', {}, 'Could not complete project');
  });

  wrap('flProjBillClose', function(orig, id){
    return runProjectCmd(id, 'complete', {}, 'Could not close project bill');
  });

  wrap('flProjSetPhase', function(orig, projId, phaseKey){
    return O.queue(function(){
      return O.patch('/v1/fleet/projects/' + enc(projId), { phase: phaseKey });
    }).then(function(res){
      upsertProject(res);
      O.wrote('fleet-project-phase');
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not update project phase', e); return null; });
  });

  wrap('flProjAddPlanItemDirect', function(orig, projId, txt){
    var t = text(txt);
    if(!t) return null;
    return O.queue(function(){
      return O.post('/v1/fleet/projects/' + enc(projId) + '/plan', { text: t });
    }).then(function(res){
      upsertProject(res);
      O.wrote('fleet-project-plan');
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not add plan item', e); return null; });
  });

  wrap('flProjTogglePlanItem', function(orig, projId, itemId){
    var p = listProjects().find(function(x){ return x && x.id === projId; });
    var it = p && (p.plan || []).find(function(x){ return x && x.id === itemId; });
    if(!it) return null;
    return O.queue(function(){
      return O.patch('/v1/fleet/projects/' + enc(projId) + '/plan/' + enc(itemId), { done: !it.done });
    }).then(function(res){
      upsertProject(res);
      O.wrote('fleet-project-plan-toggle');
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not toggle plan item', e); return null; });
  });

  wrap('flProjDeletePlanItem', function(orig, projId, itemId){
    return O.queue(function(){
      return O.del('/v1/fleet/projects/' + enc(projId) + '/plan/' + enc(itemId));
    }).then(function(res){
      upsertProject(res);
      O.wrote('fleet-project-plan-delete');
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not delete plan item', e); return null; });
  });

  /* legacy flProjDeleteVendorVisit: the same confirm, then DELETE …/projects/{id}/vendor-visits/{visit_id};
     the server answers the whole project. */
  wrap('flProjDeleteVendorVisit', function(orig, projId, vvId){
    var p = listProjects().find(function(x){ return x && x.id === projId; });
    var v = p && (p.vendorVisits || []).find(function(x){ return x && x.id === vvId; });
    if(!v) return null;
    if(!confirm('Delete vendor visit: ' + v.vendor + '?')) return null;
    return O.queue(function(){
      return O.del('/v1/fleet/projects/' + enc(projId) + '/vendor-visits/' + enc(vvId));
    }).then(function(res){
      upsertProject(res);
      O.wrote('fleet-project-vendor-visit-delete');
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not delete vendor visit', e); return null; });
  });

  // ── Safety & Fuel Budget wrappers ──

  /* the fuel budget screen reads {month: amount}: the server's budgets, not the browser's localStorage */
  wrap('_fuelBudgetGet', function(){
    return Object.assign({}, state.fuelBudgets);
  });

  wrap('flSaveSafety', function(){
    var d = function(id){ return document.getElementById(id); };
    var editId = typeof _flEditingSafetyId !== 'undefined' ? _flEditingSafetyId : null;
    var boatId = d('fl-sf-boat') ? d('fl-sf-boat').value : '';
    var cat = d('fl-sf-category') ? d('fl-sf-category').value : '';
    var name = d('fl-sf-name') ? d('fl-sf-name').value.trim() : '';
    if(!boatId || !cat || !name){ alert('กรุณากรอกข้อมูลให้ครบ'); return null; }
    var body = toSafetyBody({
      boatId: boatId,
      category: cat,
      name: name,
      brand: d('fl-sf-brand') ? d('fl-sf-brand').value.trim() : '',
      model: d('fl-sf-model') ? d('fl-sf-model').value.trim() : '',
      serial: d('fl-sf-serial') ? d('fl-sf-serial').value.trim() : '',
      qty: d('fl-sf-qty') ? (parseInt(d('fl-sf-qty').value, 10) || 1) : 1,
      installDate: d('fl-sf-install') ? d('fl-sf-install').value : null,
      expiryDate: d('fl-sf-expiry') ? d('fl-sf-expiry').value : null,
      nextPM: d('fl-sf-nextpm') ? d('fl-sf-nextpm').value : null,
      lastInspect: d('fl-sf-lastinspect') ? d('fl-sf-lastinspect').value : null,
      status: d('fl-sf-status') ? d('fl-sf-status').value : 'active',
      location: d('fl-sf-location') ? d('fl-sf-location').value.trim() : '',
      note: d('fl-sf-note') ? d('fl-sf-note').value.trim() : ''
    });
    return O.queue(function(){
      if(editId) return O.patch('/v1/fleet/safety/' + enc(editId), body);
      return O.post('/v1/fleet/safety', body);
    }).then(function(res){
      upsertSafety(res);
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-safety');
      O.wrote('fleet-safety-save');
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not save safety item', e); return null; });
  });

  wrap('flSaveInspection', function(){
    var d = function(id){ return document.getElementById(id); };
    var itemId = typeof _flInspItemId !== 'undefined' ? _flInspItemId : null;
    if(!itemId) return null;
    var editInspId = typeof _flEditingInspId !== 'undefined' ? _flEditingInspId : null;
    var body = {
      date: d('fl-insp-date') ? d('fl-insp-date').value : O.today(),
      inspector: d('fl-insp-inspector') ? nullable(d('fl-insp-inspector').value) : null,
      result: typeof _flInspResult !== 'undefined' ? (_flInspResult || 'pass') : 'pass',
      findings: d('fl-insp-findings') ? nullable(d('fl-insp-findings').value) : null,
      next_due: d('fl-insp-nextdue') ? nullable(d('fl-insp-nextdue').value) : null
    };
    return O.queue(function(){
      if(editInspId) return O.patch('/v1/fleet/safety/' + enc(itemId) + '/inspections/' + enc(editInspId), body);
      return O.post('/v1/fleet/safety/' + enc(itemId) + '/inspections', body);
    }).then(function(res){
      upsertSafety(res);
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-insp');
      O.wrote('fleet-safety-inspection');
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not save safety inspection', e); return null; });
  });

  /* legacy flDeleteInspection (06-engine-assign.js): the same confirm, then DELETE …/safety/{id}/inspections/{insp_id};
     the server recomputes the last inspection and next PM and answers the whole item. */
  wrap('flDeleteInspection', function(orig, itemId, inspId){
    var it = (typeof FL_SAFETY !== 'undefined' && Array.isArray(FL_SAFETY) ? FL_SAFETY : []).find(function(x){ return x && x.id === itemId; });
    if(!it || !it.inspections) return null;
    var insp = it.inspections.find(function(i){ return i && i.id === inspId; });
    if(!insp) return null;
    var style = typeof INSP_RESULT_STYLE !== 'undefined' ? INSP_RESULT_STYLE[insp.result] : null;
    if(!confirm('Delete this inspection record (' + insp.date + ' · ' + ((style && style.label) || insp.result) + ')?')) return null;
    return O.queue(function(){
      return O.del('/v1/fleet/safety/' + enc(itemId) + '/inspections/' + enc(inspId));
    }).then(function(res){
      upsertSafety(res);
      O.wrote('fleet-safety-inspection-delete');
      if(typeof window.flRenderSafetyList === 'function') window.flRenderSafetyList();
      redrawDailyAndProjects();
      return res;
    }).catch(function(e){ O.fail('Could not delete safety inspection', e); return null; });
  });

  /* legacy _flSafetyStatus: the state is the server's (safetyState: REPLACED, MISSING, EXPIRED, DUE <= 30, SOON <= 90, OK, OK_NO_PM);
     the label text, colours and background stay as the screens had them */
  wrap('_flSafetyStatus', function(orig, item){
    var st = item && item.state;
    if(!st || !st.label) return orig.apply(this, [].slice.call(arguments, 1));
    var days = st.days != null ? st.days : null, type = st.type;
    var red = { color: '#A32D2D', bg: '#FCEBEB' }, amber = { color: '#854F0B', bg: '#FFF5EB' }, soon = { color: '#854F0B', bg: '#FFFAF5' }, green = { color: '#0F6E56', bg: '#E1F5EE' };
    switch(st.label){
      case 'REPLACED': return { label: 'REPLACED', color: '#5F5E5A', bg: '#F1EFE8', days: null };
      case 'MISSING': return { label: 'MISSING', color: red.color, bg: red.bg, days: null };
      case 'OK_NO_PM': return { label: 'OK · no PM', color: green.color, bg: green.bg, days: null };
      case 'EXPIRED': return { label: 'EXPIRED', color: red.color, bg: red.bg, days: days, type: type };
      case 'DUE': return { label: 'DUE · ' + days + 'd', color: amber.color, bg: amber.bg, days: days, type: type };
      case 'SOON': return { label: 'SOON · ' + days + 'd', color: soon.color, bg: soon.bg, days: days, type: type };
      default: return { label: 'OK', color: green.color, bg: green.bg, days: days, type: type };
    }
  });

  wrap('swapDocExecute', function(){
    var sd = typeof _swapDoc !== 'undefined' ? _swapDoc : null;
    if(!sd || !sd.itemId) return null;
    var it = listSafety().find(function(x){ return x && x.id === sd.itemId; });
    if(!it){ alert('Safety item not found'); return null; }

    var incList = typeof FL_INCIDENTS !== 'undefined' && Array.isArray(FL_INCIDENTS) ? FL_INCIDENTS : [];
    var mjList = typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT) ? FL_MAINT : [];
    var moList = typeof FL_MEMOS !== 'undefined' && Array.isArray(FL_MEMOS) ? FL_MEMOS : [];
    var nextNo = function(arr, prefix){
      var mx = (arr || []).reduce(function(m, x){ return Math.max(m, parseInt(String((x && x.no) || '').replace(new RegExp('^' + prefix + '-'), ''), 10) || 0); }, 0);
      return prefix + '-' + String(mx + 1).padStart(3, '0');
    };

    var body = toSafetyReplaceBody({
      reason: sd.reason || 'broken',
      description: sd.description,
      date: sd.date || O.today(),
      source: sd.source || 'inventory',
      newInventoryId: sd.newInventoryId,
      newBrand: sd.newBrand,
      newModel: sd.newModel,
      supplier: sd.supplier,
      newPrice: sd.newPrice,
      newSerial: sd.newSerial,
      installDate: sd.installDate || sd.date || O.today(),
      installer: sd.installer,
      labour: sd.newLabour != null ? sd.newLabour : sd.labour, // the screen keeps the labour cost in _swapDoc.newLabour
      incNo: nextNo(incList, 'INC'),
      mjNo: nextNo(mjList, 'MJ'),
      moNo: sd.source === 'buy' ? nextNo(moList, 'MO') : null,
      serialAnyway: !sd.newSerial
    });

    // Server handles all side effects (incident, job, memo, stock withdrawal, old/new safety items)
    return O.queue(function(){
      return O.post('/v1/fleet/safety/' + enc(it.id) + '/replace', body).catch(function(e){
        if(e && e.code === 'stock_short'){
          if(!confirm(e.message)) throw e;
          return O.post('/v1/fleet/safety/' + enc(it.id) + '/replace', Object.assign({}, body, { allow_negative: true }));
        }
        throw e;
      });
    }).then(function(res){
      if(res && res.old_item) upsertSafety(res.old_item);
      if(res && res.new_item) upsertSafety(res.new_item);
      var tasks = [];
      if(O.fleetJobs && typeof O.fleetJobs.load === 'function') tasks.push(O.fleetJobs.load().catch(function(){}));
      if(O.fleetStock && typeof O.fleetStock.refetch === 'function') tasks.push(O.fleetStock.refetch().catch(function(){}));
      return Promise.all(tasks).then(function(){
        if(typeof _swapDoc !== 'undefined') _swapDoc = null;
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-swap-doc');
        O.wrote('fleet-safety-replace');
        redrawDailyAndProjects();
        return res;
      });
    }).catch(function(e){ O.fail('Could not replace safety item', e); return null; });
  });

  /* legacy flSafetyDelete (06-engine-assign.js): the same confirm, then DELETE; the list is redrawn from the answer */
  wrap('flSafetyDelete', function(orig, id){
    var it = listSafety().find(function(x){ return x && x.id === id; });
    if(!it) return undefined;
    if(!confirm('Delete "' + it.name + '"?\nThis cannot be undone.')) return undefined;
    return O.queue(function(){
      return O.del('/v1/fleet/safety/' + enc(id));
    }).then(function(){
      removeSafetyLocal(id);
      if(typeof flSelSafetyId !== 'undefined') flSelSafetyId = null;
      O.wrote('fleet-safety-delete');
      redrawDailyAndProjects();
      return null;
    }).catch(function(e){ O.fail('Could not delete safety item', e); return null; });
  });

  wrap('fuelSetBudget', function(orig, val){
    var month = typeof _fuelMonth !== 'undefined' && _fuelMonth ? _fuelMonth : O.today().slice(0, 7);
    var v = parseFloat(val);
    var amt = (val === '' || val == null || isNaN(v) || v <= 0) ? null : Math.round(v * 100) / 100;
    return O.queue(function(){
      return O.call('PUT', '/v1/fleet/fuel-budgets/' + enc(month), { amount: amt });
    }).then(function(res){
      if(amt === null) delete state.fuelBudgets[month];
      else state.fuelBudgets[month] = res && res.amount != null ? num(res.amount) : amt;
      O.wrote('fleet-fuel-budget');
      if(typeof window.renderFuelIntel === 'function') window.renderFuelIntel();
      return res;
    }).catch(function(e){ O.fail('Could not save fuel budget', e); return null; });
  });

  /* legacy flBoatRepairCostMonth (Consumables screen): the month's repair cost per boat. The server's answer is
     GET /v1/fleet/reports/upkeep?month=YYYY-MM, boats[].repairs (jobs closed that month; the server dates a
     repair by its close date). The screen draws at once from the browser's own figure; when the month's report
     arrives it is drawn again from the server's. Any write or change clears the saved months. */
  /* legacy flBoatBookingsFor (Daily Fleet Log auto-PAX): the passengers booked on a boat that day. The server's
     answer is pax_booked on GET /v1/fleet/daily-log (fleet-daily.ts bookedOn); it is read for every day loaded.
     The routes / trips count of the same call stays the browser's (the server row has the number only). */
  wrap('flBoatBookingsFor', function(orig, boatId, ds){
    var out = orig.apply(this, [].slice.call(arguments, 1));
    var v = state.bookedByKey[ds + '|' + boatId];
    if(v != null && out) out.pax = v;
    return out;
  });

  var upkeep = {};   // ym → { rows: {boatId: repairs} } | 'loading' | 'failed'
  function dropUpkeep(){ upkeep = {}; state.bookedByKey = {}; }   // a write may change bookings: the browser's own count answers until the day is read again
  O.onWrite(dropUpkeep);
  wrap('flBoatRepairCostMonth', function(orig, boatId, ym){
    var args = [].slice.call(arguments, 1);
    if(!ym) return orig.apply(this, args);
    var c = upkeep[ym];
    if(c && c.rows) return Math.round(+c.rows[boatId] || 0);
    if(!c){
      upkeep[ym] = 'loading';
      O.get('/v1/fleet/reports/upkeep', { month: ym }).then(function(res){
        var rows = {};
        ((res && res.boats) || []).forEach(function(r){ if(r && r.boat_id) rows[r.boat_id] = +r.repairs || 0; });
        upkeep[ym] = { rows: rows };
        try{ if(typeof window.renderConsumables === 'function' && document.getElementById('fl-consume-wrap')) window.renderConsumables(); }catch(_){}
      }).catch(function(e){ upkeep[ym] = 'failed'; O.fail('Could not load the month\'s repair cost', e); });
    }
    return orig.apply(this, args);
  });

  O.onChange(function(change){
    if(!change) return;
    dropUpkeep();
    if(['fleet_project', 'fleet_daily', 'fleet_safety', 'fleet_fuel_budget'].indexOf(change.entity_type) >= 0){
      state.loaded = false;
    }
  });

  var api = {
    load: function(){ return loadAll(true); },
    ensureLoaded: function(){ return loadAll(false); },
    loadDailyWindow: loadDailyWindow,
    patchBoatDay: function(date, boatId, body){
      return O.queue(function(){ return O.patch('/v1/fleet/daily-log/' + enc(date) + '/boats/' + enc(boatId), toBoatDayPatchBody(body)); })
        .then(function(day){ applyDailyDay(day); return day; });
    },
    setFuelBudget: function(month, amount){
      return O.queue(function(){ return O.call('PUT', '/v1/fleet/fuel-budgets/' + enc(month), { amount: amount }); })
        .then(function(res){ if(amount == null) delete state.fuelBudgets[month]; else state.fuelBudgets[month] = num(res.amount); return res; });
    },
    replaceSafety: function(id, body){
      return O.queue(function(){ return O.post('/v1/fleet/safety/' + enc(id) + '/replace', toSafetyReplaceBody(body)); })
        .then(function(res){ if(res && res.old_item) upsertSafety(res.old_item); if(res && res.new_item) upsertSafety(res.new_item); return res; });
    },
    /* A project document: POST (sub '') / PATCH|DELETE (sub = doc id). The server returns the whole project. */
    projectDoc: function(method, projId, sub, body){
      return O.queue(function(){ return O.call(method, '/v1/fleet/projects/' + enc(projId) + '/documents' + (sub ? '/' + enc(sub) : ''), body); })
        .then(function(res){ if(res && res.id) upsertProject(res); O.wrote('fleet-project-doc'); redrawDailyAndProjects(); return res; });
    },
    loadDashboard: function(date){ return O.get('/v1/fleet/dashboard', date ? { date: date } : {}); },
    loadRepairHistory: function(boatId){ return O.get('/v1/fleet/repair-history', { boat_id: boatId }); },
    loadCostReport: function(period){ return O.get('/v1/fleet/reports/cost', { period: period || 'all' }); },
    loadUpkeepReport: function(month){ return O.get('/v1/fleet/reports/upkeep', month ? { month: month } : {}); },
    loadFuelReport: function(month){ return O.get('/v1/fleet/reports/fuel', month ? { month: month } : {}); },
    loadMemoSpendReport: function(from, to){ return O.get('/v1/fleet/reports/memo-spend', { from: from, to: to }); },
    loadInsights: function(period){ return O.get('/v1/fleet/insights', { period: period || 'month' }); },
    loadFleetReport: function(from, to){ return O.get('/v1/fleet/reports/fleet', { from: from, to: to }); }
  };

  O.fleetDaily = api;
  window.laOpsFleetDaily = api;
  window.__laOpsFleetDailyCompat = {
    fromServerProject: fromServerProject,
    fromServerSafety: fromServerSafety,
    applyDailyDay: applyDailyDay,
    toProjectBody: toProjectBody,
    toBoatDayPatchBody: toBoatDayPatchBody,
    toSafetyBody: toSafetyBody,
    toSafetyReplaceBody: toSafetyReplaceBody
  };

  if(enabled()) loadAll(false).catch(function(){});
})();
