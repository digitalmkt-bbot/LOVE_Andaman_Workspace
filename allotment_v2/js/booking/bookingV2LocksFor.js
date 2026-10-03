// Active locks on a trip · day-scope match exact date · month-scope match the month · skip locks past their per-date release cutoff
function bookingV2LocksFor(routeId, date){
  return SB_SEAT_LOCKS.filter(l => {
    /* §bkLock · ใบชนิดเรือทั้งลำไม่กันที่นั่งจากพูล · มันเอาเรือออกจากพูลไปแล้ว
       ถ้าปล่อยให้หลุดเข้ามา qty ของมันจะถูกหักจากที่นั่งซ้ำอีกรอบ (ดูเทส nodouble) */
    if(bookingV2IsBoatLock(l)) return false;
    if(l.routeId!==routeId || l.status!=='active') return false;
    // §lkBulk · ล็อกที่กินหลายวัน · เทียบวันที่จริง + วันในสัปดาห์ที่ติ๊กไว้
    if(bookingV2LockSpansDays(l)){
      const rg = bookingV2LockRange(l);
      if(!(rg.from && date >= rg.from && date <= rg.to)) return false;
      if(!bookingV2LockDowOk(l, date)) return false;
    } else if(l.date!==date){ return false; }
    /* §lkNoAuto · เลยกำหนดปล่อยไม่ตัดทิ้งแล้ว · ตัดเฉพาะรอบที่มีคนกดปล่อยจริง */
    if(bookingV2LockRoundReleased(l, date)) return false;
    return true;
  });
}
