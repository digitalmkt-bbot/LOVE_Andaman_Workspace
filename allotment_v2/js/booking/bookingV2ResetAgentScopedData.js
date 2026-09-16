// Clear all fields that depend on the chosen agent / rate type · keeps lead + pax counts
function bookingV2ResetAgentScopedData(){
  const d = _bkV2.newBooking;
  if(!d) return;
  // Per-trip · reset route/zone/pickup-time/charter (keep pax + date)
  (d.trips||[]).forEach(t => {
    t.routeId = '';
    t.zone = 'PK';
    t.pickupTime = '';
    t.pickupTimeEdited = false;
    t.bookingMode = 'seat';
    t.charterBoatId = null;
    t.charterDisplacementAck = false;
  });
  // Booking-level pickup
  d.pickupAreaId = null;
  d.pickupZoneFilter = 'PK';
  d.hotelName = '';
  d.roomNumber = '';
  d.dropoffSame = true;
  d.dropoffAreaId = null;
  d.dropoffHotelName = '';
  d.altPickups = [];
  // Add-ons reset (different agents may have different add-on offerings)
  d.addOns = [];
}
