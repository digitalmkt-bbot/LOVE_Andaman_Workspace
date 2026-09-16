function bookingV2SetTripPickupTime(idx, val){
  if(!_bkV2.newBooking?.trips[idx]) return;
  _bkV2.newBooking.trips[idx].pickupTime = val;
  _bkV2.newBooking.trips[idx].pickupTimeEdited = true;
  // Triggered on blur (onchange) · safe to render to show EDITED badge
  bookingV2Render();
}
