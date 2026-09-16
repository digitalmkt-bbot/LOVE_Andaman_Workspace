function bookingV2SetFocReason(val){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.focReason = val;
  // Don't re-render · textarea would lose focus
}
