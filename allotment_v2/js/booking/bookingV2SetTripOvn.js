function bookingV2SetTripOvn(idx, val){
  if(!_bkV2.newBooking) return;
  const t = _bkV2.newBooking.trips[idx];
  if(!t) return;
  t.ovn = val || null;
  bookingV2Render();
}
