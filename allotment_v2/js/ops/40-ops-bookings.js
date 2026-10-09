/* ══════════════════════════════════════════════════════════════════════════
   §opsBookings (2026-10-05) · bookings ⇄ /v1/bookings
   ──────────────────────────────────────────────────────────────────────────
   GET   /v1/bookings?from=&to=           boot window (bookingV2LoadFromOpsBackend)
   GET   /v1/bookings?status=pending_approval   the approval queue, whatever the date
   GET   /v1/bookings/{id}                 fresh copy when a booking's detail opens
   GET   /v1/bookings/{id}/history         that detail's History card
   POST  /v1/bookings · PATCH /{id}        save (bookingV2SyncToOpsBackend)
   POST  /{id}/cancel · /restore · /partial-cancel · /reschedule
   POST  /{id}/confirm                     "Submit" on a booking the server holds as a quote
   POST  /{id}/approve · /reject           approve · reject · FOC approve · FOC reject
   POST  /{id}/cancel-weather              weather cancel
   GET   /v1/manifest?date=&route_id=      By-trip day, refreshed live

   Server first (2026-10-05):
     · cancel / partial cancel / reschedule: the dialog's Confirm asks the
       server, and the local change runs only after it said yes
       (laOpsBookingAction, called from the three *Confirm.js files).
     · save (bookingV2CommitBooking), restore, approve, reject, FOC, weather:
       those functions prompt and mutate in one go, so they are wrapped ·
       snapshot → run → server → on refusal put the snapshot back.

   Every write above except the create sends If-Match: the version last read
   (bk.opsVersion · laOps.bookingWrite, §opsVersion 2026-10-09).

   Mapping lives here (laOpsToServer / laOpsFromServer) · the server reads
   the frontend's own camelCase header keys and answers snake_case.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var RELEASED = ['cancelled', 'cancelled_weather', 'rejected'];

  /* ── header fields · [camel, type] · the server accepts camel and answers snake ── */
  var HEADER = [
    ['schemaVer','int'], ['soldBy','text'], ['purpose','text'], ['staffId','text'], ['staffPurpose','text'],
    ['leadPax','text'], ['leadNationality','text'], ['leadType','text'], ['leadFoc','bool'], ['leadPhone','text'], ['leadEmail','text'],
    ['pickupAreaId','text'], ['pickupSelf','bool'], ['pickupArea','text'], ['pickupZone','text'], ['hotelName','text'], ['roomNumber','text'],
    ['dropoffSame','bool'], ['dropoffAreaId','text'], ['dropoffArea','text'], ['dropoffHotelName','text'],
    ['paxType','text'], ['largeLuggage','int'], ['priceMode','text'], ['manualTotal','num'], ['total','num'],
    ['bookingDate','date'], ['bookedAt','text'], ['createdBy','text'], ['confirmedAt','text'], ['confirmedBy','text'],
    ['notes','text'], ['note','text'], ['agentId','text'], ['voucherRef','text'], ['rateTypeRef','text']
  ];
  var STRUCTS = {
    guides:          { english:['guide_english','bool'], russian:['guide_russian','bool'], chinese:['guide_chinese','bool'], otherLang:['guide_other_lang','text'] },
    specialMeals:    { veg:['special_meals_veg','int'], vegan:['special_meals_vegan','int'], halal:['special_meals_halal','int'], allergies:['special_meals_allergies','text'] },
    cashOnTour:      { amount:['cash_on_tour_amount','num'], currency:['cash_on_tour_currency','text'], handling:['cash_on_tour_handling','text'], note:['cash_on_tour_note','text'] },
    priceBreakdown:  { seat:['price_seat','num'], addOn:['price_addon','num'], focDiscount:['price_foc_discount','num'], discount:['price_discount','num'], extra:['price_extra','num'] },
    paymentSnapshot: { method:['payment_method','text'], netDays:['payment_net_days','int'], source:['payment_source','text'], contractVersion:['payment_contract_version','text'] },
    marketSnapshot:  { market:['market','text'], sub:['market_sub','text'], agentId:['market_agent_id','text'], at:['market_at','date'] }
  };
  function snake(k){ return k.replace(/[A-Z]/g, function(c){ return '_' + c.toLowerCase(); }); }
  /* coerce to what the server's column takes · null clears on PATCH, '' too */
  function coerce(v, type){
    if(v === undefined) return undefined;
    if(v === null || v === '') return v;
    if(type === 'bool') return !!v;
    if(type === 'int'){ var n = Math.round(Number(v)); return isFinite(n) ? n : null; }
    if(type === 'num'){ var f = Number(v); return isFinite(f) ? f : null; }
    if(type === 'date') return String(v).slice(0, 10);
    return typeof v === 'string' ? v : String(v);
  }
  function paxClean(p){
    var out = {}; Object.keys(p || {}).forEach(function(k){ var n = Math.round(+p[k] || 0); if(n > 0) out[k] = n; }); return out;
  }

  /* §opsAuthority (2026-10-08) · the server decides who made a booking, when, and its status.
     · bookedAt / createdBy / confirmedAt / confirmedBy are stamped by the server from the login and
       never sent: a create naming them is 400, and a PATCH changing them is 400.
     · a create sends `intent` (which save button), not `status`: the server weighs the trips and
       answers the status itself, pending_approval included. saveNow takes it from the answer.
     · focReason goes with the booking: confirming FOC passengers without one is 400. */
  var SERVER_STAMPED = { bookedAt: 1, createdBy: 1, confirmedAt: 1, confirmedBy: 1 };
  /* the button pressed · "Save draft" asks for quote, "Submit" for confirmed or pending_foc. When the
     browser already turned it into pending_approval, the button is in approval.targetStatus */
  function intentOf(bk){
    var asked = (bk.status === 'pending_approval' && bk.approval && bk.approval.targetStatus) || bk.status;
    return (asked === 'quote' || asked === 'draft') ? 'quote' : 'confirm';
  }

  /* §opsPickup (2026-10-08) · legacy keeps a trip's pickup as one text, filled from the pickup-area
     table (bookingV2GetPickupTime); operation-backend keeps it as three fields. Split before saving,
     joined back on read, so every screen still shows legacy's text:
       '07:30'                → pickupTime 07:30
       '07:30-07:45'          → pickupTime 07:30 · pickupTimeEnd 07:45
       '08:20-'               → pickupTime 08:20 (a window with no end yet)
       'Before 08:30 at pier' → pickupTimeEnd 08:30 · pickupAtPier
     Also read: '7:30', '07.30', '07:30:00', '08.00 a.m.' (normalised to HH:MM). Same shapes and rules
     as the server's importer (operation-backend src/tools/legacy-pickup.ts). */
  var PK_T = '(\\d{1,2})[:.](\\d{2})(?::\\d{2})?\\s*(a\\.?m\\.?|p\\.?m\\.?)?';
  var PK_ONE = new RegExp('^' + PK_T + '$', 'i');
  var PK_WIN = new RegExp('^' + PK_T + '\\s*[-\u2013]\\s*(?:' + PK_T + ')?$', 'i');
  var PK_PIER = new RegExp('^before\\s+' + PK_T + '\\s+at\\s+(?:the\\s+)?pier$', 'i');
  function pkClock(hour, minute, half){
    if(hour === undefined || minute === undefined) return undefined;
    var h = Number(hour), m = Number(minute);
    if(half){ if(h < 1 || h > 12) return undefined; h = /^p/i.test(half) ? (h % 12) + 12 : h % 12; }
    if(h > 23 || m > 59) return undefined;
    return String(h).padStart(2, '0') + ':' + minute;
  }
  /* {} for no pickup · null when the text is none of legacy's shapes, or a window ending before it starts */
  function pickupSplit(text){
    text = text == null ? '' : String(text).trim();
    if(!text) return {};
    var m, s, e;
    if((m = PK_ONE.exec(text))){ s = pkClock(m[1], m[2], m[3]); return s ? { pickupTime: s } : null; }
    if((m = PK_WIN.exec(text))){
      s = pkClock(m[1], m[2], m[3]); e = m[4] === undefined ? undefined : pkClock(m[4], m[5], m[6]);
      if(!s || (m[4] !== undefined && !e) || (e && e <= s)) return null;
      return e ? { pickupTime: s, pickupTimeEnd: e } : { pickupTime: s };
    }
    if((m = PK_PIER.exec(text))){ e = pkClock(m[1], m[2], m[3]); return e ? { pickupTimeEnd: e, pickupAtPier: true } : null; }
    return null;
  }
  function pickupJoin(start, end, atPier){
    if(atPier && end) return 'Before ' + end + ' at pier';
    if(start && end) return start + '-' + end;
    return start || '';
  }

  /* ── client booking → request body · `create` for POST, else PATCH ── */
  function toServer(bk, create){
    var b = { external_id: bk.id };
    if(create) b.intent = intentOf(bk);           // a PATCH sends no status: a change goes through a command (saveNow)
    HEADER.forEach(function(h){ if(SERVER_STAMPED[h[0]]) return; var v = coerce(bk[h[0]], h[1]); if(v !== undefined) b[h[0]] = v; });
    var focReason = (bk.focApproval && bk.focApproval.reason) || bk.focReason;
    if(focReason) b.focReason = String(focReason);
    if(bk.priceBreakdown && bk.priceBreakdown.total != null && bk.total == null) b.total = coerce(bk.priceBreakdown.total, 'num');
    Object.keys(STRUCTS).forEach(function(s){
      var src = bk[s]; if(!src || typeof src !== 'object') return;
      var o = {}; Object.keys(STRUCTS[s]).forEach(function(k){ var v = coerce(src[k], STRUCTS[s][k][1]); if(v !== undefined) o[k] = v; });
      b[s] = o;
    });
    b.trips = (bk.trips || []).map(function(t){
      var o = { routeId: t.routeId, date: t.date, pax: paxClean(t.pax) };
      if(t.opsTripId) o.id = t.opsTripId;                 // without it the server recreates the trip and drops its ops data
      if(t.bookingMode === 'charter'){ o.bookingMode = 'charter'; if(t.charterBoatId) o.charterBoatId = t.charterBoatId; }
      else if(Array.isArray(t.lockDraws) && t.lockDraws.length && O.locks){
        var draws = {};
        t.lockDraws.forEach(function(x){
          var q = Math.round(+(x && x.qty) || 0); if(q <= 0) return;
          var sid = O.locks.serverIdFor(x.lockId, t.date);
          if(!sid) throw new Error('Seat lock ' + x.lockId + ' on ' + t.date + ' is not on the server yet');
          draws[sid] = (draws[sid] || 0) + q;
        });
        if(Object.keys(draws).length) o.lockDraws = draws;
      }
      if(t.zone) o.zone = t.zone;
      var pk = pickupSplit(t.pickupTime);            // §opsPickup · a trip is sent whole: a field left out is cleared
      if(!pk) throw new Error('Pickup time "' + t.pickupTime + '" on ' + t.date + ' is not a time (07:30), a window (07:30-07:45) or "Before 08:30 at pier"');
      Object.assign(o, pk);
      if(t.ovn){ o.ovn = t.ovn; if(t.ovn === 'return' && t.ovnReturnDate) o.ovnReturnDate = t.ovnReturnDate; }
      if(t.ovnLeg){ o.ovnLeg = true; if(t.ovnOf != null) o.ovnOf = +t.ovnOf; }
      return o;
    });
    b.passengers = (bk.passengers || []).filter(function(p){ return p && String(p.name || '').trim(); }).map(function(p){
      var o = { name: String(p.name).trim() };
      if(p.nationality) o.nationality = String(p.nationality); if(p.type) o.type = String(p.type); if(p.foc != null) o.foc = !!p.foc;
      return o;
    });
    b.addOns = (bk.addOns || []).filter(function(a){ return a && a.type; }).map(function(a){
      var o = { type: String(a.type) };
      if(a.label) o.label = String(a.label);
      if(isFinite(+a.amount) && +a.amount >= 0) o.amount = +a.amount;
      if(Number.isInteger(+a.qty) && +a.qty >= 1) o.qty = +a.qty;
      if(a.note) o.note = String(a.note);
      if(Number.isInteger(+a.jAd) && a.jAd !== null && +a.jAd >= 0) o.jAd = +a.jAd;
      if(Number.isInteger(+a.jChd) && a.jChd !== null && +a.jChd >= 0) o.jChd = +a.jChd;
      return o;
    });
    return b;
  }

  /* ── action records · shared by the full mapping and by merges after an action ── */
  function catLabel(c){ try{ if(typeof bookingV2CancelLabel === 'function') return bookingV2CancelLabel(c); }catch(_){} return c || ''; }
  function records(ob, trips){
    var r = {};
    var c = ob.cancellation;
    if(c){
      r.cancellation = { category: c.category, categoryLabel: catLabel(c.category), group: c.group, note: c.note || '', reason: c.note || '',
                         chargeType: c.charge_type, chargeAmount: +c.charge_amount || 0, at: c.at, by: c.by || '' };
      r.cancelCategory = c.category; r.cancelledAt = c.at;
    }
    if(ob.cancellation_reason) r.cancelReason = ob.cancellation_reason;
    r.reschedules = (ob.reschedules || []).map(function(x){
      return { fromDate: x.from_date, toDate: x.to_date, reason: x.reason || '', chargeType: x.charge_type, chargeAmount: +x.charge_amount || 0,
               collect: x.collect, at: x.at, by: x.by || '' };
    });
    if(r.reschedules.length) r.reschedule = r.reschedules[r.reschedules.length - 1];
    r.partialCancels = (ob.partial_cancels || []).map(function(x){
      var idx = (trips || []).findIndex(function(t){ return t.opsTripId === x.trip_id; });
      var waived = x.waived || { count: 0, amount: 0 };
      return { date: x.service_date, tripIdx: idx, paxRemoved: x.pax_removed || {}, count: x.count || 0,
               category: x.category || '', categoryLabel: catLabel(x.category), group: x.group || '', note: x.note || '',
               refundMode: (+waived.amount > 0) ? 'refund' : 'none', refund: +waived.amount || 0,
               charged: x.charged || { count: 0, amount: 0 }, waived: waived, at: x.at, by: x.by || '' };
    });
    r.feeItems = (ob.fee_items || []).map(function(x){ return { type: x.type, label: x.label || '', amount: +x.amount || 0, at: x.at }; });
    return r;
  }

  function tripFrom(t){
    var g = function(c, s){ return t[c] !== undefined ? t[c] : t[s]; };
    var draws = g('lockDraws', 'lock_draws') || {};
    var lockDraws = Object.keys(draws).map(function(sid){ return { lockId: O.locks ? O.locks.clientIdFor(sid) : sid, qty: +draws[sid] || 0 }; });
    var locked = lockDraws.reduce(function(s, x){ return s + x.qty; }, 0);
    var total = +t.pax_total || Object.keys(t.pax || {}).reduce(function(s, k){ return s + (+t.pax[k] || 0); }, 0);
    var sel = {}; lockDraws.forEach(function(x){ sel[x.lockId] = (sel[x.lockId] || 0) + x.qty; });
    var o = { opsTripId: t.id, routeId: g('routeId', 'route_id'), date: g('date', 'service_date'), bookingMode: g('bookingMode', 'booking_mode') || 'seat',
              pax: Object.assign({}, t.pax || {}), charterBoatId: g('charterBoatId', 'charter_boat_id') || null,
              lockDraws: lockDraws, lockDrawSel: sel, lockUse: locked, seatSource: { locked: locked, general: Math.max(0, total - locked) },
              zone: t.zone || '', pickupTime: pickupJoin(g('pickupTime', 'pickup_time'), g('pickupTimeEnd', 'pickup_time_end'), g('pickupAtPier', 'pickup_at_pier')),
              ovn: t.ovn || null, ovnReturnDate: g('ovnReturnDate', 'ovn_return_date') || '', ovnLeg: !!g('ovnLeg', 'ovn_leg'),
              ovnOf: g('ovnOf', 'ovn_of') != null ? g('ovnOf', 'ovn_of') : null, ops: {} };
    return o;
  }

  /* ── §opsApprovals (2026-10-08) · the server's approvals[] → bk.approval / bk.focApproval ──
     The server records every approval it asks for (oldest first, kept after it is decided) and
     decides from it whether a pending booking holds seats: one waiting because it is over the
     allotment does not. The browser asks bkPendHoldsSeat the same question through approval.over,
     so a booking without the server's entry counted seats the server does not sell against.
     A booking the server has no entry for (imported from legacy) keeps the one it had. */
  function latestOf(list, kind){
    var mine = list.filter(function(a){ return a && a.kind === kind; });
    for(var i = mine.length - 1; i >= 0; i--) if(mine[i].status === 'pending') return mine[i];
    return mine.length ? mine[mine.length - 1] : null;
  }
  function routeName(id){ var r = (typeof ROUTES !== 'undefined' ? ROUTES : []).find(function(x){ return x && x.id === id; }); return (r && r.name) || id; }
  /* "Real seats left" · the server records the registered seats still free when the approval was
     asked (days[].licensed_free · §opsLicFree 2026-10-08), as legacy's licFree did. An approval asked
     before the server kept it has null there: that one is read from this browser's allotment when
     the queue draws (a getter · JSON keeps the number) */
  function overRow(d, bkId){
    var o = { routeId: d.route_id, date: d.service_date, name: routeName(d.route_id), need: +d.need || 0, overBy: +d.over_by || 0 };
    o.capFree = o.need - o.overBy;
    if(d.licensed_free != null){ o.licFree = +d.licensed_free; return o; }
    Object.defineProperty(o, 'licFree', { enumerable: true, configurable: true, get: function(){
      try{
        var ga = (typeof getAllotment === 'function') ? (getAllotment.__orig || getAllotment) : null;
        var al = ga ? ga(o.routeId, o.date, bkId) : null;
        if(al && al.licenseAvailable != null) return al.licenseAvailable;
      }catch(_){}
      return '—';
    } });
    return o;
  }
  function approvalFrom(a, bkId, old){
    old = old || {};
    var over = a.over_capacity ? (a.days || []).map(function(d){ return overRow(d, bkId); }) : [];
    var disc = +a.discount || 0;
    var reason = a.over_capacity ? (disc > 0 ? 'over_capacity+discount' : 'over_capacity') : (disc > 0 ? 'discount' : (old.reason || ''));
    return { status: a.status, reason: reason, targetStatus: a.target_status || old.targetStatus || 'confirmed',
             over: over, totOver: a.over_capacity ? (a.over_total != null ? +a.over_total : over.reduce(function(s, o){ return s + o.overBy; }, 0)) : 0,
             discount: disc, saleName: old.saleName || '',
             requestedBy: a.requested_by || '', requestedAt: a.requested_at || '',
             approvedBy: a.decided_by || '', approvedAt: a.decided_at || '', note: a.note || '' };
  }
  function focFrom(a, bk, old){
    old = old || {};
    return { count: a.foc_count != null ? +a.foc_count : (old.count || 0), reason: old.reason || bk.focReason || '',
             status: a.status, requestedAt: a.requested_at || '', requestedBy: a.requested_by || '',
             approvedAt: a.decided_at || '', approvedBy: a.decided_by || '', rejectReason: a.status === 'rejected' ? (a.note || '') : '' };
  }
  /* old · the booking's approvals before this answer, for what the server doesn't hold (sale name,
     FOC reason) · a response without approvals[] leaves them as they are */
  function approvalsInto(bk, ob, old){
    if(!ob || !Array.isArray(ob.approvals)) return;
    old = old || {};
    var ap = latestOf(ob.approvals, 'approval'), fa = latestOf(ob.approvals, 'foc');
    if(ap) bk.approval = approvalFrom(ap, bk.id, old.approval);
    if(fa) bk.focApproval = focFrom(fa, bk, old.focApproval);
  }
  /* a pending_foc booking with no FOC entry (imported) · the FOC buttons need one, as
     bookingV2EnsureApproval gives a pending_approval one its approval */
  function focPlaceholder(bk){
    if(bk.status !== 'pending_foc' || bk.focApproval) return;
    var n = 0;
    (bk.trips || []).forEach(function(t){ Object.keys(t.pax || {}).forEach(function(k){ if(/^foc/.test(k)) n += +t.pax[k] || 0; }); });
    if(!n) n = (bk.passengers || []).filter(function(p){ return p && p.foc; }).length;
    bk.focApproval = { count: n, reason: bk.focReason || '', status: 'pending', requestedAt: bk.bookedAt || bk.createdAt || '', requestedBy: '' };
  }

  /* ── server booking → client booking ── */
  function fromServer(ob){
    var bk = { id: ob.external_id || ob.id, opsId: ob.id, schemaVer: 2, status: ob.status || 'confirmed',
               createdAt: ob.booked_at || ob.created_at || '', updatedAt: ob.updated_at || '',
               opsVersion: ob.version != null ? +ob.version : null,        // §opsVersion · sent back as If-Match
               history: [], ops: {}, adjustments: [], _fromOpsBackend: true };
    HEADER.forEach(function(h){ var v = ob[snake(h[0])]; if(v !== undefined) bk[h[0]] = v; });
    ['leadPax', 'leadNationality', 'leadPhone', 'leadEmail', 'hotelName', 'voucherRef', 'bookingDate'].forEach(function(k){ if(bk[k] == null) bk[k] = ''; });
    if(bk.agentId == null) bk.agentId = null;
    Object.keys(STRUCTS).forEach(function(s){
      var o = {}, any = false;
      Object.keys(STRUCTS[s]).forEach(function(k){ var v = ob[STRUCTS[s][k][0]]; if(v !== undefined){ o[k] = v; any = true; } });
      if(any || s === 'guides' || s === 'specialMeals' || s === 'priceBreakdown') bk[s] = o;
    });
    if(bk.priceBreakdown) bk.priceBreakdown.total = (ob.total != null) ? +ob.total : (bk.priceBreakdown.total || 0);
    if(bk.total == null) bk.total = bk.priceBreakdown ? bk.priceBreakdown.total : 0;
    if(!bk.cashOnTour) bk.cashOnTour = null;
    bk.trips = (ob.trips || []).map(tripFrom);
    bk.passengers = (ob.passengers || []).map(function(p){ return { name: p.name, nationality: p.nationality || '', type: p.type || 'AD', foc: !!p.foc }; });
    bk.addOns = (ob.add_ons || []).map(function(a){
      var o = { type: a.type, label: a.label || '', amount: +a.amount || 0, qty: a.qty != null ? a.qty : 1, note: a.note || '' };
      if(a.join_adults !== undefined) o.jAd = a.join_adults; if(a.join_children !== undefined) o.jChd = a.join_children;
      return o;
    });
    Object.assign(bk, records(ob, bk.trips));
    approvalsInto(bk, ob, null);
    focPlaceholder(bk);
    return bk;
  }

  /* server copy over a booking already on screen · keeps what the server doesn't hold
     (van/boat/check-in ops, invoices, approval notes, weather follow-up…) */
  function mergeInto(bk, ob){
    var fresh = fromServer(ob);
    var keepTrips = bk.trips || [];
    fresh.trips.forEach(function(t, i){
      var old = keepTrips.find(function(x){ return x.opsTripId && x.opsTripId === t.opsTripId; }) || keepTrips[i];
      if(old){ ['ops', 'ovnCharge', 'promoId', 'rtRef'].forEach(function(k){ if(old[k] !== undefined && t.date === old.date) t[k] = old[k]; }); }
    });
    // adjustments (discounts, extras) are not stored by the server yet · without this a refresh erased
    // them, and the next edit re-priced the booking without them
    var keep = {}; ['ops', 'history', 'approval', 'focApproval', 'weatherResolve', 'rebook', 'invoiceId', 'paymentStatus',
      'upgrades', 'altPickups', 'b2cOverride', 'refund', 'docCheck', 'createdAt', 'adjustments'].forEach(function(k){ if(bk[k] !== undefined) keep[k] = bk[k]; });
    Object.keys(fresh).forEach(function(k){ bk[k] = fresh[k]; });
    Object.assign(bk, keep);
    // §opsApprovals · the local copy stays only where the server has no entry of that kind
    approvalsInto(bk, ob, { approval: keep.approval, focApproval: keep.focApproval });
    focPlaceholder(bk);
    return bk;
  }

  var busyIds = {};               // booking id → a write is in flight (see upsert)
  function hold(id){ busyIds[id] = (busyIds[id] || 0) + 1; }
  function free(id){ if(busyIds[id] > 1) busyIds[id]--; else delete busyIds[id]; }
  function persist(){ try{ if(typeof bookingV2PersistBookings === 'function') bookingV2PersistBookings(); }catch(_){} }
  function find(id){ return (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).find(function(b){ return b && b.id === id; }); }
  function render(){ try{ if(typeof bookingV2Render === 'function') bookingV2Render(); }catch(_){} }
  /* §opsFresh (2026-10-09) · "nothing new" means the server's copy is the one last merged, not that
     updated_at is the same: the day-of writes (dispatch, check-in, van groups, reconfirm, doc check)
     write their own tables and leave the booking's updated_at and version alone, so an updated_at
     check would drop another dispatcher's boat or van change for good. Kept beside the bookings,
     not on them: the server copy would double what each booking weighs. */
  var seen = {};                  // server id → the copy last merged, as text
  function sig(ob){ try{ return JSON.stringify(ob); }catch(_){ return String(ob.updated_at || '') + '|' + String(ob.version || ''); } }
  function upsert(ob){
    var list = (typeof SB_BOOKINGS !== 'undefined') ? SB_BOOKINGS : null; if(!list) return false;
    var cur = list.find(function(b){ return b && (b.opsId === ob.id || b.id === (ob.external_id || ob.id)); });
    var s = sig(ob);
    if(cur){
      // a write of ours is in flight · the server copy may already include it, and the local change
      // lands when the answer does · merging now would apply the same change twice
      if(busyIds[cur.id]) return false;
      if(seen[ob.id] === s) return false;
      mergeInto(cur, ob); seen[ob.id] = s; return true;
    }
    list.push(fromServer(ob)); seen[ob.id] = s; return true;
  }
  /* §opsVersion · after 409 stale_version: the server's copy replaces this one, whatever was merged
     before · then the screen is redrawn so the person sees what changed and can do it again */
  function reload(id){
    var bk = find(id); if(!bk || !bk.opsId) return Promise.resolve(null);
    var sid = bk.opsId;
    return O.get('/v1/bookings/' + encodeURIComponent(sid)).then(function(ob){
      var cur = find(id); if(!cur || busyIds[id]) return null;    // the commit wrapper may have put a fresh object back
      mergeInto(cur, ob); seen[sid] = sig(ob);
      persist(); render();
      return cur;
    }).catch(function(e){ try{ console.warn('[ops] reload ' + id + ' · ' + (e && e.message)); }catch(_){} return null; });
  }

  /* §opsAuthority · what the server decided replaces what the browser guessed: the status, and who
     made and confirmed the booking and when. The next PATCH then echoes stored values, and the screen
     shows the real status. Returns the status the browser had expected. */
  function takeServer(bk, j){
    var guessed = bk.status;
    bk.status = j.status || bk.status;
    bk.bookedAt = j.booked_at || bk.bookedAt; bk.createdBy = j.created_by || '';
    bk.confirmedAt = j.confirmed_at || null; bk.confirmedBy = j.confirmed_by || '';
    approvalsInto(bk, j, { approval: bk.approval, focApproval: bk.focApproval });   // §opsApprovals · who decided is the login
    // the browser asked for an approval the server didn't (it found the seats) · drop the stale request
    if(Array.isArray(j.approvals) && !latestOf(j.approvals, 'approval') && bk.status !== 'pending_approval'
       && bk.approval && bk.approval.status === 'pending') delete bk.approval;
    return guessed;
  }
  function toldDifferent(bk, guessed){
    if(bk.status === guessed) return;
    O.toast({ kind: 'pending', title: 'Saved as ' + bk.status.replace(/_/g, ' '), id: bk.id, status: 'SERVER',
      sub: 'The server decided ' + bk.status + ' (this screen expected ' + guessed + ')', dur: 9000 });
  }
  var NOT_YET_CONFIRMED = ['draft', 'quote', 'pending'];

  /* ── save · called from bookingV2CommitBooking via bookingV2SyncToOpsBackend ──
     an edit is a PATCH without status; "Submit" on a booking the server holds as a quote then asks
     POST /confirm, and the server decides confirmed, pending_foc or pending_approval */
  function saveNow(bk){
    var pre = Promise.resolve();
    if(O.deployments) pre = pre.then(O.deployments.syncNow);     // a new charter cell must be a deployment first
    if(O.locks) pre = pre.then(O.locks.syncNow);                 // a lock must exist before a booking draws on it
    var submit = intentOf(bk) === 'confirm';
    return pre.then(function(){
      var body = toServer(bk, !bk.opsId);
      return bk.opsId ? O.bookingWrite('PATCH', '/v1/bookings/' + encodeURIComponent(bk.opsId), bk, body)
                      : O.bookingWrite('POST', '/v1/bookings', bk, body);       // a create has no version yet: no If-Match
    }).then(function(j){
      // the PATCH moved the version on · bookingWrite kept the new one, so /confirm sends it
      if(j && j.id && submit && NOT_YET_CONFIRMED.indexOf(j.status) >= 0) return O.bookingWrite('POST', '/v1/bookings/' + encodeURIComponent(j.id) + '/confirm', bk, {});
      return j;
    }).then(function(j){
      if(j && j.id){
        bk.opsId = j.id; bk.updatedAt = j.updated_at || bk.updatedAt;
        toldDifferent(bk, takeServer(bk, j));
        var used = {};
        (bk.trips || []).forEach(function(t, i){
          var hit = (j.trips || []).find(function(st){ return !used[st.id] && st.route_id === t.routeId && st.service_date === t.date; })
                 || ((j.trips || [])[i] && !used[j.trips[i].id] ? j.trips[i] : null);
          if(hit){ used[hit.id] = 1; t.opsTripId = hit.id; }
        });
        Object.assign(bk, records(j, bk.trips));
        persist();
      }
      O.wrote('booking');
      return j;
    });
  }
  function save(bk){
    hold(bk.id);
    return O.queue(function(){ return saveNow(bk); }).then(function(j){ free(bk.id); return j; }, function(e){ free(bk.id); throw e; });
  }

  /* ── server-first actions · cancel / partial-cancel / reschedule ──
     kind: 'cancel' | 'partial-cancel' | 'reschedule' · applyLocal runs only after the server said yes */
  window.laOpsBookingAction = function(bookingId, kind, body, applyLocal, title){
    var bk = find(bookingId);
    if(!bk || !O.enabled() || !bk.opsId){
      if(bk && O.enabled() && !bk.opsId) try{ console.warn('[ops] ' + bookingId + ' has no operation-backend id · ' + kind + ' is local only'); }catch(_){}
      applyLocal(); return Promise.resolve(null);
    }
    O.toast({ kind: 'neutral', title: (title || kind) + '…', id: bookingId, status: 'SENDING', dur: 1500 });
    hold(bk.id);
    // released only after the local change is in · a refresh landing in between would apply it twice
    return O.queue(function(){ return O.bookingWrite('POST', '/v1/bookings/' + encodeURIComponent(bk.opsId) + '/' + kind, bk, body === undefined ? {} : body); })
      .then(function(j){
        try{
          applyLocal();
          if(j){ Object.assign(bk, records(j, bk.trips)); bk.status = j.status || bk.status; if(j.total != null) bk.total = +j.total; bk.updatedAt = j.updated_at; persist(); }
        } finally { free(bk.id); }
        O.wrote('booking');
        render();
        return j;
      }, function(e){ free(bk.id); O.fail((title || kind) + ' refused · nothing changed', e); render(); return null; });
  };

  /* ── wrapped actions · snapshot → run → server → put back on refusal ── */
  function snap(bk){ return { bk: O.clone(bk), locks: O.clone(typeof SB_SEAT_LOCKS !== 'undefined' ? SB_SEAT_LOCKS : []), trips: O.clone(typeof TRIPS !== 'undefined' ? TRIPS : {}) }; }
  function putBack(bk, s){
    O.restoreInPlace(bk, s.bk);
    if(typeof SB_SEAT_LOCKS !== 'undefined') O.restoreInPlace(SB_SEAT_LOCKS, s.locks);
    if(typeof TRIPS !== 'undefined') O.restoreInPlace(TRIPS, s.trips);
    persist(); render();
  }
  /* §opsRestoreFee (2026-10-08) · calls `orig` makes to these global functions are recorded, not run,
     and run only once the server said yes · for side effects putBack can't undo (an invoice voided
     by bookingV2RestoreBooking also unlinks every booking on it) */
  function deferCalls(names){
    var calls = [], saved = {};
    (names || []).forEach(function(n){
      if(typeof window[n] !== 'function') return;
      saved[n] = window[n];
      window[n] = function(){ calls.push([n, [].slice.call(arguments)]); };
    });
    return {
      release: function(){ Object.keys(saved).forEach(function(n){ window[n] = saved[n]; }); },
      run: function(){ calls.forEach(function(c){ try{ window[c[0]].apply(null, c[1]); }catch(e){ try{ console.warn('[ops] ' + c[0] + ' failed', e); }catch(_){} } }); calls = []; }
    };
  }
  function tx(name, server, defer){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(id){
      var bk = find(id);
      if(!bk || !O.enabled() || !bk.opsId) return orig.apply(this, arguments);
      var before = snap(bk);
      var later = deferCalls(defer), ret;
      try{ ret = orig.apply(this, arguments); } finally { later.release(); }
      var call = server(bk, before.bk);
      if(!call){ later.run(); return ret; }                       // the user backed out of the prompt · nothing changed
      hold(bk.id);
      O.queue(function(){ return call(); }).then(function(j){ free(bk.id); return j; }, function(e){ free(bk.id); throw e; }).then(function(j){
        later.run();
        if(j && j.id){ Object.assign(bk, records(j, bk.trips)); bk.updatedAt = j.updated_at; takeServer(bk, j); persist(); render(); }
        // two kinds of warning: /restore's seat-lock shortfalls, /approve's days past the registered seats
        var warn = (j && Array.isArray(j.warnings)) ? j.warnings : [];
        var short = warn.filter(function(x){ return x.lock_id; }), overLic = warn.filter(function(x){ return x.code === 'over_licence'; });
        if(short.length){
          O.toast({ kind: 'pending', title: 'Restored with seat-lock shortfalls', id: bk.id, status: 'CHECK',
            sub: short.map(function(x){ return x.lock_id + ' ' + x.got + '/' + x.wanted; }).join(' · '), dur: 9000 });
        }
        if(overLic.length){
          O.toast({ kind: 'pending', title: 'Approved past the boats\' registered seats · add a boat before the trip', id: bk.id, status: 'CHECK',
            sub: overLic.map(function(x){ return x.route_id + ' ' + x.service_date + ': ' + x.over_by + ' over'; }).join(' · '), dur: 12000 });
        }
        O.wrote('booking');
      }, function(e){
        // §opsVersion · the snapshot's version is stale when an earlier call of this action went through
        // (FOC: the reason PATCH, then a refused approve) · keep the newest one the server gave
        var v = bk.opsVersion; putBack(bk, before); if(v != null) bk.opsVersion = v;
        O.fail(name.replace('bookingV2', '') + ' refused · put back', e);
      });
      return ret;
    };
    w.__ops = true; window[name] = w;
  }
  var B = function(bk){ return '/v1/bookings/' + encodeURIComponent(bk.opsId); };
  /* §opsAuthority · a status changes only through the server's commands (POST /{id}/approve, /reject,
     /cancel-weather), never PATCH {status}. Who approved is the login: the name legacy prompts for is
     not sent. `note` is the reason the user typed, where there is one. */
  function command(kind, noteOf){
    return function(bk, was){
      if(bk.status === was.status) return null;                   // the user backed out of the prompt
      var note = noteOf ? String(noteOf(bk) || '').trim() : '';
      return function(){ return O.bookingWrite('POST', B(bk) + '/' + kind, bk, note ? { note: note } : {}); };
    };
  }
  // the cancellation-fee invoice is voided only once /restore went through · a refused restore
  // (route_closed, a charter boat taken meanwhile…) leaves it as it was
  tx('bookingV2RestoreBooking', function(bk, was){
    if(bk.status === was.status || RELEASED.indexOf(was.status) < 0) return null;
    return function(){ return O.bookingWrite('POST', B(bk) + '/restore', bk, {}); };
  }, ['acctVoidInvoice']);
  tx('bookingV2ApproveBooking', command('approve'));
  tx('bookingV2RejectBooking', command('reject', function(bk){ return bk.approval && bk.approval.note; }));
  // FOC approval needs the reason on the booking; one typed at the prompt is saved there first
  tx('bookingV2FocApprove', function(bk, was){
    var go = command('approve')(bk, was); if(!go) return null;
    var typed = bk.focApproval && bk.focApproval.reason, had = (was.focApproval && was.focApproval.reason) || was.focReason;
    if(!typed || typed === had) return go;
    return function(){ return O.bookingWrite('PATCH', B(bk), bk, { focReason: String(typed) }).then(go); };   // go sends the version this PATCH left
  });
  tx('bookingV2FocReject', command('reject', function(bk){ return bk.focApproval && bk.focApproval.rejectReason; }));
  tx('bookingV2WeatherResolveOne', function(bk, was){
    if(bk.status === 'cancelled_weather' && was.status !== 'cancelled_weather') return function(){ return O.bookingWrite('POST', B(bk) + '/cancel-weather', bk, {}); };
    var oldD = (was.trips || []).map(function(t){ return t.date; }), newD = (bk.trips || []).map(function(t){ return t.date; });
    var i = oldD.findIndex(function(d, k){ return d !== newD[k]; });
    if(i < 0) return null;
    return function(){ return O.bookingWrite('POST', B(bk) + '/reschedule', bk, { from_date: oldD[i], to_date: newD[i], reason: 'weather', charge_type: 'none' }); };
  });

  /* ── save with rollback · bookingV2CommitBooking ── */
  (function(){
    var orig = window.bookingV2CommitBooking;
    if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(){
      if(!O.enabled()) return orig.apply(this, arguments);
      var st = (typeof _bkV2 !== 'undefined') ? _bkV2 : {};
      var before = {
        bookings: O.clone(typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []),
        locks: O.clone(typeof SB_SEAT_LOCKS !== 'undefined' ? SB_SEAT_LOCKS : []),
        trips: O.clone(typeof TRIPS !== 'undefined' ? TRIPS : {}),
        ui: { newBooking: O.clone(st.newBooking), editingId: st.editingId, detailId: st.detailId, tab: st.tab, filterDate: st.filterDate, filterRoute: st.filterRoute }
      };
      window._laOpsCommitSync = null;
      var ret = orig.apply(this, arguments);
      var p = window._laOpsCommitSync; window._laOpsCommitSync = null;
      if(p && typeof p.then === 'function'){
        p.catch(function(e){
          if(typeof SB_BOOKINGS !== 'undefined') O.restoreInPlace(SB_BOOKINGS, before.bookings);
          if(typeof SB_SEAT_LOCKS !== 'undefined') O.restoreInPlace(SB_SEAT_LOCKS, before.locks);
          if(typeof TRIPS !== 'undefined') O.restoreInPlace(TRIPS, before.trips);
          // §opsVersion · someone else saved this booking since the form was opened · the form holds
          // their old values, so a second Save would quietly overwrite them. Stay on the booking's
          // detail (where the commit landed): it is reloaded from the server, then edited again.
          if(e && e.code === 'stale_version'){
            persist(); render();
            O.fail('Booking not saved · someone else changed it meanwhile · it is reloaded, make your change again', e);
            return;
          }
          // reopen the form with what was typed, so it can be fixed and saved again
          Object.assign(st, before.ui);
          persist(); render();
          O.fail('Booking not saved · the form is back as you left it', e);
        });
      }
      return ret;
    };
    w.__ops = true; window.bookingV2CommitBooking = w;
  })();

  /* ── detail open → fresh copy + server history ── */
  var detailAt = {};
  function refreshDetail(bk){
    detailAt[bk.id] = Date.now();
    Promise.all([ O.get(B(bk)), O.get(B(bk) + '/history') ]).then(function(r){
      if(busyIds[bk.id]){ detailAt[bk.id] = 0; return; }        // a write is in flight · ask again on the next render
      mergeInto(bk, r[0]);
      bk.history = ((r[1] && r[1].history) || []).map(function(h){ return { at: h.at, by: h.by || '—', kind: h.kind, tag: h.tag, text: h.text }; });
      bk._historyFromServer = true;
      persist();
      var st = (typeof _bkV2 !== 'undefined') ? _bkV2 : {};
      if(st.detailId === bk.id && !st.newBooking && !O.busy()){
        try{ (typeof bookingV2RenderKeep === 'function' ? bookingV2RenderKeep : bookingV2Render)(); }catch(_){}
      }
    }).catch(function(e){ detailAt[bk.id] = 0; if(e.status !== 404) O.fail('Could not refresh ' + bk.id, e); });
  }

  /* ── By-trip day → /v1/manifest per route that runs that day ── */
  var manifestAt = {}, manifestBusy = {};
  function refreshDay(date){
    if(manifestBusy[date]) return; manifestBusy[date] = 1; manifestAt[date] = Date.now();
    var routes = {}, T = (typeof TRIPS !== 'undefined') ? TRIPS : {};
    Object.keys(T[date] || {}).forEach(function(b){ var c = T[date][b]; if(c && c.route) routes[c.route] = 1; });
    var ids = Object.keys(routes);
    Promise.all(ids.map(function(r){ return O.get('/v1/manifest', { date: date, route_id: r }); })).then(function(res){
      var changed = false;
      res.forEach(function(m){
        if(!m) return;
        if(O.availability) O.availability.put(m.route_id, m.service_date, m);
        (m.bookings || []).forEach(function(ob){ if(upsert(ob)) changed = true; });
      });
      if(changed) persist();
      var st = (typeof _bkV2 !== 'undefined') ? _bkV2 : {};
      if(changed && st.tab === 'bytrip' && st.filterDate === date && !st.detailId && !O.busy()){
        try{ (typeof bookingV2RenderKeep === 'function' ? bookingV2RenderKeep : bookingV2Render)(); }catch(_){}
      }
    }).catch(function(e){ try{ console.warn('[ops] manifest ' + date + ' · ' + e.message); }catch(_){} })
      .then(function(){ manifestBusy[date] = 0; });
  }

  (function(){
    var orig = window.bookingV2Render;
    if(typeof orig !== 'function' || orig.__opsRender) return;
    var w = function(){
      var ret = orig.apply(this, arguments);
      try{
        if(!O.enabled() || !O.state.loaded) return ret;
        var st = _bkV2;
        if(st.detailId && !st.newBooking){
          var bk = find(st.detailId);
          if(bk && bk.opsId && (!detailAt[bk.id] || Date.now() - detailAt[bk.id] > 30000)) refreshDetail(bk);
        } else if(st.tab === 'bytrip' && st.filterDate && !st.newBooking){
          if(!manifestAt[st.filterDate] || Date.now() - manifestAt[st.filterDate] > 60000) refreshDay(st.filterDate);
        }
      }catch(_){}
      return ret;
    };
    w.__opsRender = true; window.bookingV2Render = w;
  })();
  // other people's bookings show up on the open day without a reload
  setInterval(function(){
    try{
      if(!O.enabled() || !O.state.loaded || document.hidden || O.activeView() !== 'booking') return;
      var st = _bkV2;
      if(st.tab === 'bytrip' && st.filterDate && !st.newBooking && !st.detailId) refreshDay(st.filterDate);
    }catch(_){}
  }, 60000);

  /* ── pending approvals, any date · the boot window would miss one booked for next year ── */
  function loadPending(){
    var all = [];
    function page(cursor){
      return O.get('/v1/bookings', { status: 'pending_approval', limit: 100, cursor: cursor }).then(function(j){
        Array.prototype.push.apply(all, (j && j.bookings) || []);
        if(j && j.next_cursor && all.length < 2000) return page(j.next_cursor);
      });
    }
    return page(null).then(function(){
      var n = 0; all.forEach(function(ob){ if(upsert(ob)) n++; });
      if(n) persist();
      try{ console.log('[ops] pending approvals · ' + all.length); }catch(_){}
    });
  }

  window.laOpsToServer = toServer;
  window.laOpsFromServer = fromServer;
  O.bookings = { save: save, saveNow: saveNow, fromServer: fromServer, toServer: toServer, mergeInto: mergeInto, upsert: upsert,
                 reload: reload, loadPending: loadPending, refreshDay: refreshDay };
})();
