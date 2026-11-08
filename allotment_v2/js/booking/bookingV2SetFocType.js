function bookingV2SetFocType(val){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.focType = val || '';
  bookingV2Render();
}
