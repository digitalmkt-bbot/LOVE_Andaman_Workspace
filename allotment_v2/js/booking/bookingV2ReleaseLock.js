// Release seats back to pool · qty omitted = release all remaining · partial keeps lock active
function bookingV2ReleaseLock(lockId, qty){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId); if(!l) return;
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  // parent releases only its UNALLOCATED remainder (seats sitting in sub-groups are released from the child); child releases its own remainder
  // §lkBulk · ล็อกแบบช่วงลดได้ไม่ต่ำกว่ารอบที่ขายไปมากที่สุด (ไม่งั้นบางรอบจะติดลบ)
  const peak = bookingV2LockPeakUsed(l);
  const rem = bookingV2LockReleasable(l);   /* §lkSubDay */
  const n = (qty==null) ? rem : Math.min(Math.max(0, qty|0), rem);
  if(n <= 0) return;
  const floor = l.parentId ? peak : bookingV2LockParentFloor(l);   // never drop below used, and (parent) never below what's allocated to children on the busiest day
  l.qty = Math.max(floor, (l.qty||0) - n);
  bookingV2LockPendShrink(l, n);   /* §lkPend · ลดจำนวน = ตัดส่วนที่รออยู่ออกก่อน */
  (l.log=l.log||[]).push({date:today, at:new Date().toISOString(), type:'release', qty:n, by:(typeof laBy==='function')?laBy():''});   /* §lkUndo · at/by ไว้โชว์ในประวัติ */
  /* §lkSubDay · ใบที่ครอบหลายวัน ตัดสินจากยอดสะสมไม่ได้ (วัน 19 เต็มไม่ได้แปลว่าวัน 21 เต็ม) · ปิดเมื่อไม่เหลือที่นั่งเลยเท่านั้น */
  if(bookingV2LockSpansDays(l)){ if((l.qty||0)<=0 && (l.parentId || !bookingV2LockChildren(l.id).length)) l.status = (l.used>0) ? 'depleted' : 'released'; }
  else if(bookingV2LockDrawable(l) <= 0 && bookingV2LockPendOn(l, l.date) <= 0 && (l.parentId || !bookingV2LockChildren(l.id).length)) l.status = (l.used>0) ? 'depleted' : 'released';
  sbSeatLocksPersist();
}
