function bookingV2ResetTripPickupTime(idx){
  const d = _bkV2.newBooking;
  if(!d?.trips[idx]) return;
  const t = d.trips[idx];
  t.pickupTimeEdited = false;
  t.pickupTime = (t.routeId && d.pickupAreaId) ? (bookingV2GetPickupTime(t.routeId, d.pickupAreaId, t.date) || '') : '';
  bookingV2Render();
}
