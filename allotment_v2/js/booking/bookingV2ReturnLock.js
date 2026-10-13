/* ══ §lkReturn · คืนที่นั่งเข้าล็อก ═══════════════════════════════════════════════
   เดิมมีแต่ทางไป ไม่มีทางกลับ · used บวกอย่างเดียวตลอดชีวิตของล็อก
   แก้ใบจองที่เคยดึงล็อก = ดึงซ้ำอีกรอบ · ยกเลิกใบจอง = ที่นั่งหายไปเลยไม่มีใครได้คืน
   ═══════════════════════════════════════════════════════════════════════════════ */
function bookingV2ReturnLock(lockId, qty, bookingId, tripDate, why){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId); if(!l) return 0;
  const n = Math.min(Math.max(0, qty|0), Number(l.used)||0); if(n<=0) return 0;
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  l.used = (Number(l.used)||0) - n;
  if(bookingV2LockSpansDays(l) && tripDate && l.usedBy){
    const v = Math.max(0, (Number(l.usedBy[tripDate])||0) - n);
    if(v) l.usedBy[tripDate] = v; else delete l.usedBy[tripDate];
  }
  (l.log=l.log||[]).push({date:today, at:new Date().toISOString(), type:'return', qty:n,
                          bookingId:bookingId||'', tripDate:tripDate||'', note:String(why||''), by:laBy()});
  if(l.status==='depleted' && bookingV2LockDrawable(l, tripDate) > 0) l.status='active';   // มีที่ว่างแล้วกลับมาใช้ได้
  sbSeatLocksPersist(); return n;
}
