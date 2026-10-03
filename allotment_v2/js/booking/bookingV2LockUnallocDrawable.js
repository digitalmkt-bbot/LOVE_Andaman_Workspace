/* §lkPend · ดึงได้ไม่เกินที่นั่งที่กันไว้จริงของรอบนั้น · ส่วนที่รอที่ว่างยังไม่ใช่ที่นั่ง */
function bookingV2LockUnallocDrawable(parent, date){
  if(bookingV2LockPendOn(parent, date) > 0) return bookingV2LockSubShares(parent, date).un.held;   /* §lkPendSub */
  return Math.max(0, Math.min(bookingV2LockUnalloc(parent) - bookingV2LockUsedOn(parent, date), bookingV2LockHeldRemaining(parent, date)));
}
