function bookingV2SetTripCharterManual(idx, val){
  const t = _bkV2.newBooking && _bkV2.newBooking.trips[idx];
  if(!t) return;
  t.charterPriceManual = Number(val) || 0;
  bookingV2Render();
}
