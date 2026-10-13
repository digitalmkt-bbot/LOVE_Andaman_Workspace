/* ใบที่กำลังจับลำนี้ของวันนี้อยู่ · ใช้ตอนวาดช่องบนกระดานเรือ */
function bookingV2BoatLockOn(date, boatId){ return bookingV2BoatLocksOn(date).find(l=>l.boatId===boatId)||null; }
