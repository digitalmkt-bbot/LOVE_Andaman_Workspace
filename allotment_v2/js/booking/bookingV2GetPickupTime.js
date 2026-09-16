function bookingV2GetPickupTime(routeId, areaId, dateStr){
  const area = bookingV2GetArea(areaId);
  if(!area || !routeId) return null;
  // 1. Try profile · look up by areaId (preferred · new schema)
  const prof = psuResolveProfile(dateStr);
  if(prof?.times?.[routeId]){
    if(prof.times[routeId][areaId]) return prof.times[routeId][areaId];
    // Backward compat: legacy timeGroup fallback if area isn't keyed directly
    if(area.timeGroup && prof.times[routeId][area.timeGroup]) return prof.times[routeId][area.timeGroup];
  }
  // 2. Legacy flat SB_PICKUP_TIMES (timeGroup-keyed)
  if(area.timeGroup && SB_PICKUP_TIMES?.[routeId]?.[area.timeGroup]) return SB_PICKUP_TIMES[routeId][area.timeGroup];
  return null;
}
