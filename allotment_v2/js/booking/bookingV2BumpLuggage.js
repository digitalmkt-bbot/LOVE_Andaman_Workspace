function bookingV2BumpLuggage(delta){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.largeLuggage = Math.max(0, (_bkV2.newBooking.largeLuggage||0) + delta);
  bookingV2Render();
}
