/* รอบที่ถูกกดปล่อยไปแล้ว · เก็บรายวันที่ ล็อก bulk จึงปล่อยทีละรอบได้
   โดยไม่กระทบรอบอื่นและไม่ต้องไปลด qty ของทั้งใบ */
function bookingV2LockRoundReleased(l, tripDate){
  if(!l || !tripDate) return false;
  const m = l.releasedDates;
  return Array.isArray(m) ? m.indexOf(tripDate)>=0 : !!(m && m[tripDate]);
}
