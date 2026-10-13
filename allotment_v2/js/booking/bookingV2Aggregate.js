// Aggregate all bookings into per-day, per-route, per-zone structure
function bookingV2Aggregate(){
  const out = { byDate: {} };
  const ensureDay = d => {
    if(!out.byDate[d]) out.byDate[d] = {
      total:0, ad:0, chd:0, inf:0, foc:0, pk:0, kl:0, nt:0,
      hasFocPending:false, routes:{}, bookings:[], revenue:0
    };
    return out.byDate[d];
  };
  const ensureRoute = (day, rid) => {
    if(!day.routes[rid]) day.routes[rid] = {
      total:0, ad:0, chd:0, inf:0, foc:0, pk:0, kl:0, nt:0, hasFocPending:false
    };
    return day.routes[rid];
  };
  const addPax = (target, p, zone) => {
    // Handle both old (ad/chd/inf/foc) and new mixed (ad_fr+ad_th etc.) shapes
    const ad  = (p.ad||0) + (p.ad_fr||0) + (p.ad_th||0);
    const chd = (p.chd||0) + (p.chd_fr||0) + (p.chd_th||0);
    const inf = (p.inf||0) + (p.inf_fr||0) + (p.inf_th||0);
    const foc = (p.foc||0) + (p.foc_fr||0) + (p.foc_th||0);
    const tot = ad+chd+inf+foc;
    target.total += tot;
    target.ad += ad; target.chd += chd; target.inf += inf; target.foc += foc;
    target[zone.toLowerCase()] += tot;
  };

  SB_BOOKINGS.forEach(bk => {
    if(['cancelled','cancelled_weather','rejected'].includes(bk.status)) return;   // don't count cancelled/rejected pax in the calendar chips (matches By-trip / seat calc)
    if(bk.schemaVer === 2 && Array.isArray(bk.trips)){
      const zone = bookingV2InferZone(bk);
      const focPending = bk.focApproval?.status === 'pending';
      bk.trips.forEach(trip => {
        if(!trip.date) return;
        { const _isLand = typeof laIsLandRoute==='function' && laIsLandRoute(trip.routeId); if(_isLand !== _bkV2CityTourOnly) return; }   // §cityTourView · marine page (flag off) excludes land · land page (flag on) excludes marine
        const day = ensureDay(trip.date);
        const rt = ensureRoute(day, trip.routeId);
        const p = trip.pax || {};
        const focTot = (p.foc||0) + (p.foc_fr||0) + (p.foc_th||0);
        addPax(day, p, zone);
        addPax(rt, p, zone);
        day.revenue += ((bk.trips||[]).length<=1 ? (typeof bk.total==='number'?bk.total:(trip.subtotal||0)) : (trip.subtotal||0));   // single-trip → adjustment-inclusive total
        if(focTot > 0 && focPending){ day.hasFocPending = true; rt.hasFocPending = true; }
        if(!day.bookings.includes(bk.id)) day.bookings.push(bk.id);
      });
    } else if(bk.schemaVer !== 2 && bk.travelDate){
      { const _isLand = typeof laIsLandRoute==='function' && laIsLandRoute(bk.programId); if(_isLand !== _bkV2CityTourOnly) return; }   // §cityTourView · marine page (flag off) excludes land · land page (flag on) excludes marine
      // Legacy v1 — adapt pax shape
      const day = ensureDay(bk.travelDate);
      const rt = ensureRoute(day, bk.programId);
      const p = bk.pax || {};
      const compat = { ad: p.adult||0, chd: p.child||0, inf: p.infant||0, foc: 0 };
      const tr = (bk.transfer||'NoTransfer').toLowerCase();
      const zone = tr === 'pk' ? 'PK' : tr === 'kl' ? 'KL' : 'NT';
      addPax(day, compat, zone);
      addPax(rt, compat, zone);
      day.revenue += (bk.total||0);
      if(!day.bookings.includes(bk.id)) day.bookings.push(bk.id);
    }
  });
  return out;
}
