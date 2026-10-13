function bookingV2SetTripField(idx, key, val){
  if(!_bkV2.newBooking) return;
  const t = _bkV2.newBooking.trips[idx];
  if(!t) return;
  // ─── Validate · prevent picking a date when the route's program is closed ───
  if(key === 'date' && val && t.routeId && typeof ROUTES !== 'undefined' && typeof getDayStatus === 'function'){
    const route = ROUTES.find(r => r.id === t.routeId);
    if(route){
      const status = getDayStatus(route, val);
      if(status && status.type === 'closed'){
        alert('Program "' + route.name + '" is closed on ' + val + '.\nPlease pick another date or change the route.');
        bookingV2Render(); // re-render to reset the date input visual to previous value
        return;
      }
    }
  }
  // ─── Same check when route changes · existing date might now be invalid ───
  if(key === 'routeId' && val && t.date && typeof ROUTES !== 'undefined' && typeof getDayStatus === 'function'){
    const route = ROUTES.find(r => r.id === val);
    if(route){
      const status = getDayStatus(route, t.date);
      if(status && status.type === 'closed'){
        if(!confirm('Heads up · "' + route.name + '" is closed on ' + t.date + '.\nThe trip date will be cleared. Continue?')){
          bookingV2Render();
          return;
        }
        t.date = ''; // clear conflicting date
      }
    }
  }
  t[key] = val;
  // When route changes · re-resolve pickup time from new route × current area (unless user manually edited)
  if(key === 'routeId' && !t.pickupTimeEdited){
    const areaId = _bkV2.newBooking.pickupAreaId;
    t.pickupTime = (val && areaId) ? (bookingV2GetPickupTime(val, areaId, t.date) || '') : '';
  }
  // When trip zone changes · propagate to booking-level pickupZoneFilter + clear/auto-pick area
  if(key === 'zone'){
    const d = _bkV2.newBooking;
    d.pickupZoneFilter = val;
    // If current pickup area doesn't match new zone · clear it
    const curArea = d.pickupAreaId ? (typeof bookingV2GetArea === 'function' ? bookingV2GetArea(d.pickupAreaId) : null) : null;
    if(curArea && curArea.zone !== val) d.pickupAreaId = null;
    // No-Transfer auto-routing based on this trip's route
    if(val === 'NoTransfer'){
      const route = (t.routeId && typeof ROUTES !== 'undefined') ? ROUTES.find(r => r.id === t.routeId) : null;
      const targetPier = route?.pier;
      if(typeof SB_PICKUP_AREAS !== 'undefined'){
        const ntAreas = SB_PICKUP_AREAS.filter(a => a.zone === 'NoTransfer');
        let targetArea = null;
        if(targetPier === 'panwa') targetArea = ntAreas.find(a => /panwa/i.test(a.id) || /panwa/i.test(a.name));
        else if(targetPier === 'tublamu') targetArea = ntAreas.find(a => /tublamu|tub.?lamu/i.test(a.id) || /tublamu|tub.?lamu/i.test(a.name));
        if(!targetArea) targetArea = ntAreas[0];
        if(targetArea) d.pickupAreaId = targetArea.id;
      }
    }
  }
  bookingV2Render();
}
