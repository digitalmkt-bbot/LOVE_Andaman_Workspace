function bookingV2LockDrawable(l, date){
  if(!l.parentId) return bookingV2LockUnallocDrawable(l, date);
  const p = SB_SEAT_LOCKS.find(x=>x.id===l.parentId);
  if(!p) return bookingV2LockRemaining(l, date);
  if(bookingV2LockPendOn(p, date) > 0){ const sh = bookingV2LockSubShares(p, date).by[l.id]; return sh ? sh.held : 0; }   /* §lkPendSub */
  return Math.min(bookingV2LockRemaining(l, date), bookingV2LockHeldRemaining(p, date));
}
