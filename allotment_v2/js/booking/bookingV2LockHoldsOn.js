/* ที่นั่งของรอบนี้ยังกันอยู่ไหม · ใช้ตัวเดียวกันทุกหน้าจะได้ไม่มีวันตอบคนละอย่าง */
function bookingV2LockHoldsOn(l, tripDate){ return !bookingV2LockRoundReleased(l, tripDate); }
