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
      // the answer is the whole booking: a field the server omits is cleared there
      target.leadAge = ob.lead_age != null ? ob.lead_age : null;
      if(ob.lead_insurance_reviewed_at !== undefined || ob.lead_age !== undefined) target.leadInsuranceReviewedAt = ob.lead_insurance_reviewed_at || null;
      if(ob.lead_insurance_reviewed_by !== undefined || ob.lead_age !== undefined) target.leadInsuranceReviewedBy = ob.lead_insurance_reviewed_by || null;
      target.leadInsuranceFirstName = ob.lead_insurance_first_name || null;
      target.leadInsuranceLastName = ob.lead_insurance_last_name || null;
      target.leadInsuranceNat = ob.lead_insurance_nationality || null;
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
            insuranceReviewedBy: p.insurance_reviewed_by || null,
            insuranceFirstName: p.insurance_first_name || null,
            insuranceLastName: p.insurance_last_name || null,
            insuranceNat: p.insurance_nationality || null
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
    // the insurer's form: first / last name and nationality typed on the Insurance page (blank clears it)
    if(update.firstName !== undefined) item.first_name = update.firstName === '' ? null : String(update.firstName);
    if(update.lastName !== undefined) item.last_name = update.lastName === '' ? null : String(update.lastName);
    if(update.nat !== undefined) item.nationality = update.nat === '' ? null : String(update.nat);
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
      /* not while the person is typing in the list: the redraw would replace the field they are in */
      var typing = document.activeElement, host = document.getElementById('insurance-host');
      if(typeof window.renderInsurance === 'function' && host && !(typing && host.contains(typing) && /^(INPUT|TEXTAREA|SELECT)$/.test(typing.tagName))){
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
      /* §vckLine · the LINE follow-ups copied for this row ("💬 LINE hh:mm ×n"); server-owned */
      lineSent: (Array.isArray(r.line_sent) ? r.line_sent : []).map(function(x){ return { at: x.at || '', by: x.by || '' }; }),
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
    /* §paAdd · legacy keeps the people added at the pier on the check-in (ops.pierCheckin.adds); here they are the trip's pier_adds */
    var adds = Array.isArray(ops.pier_adds) ? ops.pier_adds : [];
    if(adds.length){
      targetOps.pierCheckin = targetOps.pierCheckin || {};
      targetOps.pierCheckin.adds = adds.map(function(x){
        return { id: x.id, at: x.at, hm: x.hm, by: x.by || '', add: clone(x.add), nat: x.nat, names: clone(x.names || []), pay: x.pay, method: x.method || '',
          unit: clone(x.unit || {}), total: +x.total || 0, reason: x.reason || '', exId: x.sale_id || '', slot: x.slot == null ? null : x.slot,
          bill: x.bill || '', billBy: x.bill_by || '', billAt: x.bill_at || '', undone: x.undone ? clone(x.undone) : undefined };
      });
    }
  }

  function mergeTripOperations(bk, date, serverTrip){
    if(!bk || !serverTrip || !serverTrip.operations) return;
    var ops = serverTrip.operations;
    var trips = Array.isArray(bk.trips) ? bk.trips : [];
    var trip = trips.find(function(t){ return t && (t.opsTripId === serverTrip.id || t.date === date); });
    var firstDate = trips[0] ? trips[0].date : '';
    var targetOps = (trip && trip.date !== firstDate) ? (trip.ops = trip.ops || {}) : (bk.ops = bk.ops || {});

    applyServerCheckins(targetOps, ops);
    /* §opsAboard · the answer carries the trip's check-in figures: keep them with the record they were computed from */
    if(trip){
      if(serverTrip.aboard && typeof serverTrip.aboard === 'object'){ trip.aboard = serverTrip.aboard; trip.aboardDate = serverTrip.service_date || trip.date; if(O.aboardTag) O.aboardTag(trip, targetOps); }   // w4-f2: ckEventTally / ckPaxBreak read the block
      else { delete trip.aboard; delete trip.aboardDate; }
    }
  }

  /* The check-in screens are drawn once, at once, by legacy's ckAfter, but in ops mode local state changes only when
     the server answers (see ckWrite below): that first draw shows the old state. Draw the open screen again with the
     server's answer, keeping the scroll position (ckAfter's job, minus its blur, which would cut off a note being typed). */
  function checkinRedraw(kind){
    var base = typeof window._ckBase === 'function' ? window._ckBase(kind) : (kind === 'pier' ? 'pier' : 'van');
    var pier = base === 'pier';
    var host = document.getElementById(pier ? 'piercheckin-host' : 'vancheckin-host');
    if(!host || !host.offsetParent) return;
    var sy = window.scrollY || window.pageYOffset || 0;
    if(pier && typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
    else if(!pier && typeof window.renderVanCheckin === 'function') window.renderVanCheckin();
    try{ window.scrollTo(0, sy); }catch(_){}
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
      checkinRedraw(kind);
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
      // §exSplitPay: the server's split parts read back as legacy's "split:cash=400|card=250", so bkxExPays and every reader of it work as they are
      method: (s.method === 'split' && Array.isArray(s.split) && s.split.length) ? ('split:' + s.split.map(function(p){ return p.method + '=' + num(p.amount); }).join('|')) : (s.method || 'cash'),
      feePct: num(s.fee_pct),
      fee: num(s.fee),
      customerPaid: num(s.customer_paid),
      settle: s.settle || (s.method === 'cot' ? 'pending' : 'done'),
      coveredByPier: s.covered_by_pier === true,        // w5-d: the server's bkxExCovered (README "Pier money"): the pier's cash already holds this sale's money
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

  /* §exSplitPay · legacy's "split:cash=400|card=250" (or a parts list) → the server's method "split" and its parts. One part is a plain sale. */
  function splitParts(d, method){
    var parts = Array.isArray(d.split) ? d.split : null;
    if(!parts && /^split:/.test(method)){
      parts = method.slice(6).split('|').map(function(seg){ var kv = seg.split('='); return { method: kv[0], amount: num(kv[1]) }; });
    }
    return (parts || []).filter(function(p){ return p && p.method && num(p.amount) > 0; }).map(function(p){ return { method: String(p.method), amount: Math.round(num(p.amount) * 100) / 100 }; });
  }
  function toTourSaleBody(d){
    d = d || {};
    var method = text(d.method) || 'cash';
    var split = null;
    if(method === 'split' || /^split:/.test(method)){
      var parts = splitParts(d, method);
      if(parts.length > 1){ method = 'split'; split = parts; } else method = parts.length ? parts[0].method : 'cash';
    }
    var byCard = method === 'card' || !!(split && split.some(function(p){ return p.method === 'card'; }));
    var slips = method === 'cot' ? [] : (Array.isArray(d.slips || d.slip_ids) ? (d.slips || d.slip_ids).map(function(s){ return typeof s === 'string' ? s : (s && s.id); }).filter(Boolean) : []);
    var body = {
      service: text(d.service || d.name) || 'Extra',
      qty: Math.max(1, Math.round(num(d.qty || 1))),
      unit_price: num(d.unit_price != null ? d.unit_price : (d.unitPrice != null ? d.unitPrice : d.price)),
      to_company: Math.max(0, num(d.to_company != null ? d.to_company : d.toCompany)),
      seller: nullable(d.seller),
      method: method,
      fee_pct: byCard ? num(d.fee_pct != null ? d.fee_pct : d.feePct) : 0,
      slip_ids: slips
    };
    if(split) body.split = split;
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

  /* the insurer's form values the server keeps: legacy's insEff fields firstName / lastName / nat / age */
  function insForm(bk, pk, field){
    var p = pk === 'lead' ? null : (bk.passengers || [])[parseInt(pk, 10)];
    if(pk !== 'lead' && !p) return null;
    if(field === 'firstName') return pk === 'lead' ? bk.leadInsuranceFirstName : p.insuranceFirstName;
    if(field === 'lastName') return pk === 'lead' ? bk.leadInsuranceLastName : p.insuranceLastName;
    if(field === 'nat') return pk === 'lead' ? bk.leadInsuranceNat : p.insuranceNat;
    return null;
  }
  /* §tmPax (lk-inbox 2026-11-04) · the Ranong immigration (ตม.) document's traveller fields: Thai and English name, ID card number,
     laser code, date of birth, remark. Legacy kept them in insurance_overrides beside the insurer's age (tmSet → insSetField), and
     insPersist does nothing here. The server keeps them per booking and traveller key (lead, or the position, past the named
     passengers too): GET /v1/tm-pax?date= fills a cache per trip date, PUT /v1/bookings/{id}/tm-pax/{key} saves one field and
     answers the row cleaned as legacy's tmSet cleans it. Nationality (nat) stays the insurer's form field below. */
  var TM = { thName: 'th_name', enName: 'en_name', idNo: 'id_no', idLaser: 'id_laser', dob: 'dob', remark: 'remark' };
  var tmRows = {}, tmDays = {};             // server booking id -> key -> row · date -> 'loading' | 'done'
  function tmRedraw(){
    var a = document.activeElement; if(a && a.closest && a.closest('.tm-grid')) return;   // typing in the grid: the next draw picks it up
    try{ if(typeof window.renderPierTm === 'function' && document.getElementById('pt-host-' + (typeof _tmPier !== 'undefined' ? _tmPier : 'ranong'))) window.renderPierTm(); }catch(_){}
    try{ if(document.querySelector('.tm-grid, [data-tmchip]')) (typeof window.bookingV2RenderKeep === 'function' ? window.bookingV2RenderKeep : window.bookingV2Render)(); }catch(_){}
  }
  function tmLoadDay(date){
    if(tmDays[date]) return;
    tmDays[date] = 'loading';
    O.get('/v1/tm-pax', { date: date }).then(function(r){
      ((r && r.rows) || []).forEach(function(x){ (tmRows[x.booking_id] = tmRows[x.booking_id] || {})[x.pax_key] = x; });
      tmDays[date] = 'done'; tmRedraw();
    }, function(e){ delete tmDays[date]; O.fail('Immigration details did not load', e); });
  }
  /* every trip date of the booking read: else the loads start and legacy's local value answers meanwhile */
  function tmKnown(bk){
    var ds = (bk.trips || []).map(function(t){ return t && t.date; }).filter(Boolean), all = ds.length > 0;
    ds.forEach(function(d){ if(tmDays[d] !== 'done'){ all = false; tmLoadDay(d); } });
    return all;
  }
  function tmSave(bk, bkId, pk, field, val){
    if(typeof window.laCanEditArea === 'function' && !window.laCanEditArea('operations')) return null;   // legacy insPersist: operations
    var sid = toServerBookingId(bkId), key = String(pk);
    var rows = tmRows[sid] = tmRows[sid] || {}, was = rows[key];
    rows[key] = Object.assign({}, was || {}); rows[key][TM[field]] = (val == null || val === '') ? null : String(val);   // shows at once
    var body = {}; body[TM[field]] = (val == null || val === '') ? null : String(val);
    return O.queue(function(){ return O.call('PUT', '/v1/bookings/' + enc(sid) + '/tm-pax/' + enc(key), body); }).then(function(r){
      if(r && r.row) rows[key] = r.row; else delete rows[key];
      O.wrote('booking-tm-pax');
      return r;
    }, function(e){
      if(was) rows[key] = was; else delete rows[key];
      O.fail('Immigration details not saved', e); tmRedraw();
      return null;
    });
  }

  wrap('insEff', function(orig, bkId, pk, field, src){
    var bk = findBooking(bkId);
    if(bk && bk._fromOpsBackend && TM[field] && bk.opsId){
      if(!tmKnown(bk)) return orig.apply(this, [].slice.call(arguments, 1));
      var row = (tmRows[toServerBookingId(bkId)] || {})[String(pk)], v = row ? row[TM[field]] : null;
      return v != null && v !== '' ? v : src;
    }
    if(bk && bk._fromOpsBackend){
      if(field === 'firstName' || field === 'lastName' || field === 'nat'){
        var typed = insForm(bk, pk, field);
        if(typed) return typed;
      }
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
      // typed names / nationality (the server's) count as overrides: the "edited" dots and Revert read them
      ['firstName', 'lastName', 'nat'].forEach(function(f){ var v = insForm(bk, pk, f); if(v) base = Object.assign({}, base, (function(o){ o[f] = v; return o; })({})); });
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

  var insAgeTimers = {};
  wrap('insSetField', function(orig, bkId, pk, field, val){
    if(TM[field]){
      var tb = findBooking(bkId);
      if(tb && tb.opsId) return tmSave(tb, bkId, pk, field, val);
      O.fail('Immigration details not saved', new Error('This booking is not saved to operation-backend yet'));
      return null;
    }
    if(field === 'age' || field === 'firstName' || field === 'lastName' || field === 'nat'){
      /* oninput: one save per pause in typing (600 ms), carrying the latest value, not one per keystroke */
      var k = bkId + '::' + pk + '::' + field;
      clearTimeout(insAgeTimers[k]);
      return new Promise(function(done){
        insAgeTimers[k] = setTimeout(function(){
          delete insAgeTimers[k];
          var u = {}; u[field] = val;
          updateInsuranceServer(bkId, pk, u).catch(function(){ return null; }).then(done);
        }, 600);
      });
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('insToggleReviewed', function(orig, bkId, pk){
    var cur = window.insOv ? window.insOv(bkId, pk) : null;
    var nextRev = !(cur && cur.reviewed);
    return updateInsuranceServer(bkId, pk, { reviewed: nextRev }).catch(function(){ return null; });
  });

  // insReviewBoat (lk-inbox §insBoat): "Review all" on one boat ticks or unticks its people. Legacy writes the local overrides and insPersist does nothing
  // here, so each person goes as insToggleReviewed goes: one PUT per passenger, server first.
  wrap('insReviewBoat', function(orig, rid, bid){
    if(typeof window.laCanEditArea === 'function' && !window.laCanEditArea('operations')) return null;
    if(typeof _insDate === 'undefined' || typeof insTripsForDate !== 'function') return null;
    var g = insTripsForDate(_insDate).find(function(x){ return String(x.routeId) === String(rid); }); if(!g) return null;
    var bo = insBoatsOf(g, _insDate).find(function(x){ return (x.bid || '') === (bid || ''); }); if(!bo) return null;
    var rows = insBoatRows(bo, _insDate).rows.filter(function(r){ return r.p; });
    var allOn = rows.length > 0 && rows.every(function(r){ return r.rev; });
    return rows.reduce(function(p, r){
      return p.then(function(){ return updateInsuranceServer(r.b.id, r.p.key, { reviewed: !allOn }); });
    }, Promise.resolve()).catch(function(){ return null; });
  });

  // insRevertRow (08-app.js): the Revert button drops the typed age as well as the local first/last name and nationality.
  // The age lives on the server (PUT /v1/bookings/:id/insurance, age: null clears it); the other overrides stay in this browser.
  wrap('insRevertRow', function(orig, bkId, pk){
    var bk = findBooking(bkId);
    var r = orig.apply(this, [].slice.call(arguments, 1));
    if(bk && bk._fromOpsBackend){
      var idx = parseInt(pk, 10);
      var p = pk === 'lead' ? null : (Number.isFinite(idx) && bk.passengers && bk.passengers[idx]);
      var has = pk === 'lead' ? (bk.leadAge != null || bk.leadInsuranceFirstName || bk.leadInsuranceLastName || bk.leadInsuranceNat)
        : (p && (p.age != null || p.insuranceFirstName || p.insuranceLastName || p.insuranceNat));
      // Revert drops the typed age, names and nationality: all of them live on the server now
      if(has) updateInsuranceServer(bkId, pk, { age: null, firstName: '', lastName: '', nat: '' }).catch(function(){ return null; });
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
  /* §vckLine · vckLineCopy adds one line to ck.lineSent and vckLineClearLog empties it, both through ckWrite. The whole-record
     PUT carries no log (and the server refuses its counts), so a write whose only change is the log goes to
     POST|DELETE …/checkins/{kind}/{slot}/line-sent; the server stamps the clock and the login. */
  function lineSentOnly(base, val){
    if(!val || typeof val !== 'object' || !Array.isArray(val.lineSent)) return null;
    var was = Array.isArray(base.lineSent) ? base.lineSent.length : 0, now = val.lineSent.length;
    if(now === was) return null;
    var rest = Object.keys(val).concat(Object.keys(base)).filter(function(k){ return k !== 'lineSent' && k !== '_s'; });
    if(rest.some(function(k){ return !sameVal(val[k], base[k]); })) return null;
    return now === 0 ? 'DELETE' : (now === was + 1 ? 'POST' : null);
  }
  function lineSentServer(b, date, kind, method){
    var trips = Array.isArray(b.trips) ? b.trips : [];
    var trip = trips.find(function(t){ return t && t.date === date; }) || trips[0];
    if(!trip || !trip.opsTripId){ O.fail('LINE log not saved', new Error('This booking has no operation-backend trip on ' + date)); return Promise.resolve(null); }
    var target = parseCheckinKindAndSlot(kind);
    var path = '/operations/trip-ops/' + enc(trip.opsTripId) + '/checkins/' + enc(target.kind) + '/' + enc(target.slot) + '/line-sent';
    return O.queue(function(){ return O.call(method, path, method === 'POST' ? {} : undefined); }).then(function(res){
      if(res && res.trip) mergeTripOperations(b, date, res.trip);
      O.wrote('trip-checkin');
      if(window._vckLnState && typeof window.vckLineRender === 'function'){ try{ window.vckLineRender(); }catch(_){} }
      if(typeof window.ckAfter === 'function'){ try{ window.ckAfter(kind); }catch(_){} }
      return res;
    }, function(e){ O.fail(method === 'POST' ? 'LINE send not logged' : 'LINE log not cleared', e); return null; });
  }

  wrap('ckWrite', function(orig, b, date, kind, val){
    var ls = lineSentOnly((typeof window.ckRead === 'function' ? window.ckRead(b, date, kind) : null) || {}, val);
    if(ls){ lineSentServer(b, date, kind, ls); return val; }
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

  // ckEventUndo (08-app.js) moved to 36-ops-checkin-cmds.js (w4-f2): it takes the last live event back with
  // POST …/events/{i}/undo {why:"mistake"}; no adapter writes the whole check-in record with PUT for it any more.

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
    // §exSplitPay (legacy bookingV2ExtraSave): paid two ways, the amounts per method must add up to the sale; one method is a plain sale
    if(typeof window.bkxPaySplitOn === 'function' && window.bkxPaySplitOn()){
      var parts = window.bkxPayParts(total), sumP = window.bkxPaySplitSum(), fmt = function(n){ return typeof window.pckNum === 'function' ? window.pckNum(n) : String(n); };
      if(Math.abs(sumP - total) > 0.005){
        alert('ยอดที่ใส่รวม ฿' + fmt(sumP) + ' ไม่เท่ายอดขาย ฿' + fmt(total) + (sumP < total ? ('\n\nยังขาด ฿' + fmt(total - sumP) + ' · กด "ใส่ที่เหลือ" ที่บรรทัดวิธีที่ต้องการ') : ('\n\nเกิน ฿' + fmt(sumP - total))));
        return null;
      }
      pm = parts.length === 1 ? parts[0].method : 'split:' + parts.map(function(q){ return q.method + '=' + q.amount; }).join('|');
    }
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
      feePct: /card/.test(pm) ? num(pay.feePct) : 0,
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

  // §turnBack (lk-inbox 2026-10-29) · tbSave / tbRemove (08-app.js): "⛵ กลับเข้าท่า" on Pier check-in.
  //   PUT    /operations/trip-ops/{trip_id}/turn-back {reason, note, money:{kind, pct, amt, note}}
  //   DELETE /operations/trip-ops/{trip_id}/turn-back
  // Legacy put ops.turnBack on the booking and called ckPersist (local only here). The server stamps who, when, the
  // heads (from the pier check-in) and the history line; the dialog stays open on a refusal.
  function turnBackAfter(b, d, res){
    var op = opsBlock(b, d);
    var tb = res && res.trip && res.trip.operations && res.trip.operations.turn_back;
    var mapped = O.bookings && O.bookings.turnBackFrom ? O.bookings.turnBackFrom(tb) : null;
    if(mapped) op.turnBack = mapped; else delete op.turnBack;
    O.wrote('trip-ops');
    if(typeof window.ckReasonClose === 'function') window.ckReasonClose();
    if(typeof window.ckAfter === 'function') window.ckAfter('pier');
    try{ if(typeof window.bookingV2Render === 'function' && document.querySelector('#view-booking.active')) window.bookingV2Render(); }catch(_){}
  }
  wrap('tbSave', function(orig){
    var st = window._tb || {};
    if(!st.bkId) return typeof window.ckReasonClose === 'function' ? window.ckReasonClose() : null;
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return null;
    var b = findBooking(st.bkId); if(!b) return typeof window.ckReasonClose === 'function' ? window.ckReasonClose() : null;
    var g = function(id){ var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
    var pct = g('tb-pct'), amt = g('tb-amt');
    if(st.money === 'refund' && !pct && !amt){ alert('Enter the refund as a % or an amount'); return null; }
    var body = { reason: st.reason || 'other', note: g('tb-note') || null,
      money: { kind: st.money || 'pending', pct: st.money === 'refund' && pct ? +pct : null, amt: st.money === 'refund' && amt ? +amt : null, note: g('tb-mnote') || null } };
    var d = typeof bkOpsDate === 'function' ? bkOpsDate(b, st.date) : st.date;
    var t = tripOnDate(b, d);
    if(!t){ alert('This booking has no operation-backend trip on ' + d + ': save the booking first'); return null; }
    return O.queue(function(){ return O.call('PUT', '/operations/trip-ops/' + enc(t.opsTripId) + '/turn-back', body); })
      .then(function(res){ turnBackAfter(b, d, res); return res; }, function(e){ O.fail('Turn-back not saved', e); return null; });
  });
  wrap('tbRemove', function(orig){
    var st = window._tb || {};
    if(!st.bkId) return typeof window.ckReasonClose === 'function' ? window.ckReasonClose() : null;
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return null;
    if(!confirm('Remove the turn-back record from this booking?')) return null;
    var b = findBooking(st.bkId); if(!b) return typeof window.ckReasonClose === 'function' ? window.ckReasonClose() : null;
    var d = typeof bkOpsDate === 'function' ? bkOpsDate(b, st.date) : st.date;
    var t = tripOnDate(b, d);
    if(!t){ alert('This booking has no operation-backend trip on ' + d + ': save the booking first'); return null; }
    return O.queue(function(){ return O.call('DELETE', '/operations/trip-ops/' + enc(t.opsTripId) + '/turn-back'); })
      .then(function(res){ turnBackAfter(b, d, res); return res; }, function(e){ O.fail('Turn-back not removed', e); return null; });
  });

  // §tbBoat (lk-inbox 51bb0ea3) · tbBoatSave / tbBoatRemove (08-app.js): the boat header's "⛵ กลับเข้าท่า", one dialog for a tick-list of the
  // boat's bookings. Legacy writes ops.turnBack on each and calls ckPersist (local only here). There is one record per booking on the server,
  // so this is the same PUT / DELETE as tbSave, one after another. "รอตกลง" does not overwrite a money decision already made (legacy keepMoney).
  // A booking refused stops nothing already saved: what was saved stays, and the refusal says which one.
  function boatTurnBacks(st, jobs, label){
    var left = jobs.length, failed = [];
    if(!left){ if(typeof window.ckReasonClose === 'function') window.ckReasonClose(); return Promise.resolve(null); }
    return jobs.reduce(function(p, job){
      return p.then(function(){
        return O.queue(job.run).then(function(res){ job.after(res); }, function(e){ failed.push(job.b); if(failed.length === 1) O.fail(label + ' · ' + (job.b.voucherRef || job.b.id), e); });
      });
    }, Promise.resolve()).then(function(){
      O.wrote('trip-ops');
      if(!failed.length && typeof window.ckReasonClose === 'function') window.ckReasonClose();
      if(typeof window.ckAfter === 'function') window.ckAfter('pier');
      try{ if(typeof window.bookingV2Render === 'function' && document.querySelector('#view-booking.active')) window.bookingV2Render(); }catch(_){}
      return null;
    });
  }
  function turnBackStored(b, d, res){
    var op = opsBlock(b, d), tb = res && res.trip && res.trip.operations && res.trip.operations.turn_back;
    var mapped = O.bookings && O.bookings.turnBackFrom ? O.bookings.turnBackFrom(tb) : null;
    if(mapped) op.turnBack = mapped; else delete op.turnBack;
  }
  wrap('tbBoatSave', function(orig){
    var st = window._tbB || {};
    if(!st.bid) return typeof window.ckReasonClose === 'function' ? window.ckReasonClose() : null;
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return null;
    var g = function(id){ var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
    var pct = g('tbb-pct');
    if(st.money === 'refund' && !pct){ alert('Enter the refund %.'); return null; }
    var pick = {}; document.querySelectorAll('#ck-reason-host .tb-bk').forEach(function(cb){ if(cb.checked) pick[cb.value] = 1; });
    if(!Object.keys(pick).length){ alert('Tick at least one booking.'); return null; }
    var note = g('tbb-note') || null, mnote = g('tbb-mnote') || null, jobs = [], missing = 0;
    window.tbBoatRows(st.bid, st.date).forEach(function(x){
      var b = x.b, cur = x.tb, d = typeof bkOpsDate === 'function' ? bkOpsDate(b, st.date) : st.date, t = tripOnDate(b, d);
      if(!pick[b.id] && !cur) return;
      if(!t){ missing++; return; }
      var url = '/operations/trip-ops/' + enc(t.opsTripId) + '/turn-back', done = function(res){ turnBackStored(b, d, res); };
      if(!pick[b.id]){ jobs.push({ b: b, after: done, run: function(){ return O.call('DELETE', url); } }); return; }
      var m = cur && cur.money, keep = st.money === 'pending' && m && m.kind && m.kind !== 'pending';
      var money = keep ? { kind: m.kind, pct: m.pct == null ? null : m.pct, amt: m.amt == null ? null : m.amt, note: m.note || null }
        : { kind: st.money || 'pending', pct: st.money === 'refund' ? +pct : null, amt: null, note: mnote };
      jobs.push({ b: b, after: done, run: function(){ return O.call('PUT', url, { reason: st.reason || 'other', note: note, money: money }); } });
    });
    if(missing && !jobs.length){ alert('These bookings have no operation-backend trip on this day: save them first'); return null; }
    return boatTurnBacks(st, jobs, 'Turn-back not saved');
  });
  wrap('tbBoatRemove', function(orig){
    var st = window._tbB || {};
    if(!st.bid) return typeof window.ckReasonClose === 'function' ? window.ckReasonClose() : null;
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return null;
    if(!confirm('Remove the turn-back record from every booking on this boat?')) return null;
    var jobs = [];
    window.tbBoatRows(st.bid, st.date).forEach(function(x){
      if(!x.tb) return;
      var b = x.b, d = typeof bkOpsDate === 'function' ? bkOpsDate(b, st.date) : st.date, t = tripOnDate(b, d);
      if(!t) return;
      jobs.push({ b: b, after: function(res){ turnBackStored(b, d, res); }, run: function(){ return O.call('DELETE', '/operations/trip-ops/' + enc(t.opsTripId) + '/turn-back'); } });
    });
    return boatTurnBacks(st, jobs, 'Turn-back not removed');
  });

  // §paAdd (lk-inbox 62b099bd) · paAddSave / paAddUndo / paAddBillDone (08-app.js): people added at the pier. Legacy changes the booking's pax, names,
  // van part, check-in and pier extra in the browser. The server does all of that in one write (operation-backend pier-adds.ts) and answers the booking,
  // so nothing here changes local state first; the dialog stays open on a refusal. The walk-in path is an ordinary new booking (40-ops-bookings.js).
  function pierAddDone(b, res){
    applyBookingResponse(b, res && res.booking);
    O.wrote('booking');
    if(typeof window.ckReasonClose === 'function') window.ckReasonClose();
    return loadTourSalesForBooking(b.id).catch(function(){ return []; }).then(function(){
      if(typeof window.ckAfter === 'function') window.ckAfter('pier');
      return res;
    });
  }
  function pierAddTrip(b, date){
    var d = typeof bkOpsDate === 'function' ? bkOpsDate(b, date) : date, t = tripOnDate(b, d);
    if(!t) alert('This booking has no operation-backend trip on ' + d + ': save the booking first');
    return t;
  }
  wrap('paAddSave', function(orig){
    var S = window._pa; if(!S) return null;
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return null;
    var keys = ['ad', 'chd', 'inf', 'foc'], tot = 0; keys.forEach(function(k){ tot += +S.n[k] || 0; });
    if(!tot){ alert('Add at least one person.'); return null; }
    var cap = typeof window.boatCapFor === 'function' ? window.boatCapFor(S.bid, S.date) : 0;
    if(cap > 0 && typeof window.paBoatOcc === 'function' && window.paBoatOcc(S.bid, S.date) + tot > cap){ alert('Over the boat capacity - move a booking to another boat first.'); return null; }
    if(S.walk) return window.paAddWalkOpen();
    var b = findBooking(S.bk); if(!b){ alert('Pick a booking first.'); return null; }
    var priceEdited = S.pay !== 'foc' && (S.price.ad !== S.priceDef.ad || S.price.chd !== S.priceDef.chd);
    var mayMoney = typeof window.paMoneyCan !== 'function' || window.paMoneyCan();
    if((S.pay === 'foc' || priceEdited) && !mayMoney){ alert('Only users with accounting edit rights can change the price or give FOC.'); return null; }
    var reason = String(S.reason || '').trim();
    if((S.pay === 'foc' || priceEdited) && !reason){ alert('Please enter the reason.'); return null; }
    var money = S.pay === 'foc' ? 0 : (+S.n.ad || 0) * (+S.price.ad || 0) + (+S.n.chd || 0) * (+S.price.chd || 0);
    if(S.pay !== 'foc' && (+S.n.ad || 0) + (+S.n.chd || 0) > 0 && !(money > 0)){ alert('Enter the price per person (or choose FOC).'); return null; }
    var t = pierAddTrip(b, S.date); if(!t) return null;
    var add = {}; keys.forEach(function(k){ add[k] = +S.n[k] || 0; });
    var body = { add: add, nat: S.nat, names: (S.names || []).slice(0, tot).map(function(v){ return String(v || '').trim(); }), pay: S.pay, unit: { ad: +S.price.ad || 0, chd: +S.price.chd || 0 },
      reason: reason || null, price_edited: priceEdited, boat_id: S.bid };
    if(S.pay === 'pier') body.method = S.method;
    return O.queue(function(){ return O.call('POST', '/operations/trip-ops/' + enc(t.opsTripId) + '/pier-adds', body); })
      .then(function(res){ return pierAddDone(b, res); }, function(e){ O.fail('Addition not saved', e); return null; });
  });
  wrap('paAddUndo', function(orig, bkId, date, i){
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return null;
    var b = findBooking(bkId); if(!b) return null;
    var list = typeof window.paAddsOf === 'function' ? window.paAddsOf(b, date) : [], x = list[i];
    if(!x || x.undone) return null;
    if(!confirm('Undo this on-site addition? The added people, names and the pier payment of this entry will be removed.')) return null;
    var t = pierAddTrip(b, date); if(!t) return null;
    return O.queue(function(){ return O.call('DELETE', '/operations/trip-ops/' + enc(t.opsTripId) + '/pier-adds/' + enc(x.id)); })
      .then(function(res){ return pierAddDone(b, res); }, function(e){ O.fail('Addition not undone', e); return null; });
  });
  wrap('paAddBillDone', function(orig, bkId, date, recId){
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('accounting')) return null;
    var b = findBooking(bkId); if(!b) return null;
    var t = pierAddTrip(b, date); if(!t) return null;
    return O.queue(function(){ return O.call('POST', '/operations/trip-ops/' + enc(t.opsTripId) + '/pier-adds/' + enc(recId) + '/bill-done', {}); })
      .then(function(res){
        applyBookingResponse(b, res && res.booking);
        O.wrote('booking');
        if(typeof window.tsAfter === 'function') window.tsAfter(); else if(typeof window.renderTravelSum === 'function') window.renderTravelSum();
        return res;
      }, function(e){ O.fail('Bill not updated', e); return null; });
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
    // w4-f2: no local "nothing arranged" pre-check any more. The server decides what is left to clear (a final pickup time, a
    // return-van mark or a check-in record count too): 409 nothing_to_clear and 409 not_cancelled are shown as it words them.
    if(!confirm('ล้างการจัดรถ/เรือของ ' + nm + ' ออกจากวันที่ ' + date + ' ?\n\n'
      + 'จะล้างเฉพาะการจัดรถ (รถ/ลำดับรับ) · เรือ เวลารับสุดท้าย และเช็คอินไม่ถูกแตะ\n'
      + 'ตัวใบจองและประวัติการยกเลิกไม่ถูกแตะ')) return;
    var trips = (Array.isArray(b.trips) ? b.trips : []).filter(function(t){ return t && t.opsTripId && (t.date || '') === date; });
    if(!trips.length){ O.fail('Van arrangement not cleared', new Error('This booking has no operation-backend trip on ' + date + ': reload the day')); return; }
    // POST /operations/trip-ops/{trip}/clear-arrangement (no body): one command per trip of that day clears the van parts, boat,
    // final pickup, return-van mark and both check-in sides, and writes the booking's history line (w4-f2; was PATCH van_parts: null).
    return trips.reduce(function(p, t){
      return p.then(function(){ return O.queue(function(){ return O.call('POST', '/operations/trip-ops/' + enc(t.opsTripId) + '/clear-arrangement'); }); });
    }, Promise.resolve()).then(function(){
      O.wrote('trip-ops');
      // the server's trip is the truth: re-read the day so the row shows what the server kept
      var again = typeof window.bookingV2EnsureOpsRange === 'function' ? window.bookingV2EnsureOpsRange({ from: date, to: date, refresh: true }) : null;
      var done = function(){ strandToast(bkId, nm, date, 'ล้างการจัดรถ/เรือแล้ว'); strandRedraw(); };
      if(again && again.then) again.then(done, done); else done();
    }, function(e){
      // legacy showed "nothing arranged" as an alert: keep the alert, with the server's own words
      if(e && e.status === 409 && e.code === 'nothing_to_clear'){ alert(e.message || 'Nothing to clear'); return; }
      O.fail('Van arrangement not cleared', e);   // 409 not_cancelled etc.: the server's message as it is
    });
  });

  var api = {
    loadedSales: function(){ return Object.keys(state.salesLoadedFor); },   // w5-d: 83-ops-pier-extras.js reads the sales again after a pier payment
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
