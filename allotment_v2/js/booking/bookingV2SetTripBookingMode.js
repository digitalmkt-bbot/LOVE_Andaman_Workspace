function bookingV2SetTripBookingMode(idx, mode){
  if(!_bkV2.newBooking) return;
  const t = _bkV2.newBooking.trips[idx];
  if(!t) return;
  t.bookingMode = mode;
  if(mode === 'seat') t.charterBoatId = null;
  bookingV2Render();
}
