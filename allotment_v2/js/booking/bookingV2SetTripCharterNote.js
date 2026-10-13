function bookingV2SetTripCharterNote(idx, val){
  const t = _bkV2.newBooking && _bkV2.newBooking.trips[idx];
  if(!t) return;
  t.charterPriceNote = val;
  // text only · skip re-render to keep input focus
}
