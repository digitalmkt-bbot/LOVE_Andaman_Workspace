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

  /* §thaiPax (2026-10-15) · t.nat {ad,chd,inf,foc} (really-Thai heads, changes no price) <-> the server's
     trips[].thai_passengers {adults,children,infants,free_of_charge} (migration 241).  Unset (no key
     typed) is null, which tells the server "nobody checked" so park tickets read the grid's _th count;
     all zeros is a real answer.  The server refuses a count above its category's heads on the trip
     sent, so clamp like legacy bkNatTH does (the pax can be lowered after the count was typed). */
  var THAI_FIELDS = [['ad', 'adults'], ['chd', 'children'], ['inf', 'infants'], ['foc', 'free_of_charge']];
  function thaiOut(t){
    var n = t && t.nat;
    if(!(n && typeof n === 'object' && THAI_FIELDS.some(function(f){ return n[f[0]] != null && n[f[0]] !== ''; }))) return null;
    var px = t.pax || {}, out = {};
    THAI_FIELDS.forEach(function(f){
      var all = (+px[f[0] + '_th'] || 0) + (+px[f[0] + '_fr'] || 0) + (+px[f[0]] || 0);
      out[f[1]] = Math.max(0, Math.min(Math.round(all), Math.round(+n[f[0]] || 0)));
    });
    return out;
  }
  function thaiIn(th){
    if(!th || typeof th !== 'object') return undefined;
    var nat = {}; THAI_FIELDS.forEach(function(f){ nat[f[0]] = Math.max(0, Math.round(+th[f[1]] || 0)); });
    return nat;
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
    if(create && O.reservedCode && O.reservedCode(bk.id)) b.code = bk.id;      // §opsCode (Q45) · only a code the server reserved for this login; a local code is never sent as one
    if(create) b.intent = intentOf(bk);           // a PATCH sends no status: a change goes through a command (saveNow)
    HEADER.forEach(function(h){ if(SERVER_STAMPED[h[0]]) return; var v = coerce(bk[h[0]], h[1]); if(v !== undefined) b[h[0]] = v; });
    var focReason = (bk.focApproval && bk.focApproval.reason) || bk.focReason;
    if(focReason) b.focReason = String(focReason);
    /* §opsBookingFields (2026-10-10) · these are server-owned booking fields.  Send an
       explicit empty array when the user cleared a list: PATCH semantics otherwise leave
       the old server value in place. */
    if(Array.isArray(bk.adjustments)) b.adjustments = bk.adjustments.filter(function(a){
      return a && Number(a.value) > 0;
    }).map(function(a){ return { kind: a.kind, mode: a.mode, value: Number(a.value), label: a.label || undefined, note: a.note || undefined }; });
    /* The server replaces the whole list and defaults whatever is missing (heads 0, who/area/zone/place
       null), so every field it stores goes every time. Legacy's qty-only entries count as adults. */
    if(Array.isArray(bk.altPickups)) b.altPickups = bk.altPickups.map(function(a){
      var head = function(k){ var n = Number(a[k]); return Number.isInteger(n) && n >= 0 ? n : 0; };
      var counted = ['ad','chd','inf','foc'].some(function(k){ return a[k] != null && a[k] !== ''; });
      var qty = Number(a.qty);
      return { who: a.who || null, ad: counted ? head('ad') : (Number.isInteger(qty) && qty > 0 ? qty : 0),
        chd: counted ? head('chd') : 0, inf: counted ? head('inf') : 0, foc: counted ? head('foc') : 0,
        areaId: a.areaId || a.area_id || null, area: a.area || null, zone: a.zone || null, place: a.place || null,
        dropSame: a.dropSame != null ? !!a.dropSame : !!a.drop_same,
        dropAreaId: a.dropAreaId || a.drop_area_id || null, dropArea: a.dropArea || a.drop_area || '',
        dropZone: a.dropZone || a.drop_zone || '', dropPlace: a.dropPlace || a.drop_place || '' };
    });
    /* §opsUpgrades · a present list replaces the server's whole list, so send it every time it exists; an
       empty array clears it. Card fee and customer_paid are the server's (it works them out), not sent. */
    if(Array.isArray(bk.upgrades)) b.upgrades = bk.upgrades.filter(function(u){ return u && u.id; }).map(function(u){
      return { id: u.id, label: u.label || 'Upgrade', sell_price: Number(u.sellPrice) || 0,
        to_company: u.toCompany != null ? Number(u.toCompany) || 0 : null, seller: u.seller || null, note: u.note || null,
        collected: u.collected != null ? !!u.collected : null, settle: (u.settle && u.settle !== 'pending') ? u.settle : null,   /* w5e: a new sale starts 'pending' on the server */ method: u.method || null,
        fee_pct: u.feePct != null ? Number(u.feePct) || 0 : null,
        slips: (u.slips || []).filter(function(s){ return s && s.id; }).map(function(s){ return { id: s.id }; }) };
    });
    if(bk.specialMeals && Array.isArray(bk.specialMeals.allergyList)) b.allergy_list = bk.specialMeals.allergyList.map(function(a){ return { name: a.name || '', qty: +a.qty || 0 }; });
    else if(Array.isArray(bk.allergyList)) b.allergy_list = bk.allergyList;
    if(Array.isArray(bk.attachments)) b.attachments = bk.attachments.filter(function(a){ return a && a.id; }).map(function(a){ var o={ id: a.id }; if(a.kind==='upload'||a.kind==='capture'||a.kind==='paste') o.kind=a.kind; return o; });
    if(bk.companyPurpose || bk.company_purpose) b.companyPurpose = bk.companyPurpose || bk.company_purpose;
    if(bk.priceBreakdown && bk.priceBreakdown.total != null && bk.total == null) b.total = coerce(bk.priceBreakdown.total, 'num');
    Object.keys(STRUCTS).forEach(function(s){
      if(s === 'marketSnapshot') return;   /* the server freezes the agent's market at create and refuses it from a client (booking-actions.ts MARKET_SNAPSHOT_FIELDS, fe2df48) · read back only */
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
      o.thai_passengers = thaiOut(t);                   // §thaiPax · null = not set (a trip is sent whole)
      /* §opsVan (Q44) · a seat trip on a route with a private van is a No-Transfer seat; sending the old zone back is 400 private_van_transfer */
      var zone = O.vanZone ? O.vanZone(bk, t, bk.id) : t.zone;
      if(zone) o.zone = zone;
      var pk = pickupSplit(t.pickupTime);            // §opsPickup · a trip is sent whole: a field left out is cleared
      if(!pk) throw new Error('Pickup time "' + t.pickupTime + '" on ' + t.date + ' is not a time (07:30), a window (07:30-07:45) or "Before 08:30 at pier"');
      Object.assign(o, pk);
      if(t.ovn){ o.ovn = t.ovn; if(t.ovn === 'return' && t.ovnReturnDate) o.ovnReturnDate = t.ovnReturnDate; }
      if(t.ovnLeg){ o.ovnLeg = true; if(t.ovnOf != null) o.ovnOf = +t.ovnOf; }
      /* The API owns these values; do not send operations or the displacement
         acknowledgement.  They have dedicated commands and are read below. */
      if(t.ovnCharge != null) o.ovnCharge = Number(t.ovnCharge) || 0;
      if(t.charterPriceMode) o.charterPriceMode = t.charterPriceMode;
      if(t.charterPriceManual != null) o.charterPriceManual = Number(t.charterPriceManual) || 0;
      if(t.charterPriceNote != null) o.charterPriceNote = String(t.charterPriceNote);
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
    /* §w5e · what the server works out is never sent: the total, the price breakdown and the purpose (README Bookings: `total`, `price_*`,
       `purpose` are computed by priceBooking / derivePurpose on every write). The one exception is a Love Kingdom booking (b2c_ id or
       agent a_b2c): its price stays as the website sent it, so those fields go back unchanged. */
    if(!(/^b2c_/.test(String(bk.id || '')) || bk.agentId === 'a_b2c')){ delete b.total; delete b.purpose; delete b.priceBreakdown; }
    return b;
  }

  /* ── action records · shared by the full mapping and by merges after an action ── */
  function catLabel(c){ try{ if(typeof bookingV2CancelLabel === 'function') return bookingV2CancelLabel(c); }catch(_){} return c || ''; }
  /* §opsAboard · a booking answer carries aboard on every trip: put it on the browser's trip of the same id, so a save,
     a partial cancel or a reschedule never leaves the figures of the day before. A server trip without it takes the old one off. */
  function aboardInto(trips, ob){
    if(!Array.isArray(trips) || !ob || !Array.isArray(ob.trips)) return;
    trips.forEach(function(t){
      if(!t || !t.opsTripId) return;
      var st = ob.trips.find(function(x){ return x && x.id === t.opsTripId; });
      if(!st) return;
      if(st.aboard && typeof st.aboard === 'object'){ t.aboard = st.aboard; t.aboardDate = st.service_date || t.date; if(O.aboardTag) O.aboardTag(t); }
      else { delete t.aboard; delete t.aboardDate; }
    });
  }
  function records(ob, trips){
    aboardInto(trips, ob);
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

  /* the server's pier note {text, at, by} → legacy's ops.pierNote {t, at, by} (pckNoteObj reads .t) */
  function pierNoteFrom(n){
    if(!n) return null;
    if(typeof n === 'string') return { t: n, at: '', by: '' };
    return { t: String(n.t != null ? n.t : (n.text || '')), at: n.at || '', by: n.by || '' };
  }
  function operationsFrom(x){
    x = x || {};
    var r = { boatId: x.boat_id || x.boatId || null,
      boatSplits: (x.boat_splits || x.boatSplits || []).map(function(s){ return { boatId: s.boat_id || s.boatId, ad: +s.ad || 0, chd: +s.chd || 0, inf: +s.inf || 0, foc: +s.foc || 0 }; }),
      boatPulled: !!(x.boat_pulled != null ? x.boat_pulled : x.boatPulled),
      pickupTimeFinal: pickupJoin(x.pickup_time_final || x.pickupTimeFinal, x.pickup_time_final_end || x.pickupTimeFinalEnd, x.pickup_final_at_pier != null ? x.pickup_final_at_pier : x.pickupFinalAtPier),
      returnSameVan: !!(x.return_same_van != null ? x.return_same_van : x.returnSameVan),
      pierNote: pierNoteFrom(x.pier_note || x.pierNote), checkins: x.checkins || {}, vanParts: x.van_parts || x.vanParts || [] };
    /* check-in state: same mapping as the write path (36-ops-day-actions applyServerCheckins) -> pierCheckin / vanCheckin */
    if(O.applyCheckins) O.applyCheckins(r, x);
    var vs = vanSplitsFrom(r.vanParts);
    if(vs) r.vanSplits = vs;
    return r;
  }
  /* §opsVanSplits (Q40) · the server's van_parts → legacy's ops.vanSplits, only when the trip is split (more than one part,
     or the one part is not the main one). opsIdx is the server's part idx: the array position may differ from it, so every
     write to a part sends opsIdx. The browser no longer builds or heals the splits (34-ops-vans.js stops those in ops mode). */
  function vanSplitsFrom(parts){
    if(!Array.isArray(parts) || !parts.length) return null;
    if(parts.length === 1 && (parts[0].source || 'main') === 'main') return null;
    return parts.map(function(p){
      var ad = +p.ad || 0, chd = +p.chd || 0, inf = +p.inf || 0, foc = +p.foc || 0, g = p.group || null, a = p.alt || {};
      var s = { opsIdx: +p.idx || 0, pax: ad + chd + inf + foc, ad: ad, chd: chd, inf: inf, foc: foc,
        vanGroup: g ? (+g.number || 0) : 0, vanId: g ? (g.van_id || null) : null, vanSeq: +p.sequence || 0,
        vanReturnId: p.return_van_id || (g && g.return_van_id) || null };
      if(p.source === 'main') s.main = true;
      if(p.source === 'alt_pickup'){
        s.fromAlt = true;
        s.pickAreaId = a.pick_area_id || ''; s.pickHotel = a.pick_hotel || ''; s.pickZone = a.pick_zone || '';
        s.dropAreaId = a.drop_area_id || ''; s.dropHotel = a.drop_hotel || ''; s.dropZone = a.drop_zone || '';
        s.pickTime = a.pick_time || ''; s.altWho = a.alt_who || '';
      }
      return s;
    });
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
              ovnOf: g('ovnOf', 'ovn_of') != null ? g('ovnOf', 'ovn_of') : null,
              ovnCharge: g('ovnCharge', 'ovn_charge') != null ? +g('ovnCharge', 'ovn_charge') || 0 : 0,
              charterPriceMode: g('charterPriceMode', 'charter_price_mode') || '',
              charterPriceManual: g('charterPriceManual', 'charter_price_manual') != null ? +g('charterPriceManual', 'charter_price_manual') || 0 : 0,
              charterPriceNote: g('charterPriceNote', 'charter_price_note') || '',
              rtRef: g('rateTypeId', 'rate_type_id') || null, promoId: g('promoId', 'promo_id') || null,
              subtotal: t.subtotal != null ? +t.subtotal || 0 : 0,
              ops: operationsFrom(t.operations) };
    var nat = thaiIn(t.thai_passengers); if(nat) o.nat = nat;       // §thaiPax
    /* §opsAboard · the server's check-in figures for this trip (computed, read only, never sent: toServer builds a trip field by field).
       aboardDate is the service day it was read for: 71-ops-aboard.js ignores it once the trip has moved to another day. */
    if(t.aboard && typeof t.aboard === 'object'){ o.aboard = t.aboard; o.aboardDate = o.date; if(O.aboardTag) O.aboardTag(o); }   // w4-f2: ckPaxBreak(t.pax) finds the trip's block
    /* §opsUpgrade · the route upgrade in force (operations.upgrade) → legacy's trip.upg, so bkUpgActive and Undo
       still see it after a reload */
    var up = t.operations && t.operations.upgrade;
    if(up && up.from_route_id && up.to_route_id) o.upg = { fromRouteId: up.from_route_id, toRouteId: up.to_route_id, date: up.to_date || o.date,
      reason: up.reason || '', charge: +up.charge || 0, upgId: up.upgrade_id || '', by: up.by || '', at: up.at || '' };

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
    /* B2C money the order carried (read only, never sent back): bookingV2PaidSplit reads paymentSnapshot.paid */
    if(ob.payment_paid != null || ob.payment_balance != null || ob.payment_deposit != null){
      bk.paymentSnapshot = Object.assign(bk.paymentSnapshot || {}, {});
      if(ob.payment_paid != null) bk.paymentSnapshot.paid = +ob.payment_paid || 0;
      if(ob.payment_balance != null) bk.paymentSnapshot.balance = +ob.payment_balance || 0;
      if(ob.payment_deposit != null) bk.paymentSnapshot.deposit = +ob.payment_deposit || 0;
      if(ob.payment_paid_status) bk.paymentSnapshot.paidStatus = String(ob.payment_paid_status);
    }
    if(bk.priceBreakdown) bk.priceBreakdown.total = (ob.total != null) ? +ob.total : (bk.priceBreakdown.total || 0);
    if(bk.total == null) bk.total = bk.priceBreakdown ? bk.priceBreakdown.total : 0;
    if(!bk.cashOnTour) bk.cashOnTour = null;
    bk.trips = (ob.trips || []).map(tripFrom);
    /* Legacy stores the first service day's operations on bk.ops and later days on
       their trip.  The API deliberately stores operations on every trip. */
    if(bk.trips.length){
      var firstDate = bk.trips[0].date;
      bk.trips.forEach(function(t){ if(t.date === firstDate) bk.ops = t.ops || {}; });
      bk.trips.forEach(function(t){ if(t.date === firstDate) t.ops = {}; });
    }
    bk.reconfirm = ob.reconfirm ? { sentAt: ob.reconfirm.sent_at || ob.reconfirm.sentAt || '', sentBy: ob.reconfirm.sent_by || ob.reconfirm.sentBy || '' } : null;
    // Legacy board and Re-confirm page read bk.ops.reconfirm {status,via,at,by,sent,sentAt,sentBy} (see 39-ops-reconfirm.js)
    bk.ops = bk.ops || {};
    bk.ops.reconfirm = ob.reconfirm ? { status: ob.reconfirm.status || '', via: ob.reconfirm.via || 'reconfirm', at: ob.reconfirm.at || '', by: ob.reconfirm.by || '', sent: !!ob.reconfirm.sent, sentAt: ob.reconfirm.sent_at || '', sentBy: ob.reconfirm.sent_by || '' } : null;
    bk.docCheck = ob.doc_check || null;
    bk.specialRequest = ob.special_request != null ? String(ob.special_request) : '';   // w5c: the server's job_note-else-notes (vanJobsSreqFinal, 82-ops-w5c-vans.js)
    bk.opsInvoice = ob.invoice && ob.invoice.id ? ob.invoice : null;           // w5-d: the booking's live invoice as the server works it out (read only; 83-ops-pay-chip.js)
    bk.paymentState = ob.payment_state || 'none';
    if('pfm_status' in ob){ bk.pfmStatus = ob.pfm_status || null; bk.pastCutoff = !!ob.past_cutoff; }   // w6-d: only the single read carries them: the Daily PFM status of a proforma booking (hold / approved / paid / alert / awaiting / no_invoice), read only (94-ops-money-w6.js)
    bk.jobNote = ob.job_note != null ? ob.job_note : null;   // the van job order's special request override (35-ops-van-jobs.js)
    /* §bookingSlips: payment slips on the booking itself (a direct/B2C booking has no invoice payment); server-owned, shown by 38-ops-attachments.js */
    bk.slips = (ob.slips || []).filter(function(s){ return s && s.id; }).map(function(s){ return { id:s.id, attachmentId:s.attachment_id || s.attachmentId || '', addedAt:s.added_at || s.addedAt || '', addedBy:s.added_by || s.addedBy || '' }; });
    bk.attachments = (ob.attachments || []).map(function(a){ return { id:a.id, name:a.name || '', mime:a.mime || '', size:+a.size || 0, kind:a.kind || '', by:a.by || '', at:a.at || '' }; });
    bk.altPickups = (ob.alt_pickups || []).map(function(a){ var ad = +a.ad || 0, chd = +a.chd || 0, inf = +a.inf || 0, foc = +a.foc || 0; return { who:a.who || '', ad:ad, chd:chd, inf:inf, foc:foc, qty:ad + chd + inf + foc, area:a.area || '', zone:a.zone || '', place:a.place || '', areaId:a.area_id || a.areaId || null, dropSame:a.drop_same != null ? !!a.drop_same : !!a.dropSame, dropAreaId:a.drop_area_id || a.dropAreaId || null, dropArea:a.drop_area || a.dropArea || '', dropZone:a.drop_zone || a.dropZone || '', dropPlace:a.drop_place || a.dropPlace || '' }; });
    bk.adjustments = (ob.adjustments || []).map(function(a){ return { seq:a.seq, kind:a.kind, mode:a.mode, value:+a.value || 0, label:a.label || '', note:a.note || '' }; });
    if(Array.isArray(ob.allergy_list)) { bk.specialMeals = bk.specialMeals || {}; bk.specialMeals.allergyList = ob.allergy_list; }
    if(ob.allergy_count != null) { bk.specialMeals = bk.specialMeals || {}; bk.specialMeals.allergyCount = +ob.allergy_count || 0; }
    if(ob.special_meals_pier_at != null) { bk.specialMeals = bk.specialMeals || {}; bk.specialMeals.pierAt = ob.special_meals_pier_at; }
    if(ob.special_meals_pier_by != null) { bk.specialMeals = bk.specialMeals || {}; bk.specialMeals.pierBy = ob.special_meals_pier_by; }
    /* §opsUpgrades · every field the server returns is kept: the list is sent back whole on each PATCH,
       so a field dropped here would be wiped on the server. to_company is an amount, not a flag. */
    bk.upgrades = (ob.upgrades || []).map(function(u){ return { id:u.id, label:u.label || 'Upgrade', sellPrice:+(u.sell_price != null ? u.sell_price : u.sellPrice) || 0, toCompany:+(u.to_company != null ? u.to_company : u.toCompany) || 0, commission:+u.commission || 0, seller:u.seller || '', note:u.note || '', collected:!!u.collected, settle:u.settle || 'pending', method:u.method || null, feePct:+(u.fee_pct != null ? u.fee_pct : u.feePct) || 0, fee:+u.fee || 0, customerPaid:+(u.customer_paid != null ? u.customer_paid : u.customerPaid) || 0, at:u.at || null, slips:u.slips || [] }; });
    if(ob.company_purpose != null) bk.companyPurpose = ob.company_purpose;
    /* w5-a · the seats this booking holds right now (computed by the server, top level of every booking answer): a booking waiting for
       an over-allotment approval holds none. Read-only, never sent; bkPendHoldsSeat (80-ops-w5a-reads.js) reads it. */
    if(ob.allocated_pax !== undefined) bk.srvAllocatedPax = +ob.allocated_pax || 0;
    /* §opsRowFlags (2026-10-17) · the server's reading of the booking row (GET /v1/bookings, /{id}, /recent only; the POST and PATCH
       answers do not carry them). Read-only, never sent (toServer). 66-ops-row-flags.js wraps laIsB2C, laIsInternalBk, laIsCompanyBk,
       laIsInternalFree, laBkMoney and laB2CChannel to read this object when it is here; without it the legacy browser rule runs. */
    /* §w5e · the money the server works out for a booking (README Money, "On the booking"): bookingV2PayOf reads it (ops/84) */
    if(ob.payment_state !== undefined){ bk.srvPay = { state: ob.payment_state, invoice: ob.invoice || null }; }
    if(ob.is_b2c_legacy !== undefined || ob.owed !== undefined){
      bk.srvFlags = { isB2C: !!ob.is_b2c_legacy, isInternal: !!ob.is_internal, isCompany: !!ob.is_company,
                      internalFree: !!ob.internal_free, owed: +ob.owed || 0, b2cChannel: ob.b2c_channel != null ? String(ob.b2c_channel) : '',
                      reportMarket: ob.report_market != null ? String(ob.report_market) : '' };   // w6-c · the market a report puts the booking in (pmMarket, 93-ops-w6c-market.js)
    }
    /* §opsBookingList (w4-f3) · the list row's computed fields (GET /v1/bookings rows only): last activity, new / soon / today chips,
       possible duplicates. Read-only, never sent; 75-ops-booking-list.js hands them to the All-bookings screen. */
    if(ob.last_activity !== undefined){
      bk.srvList = { lastActivity: ob.last_activity || null, isNew: !!ob.is_new, isSoon: !!ob.is_soon, isToday: !!ob.is_today,
                     possibleDuplicate: !!ob.possible_duplicate, duplicates: Array.isArray(ob.duplicates) ? ob.duplicates : [],
                     pendingFoc: ob.pending_foc === undefined || ob.pending_foc === null ? null : !!ob.pending_foc };   // w6-a: the server's Pending-FOC flag of the row
    }
    /* nationality is what was recorded (the only one sent back); nationalityEffective is the server's reading, the passenger's own
       else the lead's (README "Passengers"), for every screen that counts or shows a nationality. Never sent (toServer), never guessed here. */
    bk.passengers = (ob.passengers || []).map(function(p){ return { name: p.name, nationality: p.nationality || '', nationalityEffective: p.nationality_effective || '', type: p.type || 'AD', foc: !!p.foc }; });
    bk.addOns = (ob.add_ons || []).map(function(a){
      var o = { type: a.type, label: a.label || '', amount: +a.amount || 0, qty: a.qty != null ? a.qty : 1, note: a.note || '' };
      if(a.join_adults !== undefined) o.jAd = a.join_adults; if(a.join_children !== undefined) o.jChd = a.join_children;
      if(typeof a.fee === 'boolean') o.fee = a.fee;       // w6-d · the server's reading of a Love Kingdom fee line (b2c-ad-*), read only, never sent (toServer picks its fields) (94-ops-booking-w6.js)
      return o;
    });
    /* w6-d · the add-on link of a Love Kingdom add-on-only line and its agent booking (the single read only): addon_of = the agent booking's id, addon_lines = the lines on it */
    if('addon_of' in ob){ bk.addonOfRead = true; bk.addonOf = ob.addon_of || null; }
    if(Array.isArray(ob.addon_lines)) bk.addonLines = ob.addon_lines.map(function(x){ return { booking_id: x.booking_id, code: x.code || '', lead_pax: x.lead_pax || '', voucher_ref: x.voucher_ref || '', add_ons: x.add_ons || [] }; });
    Object.assign(bk, records(ob, bk.trips));
    approvalsInto(bk, ob, null);
    focPlaceholder(bk);
    return bk;
  }

  /* server copy over a booking already on screen · keeps what the server doesn't hold
     (van/boat/check-in ops, invoices, approval notes, weather follow-up…) */
  function mergeInto(bk, ob){
    var fresh = fromServer(ob);
    /* Only retain values the API does not own.  In particular, never re-apply a
       local operations/price/adjustment copy over the server response. */
    var keep = {}; ['history', 'approval', 'focApproval', 'rebook', 'b2cOverride', 'createdAt'].forEach(function(k){ if(bk[k] !== undefined) keep[k] = bk[k]; });
    var vans = (O.vans && O.vans.take) ? O.vans.take(bk) : null;   // §vanKeep · owned by /operations/van-groups
    delete bk.srvFlags;      // §opsRowFlags · an answer without the flags (PATCH, POST) must not leave the old ones behind
    delete bk.srvAllocatedPax;   // w5-a · same for the held-seats count
    delete bk.srvList;       // §opsBookingList · same for the list row's fields (last activity, chips, duplicates)
    Object.keys(fresh).forEach(function(k){ bk[k] = fresh[k]; });
    Object.assign(bk, keep);
    if(vans) O.vans.put(bk, vans);
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
  var editAgreed = {};            // booking id → the person agreed to "Edit anyway?" when opening it
  window.laOpsEditAgreed = function(id, yes){ if(yes) editAgreed[id] = true; else delete editAgreed[id]; };
  var SAVE_RULES = {
    booking_closed: { flag: 'edit_anyway' },
    /* 409 route_not_in_programme: the agent's programme does not hold that route. The commit's own confirm ("เส้นทางนอกสัญญา…")
       already asked; an OK there is sent up front (progAgreed), otherwise the server's message is asked here */
    route_not_in_programme: { flag: 'programme_anyway', ask: function(e){
      return e.message.replace(/\. Add it to the agent's programme first, or send programme_anyway.*$/, '') + '\n\nConfirm to save anyway?'; } },
    no_charter_price: { flag: 'free_anyway', ask: function(e){
      return 'WARNING - charter trip will be saved at 0 THB\n\n' + e.message.replace(/\. Send the agreed price.*$/, '') +
        '\n\nPress Cancel to go back and enter the agreed charter price in the red box.\nPress OK only if this charter is really free.'; } },
    charter_displaces_seats: { flag: 'displace_anyway', ask: function(e){
      return e.message.replace(/\. Send displace_anyway.*$/, '') + '\n\nConfirm anyway · Notify dispatcher?'; } }
  };
  function saveNow(bk, progAgreed, rateNow){
    var pre = Promise.resolve();
    if(O.deployments) pre = pre.then(O.deployments.syncNow);     // a new charter cell must be a deployment first
    var submit = intentOf(bk) === 'confirm';
    return pre.then(function(){
      var body = toServer(bk, !bk.opsId);
      /* §rtKeep · "use today's rate" chosen on the edit form (bookingV2RtKeepUse 'now'): the server re-prices at the agent's current
         rate only when told (`rate: "agent"`, PATCH); without it each unchanged trip keeps the rate it was sold at */
      if(rateNow && bk.opsId) body.rate = 'agent';
      /* §opsAnyway · legacy's confirms, answered after the server refuses: "Edit anyway?" on a closed
         booking, "Press OK only if this charter is really free", "Confirm anyway · Notify dispatcher".
         A confirm already given on screen (edit opened on a closed booking, charter modal) goes first. */
      var agreed = {};
      if(editAgreed[bk.id]) agreed.edit_anyway = true;
      if(progAgreed) agreed.programme_anyway = true;
      if((bk.trips || []).some(function(t){ return t && t.charterDisplacementAck; })) agreed.displace_anyway = true;
      return O.anyway(function(f){
        var b = Object.assign({}, body, f);
        if(bk.opsId) return O.bookingWrite('PATCH', '/v1/bookings/' + encodeURIComponent(bk.opsId), bk, b);
        /* §opsHold · opened from a whole-boat hold ("เหมาลำ"): the server makes the booking and
           turns the hold into it in one step, so the boat is never free in between */
        var hold = O.locks && O.locks.holdFor && O.locks.holdFor(bk.id);
        if(hold) return O.call('POST', '/v1/seat-locks/' + encodeURIComponent(hold.id) + '/convert', b, { 'If-Match': '"' + hold.version + '"' }).then(function(res){
          var j = res && res.booking;
          if(j && j.version != null) bk.opsVersion = +j.version;
          O.locks.doneHold(bk.id);
          return j;
        }, function(e){ O.locks.reloadSoon(); throw e; });   // refused: the hold is as it was, redraw it
        return O.bookingWrite('POST', '/v1/bookings', bk, b);       // a create has no version yet: no If-Match
      }, SAVE_RULES, agreed);
    }).then(function(j){
      // the PATCH moved the version on · bookingWrite kept the new one, so /confirm sends it
      if(j && j.id && submit && NOT_YET_CONFIRMED.indexOf(j.status) >= 0) return O.bookingWrite('POST', '/v1/bookings/' + encodeURIComponent(j.id) + '/confirm', bk, {});
      /* §opsSaveDraft · "Save Draft" on a live booking (bkV2SaveDraft asked "downgrade to quote?" and the user said yes):
         a PATCH carries no status, so the server turns it back into a quote with its own command */
      if(j && j.id && !submit && ['confirmed', 'pending_foc', 'pending_approval'].indexOf(j.status) >= 0) return O.bookingWrite('POST', '/v1/bookings/' + encodeURIComponent(j.id) + '/unconfirm', bk, {});
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
        /* Save responses are authoritative for totals, rates, add-on amounts and
           operations.  Do not leave the browser's quote visible after a server
           repricing. */
        mergeInto(bk, j);
        Object.assign(bk, records(j, bk.trips));
        persist();
        /* §opsBookingList · the save answer's warnings[] (possible_duplicate, passenger_types) are shown with the server's own text */
        try{ if(O.saveWarnings && Array.isArray(j.warnings)) O.saveWarnings(bk, j.warnings); }catch(_){}
      }
      if(j && Array.isArray(j.price_warnings) && j.price_warnings.length){
      O.toast({ kind:'pending', title:'Server adjusted the booking price', id:bk.id, status:'PRICE',
        sub:j.price_warnings.map(function(w){ return w.message || w.code || ''; }).filter(Boolean).join(' · '), dur:9000 });
    }
    O.wrote('booking');
      return j;
    });
  }
  function save(bk){
    hold(bk.id);
    var progAgreed = !!window._laOpsProgAgreed;      // set by the commit wrapper below while its own confirm ran
    var nb = (typeof _bkV2 !== 'undefined' && _bkV2) ? _bkV2.newBooking : null;       // the form's draft is still open here (the commit closes it after)
    var rateNow = !!(nb && nb._rtKeep && nb._rtKeep.mode === 'now');
    return O.queue(function(){ return saveNow(bk, progAgreed, rateNow); }).then(function(j){ free(bk.id); return j; }, function(e){ free(bk.id); throw e; });
  }

  /* ── server-first actions · cancel / partial-cancel / reschedule ──
     kind: 'cancel' | 'partial-cancel' | 'reschedule' · applyLocal runs only after the server said yes */
  /* full = true takes the whole booking the command returns (trips and upgrades too), for a command that
     changes a trip's route and creates an upgrade sale on the server. */
  window.laOpsBookingAction = function(bookingId, kind, body, applyLocal, title, full){
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
          if(j && full){ mergeInto(bk, j); persist(); }
          else if(j){ Object.assign(bk, records(j, bk.trips)); bk.status = j.status || bk.status; if(j.total != null) bk.total = +j.total; bk.updatedAt = j.updated_at; persist(); }
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
      /* the commit confirms a route outside the agent's contract ("เส้นทางนอกสัญญา…"); an OK is passed on to the server
         as programme_anyway so the person is not asked twice */
      var realConfirm = window.confirm;
      window.confirm = function(m){ var r = realConfirm.apply(this, arguments); if(r && /^เส้นทางนอกสัญญา/.test(String(m || ''))) window._laOpsProgAgreed = true; return r; };
      window._laOpsProgAgreed = false;
      var ret;
      try{ ret = orig.apply(this, arguments); }
      finally{ window.confirm = realConfirm; window._laOpsProgAgreed = false; }     // save() has already taken it
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
          /* 400 booking_incomplete (the confirm step): legacy's "Cannot save — please complete" alert with the server's own list, one
             line each. The booking itself was saved (as a quote) and its version moved on, so it is reloaded; only the confirm was refused. */
          if(e && e.code === 'booking_incomplete'){
            var miss = ((e.body && e.body.incomplete) || []).map(function(i){ return i && i.message; }).filter(Boolean);
            try{ alert(miss.length ? 'Cannot confirm — please complete:\n\n· ' + miss.join('\n· ') : e.message); }catch(_){}
            var rid = st.editingId || (st.newBooking && st.newBooking.id);
            if(rid) reload(rid);
            return;
          }
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

  // A remote booking write needs an immediate refresh only when it touches the open
  // booking/day. Other pages simply have their query caches invalidated by O.wrote().
  if(O.onChange) O.onChange(function(change){
    if(!change || change.kind !== 'booking' || !O.state.loaded) return;
    var st = (typeof _bkV2 !== 'undefined') ? _bkV2 : {};
    if(st.detailId){
      var open = find(st.detailId);
      if(open && open.opsId === change.entity_id && !busyIds[open.id]) refreshDetail(open);
    }
    if(st.tab === 'bytrip' && st.filterDate && Array.isArray(change.route_days)
       && change.route_days.some(function(day){ return day && day.service_date === st.filterDate; })){
      manifestAt[st.filterDate] = 0;
      refreshDay(st.filterDate);
    }
  });

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

  /* ── pending approvals, any date · fetched only when the Approvals tab opens ── */
  var pendingAt=0, pendingBusy=null;
  function loadPending(){
    if(pendingBusy) return pendingBusy;
    var all = [];
    function page(cursor){
      return O.get('/v1/bookings', { status: 'pending_approval,pending_foc', limit: 100, cursor: cursor }).then(function(j){
        Array.prototype.push.apply(all, (j && j.bookings) || []);
        if(j && j.next_cursor && all.length < 2000) return page(j.next_cursor);
      });
    }
    pendingBusy=page(null).then(function(){
      var n = 0; all.forEach(function(ob){ if(upsert(ob)) n++; });
      if(n) persist(); pendingAt=Date.now();
      try{ console.log('[ops] pending approvals · ' + all.length); }catch(_){}
      return all;
    }).then(function(v){ pendingBusy=null; return v; },function(e){ pendingBusy=null; throw e; });
    return pendingBusy;
  }
  // Null means fresh/no request; a Promise is either the one in flight or a new refresh.
  function ensurePending(){
    if(pendingBusy) return pendingBusy;
    if(pendingAt && Date.now()-pendingAt<60000) return null;
    return loadPending();
  }

  /* ── route upgrade undo · bookingV2UpgUndo (booking/bookingV2UpgUndo.js) → POST /v1/bookings/{id}/upgrade/undo ──
     Legacy's checks and its confirm stay; the server checks again (route sailing, free seats on the old route) and
     answers the whole booking: the trip is back on its route, the uncollected charge is gone, the boat is cleared. */
  var origUpgUndo = window.bookingV2UpgUndo;
  window.bookingV2UpgUndo = function(bkId, routeId, date){
    if(!O.enabled() || typeof origUpgUndo !== 'function') return origUpgUndo ? origUpgUndo.apply(this, arguments) : undefined;
    var b = find(bkId); if(!b) return;
    var t = bkUpgTripOn(b, date, routeId); if(!t || !bkUpgActive(t)) return;
    var u = t.upg, fromNm = bkUpgRouteName(u.fromRouteId), toNm = bkUpgRouteName(u.toRouteId);
    var item = (u.upgId && Array.isArray(b.upgrades)) ? b.upgrades.find(function(x){ return x.id === u.upgId; }) : null;
    var pax = (typeof bookingV2PaxAllTot === 'function') ? bookingV2PaxAllTot(t.pax || {}) : 0;
    if(typeof bookingV2IsRouteOpenOn === 'function' && !bookingV2IsRouteOpenOn(u.fromRouteId, date)){
      alert('Cannot undo: ' + fromNm + ' is not running on ' + date + '.'); return; }
    var al = (typeof getAllotment === 'function') ? getAllotment(u.fromRouteId, date, null) : null;
    if(al && al.hasAllotment && pax > al.seatsAvailable){
      alert('Cannot undo: not enough free seats on ' + fromNm + ' (' + date + ').'+'\nNeeds ' + pax + ', free ' + al.seatsAvailable + '.'); return; }
    if(!confirm('Undo the upgrade?\n' + toNm + ' > back to ' + fromNm + '\n' + (item ? (item.collected ? 'The extra charge was already collected - it stays on the booking.' : 'The uncollected extra charge (THB ' + (+item.sellPrice || 0).toLocaleString() + ') will be removed.') : '') + '\nThe boat must be assigned again.')) return;
    if(!b.opsId || !t.opsTripId){ alert('Save this booking to operation-backend first.'); return; }
    window.laOpsBookingAction(b.id, 'upgrade/undo', { trip_id: t.opsTripId }, function(){
      if(item && !item.collected) b.upgrades = b.upgrades.filter(function(x){ return x.id !== u.upgId; });
      t.routeId = u.fromRouteId; delete t.upg;
      var op = bkOpsFor(b, date); op.boatId = null; if(op.boatSplits) delete op.boatSplits;
      if(typeof bookingV2AddHistory === 'function') bookingV2AddHistory(b, 'edit', 'Upgrade undone · back to ' + fromNm, 'Edit');
    }, 'Undo upgrade', true);
  };

  /* ── upgrade sale deleted · bookingV2UpgradeDelete → the shorter list goes with the booking (PATCH upgrades) ──
     Same path as bookingV2UpgradeSave. A refusal puts the list back. */
  var origUpgDel = window.bookingV2UpgradeDelete;
  window.bookingV2UpgradeDelete = function(id, bkId){
    if(!O.enabled() || typeof origUpgDel !== 'function') return origUpgDel ? origUpgDel.apply(this, arguments) : undefined;
    var bk = find(bkId); if(!bk || !Array.isArray(bk.upgrades)) return;
    var before = O.clone(bk.upgrades);
    var r = origUpgDel.apply(this, arguments);
    var sync = (typeof bookingV2SyncToOpsBackend === 'function') ? bookingV2SyncToOpsBackend(bk) : null;
    if(sync && sync.catch) sync.catch(function(e){
      bk.upgrades = before; O.fail('Upgrade not deleted', e);
      try{ bookingV2Render(); bookingV2UpgradeRender(); }catch(_){}
    });
    return r;
  };

  /* ── pickup zone changed · bookingV2ZonePickConfirm (booking/bookingV2ZonePickConfirm.js) ──
     Legacy changes pickupAreaId and (if ticked) each trip's pickup time, then "persists" (a no-op here).
     The booking goes to the server with PATCH /v1/bookings/{id} (pickupAreaId + the trips' pickup times);
     a refusal puts the booking back as it was. */
  var origZonePick = window.bookingV2ZonePickConfirm;
  window.bookingV2ZonePickConfirm = function(){
    if(!O.enabled() || typeof origZonePick !== 'function') return origZonePick ? origZonePick.apply(this, arguments) : undefined;
    var st = window._bkV2ZonePick, bk = st && st.sel ? find(st.bkId) : null;
    if(!bk || !bk.opsId) return origZonePick.apply(this, arguments);
    var s = snap(bk);
    var r = origZonePick.apply(this, arguments);
    if(JSON.stringify(O.clone(bk)) === JSON.stringify(s.bk)) return r;       // legacy refused or nothing changed
    save(bk).then(function(){ O.wrote('booking'); }, function(e){ putBack(bk, s); O.fail('Pickup zone not saved · nothing changed', e); });
    return r;
  };

  /* ── duplicate voucher · GET /v1/bookings?voucher_ref= (the whole reference, case and spaces ignored) ──
     bkV2VoucherDupHtml and bkV2FindDuplicateBookings read the loaded SB_BOOKINGS (a month window), so a voucher booked on
     another month was never found. Their logic stays legacy's; they run over the loaded list PLUS the server's hits for
     this voucher, fetched while the user types (live check) and just before a save. The "same lead name on a shared trip"
     test is not served by the API and stays over the loaded list. */
  (function(){
    var cache = {}, inflight = false;
    function vkey(v){ return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' '); }
    function fetchHits(v){
      var k = vkey(v); if(!k) return Promise.resolve([]);
      var c = cache[k]; if(c && Date.now() - c.at < 30000) return Promise.resolve(c.rows);
      return O.get('/v1/bookings', { voucher_ref: String(v).trim(), limit: 100 }).then(function(j){
        var rows = ((j && j.bookings) || []).map(function(ob){ return fromServer(ob); });
        cache[k] = { at: Date.now(), rows: rows }; return rows;
      });
    }
    function withHits(v, fn){
      var c = cache[vkey(v)];
      if(!O.enabled() || !c || !c.rows.length || typeof SB_BOOKINGS === 'undefined' || !Array.isArray(SB_BOOKINGS)) return fn();
      var have = {}; SB_BOOKINGS.forEach(function(b){ if(b){ have[b.id] = 1; if(b.opsId) have[b.opsId] = 1; } });
      var extra = c.rows.filter(function(r){ return r && !have[r.id] && !have[r.opsId]; });
      if(!extra.length) return fn();
      var saved = SB_BOOKINGS; SB_BOOKINGS = saved.concat(extra);
      try{ return fn(); }finally{ SB_BOOKINGS = saved; }
    }
    var origHtml = window.bookingV2VoucherDupHtml;
    if(typeof origHtml === 'function') window.bookingV2VoucherDupHtml = function(val){
      if(!O.enabled()) return origHtml.apply(this, arguments);
      var self = this, args = arguments;
      return withHits(val, function(){ return origHtml.apply(self, args); });
    };
    var origLive = window.bookingV2VoucherLiveCheck;
    if(typeof origLive === 'function') window.bookingV2VoucherLiveCheck = function(val){
      var r = origLive.apply(this, arguments);
      if(!O.enabled() || !vkey(val)) return r;
      fetchHits(val).then(function(){ origLive.call(null, val); }).catch(function(e){ console.warn('[ops] voucher check failed', e); });
      return r;
    };
    var origFind = window.bookingV2FindDuplicateBookings;
    if(typeof origFind === 'function') window.bookingV2FindDuplicateBookings = function(d, excludeId, fresh){
      if(!O.enabled() || !fresh) return origFind.apply(this, arguments);
      var self = this, args = arguments;
      return withHits(d && (d.voucherRef || d.code), function(){ return origFind.apply(self, args); });
    };
    /* the save asks the server first, so the duplicate warning sees every booking with this voucher */
    var origCommit = window.bookingV2CommitBooking;
    if(typeof origCommit === 'function') (function(){
      var c2 = function(){
        var self = this, args = arguments;
        var d = (typeof _bkV2 !== 'undefined' && _bkV2) ? _bkV2.newBooking : null;
        var v = d && (d.voucherRef || d.code);
        if(!O.enabled() || !vkey(v)) return origCommit.apply(self, args);
        if(inflight) return;
        inflight = true;
        return fetchHits(v).catch(function(e){ console.warn('[ops] voucher check failed', e); }).then(function(){ inflight = false; return origCommit.apply(self, args); }, function(){ inflight = false; });
      };
      c2.__ops = true; window.bookingV2CommitBooking = c2;
    })();
  })();

  window.laOpsToServer = toServer;
  window.laOpsFromServer = fromServer;
  O.bookings = { pickupSplit: pickupSplit, pierNoteFrom: pierNoteFrom, save: save, saveNow: saveNow, fromServer: fromServer, toServer: toServer, mergeInto: mergeInto, upsert: upsert,
                 reload: reload, loadPending: loadPending, ensurePending: ensurePending, refreshDay: refreshDay };

  /* The cancel dialog's reasons (BKV2_CANCEL_REASONS) are the server's list: GET /v1/cancel-categories
     { categories: [{ code, en, th, group, default_charge }] }. Replaced in place (the list is a const), same fields as legacy's
     (default_charge is legacy's `def`, the charge the dialog pre-selects). Legacy mode keeps its built-in list. */
  O.cancelCategories = { load: function(){
    return O.get('/v1/cancel-categories').then(function(j){
      var rows = (j && j.categories) || [];
      if(!rows.length || typeof BKV2_CANCEL_REASONS === 'undefined') return j;
      BKV2_CANCEL_REASONS.length = 0;
      rows.forEach(function(c){ BKV2_CANCEL_REASONS.push({ code: c.code, en: c.en, th: c.th, group: c.group, def: c.default_charge }); });
      return j;
    });
  } };
})();
