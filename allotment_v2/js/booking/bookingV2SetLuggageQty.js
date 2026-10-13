function bookingV2SetLuggageQty(val){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.largeLuggage = Math.max(0, Number(val)||0);
}
