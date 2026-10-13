function bookingV2PickDropoffAreaByText(txt){
  if(!_bkV2.newBooking) return;
  const trimmed = String(txt||'').trim();
  if(!trimmed){ bookingV2SetDropoffArea(null); return; }
  const norm = trimmed.toLowerCase();
  const area = (SB_PICKUP_AREAS||[]).find(a => {
    const zoneLab = laZoneLabel(a.zone);                   /* §rnZone */
    return `[${zoneLab}] ${a.name}`.toLowerCase() === norm || (a.name||'').toLowerCase() === norm;
  });
  if(area) bookingV2SetDropoffArea(area.id);
}
