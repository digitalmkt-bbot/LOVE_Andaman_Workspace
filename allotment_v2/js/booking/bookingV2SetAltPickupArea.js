function bookingV2SetAltPickupArea(i, areaId){
  // pick pickup area → zone auto-derives from the area · re-render to show the auto zone chip
  if(!_bkV2.newBooking || !Array.isArray(_bkV2.newBooking.altPickups)) return;
  const a = _bkV2.newBooking.altPickups[i]; if(!a) return;
  a.areaId = areaId || '';
  const ar = (areaId && typeof bookingV2GetArea==='function') ? bookingV2GetArea(areaId) : null;
  a.zone = ar ? ar.zone : '';
  bookingV2Render();
}
