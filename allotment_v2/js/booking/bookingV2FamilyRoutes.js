// Routes within a family · ALL variants active in visible month (not filtered by rate type)
// Includes variants that ops sells but no agent has bound yet (Early Tratato · Early SY · Phi Phi FS · etc.)
function bookingV2FamilyRoutes(familyId){
  if(typeof ROUTES === 'undefined') return [];
  return ROUTES
    .filter(r => bookingV2RouteFamily(r.id)?.id === familyId)
    .filter(r => bookingV2RouteActiveInMonth(r.id, _bkV2.cursor))
    .map(r => ({ id: r.id, full: r.name, short: bookingV2ShortenRouteName(r.name) }));
}
