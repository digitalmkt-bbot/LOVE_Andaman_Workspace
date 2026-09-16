// Release seats back to pool · qty omitted = release all remaining · partial keeps lock active
function bookingV2ReleaseLock(lockId, qty){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId); if(!l) return;
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  // parent releases only its UNALLOCATED remainder (seats sitting in sub-groups are released from the child); child releases its own remainder
  // §lkBulk · ล็อกแบบช่วงลดได้ไม่ต่ำกว่ารอบที่ขายไปมากที่สุด (ไม่งั้นบางรอบจะติดลบ)
  const peak = bookingV2LockPeakUsed(l);
  const rem = Math.max(0, (l.parentId ? (l.qty||0) : bookingV2LockUnalloc(l)) - peak);
  const n = (qty==null) ? rem : Math.min(Math.max(0, qty|0), rem);
  if(n <= 0) return;
  const floor = l.parentId ? peak : Math.max(peak, bookingV2LockAllocated(l));   // never drop below used, and (parent) never below what's allocated to children
  l.qty = Math.max(floor, (l.qty||0) - n);
  (l.log=l.log||[]).push({date:today, type:'release', qty:n});
  if(bookingV2LockDrawable(l) <= 0 && (l.parentId || !bookingV2LockChildren(l.id).length)) l.status = (l.used>0) ? 'depleted' : 'released';
  sbSeatLocksPersist();
}
