function bookingV2ToggleLuggageOn(on){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.largeLuggage = on ? Math.max(1, _bkV2.newBooking.largeLuggage || 0) : 0;
  bookingV2Render();
}
