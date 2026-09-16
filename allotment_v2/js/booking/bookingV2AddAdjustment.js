// ── Booking-review adjustments · discount (%/amount) + extra charge ──
function bookingV2AddAdjustment(kind){
  if(!_bkV2.newBooking) return;
  if(!Array.isArray(_bkV2.newBooking.adjustments)) _bkV2.newBooking.adjustments = [];
  _bkV2.newBooking.adjustments.push({
    kind: kind,
    mode: 'amount',                                   // discount can switch to 'percent'
    value: 0,
    label: kind === 'discount' ? 'Discount' : 'Extra charge',
    note: ''
  });
  bookingV2Render();
}
