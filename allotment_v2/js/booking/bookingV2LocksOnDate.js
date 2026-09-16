// ล็อกทุกเส้นทางที่มีผลกับวันนั้น (ไม่กรองด้วยเวลาปล่อยคืน · จะได้เห็นว่าอันไหนปล่อยไปแล้ว)
function bookingV2LocksOnDate(ds){
  return SB_SEAT_LOCKS.filter(l=>{
    if(l.parentId || l.status!=='active') return false;
    if(bookingV2LockSpansDays(l)){
      const rg=bookingV2LockRange(l);
      return !!(rg.from && ds>=rg.from && ds<=rg.to && bookingV2LockDowOk(l,ds));
    }
    return l.date===ds;
  });
}
