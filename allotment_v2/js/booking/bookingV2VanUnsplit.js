function bookingV2VanUnsplit(bkId, date){
  const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return;
  const o=bkOpsFor(b, bkOpsDate(b,date)); if(!Array.isArray(o.vanSplits)) return;   /* §per-trip ops · รวมเฉพาะวันที่กำลังดูอยู่ */
  const first=o.vanSplits[0]||{}; o.vanGroup=+first.vanGroup||0; o.vanId=first.vanId||null; o.vanReturnId=first.vanReturnId||null;
  delete o.vanSplits; delete o.altSplitAuto;
  acctPersistBookings(); if(typeof bookingV2Render==='function') bookingV2Render();
}
