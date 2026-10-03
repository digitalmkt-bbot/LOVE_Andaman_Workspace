/* §lkPend · ที่นั่งที่ยัง "รอที่ว่าง" ไม่ถูกนับว่าเหลือให้ดึง (ใบลูกไม่มี pend ของตัวเอง → 0) */
function bookingV2LockRemaining(l, date){ return Math.max(0, (l.qty||0) - bookingV2LockUsedOn(l, date) - bookingV2LockPendOn(l, date)); }
