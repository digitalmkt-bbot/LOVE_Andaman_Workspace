// Pickup area · zone derived · pickup time auto per trip
function bookingV2SetPickupArea(areaId){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.pickupAreaId = areaId || null;
  // Auto-fill pickupTime for each trip from new area
  const d = _bkV2.newBooking;
  d.trips.forEach(t => {
    if(t.pickupTimeEdited) return;  // don't override user's manual edit
    t.pickupTime = (t.routeId && areaId) ? (bookingV2GetPickupTime(t.routeId, areaId, t.date) || '') : '';
  });
  // Sync trip.zone (for pricing) from area's parent zone · also sync pickupZoneFilter
  const area = bookingV2GetArea(areaId);
  if(area){
    d.trips.forEach(t => {
      // A private van keeps a No-Transfer SEAT (seat-only price). The pickup area only says WHERE the van
      // collects — it must NOT push the seat onto the area's zone (which may have no seat rate → "no rate").
      if(bookingV2TripPrivateVan(d, t)) return;
      t.zone = area.zone;
    });
    d.pickupZoneFilter = area.zone; // keep zone filter in sync
  }
  bookingV2Render();
}
