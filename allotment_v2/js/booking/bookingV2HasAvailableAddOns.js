// True if the current rate type offers any add-ons applicable to the trips
function bookingV2HasAvailableAddOns(){
  const d = _bkV2.newBooking;
  const rt = bookingV2GetRT();
  if(!rt) return false;
  const tripRoutes = d.trips.map(t => t.routeId).filter(Boolean);
  if(tripRoutes.length === 0) return false;
  // Longtail · only if at least one trip route is in applies[] (or applies undefined = legacy)
  const lt = rt.addOns?.longtail;
  if(lt){
    const ltn = (typeof _rtNormalizeLongtail==='function') ? _rtNormalizeLongtail(lt) : null;
    if(ltn){
      const ids = ltn.applies.length ? tripRoutes.filter(r=>ltn.applies.includes(r)) : tripRoutes;
      const ok = ids.some(r=>{ const e=ltn.byRoute[r]||{join:ltn.join,charter:ltn.charter}; return (e.join&&(e.join.adult||e.join.child))||(e.charter&&e.charter.price); });
      if(ok) return true;
    }
  }
  // Private transfer · check if any trip route has matching zone+vehicle
  const ptMap = rt.addOns?.privateTransfer || {};
  return d.trips.some(t => {
    if(!t.routeId || !t.zone || t.zone === 'NoTransfer') return false;
    const zoneOpts = ptMap[t.routeId]?.[t.zone];
    return zoneOpts && Object.values(zoneOpts).some(v => v);
  });
}
