/* §natRow · แถวไทยจริงเปิดอยู่ไหม: ค่าต่างจากแถว TH อยู่แล้ว หรือกดปุ่มเปิดในการแก้ครั้งนี้ */
function bookingV2NatOpen(idx, t){
  const nb=_bkV2.newBooking; if(nb && nb._natOpen && nb._natOpen[idx]) return true;   /* อยู่กับใบที่กำลังแก้ · เปิดใบใหม่ก็หาย */
  return !!(t && bkNatHas(t) && typeof bkNatSameAsPrice==='function' && !bkNatSameAsPrice(t));
}
