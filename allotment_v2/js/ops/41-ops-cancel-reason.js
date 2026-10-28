/* ═════════════════════════════════════════════════════════════════════════
   §cxWhy (lk-inbox 31a227c2) · a booking cancelled without a reason (almost all Love Kingdom's: the B2C sync
   cancels when the customer does, and nobody picks a reason) is given one from the Booking screen's red bar
   or its detail card. Legacy's cxwSave wrote it into the blob; here
     POST /v1/bookings/{id}/cancel-reason  { category, note? }   (If-Match, laOps.bookingWrite)
   sets only the reason (operation-backend's planCancelReason: no charge, invoice, seat or lock moves), and its
   answer replaces the booking, so cxwNeed is false and the bar and the card go by themselves.
   The bar and the dialog (cxwBanner, cxwList, cxwRender) are legacy's and read SB_BOOKINGS: on main that is
   the bookings this browser has loaded (the Booking screen's month and so on), not every booking.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps;
  if(!O) return;
  var orig = window.cxwSave;
  if(typeof orig !== 'function') return;
  var enc = encodeURIComponent;
  function redraw(){
    try{ if(typeof window.cxwRender === 'function') window.cxwRender(); }catch(_){}
    try{ if(typeof window.bookingV2Render === 'function') window.bookingV2Render(); }catch(_){}
  }
  window.cxwSave = function(id, i){
    if(!O.enabled()) return orig.apply(this, arguments);
    if(typeof window.cxwCanEdit === 'function' && !window.cxwCanEdit()) return false;
    var b = (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).find(function(x){ return x && x.id === id; });
    if(!b || (typeof window.cxwNeed === 'function' && !window.cxwNeed(b))){ redraw(); return false; }
    var cat = (document.getElementById('cxw-c-' + i) || {}).value || '', note = String((document.getElementById('cxw-n-' + i) || {}).value || '').trim();
    if(!cat){ alert('Please choose a cancellation reason.'); return false; }
    if(cat === 'other' && !note){ alert('Please add a note for "Other".'); return false; }
    var body = { category: cat };
    if(note) body.note = note;
    return O.queue(function(){ return O.bookingWrite('POST', '/v1/bookings/' + enc(b.opsId || b.id) + '/cancel-reason', b, body); }).then(function(ob){
      if(ob && O.bookings && typeof O.bookings.upsert === 'function') O.bookings.upsert(ob);
      O.wrote('booking-cancel-reason');
      redraw();
      return true;
    }, function(e){ O.fail('The cancellation reason was not saved', e); redraw(); return false; });
  };
})();
