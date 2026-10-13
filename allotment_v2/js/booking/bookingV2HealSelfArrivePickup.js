function bookingV2HealSelfArrivePickup(date){
  if(!Array.isArray(SB_BOOKINGS)) return;
  const _isClock = s => /\d{1,2}[:.]\d{2}/.test(String(s||'')) && !/pier/i.test(String(s||''));   // "07:30-07:45" ใช่ · "Before 08:30 at pier" ไม่ใช่
  let changed=false;
  SB_BOOKINGS.forEach(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
    const _area=(b.pickupAreaId && typeof bookingV2GetArea==='function')?bookingV2GetArea(b.pickupAreaId):null;
    (b.trips||[]).forEach(t=>{
      if((t.date||'')!==date) return;
      const selfArr = !bookingV2TripPrivateVan(b,t) && ((t.zone==='NoTransfer'||t.zone==='NT') || (_area && (_area.zone==='NoTransfer'||_area.zone==='NT')) || !!b.pickupSelf);
      if(!selfArr) return;
      if(_isClock(t.pickupTime)){
        const def = (typeof bookingV2GetPickupTime==='function' && b.pickupAreaId) ? (bookingV2GetPickupTime(t.routeId, b.pickupAreaId, t.date)||'') : '';
        if(t.pickupTime!==def){ t.pickupTime=def; changed=true; }
      }
      const o=b.ops; if(o && _isClock(o.pickupTimeFinal)){ o.pickupTimeFinal=''; changed=true; }
    });
  });
  if(changed && typeof acctPersistBookings==='function') acctPersistBookings();
}
