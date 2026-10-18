/* ════════════════════════════════════════════════════════════════════════
   §opsBookingCalc (w5-e, 2026-10-18) · booking-form price lines, approval impact, money state, history, pickup time, PFM print
   ────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "Quote", "Bookings" (approval-impact, history), "Money" (invoice, payment_state), "Pickup time", "PFM".
   The draft's price already comes from POST /v1/quote through ops/51-ops-quote.js (grand total, perTrip total). The helpers below
   still worked their own figures out of the rate type held in the browser; they now read the same answer (cached per draft):

   · bookingV2TripSubtotal(trip)   .total <- quote trips[i].subtotal   (Trips section, review panel, charter price box)
   · bookingV2AddOnInfo(type)      .total <- quote add_ons[i].amount / qty   (longtail join / charter and transfer lines)
   · rate drift prompt (_rtKeep)   the amount "at current rates" is the quote asked with rate:"kept"; the drift flag is set from that answer
   · bookingV2ApprovalImpact(b)    <- GET /v1/bookings/{id}/approval-impact, read when the Approve dialog is opened
   · bookingV2PayOf(bk)            total / paid / balance / state <- the booking's invoice and payment_state (server, every booking read)
   · bookingV2AddHistory           the line stays for instant feedback; the history is read again from GET /v1/bookings/{id}/history
                                   after the booking is written, so what stays is the server's wording
   · bookingV2GetPickupTime        <- GET /v1/pickup-time?route_id&area_id&date  (the pickup time of an area for a trip)
   · pfmPrintReport                billed / received / balance per booking <- GET /v1/pfm rows (the rows the screen holds)
   Legacy's own figure answers until the server's answer lands (and offline); when the answer differs the form is drawn again.
   Never sent: subtotals, add-on amounts, impact, state. (ops/40 stopped sending total / purpose / price breakdown at the same time.)
   Classic script · loads after ops/51, ops/71 and the js/booking/*.js files.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v); }
  function draft(){ return (window._bkV2 && _bkV2.newBooking) || null; }
  function typing(){ var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  function redrawForm(d){
    try{
      if(draft() !== d || typing()) return;
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
    }catch(_){}
  }
  function mark(fn){ fn.__w5e = true; return fn; }
  var Q = window.laOpsQuote;

  /* ── trip subtotal ── */
  var legacySub = window.bookingV2TripSubtotal;
  if(Q && Q.answered && typeof legacySub === 'function' && !legacySub.__w5e){
    window.bookingV2TripSubtotal = mark(function(trip){
      var out = legacySub.apply(this, arguments);
      if(!on() || !trip) return out;
      var d = draft(); if(!d || d.priceMode === 'manual' || !Array.isArray(d.trips)) return out;
      var i = d.trips.indexOf(trip); if(i < 0) return out;
      var a = Q.answered(); if(!a) return out;
      var ri = a.req.map.indexOf(i); if(ri < 0) return out;
      var st = a.quote.trips && a.quote.trips[ri];
      if(!st || typeof st.subtotal !== 'number') return out;
      return Object.assign({}, out, { total: st.subtotal, server: true });
    });
  }

  /* ── add-on price lines ── */
  var legacyInfo = window.bookingV2AddOnInfo;
  if(Q && Q.answered && typeof legacyInfo === 'function' && !legacyInfo.__w5e){
    window.bookingV2AddOnInfo = mark(function(type){
      var out = legacyInfo.apply(this, arguments);
      if(!on()) return out;
      var d = draft(); if(!d) return out;
      var a = Q.answered(); if(!a) return out;
      var list = (d.addOns || []).filter(function(x){ return x && x.type; });      // same filter and order as the request
      var idx = list.findIndex(function(x){ return x.type === type; });
      var line = idx >= 0 && a.quote.add_ons && a.quote.add_ons[idx];
      if(!line || typeof line.amount !== 'number') return out;
      var qty = Number.isInteger(+list[idx].qty) && +list[idx].qty >= 1 ? +list[idx].qty : 1;
      return Object.assign({}, out, { total: line.amount / qty, server: true });
    });
  }

  /* ── rate drift: the saved total against the quote at the kept rate ── */
  if(Q && Q.onAnswer){
    Q.onAnswer(function(key, req, q){
      try{
        var d = draft(); if(!d || !d._rtKeep || !window._bkV2 || !_bkV2.editingId) return;
        var K = d._rtKeep;
        if(!req || !req.body || req.body.rate !== 'kept' || K.mode !== 'keep' || d.priceMode === 'manual' || typeof q.total !== 'number') return;
        var cur = Q.answered(); if(!cur || cur.key !== key) return;
        var was = Math.round(+K.total || 0), now = Math.round(q.total);
        var next = (was !== now) ? { was: K.total, now: q.total } : null;
        var changed = (!!K.drift !== !!next) || (next && K.drift && Math.round(+K.drift.now || 0) !== now);
        K.drift = next;
        if(changed) redrawForm(d);
      }catch(_){}
    });
  }

  /* ── approval impact: read when the dialog opens ── */
  var impacts = Object.create(null);
  var legacyImpact = window.bookingV2ApprovalImpact;
  if(typeof legacyImpact === 'function' && !legacyImpact.__w5e){
    window.bookingV2ApprovalImpact = mark(function(b){
      if(on() && b && impacts[b.id]) return impacts[b.id];
      return legacyImpact.apply(this, arguments);
    });
  }
  var legacyApprove = window.bookingV2ApproveBooking;
  if(typeof legacyApprove === 'function' && !legacyApprove.__w5e){
    window.bookingV2ApproveBooking = mark(function(id){
      var self = this, args = arguments;
      var bk = (typeof SB_BOOKINGS !== 'undefined') ? SB_BOOKINGS.find(function(x){ return x && x.id === id; }) : null;
      if(!on() || !bk || !bk.opsId) return legacyApprove.apply(self, args);
      return O.get('/v1/bookings/' + enc(bk.opsId) + '/approval-impact').then(function(r){
        impacts[id] = ((r && r.impact) || []).map(function(x){
          return { name: x.route_name || x.route_id, date: x.service_date, need: x.need, sellable: x.sellable, overCap: x.over_cap, overLic: x.over_licence };
        });
      }, function(){ delete impacts[id]; }).then(function(){
        try{ return legacyApprove.apply(self, args); } finally { delete impacts[id]; }
      });
    });
  }

  /* ── money state of a booking ── */
  var legacyPay = window.bookingV2PayOf;
  if(typeof legacyPay === 'function' && !legacyPay.__w5e){
    var STATE = { none: 'noinv', invoiced: 'due', partial: 'partial', paid: 'paid' };
    window.bookingV2PayOf = mark(function(bk){
      var out = legacyPay.apply(this, arguments);
      if(!on() || !bk || !bk.srvPay) return out;
      var p = bk.srvPay, inv = p.invoice;
      if(inv){
        out.tot = +inv.total || 0; out.bal = Math.max(0, +inv.balance || 0);
        out.paid = Math.max(0, +inv.paid || 0); out.over = Math.max(0, out.paid - out.tot);
      }
      if(STATE[p.state]) out.state = STATE[p.state];
      return out;
    });
  }

  /* ── history: the server's words replace the browser's line after the write ── */
  var hist = {};
  var legacyHistory = window.bookingV2AddHistory;
  if(typeof legacyHistory === 'function' && !legacyHistory.__w5e){
    window.bookingV2AddHistory = mark(function(bk){
      var r = legacyHistory.apply(this, arguments);
      if(on() && bk && bk.opsId) hist[bk.id] = true;
      return r;
    });
  }
  var histTimer = null;
  function refreshHistory(){
    var ids = Object.keys(hist); hist = {};
    ids.forEach(function(id){
      var bk = (typeof SB_BOOKINGS !== 'undefined') ? SB_BOOKINGS.find(function(x){ return x && x.id === id; }) : null;
      if(!bk || !bk.opsId) return;
      O.get('/v1/bookings/' + enc(bk.opsId) + '/history').then(function(r){
        bk.history = ((r && r.history) || []).map(function(h){ return { at: h.at, by: h.by || '—', kind: h.kind, tag: h.tag, text: h.text }; });
        bk._historyFromServer = true;
        var st = window._bkV2 || {};
        if(st.detailId === bk.id && !st.newBooking && !O.busy() && !typing()){
          try{ (typeof window.bookingV2RenderKeep === 'function' ? window.bookingV2RenderKeep : window.bookingV2Render)(); }catch(_){}
        }
      }, function(){});
    });
  }
  O.onWrite(function(kind){
    if(!on() || !Object.keys(hist).length) return;
    if(histTimer) clearTimeout(histTimer);
    histTimer = setTimeout(function(){ histTimer = null; refreshHistory(); }, 400);
  });

  /* ── pickup time of an area ── */
  var KEEP_LEGACY = {}, badArea = Object.create(null);
  var pk = Object.create(null);          // route|area|date -> { text: string|null, at }
  function cellText(c){
    if(c && c.pickup_at_pier && c.pickup_time_end) return 'Before ' + c.pickup_time_end + ' at pier';
    if(c && c.pickup_time && c.pickup_time_end) return c.pickup_time + '-' + c.pickup_time_end;
    return (c && c.pickup_time) || '';
  }
  O.onWrite(function(kind){ if(String(kind || '') === 'pickup'){ pk = Object.create(null); badArea = Object.create(null); } });
  var legacyPickup = window.bookingV2GetPickupTime;
  if(typeof legacyPickup === 'function' && !legacyPickup.__w5e){
    window.bookingV2GetPickupTime = mark(function(routeId, areaId, dateStr){
      var legacy = legacyPickup.apply(this, arguments);
      if(!on() || !routeId || !areaId || !dateStr || badArea[areaId]) return legacy;
      var k = routeId + '|' + areaId + '|' + dateStr, hit = pk[k];
      if(hit && hit.text !== undefined) return hit.text === null ? null : hit.text;
      if(!hit){
        pk[k] = { text: undefined, at: Date.now() };
        O.get('/v1/pickup-time', { route_id: routeId, area_id: areaId, date: dateStr }).then(function(r){ return cellText(r); }, function(e){
          /* 404 "Pickup area X not found": the server does not know this area (a local-only one): legacy's table answers, and is not asked again.
             404 for any other reason: the server has no time for that area on that date. */
          if(e && e.status === 404 && /area/i.test(e.message || '') && /not found/i.test(e.message || '')) return KEEP_LEGACY;
          return (e && e.status === 404) ? null : undefined;
        }).then(function(text){
          if(text === KEEP_LEGACY){ pk[k] = { text: undefined, at: Date.now() }; badArea[areaId] = true; return; }
          if(text === undefined){ delete pk[k]; return; }
          pk[k] = { text: text, at: Date.now() };
          var d = draft(); if(!d) return;
          var changed = false;
          (d.trips || []).forEach(function(t){
            if(!t || t.pickupTimeEdited || t.routeId !== routeId || t.date !== dateStr || d.pickupAreaId !== areaId) return;
            var want = text === null ? '' : text;
            if((t.pickupTime || '') !== want){ t.pickupTime = want; changed = true; }
          });
          if(changed) redrawForm(d);
        });
      }
      return legacy;
    });
  }

  /* ── printed PFM report: the server's per-booking money ── */
  var legacyPrint = window.pfmPrintReport;
  if(typeof legacyPrint === 'function' && !legacyPrint.__w5e){
    window.pfmPrintReport = mark(function(){
      if(!on() || typeof window.pfmServerRow !== 'function' || typeof pfmBookingsForPeriod !== 'function') return legacyPrint.apply(this, arguments);
      var list = pfmBookingsForPeriod(_pfmDate, _pfmMode || 'daily') || [];
      var byBk = Object.create(null), byInv = Object.create(null), all = true;
      list.forEach(function(b){ var r = window.pfmServerRow(b); if(!r) all = false; else { byBk[b.id] = r; if(r.invoice && r.invoice.id) byInv[r.invoice.id] = r; } });
      if(!list.length || !all) return legacyPrint.apply(this, arguments);
      var origTot = window.acctBookingTotal, origBal = window.acctInvoiceBalance, origInv = window.acctBookingInvoice;
      window.acctBookingTotal = function(b){ var r = b && byBk[b.id]; return r ? r.total : origTot.apply(this, arguments); };
      window.acctBookingInvoice = function(id){
        var l = origInv.apply(this, arguments); if(l) return l;
        var r = byBk[id];      // the booking has an invoice on the server that this browser has not read yet
        return (r && r.invoice) ? { id: r.invoice.id, number: r.invoice.number, status: r.invoice.status, total: r.total, bookingIds: [id], _fromOpsBackend: true } : null;
      };
      window.acctInvoiceBalance = function(inv){
        var r = inv && byInv[inv.id];
        return r ? Math.max(0, r.total - r.received) : origBal.apply(this, arguments);
      };
      try{ return legacyPrint.apply(this, arguments); }
      finally { window.acctBookingTotal = origTot; window.acctInvoiceBalance = origBal; window.acctBookingInvoice = origInv; }
    });
  }
  /* the browser's own rule stays reachable (tests compare the server's figure with it) */
  [['bookingV2TripSubtotal', legacySub], ['bookingV2AddOnInfo', legacyInfo], ['bookingV2ApprovalImpact', legacyImpact], ['bookingV2PayOf', legacyPay],
   ['bookingV2AddHistory', legacyHistory], ['bookingV2GetPickupTime', legacyPickup], ['pfmPrintReport', legacyPrint]].forEach(function(p){
    if(typeof window[p[0]] === 'function' && window[p[0]].__w5e) window[p[0]].__orig = p[1];
  });
})();
