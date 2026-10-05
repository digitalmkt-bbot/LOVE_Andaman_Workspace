function bookingV2GetRTForTrip(trip){
  const base = bookingV2GetRT();
  if(!trip || !trip.routeId || !trip.date) return base;
  const d = _bkV2.newBooking; if(!d || !d.agentId) return base;
  /* §rtSeason · ฐานราคาของทริปนี้ ตามฤดูของ "วันเดินทาง" ไม่ใช่ฤดูของทั้งใบ
     ใบเดียวข้ามฤดูได้จริง — ใบเหมาค้างเกาะที่ออก 14 กลับ 15 ต.ค. คือเคสนั้นเป๊ะ
     ไม่ได้ตั้งตารางฤดูกาล = ได้ base ตัวเดิมกลับมา ไม่มีอะไรเปลี่ยน */
  /* §rtKeep · ใบที่กำลังแก้ และทริปนี้ยังเป็นเส้นทาง+วันเดิม = ยึดชุดราคาเดิมของทริป */
  const kept = bookingV2RtKeptFor(trip);
  const seas = kept ? null : ((typeof laMainRtFor === 'function') ? laMainRtFor(d.agentId, trip.date) : null);
  const B = kept || seas || base;
  /* §b2bPromo · ทางเข้าเดียว · รองรับทั้งใบโปรที่ดึงจาก Rate Type และใบที่กรอกราคาเอง
     วันจองส่งเข้าไปด้วย · ใบที่ไม่ได้ตั้งช่วงวันจองไว้จะไม่สนใจค่านี้ (laPromoCovers) */
  const hit = laPromoRateFor(d.agentId, bookingV2PrRoute(trip), trip.date,
                             d.bookingDate || (typeof TODAY_STR!=='undefined'?TODAY_STR:''), B);
  if(!hit) return B;
  if(hit.rt && hit.rt.id === (B && B.id)) return B;         /* โปรชี้กลับไปชุดเดิม = ไม่ต้องสลับ */
  return hit.rt || B;
}
