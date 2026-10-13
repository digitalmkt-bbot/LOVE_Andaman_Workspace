// Family active on a specific date (any sub-route open)
function bookingV2IsFamilyOpenOn(familyId, dateStr){
  return bookingV2FamilyRoutes(familyId).some(r => bookingV2IsRouteOpenOn(r.id, dateStr));
}
