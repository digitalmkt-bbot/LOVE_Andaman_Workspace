// Is route open on a specific date? (consults Programs · seasons + overrides)
function bookingV2IsRouteOpenOn(routeId, dateStr){
  if(typeof ROUTES === 'undefined') return true;
  const r = ROUTES.find(rr => rr.id === routeId);
  if(!r) return true;
  if(typeof getDayStatus !== 'function') return true;
  const s = getDayStatus(r, dateStr);
  if(!s) return true;  // no season defined → assume open
  return s.type === 'open';
}
