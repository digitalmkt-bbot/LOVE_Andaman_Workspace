function bookingV2LockHeldRemaining(l, date){
  // §lkBulkFix · ล็อกแบบช่วงที่ไม่ได้ระบุรอบ → ตอบเป็นที่นั่งต่อรอบ ไม่ใช่ qty ลบยอดสะสม
  if(!date && bookingV2LockSpansDays(l)) return Math.max(0, l.qty||0);
  return Math.max(0, (l.qty||0) - bookingV2LockUsedTotal(l, date));
}
