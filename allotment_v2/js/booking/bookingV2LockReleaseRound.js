/* กดปล่อยที่นั่งของรอบหนึ่ง · ไม่แตะ qty ของทั้งใบ รอบอื่นยังเต็มเหมือนเดิม */
function bookingV2LockReleaseRound(lockId, tripDate, by){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId);
  if(!l || !tripDate || bookingV2LockRoundReleased(l, tripDate)) return 0;
  const seats = (typeof bookingV2LockPoolHold==='function') ? bookingV2LockPoolHold(l, tripDate) : 0;
  if(!Array.isArray(l.releasedDates)) l.releasedDates = [];
  if(bookingV2LockPendOn(l, tripDate) > 0) bookingV2LockPendSet(l, tripDate, 0);   /* §lkPend · ปล่อยรอบนี้แล้ว คำขอที่รออยู่ของรอบนี้จบไปด้วย */
  l.releasedDates.push(tripDate);
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  (l.log = l.log||[]).push({ date:today, at:new Date().toISOString(), type:'release-round',
                             tripDate:tripDate, qty:seats, by:(by || ((typeof laBy==='function')?laBy():'')) });
  sbSeatLocksPersist();
  return seats;
}
