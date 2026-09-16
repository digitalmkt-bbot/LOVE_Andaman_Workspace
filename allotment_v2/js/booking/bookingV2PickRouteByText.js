function bookingV2PickRouteByText(idx, txt){
  if(!_bkV2.newBooking) return;
  const t = _bkV2.newBooking.trips[idx];
  if(!t) return;
  const trimmed = String(txt||'').trim();
  if(!trimmed){ t.routeId = ''; bookingV2Render(); return; }
  const norm = trimmed.toLowerCase();
  // Resolve allowed routes via the same logic as the dropdown (contract programs first · rate type fallback)
  const covered = bookingV2RouteDDOpts().map(o => (typeof ROUTES !== 'undefined' ? ROUTES.find(r => r.id === o.id) : null)).filter(Boolean);
  const r = covered.find(x => (x.name||'').toLowerCase() === norm || x.id === trimmed);
  if(r){
    t.routeId = r.id;
    // §3 · default the trip date to the next day this route ACTUALLY runs (skip closed/off-season days)
    if(t.date && typeof bookingV2IsRouteOpenOn==='function' && !bookingV2IsRouteOpenOn(r.id, t.date)){
      const nd = bookingV2NextOpenDate(r.id, t.date);
      if(nd && nd !== t.date){ t.date = nd; t.pickupTimeEdited = false; }
    }
    bookingV2Render();
  }
}
