function bookingV2AreaDDOpts(kind){
  if(typeof SB_PICKUP_AREAS === 'undefined') return [];
  const zoneLbl = z => laZoneLabel(z);                    /* §rnZone */
  const grouped = { PK:[], KL:[], RN:[], NoTransfer:[] };
  SB_PICKUP_AREAS.forEach(a => { if(grouped[a.zone]) grouped[a.zone].push(a); });
  // Usage from PAST bookings (count per pickup areaId) → areas actually used before surface first
  const usage = {};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b=>{ if(b&&b.pickupAreaId) usage[b.pickupAreaId]=(usage[b.pickupAreaId]||0)+1; });
  // Pickup: filter by the trip's pickup zone · Drop-off: show ALL zones (can drop anywhere · incl. self-arrive piers)
  const zoneFilter = (kind==='dropoff') ? null : _bkV2?.newBooking?.pickupZoneFilter;
  const zones = (zoneFilter && grouped[zoneFilter]) ? [zoneFilter] : LA_PICKUP_ZONES;
  return zones.flatMap(z => (grouped[z]||[]).slice()
    .sort((a,b)=>{ const ca=usage[a.id]||0, cb=usage[b.id]||0; if(cb!==ca) return cb-ca; return String(a.name).localeCompare(String(b.name)); })   // used-most first, then A→Z
    .map(a => ({ id: a.id, zone: zoneLbl(z), name: a.name, count: usage[a.id]||0, label: `[${zoneLbl(z)}] ${a.name}` })));
}
