function bookingV2CalClear(){
  if(_bkV2CalIdx === null) return;
  const idx = _bkV2CalIdx;
  bookingV2CalClose();
  if(_bkV2.newBooking?.trips?.[idx]){ _bkV2.newBooking.trips[idx].date = ''; bookingV2Render(); }
}
