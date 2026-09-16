// Day-specific locked seats (exact date · scope==='day') · used for calendar cell badge
function bookingV2DayLockedExact(date){
  return SB_SEAT_LOCKS.filter(l => l.status==='active' && !bookingV2LockSpansDays(l) && l.date===date && !bookingV2LockReleasedForDate(l,date)).reduce((s,l)=>s+bookingV2LockPoolHold(l,date), 0);
}
