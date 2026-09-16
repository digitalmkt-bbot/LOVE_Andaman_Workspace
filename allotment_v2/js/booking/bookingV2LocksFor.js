// Active locks on a trip · day-scope match exact date · month-scope match the month · skip locks past their per-date release cutoff
function bookingV2LocksFor(routeId, date){
  return SB_SEAT_LOCKS.filter(l => {
    if(l.routeId!==routeId || l.status!=='active') return false;
    // §lkBulk · ล็อกที่กินหลายวัน · เทียบวันที่จริง + วันในสัปดาห์ที่ติ๊กไว้
    if(bookingV2LockSpansDays(l)){
      const rg = bookingV2LockRange(l);
      if(!(rg.from && date >= rg.from && date <= rg.to)) return false;
      if(!bookingV2LockDowOk(l, date)) return false;
    } else if(l.date!==date){ return false; }
    if(bookingV2LockReleasedForDate(l, date)) return false;   // rolling cutoff passed → seats freed for THIS trip
    return true;
  });
}
