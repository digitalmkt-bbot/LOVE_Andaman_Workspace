/* §per-trip ops · เดิมไม่รับ date → "แยกคน" ในวันที่ 2 ของ OVN ไปแยกวันที่ 1 แทน (แล้วหน้าวันที่ 2 ก็ไม่เห็นอะไรเลย) */
function bookingV2VanSplit(bkId, date){
  const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return;
  const _d = bkOpsDate(b, date);
  const _o = bkOpsFor(b, _d);
  const sp = Array.isArray(_o.vanSplits) ? _o.vanSplits : [];
  let pool;
  if(sp.length){ pool = bkSplitPax(sp[0]); }                      // แยกซ้ำ → หยิบจากก้อนหลัก
  else { pool={ad:0,chd:0,inf:0,foc:0};
         (b.trips||[]).forEach(t=>{ const p=bkPaxOfTrip(t); if(bkPaxSum(p)>bkPaxSum(pool)) pool=p; }); }
  if(bkPaxSum(pool) < 2){
    if(typeof laSaveToast==='function') laSaveToast({kind:'error', title:'แยกไม่ได้', msg:'ส่วนนี้เหลือคนเดียว'});
    else alert('ส่วนนี้เหลือคนเดียว แยกไม่ได้');
    return;
  }
  _bkSplitM = { bkId, date:_d, pool, again:sp.length>0, ad:0, chd:0, inf:0, foc:0 };
  bookingV2SplitRender();
}
