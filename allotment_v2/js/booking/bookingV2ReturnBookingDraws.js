/* คืนทุกที่นั่งที่ใบจองนี้เคยดึงไว้ · ใช้ตอนแก้ใบจอง (คืนก่อนดึงใหม่) และตอนยกเลิก */
function bookingV2ReturnBookingDraws(bk, why){
  if(!bk || !Array.isArray(bk.trips)) return 0;
  let n = 0;
  bk.trips.forEach(t => { (t.lockDraws||[]).forEach(x => {
    n += bookingV2ReturnLock(x.lockId, x.qty, bk.id, t.date, why); }); });
  return n;
}
