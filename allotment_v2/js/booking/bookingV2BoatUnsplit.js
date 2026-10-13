function bookingV2BoatUnsplit(bkId, date){
  const b=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).find(x=>x.id===bkId); if(!b) return;
  const o=(typeof bkOpsFor==='function')?bkOpsFor(b,bkOpsDate(b,date)):(b.ops||{});
  if(!Array.isArray(o.boatSplits)||!o.boatSplits.length) return;
  const tot=o.boatSplits.reduce((s,x)=>s+bkPaxSum(bkSplitPax(x)),0);
  const first=o.boatSplits[0]||{};
  const nm=(typeof pckBoatName==='function')?pckBoatName(first.boatId):first.boatId;
  if(!confirm('รวมกลับเป็นลำเดียว — คนทั้ง '+tot+' คนจะไปอยู่ '+nm+' ลำเดียว\nถ้าเกินความจุจะขึ้นเตือนที่หน้าจัดเรือ · ยืนยันไหม')) return;
  o.boatId=first.boatId||null;
  delete o.boatSplits;
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  if(typeof bookingV2Render==='function') bookingV2Render();
  if(typeof renderCheckinAll==='function') renderCheckinAll();   // §landCk · สองหน้า
}
