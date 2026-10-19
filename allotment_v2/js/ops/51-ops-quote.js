/* ══════════════════════════════════════════════════════════════════════════
   §opsQuote (2026-10-13) · the price shown while editing a booking comes from POST /v1/quote
   ──────────────────────────────────────────────────────────────────────────
   Wraps window.bookingV2CalcQuote (js/booking/bookingV2CalcQuote.js).  Loads after
   40-ops-bookings.js and every js/booking/*.js file.

   HOW IT WORKS
     bookingV2CalcQuote() has ~12 SYNCHRONOUS callers (review panel, submit button, FOC
     section, payment credit check, commit/submit, edit-load) that need a value NOW and read
     the legacy shape {totalSeat,totalAddOn,focDiscount,totalFoc,totalDiscount,totalExtra,
     base,grandTotal,perTrip[]}.  So the wrapper stays synchronous:
       1. build the request from the draft (_bkV2.newBooking) -> key = JSON of the request
       2. cache hit  -> legacy result with the server's numbers laid over it
       3. cache miss -> return the LEGACY result untouched, and schedule ONE debounced
          POST /v1/quote (300 ms).  When it answers, the answer is cached under its key and the
          review panel + side slots are redrawn (they call this wrapper again and now hit).
     Sequencing: every fired request gets a sequence number; an answer redraws only if it is
     the newest request AND the draft's current key still equals the request's key, so a
     slow old answer can never overwrite a newer one.  (The cache is keyed by request, so an
     old answer filed under its own key is still correct for that key.)

   WHAT THE SERVER REPLACES (when the call succeeds)
     totalSeat, totalAddOn, focDiscount, totalDiscount, totalExtra, base, grandTotal and
     perTrip[i].total  <-  quote.seat, add_on, -foc_discount, -discount, extra, seat+add_on,
     total, trips[i].subtotal.   Seat rates, zones, promo/contract rates, longtail bundles,
     charter prices, add-on prices, discount/extra, OVN charge and the manual-total rule are
     all computed by operation-backend (src/domain/pricing.ts), not by the browser.

   WHAT STAYS LEGACY (bypassed only when the server value is missing)
     · the whole legacy calc still RUNS on every call (it is the fallback, and it supplies the
       fields the server has no equivalent for: totalFoc (count of FOC pax), perTrip[i].error /
       noRateCard / priceMode / other per-trip display fields, the manual+B2C bits).
     · the legacy value is what callers get: when laOps is disabled, the draft is B2C
       (id b2c_*, the server keeps Love Kingdom's price), the draft has no priced trip, a
       charter has no boat yet, the request is refused (400/409/403/5xx/network), or the
       answer has not arrived yet.  A failed key is remembered for 15 s so it is not retried
       on every redraw.
     · save/submit decisions made in the browser (discount -> pending approval, credit limit)
       read this wrapper synchronously, so right after an edit they may still see the legacy
       number; the server re-prices on save anyway and is authoritative.
     · bookingV2TripSubtotal / _bkV2CalcQuoteRun / bookingV2AddOnInfo are NOT wrapped.

   REQUEST (POST /v1/quote, same camelCase keys as laOpsToServer; priced inputs only)
     { agentId, rateTypeRef, bookingDate, priceMode, manualTotal, staffPurpose,
       bookingId (opsId when editing a booking the server holds),
       rate: 'kept' (edit with _rtKeep.mode 'keep') | 'agent',
       trips[]: {id?, routeId (the SOLD route, i.e. before an upgrade), date, pax, zone,
                 bookingMode, charterBoatId, ovn, ovnReturnDate, ovnLeg, ovnOf, ovnCharge,
                 charterPriceMode, charterPriceManual, charterPriceNote},
       addOns[]: {type, qty, jAd, jChd, amount?}, adjustments[]: {kind, mode, value} }
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  if(typeof window.bookingV2CalcQuote !== 'function') return;
  var legacyCalc = window.bookingV2CalcQuote;

  var DEBOUNCE_MS = 300, FAIL_MS = 15000, KEEP = 24, OK_MS = 120000;
  var cache = {};            // key -> { ok, quote, map, at }
  var order = [];            // keys, oldest first
  var timer = null, seq = 0, pending = null, listeners = [];

  function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
  function paxClean(p){
    var out = {}; Object.keys(p || {}).forEach(function(k){ var n = Math.round(+p[k] || 0); if(n > 0) out[k] = n; }); return out;
  }
  function paxCount(p){ var n = 0; Object.keys(p || {}).forEach(function(k){ n += Math.round(+p[k] || 0) > 0 ? Math.round(+p[k]) : 0; }); return n; }

  /* draft -> { body, map } or null when the server cannot be asked (legacy answers).
     map[i] = index in d.trips of request trip i.  Pure: takes the draft and its context. */
  function buildRequest(d, ctx){
    ctx = ctx || {};
    if(!d || !Array.isArray(d.trips)) return null;
    if(/^b2c_/.test(String(d.id || d.code || ''))) return null;      // the server keeps B2C's own price
    var map = [], trips = [];
    for(var i = 0; i < d.trips.length; i++){
      var t = d.trips[i];
      if(!t || !t.routeId || !t.date || paxCount(t.pax) === 0) continue;
      var charter = t.bookingMode === 'charter';
      if(charter && !t.charterBoatId) return null;                    // server: charter needs a boat -> 400
      var o = { routeId: ctx.soldRoute ? ctx.soldRoute(t) : t.routeId, date: t.date, pax: paxClean(t.pax) };
      if(t.opsTripId) o.id = t.opsTripId;
      if(charter){ o.bookingMode = 'charter'; o.charterBoatId = t.charterBoatId; }
      var zone = O.vanZone ? O.vanZone(d, t, d.id || d.code) : t.zone;      // §opsVan (Q44) · a private van makes the seat No-Transfer
      if(zone) o.zone = zone;
      if(t.ovn){ o.ovn = t.ovn; if(t.ovn === 'return' && t.ovnReturnDate) o.ovnReturnDate = t.ovnReturnDate; }
      if(t.ovnLeg){ o.ovnLeg = true; if(t.ovnOf != null) o.ovnOf = +t.ovnOf; }
      if(t.ovnCharge != null && t.ovnCharge !== '') o.ovnCharge = Math.max(0, num(t.ovnCharge));
      if(t.charterPriceMode) o.charterPriceMode = t.charterPriceMode;
      if(t.charterPriceManual != null && t.charterPriceManual !== '') o.charterPriceManual = Math.max(0, num(t.charterPriceManual));
      if(t.charterPriceNote != null && String(t.charterPriceNote).trim()) o.charterPriceNote = String(t.charterPriceNote);
      trips.push(o); map.push(i);
    }
    if(!trips.length) return null;
    var body = { trips: trips };
    if(d.agentId) body.agentId = d.agentId;
    if(d.rateTypeRef) body.rateTypeRef = d.rateTypeRef;
    if(d.bookingDate) body.bookingDate = String(d.bookingDate).slice(0, 10);
    body.priceMode = d.priceMode === 'manual' ? 'manual' : 'rate';
    if(body.priceMode === 'manual') body.manualTotal = Math.max(0, num(d.manualTotal));
    if(d.staffPurpose) body.staffPurpose = d.staffPurpose;
    /* §w7a · the nationalities the person typed (client facts), so the server can judge nat_mix (park-fee warning) for this draft;
       the warning itself comes back in warnings[] and is drawn by 95-ops-w7a-booking-form.js. Named passengers only, as the save sends them. */
    if(d.leadNationality) body.leadNationality = String(d.leadNationality);
    var nats = (d.passengers || []).filter(function(p){ return p && String(p.name || '').trim(); }).map(function(p){
      var o = { name: String(p.name).trim() };
      if(p.nationality) o.nationality = String(p.nationality); if(p.type) o.type = String(p.type); if(p.foc != null) o.foc = !!p.foc;
      return o;
    });
    if(nats.length) body.passengers = nats;
    var addOns = (d.addOns || []).filter(function(a){ return a && a.type; }).map(function(a){
      var x = { type: String(a.type) };
      if(Number.isInteger(+a.qty) && +a.qty >= 1) x.qty = +a.qty;
      if(a.jAd != null && Number.isInteger(+a.jAd) && +a.jAd >= 0) x.jAd = +a.jAd;
      if(a.jChd != null && Number.isInteger(+a.jChd) && +a.jChd >= 0) x.jChd = +a.jChd;
      if(isFinite(+a.amount) && +a.amount >= 0 && a.amount !== '' && a.amount !== null) x.amount = +a.amount;
      return x;
    });
    if(addOns.length) body.addOns = addOns;
    var adj = (d.adjustments || []).filter(function(a){ return a && num(a.value) > 0; })
      .map(function(a){ return { kind: a.kind, mode: a.mode, value: num(a.value) }; });
    if(adj.length) body.adjustments = adj;
    if(ctx.editing){
      if(ctx.editing.opsId) body.bookingId = ctx.editing.opsId;
      body.rate = (d._rtKeep && d._rtKeep.mode === 'keep') ? 'kept' : 'agent';
    }
    return { body: body, map: map };
  }

  /* legacy result + the server's quote -> legacy shape carrying the server's numbers */
  function overlay(legacy, q, map){
    if(!legacy || !q || typeof q.total !== 'number') return legacy;
    var out = Object.assign({}, legacy);
    var seat = num(q.seat), addOn = num(q.add_on);
    out.totalSeat = seat; out.totalAddOn = addOn;
    out.focDiscount = Math.abs(num(q.foc_discount));
    out.totalDiscount = Math.abs(num(q.discount));
    out.totalExtra = num(q.extra);
    out.base = seat + addOn;
    out.grandTotal = num(q.total);
    if(q.price_mode === 'manual') out.manual = true;
    if(Array.isArray(legacy.perTrip) && Array.isArray(q.trips) && map){
      var per = legacy.perTrip.slice();
      map.forEach(function(di, ri){
        var s = q.trips[ri];
        if(s && per[di] && typeof s.subtotal === 'number') per[di] = Object.assign({}, per[di], { total: s.subtotal, rateTypeId: s.rate_type_id, promoId: s.promo_id, rateSource: s.rate_source });
      });
      out.perTrip = per;
    }
    out.server = true; out.serverWarnings = q.warnings || [];
    return out;
  }

  function remember(key, entry){
    if(!cache[key]) order.push(key);
    cache[key] = entry;
    while(order.length > KEEP){ delete cache[order.shift()]; }
  }
  function fresh(e){ return e && (Date.now() - e.at) < (e.ok ? OK_MS : FAIL_MS); }

  function context(){
    var editing = null;
    try{ if(window._bkV2 && _bkV2.editingId && typeof SB_BOOKINGS !== 'undefined') editing = SB_BOOKINGS.find(function(b){ return b && b.id === _bkV2.editingId; }) || { opsId: null }; }catch(_){}
    return { editing: editing, soldRoute: function(t){
      try{ if(typeof bkUpgActive === 'function' && bkUpgActive(t) && t.upg && t.upg.fromRouteId) return t.upg.fromRouteId; }catch(_){}
      return t.routeId;
    } };
  }
  function current(){
    try{ var d = window._bkV2 && _bkV2.newBooking; if(!d) return null;
      var r = buildRequest(d, context()); return r ? { key: JSON.stringify(r.body), req: r } : null;
    }catch(_){ return null; }
  }

  function redraw(){
    try{
      var slot = document.getElementById('nbf-review-slot');
      var a = document.activeElement;
      if(slot && !(a && slot.contains(a)) && typeof window.bookingV2RenderReviewPanel === 'function') slot.innerHTML = window.bookingV2RenderReviewPanel(true);
      if(typeof window.bookingV2NbRefreshSide === 'function') window.bookingV2NbRefreshSide();
    }catch(e){ console.warn('quote redraw failed', e); }
  }

  function fire(key, req){
    var mine = ++seq; pending = key;
    O.post('/v1/quote', req.body).then(function(q){
      remember(key, { ok: true, quote: q, map: req.map, at: Date.now() });
      try{ listeners.forEach(function(fn){ fn(key, req, q); }); }catch(_){}      // w5-e: ops/84 reads the answer (rate drift prompt)
      if(mine !== seq) return;                       // a newer request is out: let it redraw
      pending = null;
      var cur = current();
      if(cur && cur.key === key) redraw();
    }, function(e){
      remember(key, { ok: false, at: Date.now() });
      if(mine === seq) pending = null;
      try{ console.warn('quote: server refused, legacy price kept (' + ((e && e.message) || e) + ')'); }catch(_){}
    });
  }
  function schedule(key, req){
    if(pending === key) return;
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){
      timer = null;
      var cur = current();                           // the draft may have moved on while we waited
      if(!cur) return;
      var e = cache[cur.key]; if(fresh(e)) return;
      fire(cur.key, cur.req);
    }, DEBOUNCE_MS);
  }

  window.bookingV2CalcQuote = function(){
    var legacy = legacyCalc.apply(this, arguments);
    if(!O.enabled()) return legacy;
    var cur = current(); if(!cur) return legacy;
    var e = cache[cur.key];
    if(fresh(e)) return e.ok ? overlay(legacy, e.quote, e.map) : legacy;
    schedule(cur.key, cur.req);
    return legacy;
  };

  /* give the review panel a mount point so a late answer can redraw it without a full render */
  var panel = window.bookingV2RenderReviewPanel;
  if(typeof panel === 'function'){
    window.bookingV2RenderReviewPanel = function(bare){
      var html = panel.apply(this, arguments);
      return bare === true ? html : '<div id="nbf-review-slot" style="display:contents">' + html + '</div>';
    };
  }

  /* §opsNoRate · "NO RATE" trips (bkV2NoRateTrips) from the server's quote: its warnings no_rate / not_offered are the same
     test as the 409 no_rate a save would meet (pricing.ts assertPriced). Until the quote for this draft has answered, legacy's list stands. */
  var legacyNoRate = window.bookingV2NoRateTrips;
  if(typeof legacyNoRate === 'function') window.bookingV2NoRateTrips = function(){
    var legacy = legacyNoRate.apply(this, arguments);
    if(!O.enabled()) return legacy;
    var d = window._bkV2 && _bkV2.newBooking;
    if(!d || d.priceMode === 'manual' || !Array.isArray(d.trips)) return legacy;
    var cur = current(), e = cur && cache[cur.key];
    if(!(fresh(e) && e.ok && e.quote)) return legacy;
    var bad = {};
    (e.quote.warnings || []).forEach(function(w){
      if(w && (w.code === 'no_rate' || w.code === 'not_offered') && typeof w.trip === 'number' && e.map[w.trip] != null) bad[e.map[w.trip]] = w.message;
    });
    var out = [];
    d.trips.forEach(function(t, i){
      if(!t || !t.routeId || !t.zone || !(i in bad) || t.bookingMode === 'charter' || t.ovnLeg) return;
      var was = legacy.find(function(x){ return x.idx === i; });
      out.push({ idx: i, trip: t, reason: was ? was.reason : bad[i] });
    });
    return out;
  };

  /* w5-e: the cached answer for the draft on screen, so TripSubtotal / AddOnInfo (ops/84) read the server's numbers
     instead of working them out: { key, req: {body, map}, quote } or null while there is none. */
  function answered(){
    var cur = current(); if(!cur) return null;
    var e = cache[cur.key];
    return (fresh(e) && e.ok && e.quote) ? { key: cur.key, req: cur.req, quote: e.quote } : null;
  }
  window.laOpsQuote = { buildRequest: buildRequest, overlay: overlay, _cache: cache, _legacy: legacyCalc, answered: answered,
    onAnswer: function(fn){ listeners.push(fn); } };
})();
