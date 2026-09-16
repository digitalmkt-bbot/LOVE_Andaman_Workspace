function bookingV2RouteDDOpts(){
  if(typeof ROUTES === 'undefined') return [];
  return bookingV2BookableRoutes().ids
    .map(rid => ROUTES.find(r => r.id === rid)).filter(Boolean)
    .filter(r => (typeof laIsLandRoute!=='function') || (laIsLandRoute(r.id)===_bkV2CityTourOnly))   // §cityTourView · marine page offers marine routes only · land page offers land routes only
    .map(r => ({ id: r.id, label: r.name, pier: bookingV2PierTag(r.pier) }));
}
