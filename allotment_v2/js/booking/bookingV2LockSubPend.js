/* ส่วนที่รอที่ว่างของกรุ๊ปย่อยหนึ่งกรุ๊ป · 0 ถ้าใบแม่ไม่มีอะไรรออยู่ */
function bookingV2LockSubPend(c, date){
  if(!c || !c.parentId) return 0;
  const p = SB_SEAT_LOCKS.find(x=>x.id===c.parentId);
  if(!p || bookingV2LockPendOn(p, date) <= 0) return 0;
  const sh = bookingV2LockSubShares(p, date).by[c.id];
  return sh ? sh.pend : 0;
}
