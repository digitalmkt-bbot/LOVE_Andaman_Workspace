// Total applicable locked seats on a date (day-locks + any month-range pool covering it) · skips locks past their per-date release cutoff
function bookingV2DayLockedTotal(date){
  return SB_SEAT_LOCKS.filter(l => l.status==='active' && !bookingV2LockReleasedForDate(l,date) && (
    bookingV2LockSpansDays(l)
      ? (function(){ const rg=bookingV2LockRange(l); return rg.from && date>=rg.from && date<=rg.to && bookingV2LockDowOk(l,date); })()
      : l.date===date
  )).reduce((s,l)=>s+bookingV2LockPoolHold(l,date), 0);
}
