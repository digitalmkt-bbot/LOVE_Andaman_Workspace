/* ══════════════════════════════════════════════════════════════════════════
   §opsDayActions · day-of booking actions ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   - Insurance (`PUT /v1/bookings/:id/insurance`): versioned via
     `laOps.bookingWrite`; replaces returned booking projection.
   - Meals (`PUT /v1/bookings/:id/meals`): versioned via `laOps.bookingWrite`;
     replaces returned booking projection.
   - Check-in (`PUT|DELETE /operations/trip-ops/:trip_id/checkins/:kind/:slot`):
     unversioned (`laOps.call`); merges returned `trip.operations` without a
     booking version bump and preserves append-only no-show/cxl events.
   - Tour sales (`GET|POST /v1/bookings/:id/tour-sales`,
     `PATCH|DELETE .../:sale_id`, `POST .../:sale_id/collect`, and
     `POST /v1/bookings/:id/upgrades/:upgrade_id/collect`): versioned via
     `laOps.bookingWrite`.
   - Reconfirm remains legacy-only per O3 specification.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var state = {
    salesLoadedFor: {}
  };
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function nullable(v){ var s = text(v); return s ? s : null; }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function clone(v){ return O.clone ? O.clone(v) : (v == null ? v : JSON.parse(JSON.stringify(v))); }

  function listBookings(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }
  function listExtras(){ return typeof SB_EXTRAS !== 'undefined' && Array.isArray(SB_EXTRAS) ? SB_EXTRAS : []; }

  function findBooking(id){
    var s = text(id);
    if(!s) return null;
    return listBookings().find(function(b){ return b && (b.id === s || b.opsId === s); }) || null;
  }
  function toServerBookingId(id){
    var bk = findBooking(id);
    return (bk && bk.opsId) ? bk.opsId : text(id);
  }
  function toClientBookingId(id){
    var bk = findBooking(id);
    return (bk && bk.id) ? bk.id : text(id);
  }

  function applyBookingResponse(bk, ob){
    if(!ob || !ob.id) return bk;
    if(O.bookings && typeof O.bookings.upsert === 'function'){
      O.bookings.upsert(ob);
    }
    var target = bk || findBooking(ob.external_id || ob.id);
    if(target){
      if(ob.version != null) target.opsVersion = +ob.version;
      if(ob.lead_age !== undefined) target.leadAge = ob.lead_age;
      if(ob.lead_insurance_reviewed_at !== undefined) target.leadInsuranceReviewedAt = ob.lead_insurance_reviewed_at;
      if(ob.lead_insurance_reviewed_by !== undefined) target.leadInsuranceReviewedBy = ob.lead_insurance_reviewed_by;
      if(Array.isArray(ob.passengers)){
        target.passengers = ob.passengers.map(function(p){
          return {
            seq: p.seq,
            name: p.name,
            nationality: p.nationality || '',
            type: p.type || 'AD',
            foc: !!p.foc,
            age: p.age != null ? p.age : null,
            insuranceReviewedAt: p.insurance_reviewed_at || null,
            insuranceReviewedBy: p.insurance_reviewed_by || null
          };
        });
      }
      if(ob.special_meals_veg !== undefined || ob.special_meals_vegan !== undefined || ob.special_meals_halal !== undefined || ob.special_meals_allergies !== undefined){
        target.specialMeals = Object.assign({}, target.specialMeals || {}, {
          veg: ob.special_meals_veg != null ? +ob.special_meals_veg : 0,
          vegan: ob.special_meals_vegan != null ? +ob.special_meals_vegan : 0,
          halal: ob.special_meals_halal != null ? +ob.special_meals_halal : 0,
          allergies: ob.special_meals_allergies || '',
          pierAt: ob.special_meals_pier_at || null,
          pierBy: ob.special_meals_pier_by || null
        });
      }
      if(Array.isArray(ob.upgrades)){
        target.upgrades = ob.upgrades.map(function(u){
          return {
            id: u.id,
            label: u.label || 'Upgrade',
            sellPrice: num(u.sell_price != null ? u.sell_price : u.sellPrice),
            toCompany: num(u.to_company != null ? u.to_company : u.toCompany),
            commission: num(u.commission != null ? u.commission : Math.max(0, num(u.sell_price) - num(u.to_company))),
            seller: u.seller || '',
            note: u.note || '',
            collected: !!u.collected,
            settle: u.settle || (u.collected ? 'done' : 'pending'),
            method: u.method || 'cash',
            feePct: num(u.fee_pct != null ? u.fee_pct : u.feePct),
            fee: num(u.fee),
            customerPaid: num(u.customer_paid != null ? u.customer_paid : u.customerPaid),
            at: u.at || '',
            slips: Array.isArray(u.slips) ? clone(u.slips) : []
          };
        });
      }
    }
    return target;
  }

  // ── 1. Insurance (`PUT /v1/bookings/:id/insurance`) ──

  function toInsuranceBody(passengerKey, update){
    update = update || {};
    var p = passengerKey === 'lead' ? 'lead' : parseInt(passengerKey, 10);
    var item = { passenger: p };
    if(update.age !== undefined){
      var rawAge = update.age;
      if(rawAge === '' || rawAge === null){
        item.age = null;
      } else {
        var n = Number(rawAge);
        item.age = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
      }
    }
    if(update.reviewed !== undefined){
      item.reviewed = !!update.reviewed;
    }
    return { passengers: [item] };
  }

  function updateInsuranceServer(bkId, passengerKey, update){
    var bk = findBooking(bkId);
    var sid = toServerBookingId(bkId);
    var body = toInsuranceBody(passengerKey, update);
    return O.queue(function(){
      return O.bookingWrite('PUT', '/v1/bookings/' + enc(sid) + '/insurance', bk || { id: bkId, opsId: sid }, body);
    }).then(function(ob){
      applyBookingResponse(bk, ob);
      O.wrote('booking-insurance');
      if(typeof window.renderInsurance === 'function' && document.getElementById('insurance-host')){
        window.renderInsurance();
      }
      return ob;
    }, function(e){
      O.fail('Could not save insurance details', e);
      throw e;
    });
  }

  // ── 2. Meals (`PUT /v1/bookings/:id/meals`) ──

  function toMealsBody(d){
    d = d || {};
    return {
      veg: Math.max(0, Math.round(num(d.veg))),
      vegan: Math.max(0, Math.round(num(d.vegan))),
      halal: Math.max(0, Math.round(num(d.halal))),
      allergies: text(d.allergies)
    };
  }

  function updateMealsServer(bkId, mealsInput){
    var bk = findBooking(bkId);
    var sid = toServerBookingId(bkId);
    var body = toMealsBody(mealsInput);
    return O.queue(function(){
      return O.bookingWrite('PUT', '/v1/bookings/' + enc(sid) + '/meals', bk || { id: bkId, opsId: sid }, body);
    }).then(function(ob){
      applyBookingResponse(bk, ob);
      O.wrote('booking-meals');
      if(typeof window.renderPierCheckin === 'function' && document.getElementById('piercheckin-host')){
        window.renderPierCheckin();
      }
      return ob;
    }, function(e){
      O.fail('Could not save special meals', e);
      throw e;
    });
  }

  // ── 3. Check-in (`PUT|DELETE /operations/trip-ops/:trip_id/checkins/:kind/:slot`) ──

  function parseCheckinKindAndSlot(kind){
    var s = String(kind || '');
    // legacy _ckSlot writes split-van slots as 'van#2' / 'pier#1'
    var m = /^(van|pier)(?:[#:](\d+))?$/.exec(s);
    if(!m) return { kind: s === 'pier' ? 'pier' : 'van', slot: 0 };
    return { kind: m[1], slot: m[2] != null ? parseInt(m[2], 10) : 0 };
  }

  function mapCheckinEventToServer(ev){
    ev = ev || {};
    var u = ev.undone ? {
      why: ev.undone.why || 'mistake',
      at: nullable(ev.undone.at),
      by: nullable(ev.undone.by),
      ts: nullable(ev.undone.ts),
      note: nullable(ev.undone.note)
    } : null;
    var tries = (Array.isArray(ev.tries) ? ev.tries : []).map(function(t){
      return {
        at: nullable(t.at),
        by: nullable(t.by),
        note: nullable(t.note),
        ts: nullable(t.ts)
      };
    });
    return {
      type: ev.type === 'cxl' ? 'cxl' : 'no_show',
      pax: Math.max(0, Math.round(num(ev.pax))),
      ad: ev.ad != null ? Math.round(num(ev.ad)) : null,
      chd: ev.chd != null ? Math.round(num(ev.chd)) : null,
      inf: ev.inf != null ? Math.round(num(ev.inf)) : null,
      foc: ev.foc != null ? Math.round(num(ev.foc)) : null,
      reason_code: nullable(ev.reason_code != null ? ev.reason_code : ev.reasonCode),
      note: nullable(ev.note),
      at: nullable(ev.at),
      by: nullable(ev.by),
      ts: nullable(ev.ts),
      undone: u,
      tries: tries
    };
  }

  function toCheckinBody(val, prevEvents){
    val = val || {};
    // Preserve append-only events from previous state if caller omitted or truncated them
    var incomingEvents = Array.isArray(val.events) ? val.events : [];
    var baseEvents = Array.isArray(prevEvents) ? prevEvents : [];
    var events = incomingEvents.length >= baseEvents.length ? incomingEvents : baseEvents;

    var r = val.reinstate ? {
      at: nullable(val.reinstate.at),
      by: nullable(val.reinstate.by),
      ts: nullable(val.reinstate.ts)
    } : null;
    var sa = (val.selfAdd || val.self_add) ? (function(s){
      return {
        pax: Math.max(0, Math.round(num(s.pax))),
        ad: s.ad != null ? Math.round(num(s.ad)) : null,
        chd: s.chd != null ? Math.round(num(s.chd)) : null,
        inf: s.inf != null ? Math.round(num(s.inf)) : null,
        foc: s.foc != null ? Math.round(num(s.foc)) : null,
        at: nullable(s.at),
        by: nullable(s.by),
        ts: nullable(s.ts),
        note: nullable(s.note)
      };
    })(val.selfAdd || val.self_add) : null;

    return {
      expected: val.expected != null ? Math.max(0, Math.round(num(val.expected))) : null,
      actual_pax: (val.actual_pax !== undefined ? val.actual_pax : val.actualPax) != null
        ? Math.max(0, Math.round(num(val.actual_pax !== undefined ? val.actual_pax : val.actualPax))) : null,
      checked_in_at: nullable(val.checked_in_at || val.checkedInAt || val.ts || (val.at && val.at.length > 5 ? val.at : null)),
      checked_in_by: nullable(val.checked_in_by || val.checkedInBy || val.by),
      reason_code: nullable(val.reason_code != null ? val.reason_code : val.reasonCode),
      reason_note: nullable(val.reason_note != null ? val.reason_note : val.reasonNote),
      reason_at: nullable(val.reason_at != null ? val.reason_at : val.reasonAt),
      arrived_at: nullable(val.arrived_at != null ? val.arrived_at : val.arrivedAt),
      arrived_by: nullable(val.arrived_by != null ? val.arrived_by : val.arrivedBy),
      cleared_at: nullable(val.cleared_at != null ? val.cleared_at : val.clearedAt),
      cleared_by: nullable(val.cleared_by != null ? val.cleared_by : val.clearedBy),
      flow: nullable(val.flow),
      flow_at: nullable(val.flow_at != null ? val.flow_at : val.flowAt),
      flow_by: nullable(val.flow_by != null ? val.flow_by : val.flowBy),
      flow_note: nullable(val.flow_note != null ? val.flow_note : val.flowNote),
      reinstate: r,
      self_add: sa,
      events: events.map(mapCheckinEventToServer)
    };
  }

  function fromServerCheckinRecord(r){
    r = r || {};
    return {
      kind: r.kind,
      slot: r.slot,
      expected: r.expected != null ? r.expected : null,
      actualPax: r.actual_pax != null ? r.actual_pax : null,
      noShow: r.no_show != null ? r.no_show : null,
      at: r.checked_in_at || null,
      by: r.checked_in_by || null,
      reasonCode: r.reason_code || '',
      reasonNote: r.reason_note || '',
      reasonAt: r.reason_at || '',
      arrivedAt: r.arrived_at || null,
      arrivedBy: r.arrived_by || null,
      clearedAt: r.cleared_at || null,
      clearedBy: r.cleared_by || null,
      flow: r.flow || null,
      flowAt: r.flow_at || null,
      flowBy: r.flow_by || null,
      flowNote: r.flow_note || null,
      reinstate: r.reinstate ? clone(r.reinstate) : null,
      selfAdd: r.self_add ? clone(r.self_add) : null,
      events: (Array.isArray(r.events) ? r.events : []).map(function(e){
        return {
          type: e.type,
          pax: e.pax,
          ad: e.ad,
          chd: e.chd,
          inf: e.inf,
          foc: e.foc,
          reasonCode: e.reason_code || '',
          note: e.note || '',
          at: e.at || null,
          by: e.by || null,
          ts: e.ts || null,
          undone: e.undone ? clone(e.undone) : null,
          tries: Array.isArray(e.tries) ? clone(e.tries) : []
        };
      })
    };
  }

  /* Server trip.operations.checkins {van:[],pier:[]} -> the local fields legacy screens read:
     targetOps.checkins (raw), targetOps.pierCheckin / vanCheckin (slot 0 + _s{slot>0}).
     Shared by the write path (mergeTripOperations) and the booking LOAD (40-ops-bookings operationsFrom). */
  function applyServerCheckins(targetOps, ops){
    ops = ops || {};
    targetOps.checkins = clone(ops.checkins || { van: [], pier: [] });
    ['van', 'pier'].forEach(function(k){
      var list = (ops.checkins && Array.isArray(ops.checkins[k])) ? ops.checkins[k] : [];
      var slot0 = list.find(function(r){ return r && r.slot === 0; });
      var prop = k === 'pier' ? 'pierCheckin' : 'vanCheckin';
      var bag = {};
      list.forEach(function(r){
        if(r && r.slot > 0) bag[r.slot] = fromServerCheckinRecord(r);
      });
      if(slot0){
        var mapped0 = fromServerCheckinRecord(slot0);
        if(Object.keys(bag).length) mapped0._s = bag;
        targetOps[prop] = mapped0;
      } else if(Object.keys(bag).length){
        targetOps[prop] = { _s: bag };
      } else {
        targetOps[prop] = null;
      }
    });
  }

  function mergeTripOperations(bk, date, serverTrip){
    if(!bk || !serverTrip || !serverTrip.operations) return;
    var ops = serverTrip.operations;
    var trips = Array.isArray(bk.trips) ? bk.trips : [];
    var trip = trips.find(function(t){ return t && (t.opsTripId === serverTrip.id || t.date === date); });
    var firstDate = trips[0] ? trips[0].date : '';
    var targetOps = (trip && trip.date !== firstDate) ? (trip.ops = trip.ops || {}) : (bk.ops = bk.ops || {});

    applyServerCheckins(targetOps, ops);
  }

  function writeCheckinServer(b, date, kind, val){
    if(!b) return Promise.resolve(null);
    var trips = Array.isArray(b.trips) ? b.trips : [];
    var trip = trips.find(function(t){ return t && t.date === date; }) || trips[0];
    var tripId = trip && trip.opsTripId;
    if(!tripId) return Promise.resolve(null);

    var target = parseCheckinKindAndSlot(kind);
    var path = '/operations/trip-ops/' + enc(tripId) + '/checkins/' + enc(target.kind) + '/' + enc(target.slot);

    var curOps = (trip && trips[0] && trip.date !== trips[0].date) ? (trip.ops || {}) : (b.ops || {});
    var curProp = target.kind === 'pier' ? curOps.pierCheckin : curOps.vanCheckin;
    var curRec = target.slot > 0 ? (curProp && curProp._s && curProp._s[target.slot]) : curProp;
    var prevEvents = curRec && Array.isArray(curRec.events) ? curRec.events : [];

    return O.queue(function(){
      if(val === null){
        return O.del(path);
      }
      return O.call('PUT', path, toCheckinBody(val, prevEvents));
    }).then(function(res){
      if(res && res.trip){
        // Do NOT bump bk.opsVersion on check-in writes
        mergeTripOperations(b, date, res.trip);
      }
      O.wrote('trip-checkin');
      return res;
    }, function(e){
      O.fail('Could not save check-in', e);
      throw e;
    });
  }

  // ── 4. On-tour sales (`GET|POST|PATCH|DELETE /v1/bookings/:id/tour-sales...`) ──

  function fromServerTourSale(s, clientBookingId){
    s = s || {};
    var cid = clientBookingId || toClientBookingId(s.booking_id);
    return {
      id: s.id,
      bookingId: cid,
      serverBookingId: s.booking_id,
      tripDate: s.trip_date || '',
      service: s.service || 'Extra',
      qty: num(s.qty || 1),
      unitPrice: num(s.unit_price),
      total: num(s.total != null ? s.total : (num(s.qty || 1) * num(s.unit_price))),
      toCompany: num(s.to_company),
      commission: num(s.commission),
      seller: s.seller || '',
      method: s.method || 'cash',
      feePct: num(s.fee_pct),
      fee: num(s.fee),
      customerPaid: num(s.customer_paid),
      settle: s.settle || (s.method === 'cot' ? 'pending' : 'done'),
      collectedAt: s.collected_at || '',
      collectedBy: s.collected_by || '',
      date: s.sold_at || '',
      slips: Array.isArray(s.slips) ? clone(s.slips) : [],
      _fromOpsBackend: true
    };
  }

  function upsertExtra(row, clientBookingId){
    var mapped = fromServerTourSale(row, clientBookingId);
    var target = listExtras();
    var idx = target.findIndex(function(x){ return x && x.id === mapped.id; });
    if(idx < 0) target.push(mapped);
    else target[idx] = mapped;
    return mapped;
  }

  function removeExtraLocal(id){
    var target = listExtras();
    var idx = target.findIndex(function(x){ return x && x.id === id; });
    if(idx >= 0) target.splice(idx, 1);
  }

  function loadTourSalesForBooking(bkId){
    var cid = toClientBookingId(bkId);
    var sid = toServerBookingId(bkId);
    if(!sid) return Promise.resolve([]);
    return O.get('/v1/bookings/' + enc(sid) + '/tour-sales').then(function(res){
      var rows = (res && res.tour_sales) || [];
      var target = listExtras();
      for(var i = target.length - 1; i >= 0; i--){
        if(target[i] && (target[i].bookingId === cid || target[i].serverBookingId === sid)){
          target.splice(i, 1);
        }
      }
      var mapped = rows.map(function(r){ return fromServerTourSale(r, cid); });
      Array.prototype.push.apply(target, mapped);
      state.salesLoadedFor[cid] = true;
      return mapped;
    });
  }

  function toTourSaleBody(d){
    d = d || {};
    var method = text(d.method) || 'cash';
    var slips = method === 'cot' ? [] : (Array.isArray(d.slips || d.slip_ids) ? (d.slips || d.slip_ids).map(function(s){ return typeof s === 'string' ? s : (s && s.id); }).filter(Boolean) : []);
    var body = {
      service: text(d.service || d.name) || 'Extra',
      qty: Math.max(1, Math.round(num(d.qty || 1))),
      unit_price: num(d.unit_price != null ? d.unit_price : (d.unitPrice != null ? d.unitPrice : d.price)),
      to_company: Math.max(0, num(d.to_company != null ? d.to_company : d.toCompany)),
      seller: nullable(d.seller),
      method: method,
      fee_pct: method === 'card' ? num(d.fee_pct != null ? d.fee_pct : d.feePct) : 0,
      slip_ids: slips
    };
    if(nullable(d.trip_date != null ? d.trip_date : d.tripDate)){
      body.trip_date = nullable(d.trip_date != null ? d.trip_date : d.tripDate);
    }
    return body;
  }

  function toCollectBody(d){
    d = d || {};
    var method = text(d.method) || 'cash';
    var body = { method: method };
    if(method === 'card' && (d.fee_pct !== undefined || d.feePct !== undefined)){
      body.fee_pct = num(d.fee_pct != null ? d.fee_pct : d.feePct);
    }
    var slips = d.slip_ids || d.slips;
    if(Array.isArray(slips) && slips.length){
      body.slip_ids = slips.map(function(s){ return typeof s === 'string' ? s : (s && s.id); }).filter(Boolean);
    }
    return body;
  }

  function bumpBookingFromReload(bk){
    if(!bk || !bk.opsId) return Promise.resolve();
    return O.get('/v1/bookings/' + enc(bk.opsId)).then(function(ob){
      applyBookingResponse(bk, ob);
    }).catch(function(){});
  }

  function saveTourSaleServer(bkId, editId, input){
    var bk = findBooking(bkId);
    var sid = toServerBookingId(bkId);
    var cid = toClientBookingId(bkId);
    var body = toTourSaleBody(input);
    var method = editId ? 'PATCH' : 'POST';
    var path = '/v1/bookings/' + enc(sid) + '/tour-sales' + (editId ? ('/' + enc(editId)) : '');
    return O.queue(function(){
      return O.bookingWrite(method, path, bk || { id: cid, opsId: sid }, body);
    }).then(function(sale){
      var mapped = upsertExtra(sale, cid);
      return bumpBookingFromReload(bk).then(function(){
        O.wrote('booking-tour-sale');
        if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
        if(typeof window.bookingV2ExtraRender === 'function') window.bookingV2ExtraRender();
        return mapped;
      });
    }, function(e){
      O.fail('Could not save on-tour sale', e);
      throw e;
    });
  }

  function deleteTourSaleServer(saleId, bkId){
    var bk = findBooking(bkId);
    var sid = toServerBookingId(bkId);
    return O.queue(function(){
      return O.bookingWrite('DELETE', '/v1/bookings/' + enc(sid) + '/tour-sales/' + enc(saleId), bk || { id: bkId, opsId: sid });
    }).then(function(){
      removeExtraLocal(saleId);
      return bumpBookingFromReload(bk).then(function(){
        O.wrote('booking-tour-sale-delete');
        if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
        if(typeof window.bookingV2ExtraRender === 'function') window.bookingV2ExtraRender();
      });
    }, function(e){
      O.fail('Could not delete on-tour sale', e);
      throw e;
    });
  }

  function collectTourSaleServer(saleId, bkId, opt){
    var bk = findBooking(bkId);
    var sid = toServerBookingId(bkId);
    var cid = toClientBookingId(bkId);
    var body = toCollectBody(opt);
    return O.queue(function(){
      return O.bookingWrite('POST', '/v1/bookings/' + enc(sid) + '/tour-sales/' + enc(saleId) + '/collect', bk || { id: cid, opsId: sid }, body);
    }).then(function(sale){
      var mapped = upsertExtra(sale, cid);
      return bumpBookingFromReload(bk).then(function(){
        O.wrote('booking-tour-sale-collect');
        if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
        if(typeof window.renderCheckinAll === 'function') window.renderCheckinAll();
        if(typeof window.bookingV2ExtraRender === 'function') window.bookingV2ExtraRender();
        return mapped;
      });
    }, function(e){
      O.fail('Could not collect on-tour sale', e);
      throw e;
    });
  }

  function collectUpgradeServer(upgradeId, bkId, opt){
    var bk = findBooking(bkId);
    var sid = toServerBookingId(bkId);
    var body = toCollectBody(opt);
    return O.queue(function(){
      return O.bookingWrite('POST', '/v1/bookings/' + enc(sid) + '/upgrades/' + enc(upgradeId) + '/collect', bk || { id: bkId, opsId: sid }, body);
    }).then(function(ob){
      applyBookingResponse(bk, ob);
      O.wrote('booking-upgrade-collect');
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
      if(typeof window.bookingV2UpgradeRender === 'function') window.bookingV2UpgradeRender();
      return ob;
    }, function(e){
      O.fail('Could not collect upgrade payment', e);
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
    w.__opsDayActions = true;
    window[name] = w;
  }

  // Block legacy localStorage writers for insurance and extras in operations mode
  ['insPersist', 'sbExtrasPersist'].forEach(function(name){
    wrap(name, function(){ return; });
  });

  wrap('insEff', function(orig, bkId, pk, field, src){
    var bk = findBooking(bkId);
    if(bk && bk._fromOpsBackend){
      if(field === 'age'){
        if(pk === 'lead' && bk.leadAge != null) return bk.leadAge;
        var idx = parseInt(pk, 10);
        if(Number.isFinite(idx) && bk.passengers && bk.passengers[idx] && bk.passengers[idx].age != null){
          return bk.passengers[idx].age;
        }
      }
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('insOv', function(orig, bkId, pk){
    var base = orig.apply(this, [].slice.call(arguments, 1)) || {};
    var bk = findBooking(bkId);
    if(bk && bk._fromOpsBackend){
      if(pk === 'lead' && bk.leadInsuranceReviewedAt){
        return Object.assign({}, base, { reviewed: true, age: bk.leadAge });
      }
      var idx = parseInt(pk, 10);
      if(Number.isFinite(idx) && bk.passengers && bk.passengers[idx] && bk.passengers[idx].insuranceReviewedAt){
        return Object.assign({}, base, { reviewed: true, age: bk.passengers[idx].age });
      }
    }
    return Object.keys(base).length ? base : null;
  });

  wrap('insSetField', function(orig, bkId, pk, field, val){
    if(field === 'age'){
      return updateInsuranceServer(bkId, pk, { age: val }).catch(function(){ return null; });
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('insToggleReviewed', function(orig, bkId, pk){
    var cur = window.insOv ? window.insOv(bkId, pk) : null;
    var nextRev = !(cur && cur.reviewed);
    return updateInsuranceServer(bkId, pk, { reviewed: nextRev }).catch(function(){ return null; });
  });

  // insRevertRow (08-app.js): the Revert button drops the typed age as well as the local first/last name and nationality.
  // The age lives on the server (PUT /v1/bookings/:id/insurance, age: null clears it); the other overrides stay in this browser.
  wrap('insRevertRow', function(orig, bkId, pk){
    var bk = findBooking(bkId);
    var r = orig.apply(this, [].slice.call(arguments, 1));
    if(bk && bk._fromOpsBackend){
      var idx = parseInt(pk, 10);
      var has = pk === 'lead' ? bk.leadAge != null : (Number.isFinite(idx) && bk.passengers && bk.passengers[idx] && bk.passengers[idx].age != null);
      if(has) updateInsuranceServer(bkId, pk, { age: null }).catch(function(){ return null; });
    }
    return r;
  });

  wrap('pckMealSave', function(){
    var st = typeof _pckMeal !== 'undefined' ? _pckMeal : null;
    if(!st || !st.bkId){
      if(typeof window.pckMealClose === 'function') window.pckMealClose();
      return null;
    }
    var el = document.getElementById('pck-meal-al');
    var allergies = el ? String(el.value || '') : (st.allergies || '');
    return updateMealsServer(st.bkId, {
      veg: st.veg,
      vegan: st.vegan,
      halal: st.halal,
      allergies: allergies
    }).then(function(){
      if(typeof window.pckMealClose === 'function') window.pckMealClose();
    }).catch(function(){ return null; });
  });

  /* Two check-in writes in one tick (vckStatus: ckToggle un-checks the row, then vckSetFlow writes its flow) both
     build their value from the SAME local record, because local state changes only when the server answers.  The
     second PUT would carry the stale `at` the first one just cleared, and since a PUT is the whole record the server
     would check the row in again.  So a write issued while another for the same row is in flight takes over what
     that write changed: a field the earlier write changed and this one left at the old value gets the earlier value. */
  var ckFlight = {};
  function sameVal(x, y){ return JSON.stringify(x === undefined ? null : x) === JSON.stringify(y === undefined ? null : y); }
  wrap('ckWrite', function(orig, b, date, kind, val){
    // Server-first check-in write: do not mutate local ops until server responds,
    // except return a pending promise while keeping UI responsive
    var key = (b && b.id) + '|' + date + '|' + kind, prior = ckFlight[key];
    var base = (typeof window.ckRead === 'function' ? window.ckRead(b, date, kind) : null) || {};
    if(prior && val && typeof val === 'object'){
      Object.keys(prior.sent).forEach(function(k){
        if(k === 'events' || k === '_s') return;
        if(!sameVal(prior.sent[k], prior.base[k]) && sameVal(val[k], prior.base[k])) val[k] = prior.sent[k];
      });
    }
    var mine = ckFlight[key] = { sent: clone(val || {}), base: clone(base) };
    writeCheckinServer(b, date, kind, val).catch(function(){}).then(function(){ if(ckFlight[key] === mine) delete ckFlight[key]; });
    return val;
  });

  // ckEventUndo (08-app.js): legacy pops the last CXL / No-show event. The server keeps check-in events
  // (409 events_append_only on a shorter list), so the same click marks the last live event undone ("mistake")
  // and gives its people back, exactly as the "รับกลับ" path does. Same confirm, same counts.
  wrap('ckEventUndo', function(orig, bkId, date, kind){
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return undefined;
    var b = findBooking(bkId); if(!b) return undefined;
    var cur = window.ckRead(b, date, kind) || {};
    var ev = Array.isArray(cur.events) ? cur.events.map(function(x){ return Object.assign({}, x); }) : [];
    var ix = -1;
    for(var i = ev.length - 1; i >= 0; i--){ if(ev[i] && !ev[i].undone){ ix = i; break; } }
    if(ix < 0){ alert('ไม่มีรายการให้ถอน'); return undefined; }
    var last = ev[ix];
    if(!confirm('ถอนรายการล่าสุด?\n' + ((last.type === 'cxl') ? 'CXL' : 'No-show') + ' ' + (last.pax || 0) + ' คน · ' + ((last.at || '') + ' ' + (last.by || '')))) return undefined;
    ev[ix] = Object.assign({}, last, { undone: { why: 'mistake', at: window.ckNowHM(), by: window.ckMe(), ts: new Date().toISOString() } });
    var live = ev.slice(0, ix).filter(function(x){ return x && !x.undone; });
    var prev = live.length ? live[live.length - 1] : null;
    var t = window.ckTripOn(b, date) || {}, booked = window.ckBookedPax(t);
    var cap = (typeof window.ckCap === 'function') ? window.ckCap(b, date, kind, booked) : booked;
    var ceil = (typeof window.ckCeil === 'function' && window._ckBase(kind) === 'pier') ? window.ckCeil(b, date, kind, booked) : cap;
    var back = Math.min(ceil, ((cur.actualPax != null) ? cur.actualPax : 0) + Math.max(0, +last.pax || 0));
    window.ckWrite(b, date, kind, { actualPax: back, noShow: Math.max(0, cap - back), expected: cap,
      selfAdd: (back > cap) ? { pax: back - cap, at: window.ckNowHM(), by: window.ckMe(), ts: new Date().toISOString() } : null,
      at: cur.at || null, by: cur.by || null, events: ev,
      reasonCode: prev ? (prev.reasonCode || prev.reason_code || '') : '', reasonNote: prev ? (prev.note || '') : '', reasonAt: prev ? (prev.at || '') : '' });
    if(typeof window.ckPersist === 'function') window.ckPersist();
    if(typeof window.ckAfter === 'function') window.ckAfter(kind);
    return undefined;
  });

  wrap('bookingV2ExtraAdd', function(orig, bkId){
    var args = [].slice.call(arguments, 1);
    var self = this;
    return loadTourSalesForBooking(bkId).catch(function(){}).then(function(){
      return orig.apply(self, args);
    });
  });

  wrap('bookingV2ExtraSave', function(orig, bkId){
    var d = function(id){ return document.getElementById(id); };
    var name = ((d('bkx-name') && d('bkx-name').value) || 'Extra').trim();
    var qty = Math.max(1, +(d('bkx-qty') && d('bkx-qty').value) || 1);
    var price = Math.max(0, num(d('bkx-price') && d('bkx-price').value));
    if(price <= 0){ alert('ใส่ราคา'); return null; }
    var total = Math.round(qty * price * 100) / 100;
    var toCompany = Math.min(total, Math.max(0, num(d('bkx-company') && d('bkx-company').value)));
    var seller = ((d('bkx-seller') && d('bkx-seller').value) || '').trim();
    var pay = typeof _bkExtraPay !== 'undefined' && _bkExtraPay ? _bkExtraPay : { m: 'cash', feePct: 0, slips: [] };
    var pm = pay.m || 'cash';
    var slips = (pay.slips || []).slice();
    if(pm !== 'cash' && pm !== 'cot' && !slips.length && !confirm('ยังไม่ได้แนบสลิป\n\nบันทึกก่อนแล้วแนบทีหลังได้ · กด OK เพื่อบันทึกเลย')) return null;

    var bk = findBooking(bkId);
    var tripDate = typeof window.bookingV2ExtraDayOf === 'function' ? window.bookingV2ExtraDayOf(bk) : ((bk && bk.trips && bk.trips[0] && bk.trips[0].date) || '');
    var editId = typeof _bkExtraEditId !== 'undefined' ? _bkExtraEditId : null;

    return saveTourSaleServer(bkId, editId, {
      tripDate: tripDate,
      service: name,
      qty: qty,
      unitPrice: price,
      toCompany: toCompany,
      seller: seller,
      method: pm,
      feePct: pm === 'card' ? num(pay.feePct) : 0,
      slips: slips
    }).then(function(res){
      if(typeof _bkExtraEditId !== 'undefined') _bkExtraEditId = null;
      if(typeof window._bkxPayReset === 'function') window._bkxPayReset(null);
      return res;
    }).catch(function(){ return null; });
  });

  wrap('bookingV2ExtraDelete', function(orig, id, bkId){
    return deleteTourSaleServer(id, bkId).catch(function(){ return null; });
  });

  wrap('bookingV2ExtraCollect', function(orig, id, bkId){
    var e = listExtras().find(function(x){ return x && x.id === id; });
    if(!e) return null;
    if(!confirm('ยืนยันว่าเก็บเงิน "' + (e.service || '') + '" ฿' + Math.round(num(e.total)).toLocaleString() + ' เป็นเงินสดแล้ว')) return null;
    return collectTourSaleServer(id, bkId || e.bookingId, { method: 'cash' }).catch(function(){ return null; });
  });

  window.bookingV2UpgradeCollect = function(upgradeId, bkId, opt){
    if(!enabled()) return null;
    return collectUpgradeServer(upgradeId, bkId, opt);
  };

  // ── 5. Trip dispatch notes and times (`PATCH /operations/trip-ops/:trip_id`) ──
  // Server first: the local ops block changes only when the server has said yes. The PATCH is unversioned
  // (a day-of write), refused with a message for a cancelled booking.

  function tripOnDate(b, date){
    var trips = Array.isArray(b && b.trips) ? b.trips : [];
    return trips.find(function(t){ return t && t.opsTripId && (t.date || '') === date; }) || null;
  }
  function patchTripOps(b, date, body){
    var t = tripOnDate(b, date);
    if(!t) return Promise.reject(new Error('This booking has no operation-backend trip on ' + date + ': save the booking first'));
    return O.queue(function(){ return O.call('PATCH', '/operations/trip-ops/' + enc(t.opsTripId), body); });
  }
  function opsBlock(b, date){
    return typeof bkOpsFor === 'function' ? bkOpsFor(b, typeof bkOpsDate === 'function' ? bkOpsDate(b, date) : date) : (b.ops = b.ops || {});
  }
  function pickupJoinText(start, end, atPier){
    if(atPier && end) return 'Before ' + end + ' at pier';
    if(start && end) return start + '-' + end;
    return start || '';
  }

  // bookingV2SetPickupFinal (booking/bookingV2SetPickupFinal.js): the final pickup time typed on the By-trip row
  wrap('bookingV2SetPickupFinal', function(orig, bkId, val, date){
    var b = findBooking(bkId); if(!b) return null;
    var d = typeof bkOpsDate === 'function' ? bkOpsDate(b, date) : date;
    var split = O.bookings && O.bookings.pickupSplit ? O.bookings.pickupSplit(val) : {};
    if(split === null){
      alert('Pickup time "' + text(val) + '" is not a time (07:30), a window (07:30-07:45) or "Before 08:30 at pier"');
      if(typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep();
      return null;
    }
    var body = { pickup_time_final: split.pickupTime || null, pickup_time_final_end: split.pickupTimeEnd || null, pickup_final_at_pier: !!split.pickupAtPier };
    return patchTripOps(b, d, body).then(function(res){
      var op = res && res.trip && res.trip.operations;
      opsBlock(b, d).pickupTimeFinal = op ? pickupJoinText(op.pickup_time_final, op.pickup_time_final_end, op.pickup_final_at_pier) : pickupJoinText(body.pickup_time_final, body.pickup_time_final_end, body.pickup_final_at_pier);
      O.wrote('trip-ops');
      return res;
    }, function(e){
      O.fail('Pickup time not saved', e);          // 409 cancelled arrives here with the server's message
      if(typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep();
      return null;
    });
  });

  // pckNoteSet (08-app.js): the pier note of one day; the server stamps who and when. An empty text clears it.
  wrap('pckNoteSet', function(orig, b, date, txt){
    if(!b) return null;
    var d = typeof bkOpsDate === 'function' ? bkOpsDate(b, date) : date;
    var note = text(txt);
    return patchTripOps(b, d, { pier_note: note || null }).then(function(res){
      var n = res && res.trip && res.trip.operations && res.trip.operations.pier_note;
      var op = opsBlock(b, d);
      op.pierNote = n ? { t: String(n.text != null ? n.text : (n.t || '')), at: n.at || '', by: n.by || '' } : null;
      delete op.pierNoteAt; delete op.pierNoteBy;
      if(typeof window.bookingV2AddHistory === 'function') window.bookingV2AddHistory(b, 'note', (note ? ('โน้ตหน้างาน: ' + note) : 'ลบโน้ตหน้างาน'), 'Pier');
      O.wrote('trip-ops');
      if(typeof window.renderPierCheckin === 'function' && O.activeView && O.activeView() === 'piercheckin') window.renderPierCheckin();
      return res;
    }, function(e){
      // 409 cancelled (a cancelled or rejected booking's dispatch cannot change): the server's message is shown as it is
      O.fail('Pier note not saved', e);
      if(typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep();
      return null;
    });
  });

  // ckStrandClear (08-app.js): "ล้างรายการค้าง" / "ล้างการจัดรถ/เรือ" on a struck-through row. Server first; the dialogs are legacy's.
  //   moved to another day  → DELETE /operations/van-strands/{booking_id}/{service_date} (404 = nothing left on the server: fine)
  //   cancelled, still in a van → PATCH /operations/trip-ops/{trip_id} {van_parts: null} for the booking's trips of that day
  //   (the one dispatch change a cancelled booking takes; the server does not clear boat/final pickup/check-in or write a history line)
  function strandRedraw(){
    ['vancheckin-host', 'piercheckin-host', 'landcheckin-host', 'vanjobs-host'].forEach(function(h){
      var el = document.getElementById(h); if(!el || !el.offsetParent) return;
      if(h === 'vancheckin-host' && typeof window.renderVanCheckin === 'function') window.renderVanCheckin();
      if(h === 'piercheckin-host' && typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
      if(h === 'landcheckin-host' && typeof window.renderLandCheckin === 'function') window.renderLandCheckin();
      if(h === 'vanjobs-host' && typeof window.renderVanJobs === 'function') window.renderVanJobs();
    });
  }
  function strandToast(bkId, nm, date, title){
    if(typeof window.laSaveToast === 'function') window.laSaveToast({ kind: 'neutral', title: title, id: bkId, status: 'CLEARED', sub: nm + ' · ' + date });
  }
  wrap('ckStrandClear', function(orig, bkId, date){
    var b = findBooking(bkId);
    if(!b) return orig(bkId, date);                                        // legacy's "not found on this machine" alert
    var nm = b.leadPax || b.voucherRef || b.code || bkId;
    var mk = bkId + '|' + date;
    var moved = typeof window.ckStrandStore === 'function' && (mk in window.ckStrandStore());
    if(moved){
      if(!confirm('ล้างรายการค้างของ ' + nm + ' ออกจากวันที่ ' + date + ' ?\n\n'
        + 'ใบนี้ถูกเลื่อนวันไปแล้ว · การจัดรถ/เรือของวันใหม่ไม่ถูกแตะ')) return;
      return O.queue(function(){ return O.call('DELETE', '/operations/van-strands/' + enc(toServerBookingId(bkId)) + '/' + enc(date)); }).then(null, function(e){
        if(e && e.status === 404) return null;
        throw e;
      }).then(function(){
        if(typeof window.ckStrandMvDrop === 'function') window.ckStrandMvDrop(mk);
        strandToast(bkId, nm, date, 'ล้างรายการค้างแล้ว'); strandRedraw();
      }, function(e){ O.fail('Leftover row not cleared', e); });
    }
    if(typeof window.ckHasArrange === 'function' && !window.ckHasArrange(b, date)) return orig(bkId, date);   // legacy's "nothing arranged" alert
    if(!confirm('ล้างการจัดรถ/เรือของ ' + nm + ' ออกจากวันที่ ' + date + ' ?\n\n'
      + 'รายการจะหายจากใบงานรถ · เช็คอินรถ · เช็คอินหน้าท่า\n'
      + 'ตัวใบจองและประวัติการยกเลิกไม่ถูกแตะ')) return;
    var trips = (Array.isArray(b.trips) ? b.trips : []).filter(function(t){ return t && t.opsTripId && (t.date || '') === date; });
    if(!trips.length){ O.fail('Van arrangement not cleared', new Error('This booking has no operation-backend trip on ' + date + ': reload the day')); return; }
    return trips.reduce(function(p, t){
      return p.then(function(){ return O.queue(function(){ return O.call('PATCH', '/operations/trip-ops/' + enc(t.opsTripId), { van_parts: null }); }); });
    }, Promise.resolve()).then(function(){
      O.wrote('trip-ops');
      // the server's trip is the truth: re-read the day so the row shows what the server kept
      var again = typeof window.bookingV2EnsureOpsRange === 'function' ? window.bookingV2EnsureOpsRange({ from: date, to: date, refresh: true }) : null;
      var done = function(){ strandToast(bkId, nm, date, 'ล้างการจัดรถ/เรือแล้ว'); strandRedraw(); };
      if(again && again.then) again.then(done, done); else done();
    }, function(e){ O.fail('Van arrangement not cleared', e); });   // 409 cancelled etc.: the server's message as it is
  });

  var api = {
    updateInsurance: updateInsuranceServer,
    updateMeals: updateMealsServer,
    writeCheckin: writeCheckinServer,
    loadTourSales: loadTourSalesForBooking,
    saveTourSale: saveTourSaleServer,
    deleteTourSale: deleteTourSaleServer,
    collectTourSale: collectTourSaleServer,
    collectUpgrade: collectUpgradeServer
  };

  O.applyCheckins = applyServerCheckins;
  O.dayActions = api;
  window.laOpsDayActions = api;
  window.__laOpsDayActionsCompat = {
    toInsuranceBody: toInsuranceBody,
    toMealsBody: toMealsBody,
    parseCheckinKindAndSlot: parseCheckinKindAndSlot,
    toCheckinBody: toCheckinBody,
    fromServerCheckinRecord: fromServerCheckinRecord,
    mergeTripOperations: mergeTripOperations,
    fromServerTourSale: fromServerTourSale,
    toTourSaleBody: toTourSaleBody,
    toCollectBody: toCollectBody
  };
})();
