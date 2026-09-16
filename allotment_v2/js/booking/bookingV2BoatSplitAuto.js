// เกลี่ยคนที่ยังไม่ได้จัด ลงลำที่เลือกไว้ตามที่ว่างจริง · ผู้ใหญ่ก่อน (เด็กไม่ควรแยกจากผู้ใหญ่)
function bookingV2BoatSplitAuto(){
  const m=_bkBoatM; if(!m) return;
  const b=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).find(x=>x.id===m.bkId); if(!b) return;
  let left={}; PAX_K.forEach(k=>left[k]=Math.max(0,(+m.pool[k]||0)-m.parts.reduce((s,p)=>s+(+p[k]||0),0)));
  if(bkPaxSum(left)<=0) return;
  m.parts.forEach(p=>{
    if(!p.boatId || bkPaxSum(left)<=0) return;
    const bo=(typeof BOATS!=='undefined'?BOATS:[]).find(x=>x.id===p.boatId)||{};
    const cap=(typeof boatCapFor==='function')?boatCapFor(p.boatId,m.date):(+bo.cap||0);
    const room=Math.max(0, cap - bkBoatLoadOther(b,m.date,p.boatId) - bkPaxSum(p));
    if(room<=0) return;
    const take=bkPaxTake(left, Math.min(room, bkPaxSum(left)));
    PAX_K.forEach(k=>{ p[k]=(+p[k]||0)+(+take[k]||0); left[k]=Math.max(0,(+left[k]||0)-(+take[k]||0)); });
  });
  bookingV2BoatSplitRender();
}
