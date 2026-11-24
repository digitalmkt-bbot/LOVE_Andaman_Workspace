/* ที่ยังแบ่งลงกรุ๊ปย่อยได้ · นับจากจำนวนที่ขอ ไม่ใช่จากที่กันไว้จริง (หักที่ใบแม่ขายเองไปแล้ว · §lkOver) */
function bookingV2LockSubRoom(p, date){
  /* §lkSubDay · Bulk คิดรายวัน · ไม่ระบุวัน = วันที่ยังแบ่งได้มากที่สุด (ไว้ตัดสินว่าจะโชว์ปุ่ม + ย่อย ไหม) */
  if(bookingV2LockSpansDays(p)){
    if(date) return bookingV2LockRoundReleased(p, date) ? 0 : Math.max(0, bookingV2LockUnalloc(p, date) - bookingV2LockUsedOn(p, date));
    let mx=0; bookingV2LockSpecDates(p).forEach(d=>{ const v=bookingV2LockSubRoom(p, d); if(v>mx) mx=v; }); return mx;
  }
  return Math.max(0, bookingV2LockUnalloc(p) - bookingV2LockUsedOn(p));
}
