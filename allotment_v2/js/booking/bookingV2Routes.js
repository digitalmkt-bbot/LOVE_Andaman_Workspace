function bookingV2Routes(){
  // Collect routeIds referenced by active Rate Types + any booking trip
  const ids = new Set();
  if(typeof SB_RATE_TYPES !== 'undefined' && Array.isArray(SB_RATE_TYPES)){
    SB_RATE_TYPES.forEach(rt => {
      if(rt.active !== false && Array.isArray(rt.routes)) rt.routes.forEach(rid => ids.add(rid));
    });
  }
  SB_BOOKINGS.forEach(bk => {
    if(bk.schemaVer === 2 && Array.isArray(bk.trips)){
      bk.trips.forEach(t => t.routeId && ids.add(t.routeId));
    } else if(bk.programId){
      ids.add(bk.programId);
    }
  });
  // §b2cNoRateVisible · a route created via /api/b2c/routes carries extId (b2c-catalog.js record.extId)
  // — that alone marks it as a B2C-origin product, so it shows on the calendar even with no ops rate
  // type attached (B2C prices its own orders and never needs one — see that file's §Pricing comment).
  // A staff-made route from Config has no extId and still needs a rate type or a booking to appear.
  if(typeof ROUTES !== 'undefined' && Array.isArray(ROUTES)){
    ROUTES.forEach(r => { if(r.extId) ids.add(r.id); });
  }
  // Map to {id, short, full} via ROUTES (source of truth)
  if(typeof ROUTES === 'undefined') return [];
  const out = [];
  ids.forEach(id => {
    const r = ROUTES.find(rr => rr.id === id);
    if(!r) return;
    out.push({ id, full: r.name, short: bookingV2ShortenRouteName(r.name) });
  });
  // Preserve ROUTES original order
  out.sort((a,b) => ROUTES.findIndex(r=>r.id===a.id) - ROUTES.findIndex(r=>r.id===b.id));
  // ★ Filter to routes that have ≥1 open day in the visible month (per Programs seasons)
  return out.filter(r => bookingV2RouteActiveInMonth(r.id, _bkV2.cursor));
}
