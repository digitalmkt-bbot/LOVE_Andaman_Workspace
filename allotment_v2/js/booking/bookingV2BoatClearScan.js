/* ══ §btBoatClear (2026-10-23) · owner "By trip date การจัดเรือ ตอนถอดเรือ ถอดออกทีละลำ สามารถถอดออกทีเดียวทั้งลำได้ไหม"
   เดิมถอดได้ทีละใบ (× ในตัวเลือกเรือ) · ปุ่ม "ถอดทั้งลำ" บนการ์ดเรือในโหมดเรือ ถอดเรือลำนั้นออกจากทุกใบของรอบนี้ (วัน + โปรแกรม) ในครั้งเดียว
   ทำแบบเดียวกับถอดทีละใบ (ops.boatId = null ของวันนั้น) · ใบที่แยกลงหลายลำ (§boatSplit) ไม่แตะ แจ้งให้ไปแก้ทีละใบ
   (ก้อนที่ไม่มีเรือไม่มีในโครงของ split · ถอดก้อนเดียวคนจะหาย) · ถามยืนยันก่อน · ตำแหน่งเลื่อนอยู่ที่เดิม */
function bookingV2BoatClearScan(boatId, date, rid){
  const one=[], split=[]; let pax=0;
  (SB_BOOKINGS||[]).forEach(b=>{
    if(!b || ['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
    if(!(b.trips||[]).some(t=>t && t.date===date && t.routeId===rid)) return;
    const sp=(typeof bkBoatSplits==='function')?bkBoatSplits(b,date):null;
    if(sp){ if(sp.some(x=>x && x.boatId===boatId)) split.push(b); return; }
    if((bkOpsRead(b,date)||{}).boatId!==boatId) return;
    one.push(b); pax+=(typeof bkBoatPaxOnBoat==='function')?bkBoatPaxOnBoat(b,date,boatId):0;
  });
  return {one, split, pax};
}
