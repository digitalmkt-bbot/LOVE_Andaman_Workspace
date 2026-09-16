function bookingV2RouteShort(id){
  const known = bookingV2Routes().find(r => r.id === id);
  if(known) return known.short;
  const r = (typeof ROUTES !== 'undefined') ? ROUTES.find(rr => rr.id === id) : null;
  return r ? bookingV2ShortenRouteName(r.name) : id;
}
