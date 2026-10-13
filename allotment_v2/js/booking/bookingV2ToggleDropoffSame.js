function bookingV2ToggleDropoffSame(){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.dropoffSame = !_bkV2.newBooking.dropoffSame;
  if(_bkV2.newBooking.dropoffSame) _bkV2.newBooking.dropoffAreaId = null;
  bookingV2Render();
}
