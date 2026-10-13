/* §lkNoAuto · เลยกำหนดแล้วไม่ปล่อยเอง · แต่ของเรือทั้งลำต้องเห็นชัดกว่าที่นั่ง */
function bookingV2BoatLockOverdue(l, today){
  const t = today || ((typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10));
  return !!(l && l.status==='active' && l.expiry && l.expiry < t);
}
