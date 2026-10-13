// จำนวนที่ดึงไปแล้วของ "รอบนั้น" · ล็อกรายวันใช้ตัวนับเดียวเหมือนเดิม
function bookingV2LockUsedOn(l, date){
  if(!l) return 0;
  if(date && bookingV2LockSpansDays(l)) return Number((l.usedBy||{})[date])||0;
  return Number(l.used)||0;
}
