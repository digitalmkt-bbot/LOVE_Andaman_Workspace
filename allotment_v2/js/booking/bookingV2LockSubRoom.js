/* ที่ยังแบ่งลงกรุ๊ปย่อยได้ · นับจากจำนวนที่ขอ ไม่ใช่จากที่กันไว้จริง (หักที่ใบแม่ขายเองไปแล้ว · §lkOver) */
function bookingV2LockSubRoom(p){ return Math.max(0, bookingV2LockUnalloc(p) - bookingV2LockUsedOn(p)); }
