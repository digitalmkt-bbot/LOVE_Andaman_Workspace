function bookingV2SetTripCharterBoat(idx, boatId){
  if(!_bkV2.newBooking) return;
  const t = _bkV2.newBooking.trips[idx];
  if(!t) return;
  // Intercept: if there are existing seat bookings on this route+date · ask ops confirmation
  if(boatId && t.routeId && t.date && typeof getSeatsConsumed === 'function'){
    const seatsConsumed = getSeatsConsumed(t.routeId, t.date);
    if(seatsConsumed > 0){
      const al = getAllotment(t.routeId, t.date);
      const boat = (typeof BOATS !== 'undefined') ? BOATS.find(b => b.id === boatId) : null;
      const affected = getBookingsForRouteDate(t.routeId, t.date);
      _bkV2CharterConfirm = {
        tripIdx: idx,
        boatId,
        boatName: boat?.name || boatId,
        boatCapacity: boat?.cap || 0,
        routeId: t.routeId,
        date: t.date,
        totalCapacity: al.totalCapacity,
        currentCharterCap: al.charterCapacity,
        currentAvailable: al.availableCapacity,
        seatsConsumed,
        availAfter: Math.max(0, al.availableCapacity - (boat?.cap || 0)),
        oversold: Math.max(0, seatsConsumed - (al.availableCapacity - (boat?.cap || 0))),
        affectedBookings: affected
      };
      bookingV2Render();
      return;
    }
  }
  // No existing seats · commit immediately
  t.charterBoatId = boatId || null;
  bookingV2Render();
}
