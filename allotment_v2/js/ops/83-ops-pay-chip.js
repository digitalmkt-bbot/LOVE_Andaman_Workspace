/* ═════════════════════════════════════════════════════════════════
   §opsPayChip (w5-d, 2026-10-18) · the By-trip payment chip and the paid / balance split from the booking's own invoice

   bookingV2PayChip (the "Awaiting / Partial / Paid" chip of a By-trip row) and bookingV2PaidSplit ("paid x · balance y") read the booking's
   invoice through acctBookingInvoice and its state through acctInvoiceState / acctInvoicePaid / acctInvoiceBalance. Those are server-fed
   (30-ops-money.js) but only for invoices the browser holds in SB_INVOICES, which the accounting screens load. The server hands every
   booking its live invoice already worked out (README "On the booking"):

     bk.invoice        { id number kind fee_type status total paid balance received } or null
     bk.payment_state  none | invoiced | partial | paid   (over every live invoice of the booking)

   40-ops-bookings.js keeps them as bk.opsInvoice / bk.paymentState (read only, never sent). Here acctBookingInvoice answers from
   them when SB_INVOICES has no invoice for the booking, so the chip and the split are the server's wherever a booking is drawn.
   An invoice that covers several bookings (its total is not this booking's) is given two booking ids, so legacy's "shared invoice" line of
   bookingV2PaidSplit applies. When the browser holds the invoice, that one answers, as before.

   Load order: after 30-ops-money.js and 40-ops-bookings.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function num(v){ return +v || 0; }
  function bookingOf(id){
    var l = typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : [];
    for(var i = 0; i < l.length; i++) if(l[i] && (l[i].id === id || l[i].opsId === id)) return l[i];
    return null;
  }
  var synth = {};          // booking id -> the stand-in (kept so the same object answers while the invoice is unchanged)
  function standIn(b){
    var oi = b.opsInvoice; if(!oi || !oi.id) return null;
    var tot = typeof window.acctBookingTotal === 'function' ? num(window.acctBookingTotal(b)) : num(oi.total);
    var shared = tot > 0 && Math.abs(num(oi.total) - tot) > 1;
    var sig = JSON.stringify([oi.id, oi.status, oi.total, oi.paid, oi.balance, shared]), c = synth[b.id];
    if(c && c.sig === sig) return c.inv;
    var inv = { id: oi.id, number: oi.number || '', kind: oi.kind || 'booking', feeType: oi.fee_type || null, status: oi.status, total: num(oi.total), paid: num(oi.paid), balance: num(oi.balance),
                received: num(oi.received), bookingIds: shared ? [b.id, '_other'] : [b.id], serverBookingIds: b.opsId ? [b.opsId] : [], lineItems: [], _fromOpsBackend: true, _fromBooking: true };
    synth[b.id] = { sig: sig, inv: inv };
    return inv;
  }
  var orig = window.acctBookingInvoice;
  if(typeof orig === 'function' && !orig.__opsPayChip){
    var w = function(bkId){
      var inv = orig.apply(this, arguments);
      if(inv || !enabled()) return inv;
      var b = bookingOf(bkId);
      return b ? standIn(b) : null;
    };
    w.__opsPayChip = true; window.acctBookingInvoice = w;
  }
})();
