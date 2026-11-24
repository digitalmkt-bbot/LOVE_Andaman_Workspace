function bookingV2LockAllocated(parent, date){                                                                            // seats carved into sub-groups
  const kids = bookingV2LockChildren(parent.id, date);
  if(date || !bookingV2LockSpansDays(parent)) return kids.reduce((s,c)=>s+(c.qty||0),0);
  /* §lkSubDay · ไม่ระบุวัน + ใบแม่ Bulk → วันที่แบ่งไปมากที่สุด (นับเฉพาะวันนี้เป็นต้นไป) · กรุ๊ปแบบครอบช่วงนับทุกวัน */
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  let base=0, mx=0; const by={};
  kids.forEach(c=>{ if(bookingV2LockKidDated(c)){ if(c.date>=today) by[c.date]=(by[c.date]||0)+(c.qty||0); } else base+=(c.qty||0); });
  Object.keys(by).forEach(k=>{ if(by[k]>mx) mx=by[k]; });
  return base+mx;
}
