/* ชื่อเดิม · เหลือไว้ให้ที่เรียกอยู่ไม่พัง · ความหมายใหม่คือ "ปล่อยไปแล้วจริง ๆ"
   ซึ่งตอนนี้เกิดจากการกดเท่านั้น ไม่ได้เกิดเองจากเวลา */
function bookingV2LockReleasedForDate(l, tripDate){ return bookingV2LockRoundReleased(l, tripDate); }
