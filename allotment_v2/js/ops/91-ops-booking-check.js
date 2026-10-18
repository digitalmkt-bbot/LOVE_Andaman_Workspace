/* ══════════════════════════════════════════════════════════════════════════
   §opsBookingCheck (w6-a, 2026-10-18) · the duplicate question BEFORE the save ⇄ POST /v1/bookings/check
   ──────────────────────────────────────────────────────────────────────────
   Legacy's bookingV2CommitBooking asked "⚠ พบ booking ที่อาจซ้ำ N รายการ" from the bookings this browser holds
   (bookingV2FindDuplicateBookings), before it sent anything. ops/75 showed the server's warning only AFTER the save. The server now answers the
   same question without storing anything: POST /v1/bookings/check {the form's body, booking_id when amending} -> {warnings[]}, with
   possible_duplicate {duplicates[{booking_id, code, voucher_ref, lead_pax, service_date, route_id, reasons[]}]} judged over every booking the server
   holds. Here the commit asks that first and legacy's own confirm is drawn from the server's list (same box, same lines, same buttons); when the
   server found none, the confirm does not appear, whatever this browser holds. If the check cannot be answered (offline, or the form is refused:
   the save will say why) legacy's own scan runs as before. The passenger-type warning stays an after-the-save notice (legacy never asked it).
   Nothing is computed here; the body is the save's body. Classic script, after ops/40 and ops/75.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var prevCommit = window.bookingV2CommitBooking, prevFind = window.bookingV2FindDuplicateBookings;
  if(typeof prevCommit !== 'function' || typeof prevFind !== 'function' || prevCommit.__w6a) return;
  var checked = null;       // { form, list } · the server's duplicates for this form object
  var busy = false;

  function legacyShape(dups){
    return (dups || []).map(function(x){
      return { bk: { id: x.booking_id, voucherRef: x.voucher_ref || '', code: x.code || '', leadPax: x.lead_pax || '',
                     trips: [{ date: x.service_date || '', routeId: x.route_id || '' }] },
               reasons: (x.reasons || []).slice() };
    });
  }
  window.bookingV2FindDuplicateBookings = function(d, excludeId, fresh){
    if(fresh && checked && checked.form === d && O.enabled()) return checked.list.slice();
    return prevFind.apply(this, arguments);
  };

  var w = function(){
    var self = this, args = arguments;
    checked = null;
    var st = (typeof _bkV2 !== 'undefined') ? _bkV2 : null, d = st && st.newBooking;
    if(!O.enabled() || !d || typeof window.laOpsToServer !== 'function') return prevCommit.apply(self, args);
    if(busy) return;
    var body;
    try{
      var own = st.editingId ? (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).filter(function(b){ return b && b.id === st.editingId; })[0] : null;
      body = window.laOpsToServer(d, !(own && own.opsId));
      if(own && own.opsId) body.booking_id = own.opsId;
      /* the check asks the duplicate question only: the save's own refusals that a person may overrule (a route outside the programme, a closed booking,
         a free charter, seats taken from a charter) are asked later, by the commit, and must not stop the check here */
      body.programme_anyway = true; body.edit_anyway = true; body.free_anyway = true; body.displace_anyway = true;
    }catch(_){ return prevCommit.apply(self, args); }
    busy = true;
    return O.call('POST', '/v1/bookings/check', body).then(function(r){
      var dup = ((r && r.warnings) || []).filter(function(x){ return x && x.code === 'possible_duplicate'; })[0];
      checked = { form: d, list: legacyShape(dup && dup.duplicates) };
    }, function(){ checked = null; }).then(function(){
      busy = false;
      return prevCommit.apply(self, args);
    });
  };
  w.__w6a = true; w.__ops = true; w.__orig = prevCommit;
  window.bookingV2CommitBooking = w;
})();
