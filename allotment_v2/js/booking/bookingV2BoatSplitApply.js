function bookingV2BoatSplitApply(){
  const m=_bkBoatM; if(!m) return;
  const b=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).find(x=>x.id===m.bkId); if(!b) return;
  const parts=m.parts.filter(p=>bkPaxSum(p)>0);
  if(!parts.length) return;
  if(parts.reduce((s,p)=>s+bkPaxSum(p),0)!==bkPaxSum(m.pool)) return;
  if(parts.some(p=>!p.boatId)){ alert('ยังมีก้อนที่ไม่ได้เลือกเรือ'); return; }
  const ids=parts.map(p=>p.boatId);
  if(ids.filter((x,i)=>ids.indexOf(x)!==i).length){ alert('เลือกเรือซ้ำลำ — รวมให้เป็นก้อนเดียว หรือเปลี่ยนลำ'); return; }
  const o=(typeof bkOpsFor==='function')?bkOpsFor(b,m.date):(b.ops=b.ops||{});
  if(parts.length<=1){ delete o.boatSplits; o.boatId=parts[0].boatId||null; }
  else {
    o.boatSplits=parts.map(p=>{ const q={pax:bkPaxSum(p), boatId:p.boatId}; PAX_K.forEach(k=>q[k]=+p[k]||0); return q; });
    o.boatId=parts[0].boatId;   /* ลำหลัก · โค้ดเก่าที่อ่าน ops.boatId ยังทำงานได้ */
  }
  bookingV2BoatSplitClose();
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  if(typeof bookingV2Render==='function') bookingV2Render();
  if(typeof renderCheckinAll==='function') renderCheckinAll();   // §landCk · สองหน้า
  const msg=parts.map(p=>((typeof pckBoatName==='function')?pckBoatName(p.boatId):p.boatId)+' '+bkPaxSum(p)).join(' · ');
  if(typeof laSaveToast==='function') laSaveToast({kind:'success', title:(parts.length>1?'แยกลงเรือแล้ว':'จัดลงลำเดียว'), msg:msg});
}
