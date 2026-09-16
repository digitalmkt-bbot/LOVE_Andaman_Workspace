// ── Helpers ──
function bookingV2GetArea(areaId){
  return (SB_PICKUP_AREAS||[]).find(a => a.id === areaId);
}
