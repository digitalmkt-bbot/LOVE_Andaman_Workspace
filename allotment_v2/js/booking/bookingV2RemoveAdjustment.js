function bookingV2RemoveAdjustment(i){
  if(!_bkV2.newBooking || !_bkV2.newBooking.adjustments) return;
  _bkV2.newBooking.adjustments.splice(i, 1);
  bookingV2Render();
}
