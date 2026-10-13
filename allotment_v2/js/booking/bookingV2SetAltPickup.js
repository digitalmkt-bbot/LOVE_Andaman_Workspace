function bookingV2SetAltPickup(i, field, val){
  // mutate WITHOUT re-render so the input keeps focus while typing
  if(!_bkV2.newBooking || !Array.isArray(_bkV2.newBooking.altPickups)) return;
  const a = _bkV2.newBooking.altPickups[i]; if(!a) return;
  a[field] = val;
}
