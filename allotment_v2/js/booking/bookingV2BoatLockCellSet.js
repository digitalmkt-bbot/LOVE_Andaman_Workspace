/* ══ ช่องบนกระดานเรือ · ผลพลอยได้ของใบล็อก ไม่ใช่ต้นทางความจริง ═══════════════
   ใช้ทางเดียวกับใบเหมาลำ (type='charter') เพื่อให้ 10 จุดที่เช็ค "ลำนี้ไม่ขายที่นั่ง"
   อยู่แล้วทำงานทันที · ต่างกันที่ไม่มี charterBookingId แต่มี boatLockId ชี้กลับมาที่ใบ  */
function bookingV2BoatLockCellSet(l){
  if(!l || !l.boatId || !l.date || typeof TRIPS==='undefined') return false;
  TRIPS[l.date] = TRIPS[l.date] || {};
  if(!TRIPS[l.date][l.boatId]) TRIPS[l.date][l.boatId] = { route:l.routeId, type:'normal', booked:0 };
  const op = TRIPS[l.date][l.boatId];
  if(op.charterBookingId) return false;          /* เหมาลำจริงอยู่ก่อน · ไม่แย่ง */
  op.route = l.routeId;
  op.type  = 'charter';
  op.booked = 0;                                  /* ยังไม่มีหัว · เลขเดิมจะถูกนับเป็น pax เหมาลำ */
  op.boatLockId = l.id;
  return true;
}
