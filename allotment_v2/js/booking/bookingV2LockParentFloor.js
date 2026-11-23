/* §lkSubDay · ใบแม่ลด qty ได้ไม่ต่ำกว่า "วันที่แน่นที่สุด" = ที่ใบแม่ขายเองวันนั้น + ที่แบ่งให้กรุ๊ปย่อยวันนั้น */
function bookingV2LockParentFloor(l){
  if(!bookingV2LockSpansDays(l)) return Math.max(bookingV2LockPeakUsed(l), bookingV2LockAllocated(l));
  const kids = bookingV2LockChildren(l.id);
  const base = kids.filter(c=>!bookingV2LockKidDated(c)).reduce((s,c)=>s+(c.qty||0),0);
  const ds = {}; Object.keys(l.usedBy||{}).forEach(d=>{ ds[d]=1; });
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  kids.forEach(c=>{ if(bookingV2LockKidDated(c) && c.date>=today) ds[c.date]=1; });
  let mx = 0;
  Object.keys(ds).forEach(d=>{
    const dated = kids.filter(c=>bookingV2LockKidDated(c) && c.date===d).reduce((s,c)=>s+(c.qty||0),0);
    const v = bookingV2LockUsedOn(l, d) + dated; if(v>mx) mx=v;
  });
  return base + mx;
}
