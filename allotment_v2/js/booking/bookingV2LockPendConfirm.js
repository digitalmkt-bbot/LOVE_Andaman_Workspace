/* กดยืนยัน · ดันส่วนที่รออยู่เข้าเป็นล็อกจริงเท่าที่ที่ว่างมี · ไม่มีการดันเองโดยไม่มีคนกด */
function bookingV2LockPendConfirm(lockId, date, want){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId); if(!l) return {ok:false, why:'gone'};
  const p = bookingV2LockPendOn(l, date); if(p<=0) return {ok:false, why:'none'};
  const free = bookingV2LockFreeOn(l.routeId, date, null);
  const can = (free==null) ? p : Math.min(p, free);
  const n = Math.min(can, (Number(want)>0) ? Number(want) : can);
  if(n<=0) return {ok:false, why:'full', free:0, pend:p};
  bookingV2LockPendSet(l, date, p-n);
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  (l.log=l.log||[]).push({ date:today, at:new Date().toISOString(), type:'pend-confirm', qty:n, tripDate:date, by:laBy() });
  sbSeatLocksPersist();
  return {ok:true, n:n, left:p-n};
}
