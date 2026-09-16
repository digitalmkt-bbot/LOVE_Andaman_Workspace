function bookingV2SplitApply(){
  const m=_bkSplitM; if(!m) return;
  const b=SB_BOOKINGS.find(x=>x.id===m.bkId); if(!b) return;
  const mv={}; PAX_K.forEach(k=>mv[k]=+m[k]||0);
  const n=bkPaxSum(mv), tot=bkPaxSum(m.pool);
  if(n<1 || n>=tot) return;
  const keep=bkPaxSub(m.pool, mv);
  const o=bkOpsFor(b, bkOpsDate(b, m.date));   /* §per-trip ops · แยกลง ops ของวันที่เปิดหน้าจัดรถอยู่ */
  if(Array.isArray(o.vanSplits) && o.vanSplits.length){
    const main=o.vanSplits[0];
    Object.assign(main, keep); main.pax=bkPaxSum(keep);          // headcount กับ breakdown ขยับพร้อมกันเสมอ
    o.vanSplits.push(Object.assign({pax:n, vanGroup:0, vanId:null, vanReturnId:null}, mv));
  } else {
    o.vanSplits=[Object.assign({pax:bkPaxSum(keep), vanGroup:+o.vanGroup||0, vanId:o.vanId||null, vanReturnId:o.vanReturnId||null}, keep),
                 Object.assign({pax:n, vanGroup:0, vanId:null, vanReturnId:null}, mv)];
    delete o.vanGroup; delete o.vanId;
  }
  bookingV2SplitClose();
  acctPersistBookings(); if(typeof bookingV2Render==='function') bookingV2Render();
  if(typeof laSaveToast==='function') laSaveToast({kind:'success', title:'แยกคนแล้ว', msg:n+' คนไปอีกคัน · เหลือ '+bkPaxSum(keep)+' คนคันเดิม'});
}
