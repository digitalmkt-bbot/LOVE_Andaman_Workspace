function bookingV2RouteFamily(routeId){
  if(typeof ROUTES === 'undefined') return null;
  const r = ROUTES.find(rr => rr.id === routeId);
  if(!r) return null;
  if(r.familyId != null) return bookingV2FamilyById(r.familyId);   // '' → null · set on purpose, don't guess over it
  return bookingV2RouteFamilyGuess(r);
}
