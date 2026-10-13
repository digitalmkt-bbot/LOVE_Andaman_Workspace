function bookingV2PickPickupAreaByText(txt){
  if(!_bkV2.newBooking) return;
  const trimmed = String(txt||'').trim();
  if(!trimmed){ bookingV2SetPickupArea(null); return; }
  const norm = trimmed.toLowerCase();
  const area = (SB_PICKUP_AREAS||[]).find(a => {
    const zoneLab = laZoneLabel(a.zone);                   /* §rnZone */
    return `[${zoneLab}] ${a.name}`.toLowerCase() === norm || (a.name||'').toLowerCase() === norm;
  });
  if(area) bookingV2SetPickupArea(area.id);
}
