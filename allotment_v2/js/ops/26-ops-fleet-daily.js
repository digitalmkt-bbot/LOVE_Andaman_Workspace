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
    prevMeterByKey: {},
    issueItems: [],
    fuelBudgets: {},
    safetyCategories: [],
    reports: {},
    drBoat: {},               // 'date|boat' → the server's status / operated / ran_despite / pax_effective / fuel_cost for that boat-day (flRenderDR)
    drPier: {},               // 'date|pier' → the server's pier totals of the day (piers[])
    drClosed: {}              // date → { pier: true } the piers the server says are closed (closed_piers)
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
      billDays: p.bill_days != null ? num(p.bill_days) : null,
      requiredDocuments: Array.isArray(p.required_documents) ? p.required_documents.slice() : null,
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
    Object.keys(state.prevMeterByKey).forEach(function(k){ if(k.indexOf(ds + '|') === 0) delete state.prevMeterByKey[k]; });
    Object.keys(state.drBoat).forEach(function(k){ if(k.indexOf(ds + '|') === 0) delete state.drBoat[k]; });
    Object.keys(state.drPier).forEach(function(k){ if(k.indexOf(ds + '|') === 0) delete state.drPier[k]; });

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
      if(b.pax_effective != null) state.drBoat[ds + '|' + bid] = {
        status: b.status || 'available', operated: !!b.operated, ranDespite: !!b.ran_despite,
        paxEffective: num(b.pax_effective), fuelCost: b.fuel_cost != null ? num(b.fuel_cost) : null
      };
      if(b.water){
        // used = the server's close minus open (a negative one also comes as the water_negative flag)
        state.waterByKey[ds + '|' + bid] = { o: b.water.open, c: b.water.close, by: b.water.by, at: b.water.at, used: b.water.used != null ? b.water.used : null };
      }
      // the engine's earlier reading, worked out by the server (meter_deltas = reading minus the latest earlier reading above 0)
      var deltas = b.meter_deltas || {};
      Object.keys(deltas).forEach(function(tType){
        Object.keys(deltas[tType] || {}).forEach(function(engId){
          var reading = meters[tType] ? meters[tType][engId] : null;
          var d = deltas[tType][engId];
          if(reading == null) return;
          state.prevMeterByKey[ds + '|' + engId] = d == null ? null : Math.round((Number(reading) - Number(d)) * 100) / 100;
        });
      });
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
    (Array.isArray(day.piers) ? day.piers : []).forEach(function(p){
      if(!p || !p.pier) return;
      state.drPier[ds + '|' + p.pier] = {
        closed: !!p.closed, operating: num(p.operating), pax: num(p.pax), trips: num(p.trips), fuelLitres: num(p.fuel_litres),
        fuelCost: p.fuel_cost != null ? num(p.fuel_cost) : null, fuelCostMissing: !!p.fuel_cost_missing
      };
    });

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
    if(res.closed_piers && typeof res.closed_piers === 'object'){
      (Array.isArray(res.days) ? res.days : []).forEach(function(d){
        if(!d || !d.date) return;
        var m = {}; (res.closed_piers[d.date] || []).forEach(function(p){ m[p] = true; });
        state.drClosed[d.date] = m;
      });
    }
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
    try{ if(typeof window.flRenderDR === 'function' && document.getElementById('fl-dr-body')) window.flRenderDR(); }catch(_){}
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

  /* Raw readers of the browser blob (fl_water, fl_issue, fl_extra, fl_req). In ops the blob is empty, so the
     screens that read them directly (flDRRan, _flIssueUseDays, flExtraNames) saw nothing. They now read the
     daily-log rows the server sent, in the same shapes. */
  wrap('flWaterAll', function(){ return state.waterByKey; });
  wrap('flIssueAll', function(){ return state.issuesByKey; });
  wrap('flExtraAll', function(){ return state.extrasByKey; });
  wrap('flReqAll', function(){ return state.requestsByKey; });

  /* water used = the server's close minus open (a negative one is its water_negative flag) */
  wrap('flWaterUsed', function(orig, ds, bid){
    var w = state.waterByKey[String(ds || '') + '|' + String(bid || '')];
    if(w && w.used !== undefined) return w.used;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* the engine's previous reading: the server's latest earlier reading above 0 (the window of 14 days
     loaded here would miss an older one) = reading minus meter_deltas */
  wrap('flPrevMeter', function(orig, engId, dateStr){
    var k = String(dateStr || '') + '|' + String(engId || '');
    if(Object.prototype.hasOwnProperty.call(state.prevMeterByKey, k)) return state.prevMeterByKey[k];
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* the price the boat's fuel costs that day: the server's boat, pier, sibling, back-30-days chain */
  wrap('flFuelPriceEff', function(orig, ds, boat){
    var day = boat && mapDaily()[ds];
    var bd = day && day[boat.id];
    if(bd && bd.fuelPriceEff && bd.fuelPriceEff.price != null) return clone(bd.fuelPriceEff);
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* strict price (no fallback): the server marks a litre with no price of its own as price_missing */
  wrap('flFuelPriceForBoat', function(orig, ds, boat){
    var day = boat && mapDaily()[ds];
    var bd = day && day[boat.id];
    if(bd && Array.isArray(bd.flags) && bd.flags.indexOf('price_missing') >= 0) return null;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* issue items: add / switch on again by name. POST /v1/fleet/issue-items turns a same-name item back on
     (planIssueItemAdd); the list comes back with the daily log, so it is read again. The old code kept the
     item in the browser blob only, and the wrapped flIssueItems then showed the server list without it. */
  wrap('flIssueAddItem', function(orig, name, unit, pierKey){
    name = String(name || '').trim(); if(!name) return null;
    var body = { name: name, unit: String(unit || '').trim(), pier: pierKey || '' };
    return O.queue(function(){
      return O.post('/v1/fleet/issue-items', body);
    }).then(function(item){
      return loadDailyWindow().then(function(){
        O.wrote('fleet-issue-items');
        redrawDailyAndProjects();
        return item && item.id;
      });
    }).catch(function(e){ O.fail('Could not add the issue item', e); return null; });
  });

  // the item list is the server's: never written to the browser blob (flIssueSetItem and flIssueAddItem send it)
  wrap('flIssueItemsSave', function(){ return undefined; });

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

  /* Cancel: legacy's prompt, then, when the project has open child jobs, its confirm "Unlink them so they continue as
     standalone jobs?". OK sends unlink_jobs: true (they go on alone), Cancel sends unlink_jobs: false (they stay linked);
     the wrapper used to send true without asking. The server judges completed / cancelled projects; the two toasts are
     legacy's hint before the prompt. */
  wrap('flProjCancel', function(orig, id){
    var p = listProjects().find(function(x){ return x && x.id === id; });
    if(!p) return null;
    var toast = function(m){ if(typeof window.flShowToast === 'function') window.flShowToast(m); };
    if(p.status === 'completed'){ toast('Completed projects cannot be cancelled'); return null; }
    if(p.status === 'cancelled'){ toast('Already cancelled'); return null; }
    var reason = prompt('Reason for cancelling:', '');
    if(reason === null) return null;
    reason = text(reason);
    if(!reason){ alert('Reason required'); return null; }
    var kids = typeof window.flProjChildMJs === 'function' ? window.flProjChildMJs(p.id) : [];
    var open = (kids || []).filter(function(m){ return m && m.status !== 'done'; });
    var body = { reason: reason };
    if(open.length){
      body.unlink_jobs = !!confirm('This project has ' + open.length + ' open child MJ(s).\n\nUnlink them so they continue as standalone jobs?\n\n(OK = unlink · Cancel = keep linked but project will be cancelled)');
    }
    return runProjectCmd(id, 'cancel', body, 'Could not cancel project');
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

  /* The bill gate is the server's (bill_gate on the project). Legacy asked first: with no invoice document or no
     cost it opened the "close how?" dialog (flProjBillAsk: wait for the bill, or close at ฿0 with a reason) and only
     otherwise confirmed and closed. The project is read again first, so the gate is the server's answer of now. */
  function freshProject(id){
    return O.get('/v1/fleet/projects/' + enc(id)).then(function(res){ return upsertProject(res); });
  }

  wrap('flProjMarkComplete', function(orig, id){
    return freshProject(id).then(function(p){
      if(p.status === 'completed'){ if(typeof window.flShowToast === 'function') window.flShowToast('Already completed'); return null; }
      if(p.billGate && !p.billGate.ok && typeof window.flProjBillAsk === 'function'){ window.flProjBillAsk(id); return null; }
      var kids = typeof window.flProjChildMJs === 'function' ? window.flProjChildMJs(id).filter(function(m){ return m.status !== 'done'; }) : [];
      var msg = kids.length
        ? 'Mark project complete?\n\nThis will:\n- Close ' + kids.length + ' open child MJ(s)\n- Set boat status → available\n- Set project status → completed\n\nContinue?'
        : 'Mark project complete?\n\nThis will set boat status → available and project status → completed.';
      if(!confirm(msg)) return null;
      return runProjectCmd(id, 'complete', {}, 'Could not complete project');
    }).catch(function(e){ O.fail('Could not complete project', e); return null; });
  });

  wrap('flProjBillClose', function(orig, id){
    return freshProject(id).then(function(p){
      if(p.billGate && !p.billGate.ok && typeof window.flProjBillAsk === 'function'){ window.flProjBillAsk(id); return null; }
      var cost = p.billGate && p.billGate.cost != null ? p.billGate.cost : p.cost;
      if(!confirm('ปิดโปรเจค ' + p.no + '?\n\nต้นทุนที่จะบันทึก ฿' + (cost || 0).toLocaleString() + '\nใบนี้จะเข้า YTD Spend และย้ายไปคลังงานที่ปิดแล้ว')) return null;
      return runProjectCmd(id, 'complete', {}, 'Could not close project bill');
    }).catch(function(e){ O.fail('Could not close project bill', e); return null; });
  });

  /* what the project screens show of a project comes from the server's view of it: its phases and the current
     one, health score, bill gate, days waiting for the bill, cost. Legacy worked each one out from the local
     jobs and memos. Without a server project (not loaded) the legacy function runs. */
  function serverProject(p){ return p && p._fromOpsBackend ? p : null; }
  var HEALTH_COLORS = {
    completed: { color: '#0E7A5C', bg: '#E6F7F1' }, cancelled: { color: '#A32D2D', bg: '#FCEBEB' },
    ontrack: { color: '#0E7A5C', bg: '#E6F7F1' }, atrisk: { color: '#996A14', bg: '#FFF4E1' }, critical: { color: '#A32D2D', bg: '#FCEBEB' }
  };

  wrap('flProjPhasesFor', function(orig, p){
    if(serverProject(p) && p.phases && p.phases.length) return p.phases;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flProjCurrentPhaseIdx', function(orig, p){
    if(serverProject(p) && p.phases && p.phases.length) return p.phaseIndex;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flProjHealth', function(orig, p){
    var h = serverProject(p) && p.health;
    if(h && h.key){
      var c = HEALTH_COLORS[h.key] || HEALTH_COLORS.ontrack;
      return { key: h.key, label: h.label, color: c.color, bg: c.bg, score: h.score, budgetPct: h.budget_pct, schedOver: h.sched_over, openRatio: h.open_ratio };
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flProjBillGate', function(orig, p){
    var g = serverProject(p) && p.billGate;
    if(g) return { ok: !!g.ok, miss: Array.isArray(g.missing) ? g.missing.slice() : [], cost: g.cost != null ? g.cost : 0 };
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flProjBillDays', function(orig, p){
    if(serverProject(p) && p.billDays != null) return p.billDays;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* flProjCostBreakdown / flProjMJCostBreakdown (project cost card): parts, labour, other memos and total are the
     server's cost_breakdown on the project; a job's own split is its child_jobs line. A job outside any server project
     keeps legacy's sum. */
  wrap('flProjCostBreakdown', function(orig, projId){
    var p = listProjects().find(function(x){ return x && x.id === projId; });
    var b = serverProject(p) && p.costBreakdown;
    if(b && b.total != null) return { parts: num(b.parts), labour: num(b.labour), memos: num(b.memos), total: num(b.total) };
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('flProjMJCostBreakdown', function(orig, mjId){
    var hit = null;
    listProjects().forEach(function(p){
      var b = serverProject(p) && p.costBreakdown;
      if(b && Array.isArray(b.child_jobs)) b.child_jobs.forEach(function(c){ if(c && c.job_id === mjId) hit = c; });
    });
    if(hit) return { parts: num(hit.parts), labour: num(hit.labour), memos: num(hit.memos), total: num(hit.total) };
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flProjCalcCost', function(orig, projId){
    var p = listProjects().find(function(x){ return x && x.id === projId; });
    if(serverProject(p) && p.cost != null) return p.cost;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* a project's cost, bill gate and health depend on its jobs and memos: when one of those is written the
     projects are read again (one read, after the writes of the moment settle) */
  var projRefreshTimer = null;
  O.onWrite(function(kind){
    if(!enabled() || !state.loaded) return;
    kind = String(kind || '');
    if(kind.indexOf('fleet-job') !== 0 && kind.indexOf('fleet-memo') !== 0 && kind.indexOf('fleet-incident') !== 0) return;
    clearTimeout(projRefreshTimer);
    projRefreshTimer = setTimeout(function(){
      O.get('/v1/fleet/projects').then(function(r){
        replaceProjects((r && r.projects) || []);
        redrawDailyAndProjects();
      }).catch(function(){});
    }, 400);
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

  /* flOpenLogInspectionModal: a NEW inspection's next-due date is prefilled for the eye (date + the cadence, legacy's
     look) but marked as not entered by a person; flSaveInspection then leaves it to the server. Typing in the field
     makes it the person's date. Editing an inspection shows its stored date as it was. */
  wrap('flOpenLogInspectionModal', function(orig, itemId, editInspId){
    var r = orig.apply(this, [].slice.call(arguments, 1));
    var el = document.getElementById('fl-insp-nextdue');
    if(el){
      el.dataset.auto = editInspId ? '0' : '1';
      if(!el.__opsAuto){
        el.__opsAuto = true;
        var touched = function(){ el.dataset.auto = '0'; };
        el.addEventListener('input', touched); el.addEventListener('change', touched);
      }
    }
    return r;
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
    /* a date the person did not touch (the modal's prefill is only a hint) is left OUT of the body, not sent as null:
       the server fills a missing next_due (date + the category's pmMonths, fleet-safety.ts parseInspection) */
    if(!editInspId && d('fl-insp-nextdue') && d('fl-insp-nextdue').dataset.auto === '1') delete body.next_due;
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

    /* w5-b / w6-b: the incident, job and memo numbers are the server's next_no (GET /v1/fleet/incidents, /jobs, /memos), read just
       before the send, not the browser's highest + 1. The browser's own count is only the fallback for a read that failed. */
    var nosP = Promise.all([
      O.get('/v1/fleet/incidents', { boat_id: '-none-' }).catch(function(){ return null; }),
      O.get('/v1/fleet/jobs', { boat_id: '-none-' }).catch(function(){ return null; }),
      O.get('/v1/fleet/memos', { boat_id: '-none-' }).catch(function(){ return null; })
    ]).then(function(r){
      return { inc: (r[0] && r[0].next_no) || nextNo(incList, 'INC'), mj: (r[1] && r[1].next_no) || nextNo(mjList, 'MJ'), mo: (r[2] && r[2].next_no) || nextNo(moList, 'MO') };
    });
    var body = null;
    function buildBody(nos){
      return toSafetyReplaceBody({
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
        incNo: nos.inc,
        mjNo: nos.mj,
        moNo: sd.source === 'buy' ? nos.mo : null,
        serialAnyway: !sd.newSerial
      });
    }

    // Server handles all side effects (incident, job, memo, stock withdrawal, old/new safety items)
    return nosP.then(function(nos){ body = buildBody(nos); return O.queue(function(){
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
    }).catch(function(e){ O.fail('Could not replace safety item', e); return null; }); });
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
     GET /v1/fleet/reports/upkeep?month=YYYY-MM, boats[].repairs (every job of the boat, any status, that STARTED that
     month, at its cost so far; rule Q2 of 2026-10-17, it was the close date before). The screen draws at once from the browser's own figure; when the month's report
     arrives it is drawn again from the server's. Any write or change clears the saved months. */
  /* flRenderDR (Daily Fleet Log): what the server worked out for a boat-day and a pier-day. Legacy's render asks these
     (not wraps: flRenderDR is one long function) and keeps its own sums for a day the server did not send. */
  window.flDrServerBoat = function(ds, boatId){ return enabled() ? (state.drBoat[ds + '|' + boatId] || null) : null; };
  window.flDrServerPier = function(ds, pier){ return enabled() ? (state.drPier[ds + '|' + pier] || null) : null; };
  window.flDrPierClosed = function(ds, pier){
    if(!enabled() || !state.drClosed[ds]) return null;     // day not read: legacy's own check
    return !!state.drClosed[ds][pier];
  };

  /* legacy flBoatBookingsFor (Daily Fleet Log auto-PAX): the passengers booked on a boat that day. The server's
     answer is pax_booked on GET /v1/fleet/daily-log (fleet-daily.ts bookedOn); it is read for every day loaded.
     The routes / trips count of the same call stays the browser's (the server row has the number only). */
  /* A write drops every pax_booked (dropUpkeep below), and nothing else reads the day again when the Daily Fleet Log is
     opened: the browser's own count would answer for the rest of the session. So a day with no server figure is read once
     (since the last write) and the log is drawn again when it lands. */
  var bookedAsked = {};
  function readBookedDay(ds){
    if(bookedAsked[ds] || !enabled() || !state.loaded || !/^\d{4}-\d{2}-\d{2}$/.test(ds || '')) return;
    bookedAsked[ds] = true;
    O.get('/v1/fleet/daily-log', { from: ds, to: ds }).then(function(res){
      applyDailyRange(res);
      var el = document.getElementById('fl-dr-date');
      if(el && el.value === ds && O.activeView() === 'dailyreport' && !O.busy() && typeof window.flRenderDR === 'function') window.flRenderDR();
    }).catch(function(){});
  }
  wrap('flBoatBookingsFor', function(orig, boatId, ds){
    var out = orig.apply(this, [].slice.call(arguments, 1));
    var v = state.bookedByKey[ds + '|' + boatId];
    if(v != null && out) out.pax = v;
    else if(v == null) readBookedDay(ds);
    return out;
  });

  var upkeep = {};   // ym → { rows: {boatId: repairs} } | 'loading' | 'failed'
  function dropUpkeep(){ upkeep = {}; state.bookedByKey = {}; bookedAsked = {}; }   // a write may change bookings: the browser's own count answers until the day is read again
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

  /* Fuel Intelligence (view fl-fuel). Legacy summed FL_DAILY and SB_BOOKINGS in the browser, and FL_DAILY holds only
     the last 14 days, so a month total was incomplete. The month's figures are the server's: GET /v1/fleet/reports/fuel?month=
     (days that ran, the price of the boat or of its pier that day, anomalies at 1.3x, weekly cost, revenue by family,
     the six months of each boat). The report is read for the month shown; _fuelAgg and _fuelWkAgg then give the screen the
     same shapes it always read. Shown from the last read at once, and drawn again if the server's answer differs. */
  state.fuelReports = {};

  function fuelAggFromReport(r){
    var out = { fuel: num(r.fuel), cost: num(r.cost), pax: num(r.pax), tripDays: num(r.trip_days), byBoat: {}, byFam: {}, missing: [], anomalies: [], weekly: {}, priceMissing: !!r.price_missing };
    (r.boats || []).forEach(function(b){
      var routes = {};
      (b.routes || []).forEach(function(x){
        routes[x.route_id || '_none'] = { name: x.name, fuel: num(x.fuel), cost: num(x.cost), pax: num(x.pax), days: num(x.days) };
      });
      out.byBoat[b.boat_id] = { id: b.boat_id, name: b.name, fuel: num(b.fuel), cost: num(b.cost), pax: num(b.pax), runH: num(b.run_hours), days: num(b.days), missing: num(b.missing), fdays: [], routes: routes };
    });
    (r.families || []).forEach(function(f){ out.byFam[f.family_id] = { name: f.name, fuel: num(f.fuel), cost: num(f.cost), pax: num(f.pax), rev: num(f.revenue) }; });
    (r.missing || []).forEach(function(m){ out.missing.push({ name: m.name, ds: m.date, route: m.route || '' }); });
    (r.anomalies || []).forEach(function(x){ out.anomalies.push({ name: x.name, ds: x.date, fuel: x.fuel, avg: x.average, pct: x.pct }); });
    // a week is listed when a boat ran in it (legacy), even when its fuel had no price
    (r.weekly || []).forEach(function(w, i){
      var ran = (r.trend || []).some(function(t){ return t.weeks && t.weeks[i] && t.weeks[i].days > 0; });
      if(ran || num(w.cost) > 0) out.weekly[w.week] = num(w.cost);
    });
    return out;
  }

  function accOf(m){ return m && m.days ? { fuel: num(m.fuel), cost: num(m.cost), pax: num(m.pax), days: num(m.days), runH: num(m.run_hours) } : null; }

  function fuelWkFromReport(r){
    var out = {};
    (r.trend || []).forEach(function(t){
      var tot = accOf((r.boats || []).find(function(b){ return b.boat_id === t.boat_id; }));
      if(!tot) return;
      out[t.boat_id] = { id: t.boat_id, name: t.name, w: (t.weeks || []).map(accOf), tot: tot };
    });
    return out;
  }

  // a month that has no report of its own is read from the six-month series of one that has
  function fuelWkFromSeries(month){
    var out = null;
    Object.keys(state.fuelReports).forEach(function(k){
      ((state.fuelReports[k] || {}).trend || []).forEach(function(t){
        var m = (t.months || []).find(function(x){ return x.month === month; });
        var tot = accOf(m);
        if(!tot) return;
        out = out || {};
        out[t.boat_id] = { id: t.boat_id, name: t.name, w: [null, null, null, null, null], tot: tot };
      });
    });
    return out || {};
  }

  wrap('_fuelAgg', function(orig, month){
    var r = state.fuelReports[month];
    if(r) return fuelAggFromReport(r);
    // the month before the one shown: only its cost and pax are read (cost per pax, the change against it)
    var next = Object.keys(state.fuelReports).map(function(k){ return state.fuelReports[k]; }).find(function(x){ return x && x.previous && x.previous.month === month; });
    if(next) return { fuel: 0, cost: num(next.previous.cost), pax: num(next.previous.pax), tripDays: 0, byBoat: {}, byFam: {}, missing: [], anomalies: [], weekly: {}, priceMissing: false };
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('_fuelWkAgg', function(orig, month){
    var r = state.fuelReports[month];
    if(r) return fuelWkFromReport(r);
    return fuelWkFromSeries(month);
  });

  wrap('renderFuelIntel', function(orig){
    var month = typeof _fuelMonth !== 'undefined' && _fuelMonth ? _fuelMonth : O.today().slice(0, 7);
    var had = state.fuelReports[month] || null;
    if(had) orig.apply(this, [].slice.call(arguments, 1));
    return O.get('/v1/fleet/reports/fuel', { month: month }).then(function(rep){
      state.fuelReports[month] = rep;
      var still = typeof _fuelMonth !== 'undefined' ? _fuelMonth === month : true;
      if(still && (!had || JSON.stringify(had) !== JSON.stringify(rep))) orig.call(window);
      return rep;
    }).catch(function(e){ O.fail('Could not load the fuel report', e); return null; });
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
