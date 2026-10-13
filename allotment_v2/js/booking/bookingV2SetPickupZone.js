// Zone segmented control · clears area + auto-assigns for NoTransfer
function bookingV2SetPickupZone(zone){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  d.pickupZoneFilter = zone;
  // If current area doesn't match new zone → clear it
  const curArea = d.pickupAreaId ? (typeof bookingV2GetArea === 'function' ? bookingV2GetArea(d.pickupAreaId) : null) : null;
  if(curArea && curArea.zone !== zone) d.pickupAreaId = null;
  // No-Transfer auto-routing · pick the matching pier-based area from first trip's route
  if(zone === 'NoTransfer'){
    const firstTrip = d.trips?.[0];
    const route = (firstTrip?.routeId && typeof ROUTES !== 'undefined') ? ROUTES.find(r => r.id === firstTrip.routeId) : null;
    const targetPier = route?.pier; // 'tublamu' or 'panwa'
    let targetArea = null;
    if(typeof SB_PICKUP_AREAS !== 'undefined'){
      const ntAreas = SB_PICKUP_AREAS.filter(a => a.zone === 'NoTransfer');
      if(targetPier === 'panwa') targetArea = ntAreas.find(a => /panwa/i.test(a.id) || /panwa/i.test(a.name));
      else if(targetPier === 'tublamu') targetArea = ntAreas.find(a => /tublamu|tub.?lamu/i.test(a.id) || /tublamu|tub.?lamu/i.test(a.name));
      if(!targetArea) targetArea = ntAreas[0]; // fallback to first
    }
    if(targetArea) d.pickupAreaId = targetArea.id;
  }
  bookingV2Render();
}
