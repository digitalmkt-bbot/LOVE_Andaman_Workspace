/* แก้ตัวนับให้ตรงกับใบจองที่ยังอ้างถึงจริง · ไม่แตะ qty ที่นั่งที่กันไว้ยังเท่าเดิม */
function bookingV2LockFixUsed(lockId, silent){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId); if(!l) return 0;
  const A = bookingV2LockAudit(l); if(A.diff===0) return 0;
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  const before = A.used;
  l.used = A.live;
  if(bookingV2LockSpansDays(l)){
    const m = {}; A.claims.filter(c=>!c.dead).forEach(c => { if(c.date) m[c.date]=(m[c.date]||0)+c.qty; });
    l.usedBy = m;
  }
  (l.log=l.log||[]).push({date:today, at:new Date().toISOString(), type:'reconcile',
    qty:(before-A.live), note:'used '+before+' → '+A.live+' \u0e15\u0e32\u0e21\u0e43\u0e1a\u0e08\u0e2d\u0e07\u0e17\u0e35\u0e48\u0e2d\u0e49\u0e32\u0e07\u0e16\u0e36\u0e07\u0e08\u0e23\u0e34\u0e07', by:laBy()});
  if(l.status==='depleted' && bookingV2LockDrawable(l) > 0) l.status='active';
  if(!silent) sbSeatLocksPersist();
  return before - A.live;
}
