/* วันที่ยังรออยู่ของล็อกใบนี้ · เฉพาะวันนี้เป็นต้นไป (รอบที่ผ่านแล้วไม่มีอะไรให้ยืนยัน) */
function bookingV2LockPendDates(l){
  if(!l || l.parentId) return [];
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  const ds = bookingV2LockSpansDays(l) ? Object.keys(l.pendBy||{}) : (l.date ? [l.date] : []);
  return ds.filter(d => d >= today && !bookingV2LockRoundReleased(l, d))
           .map(d => ({ date:d, n:bookingV2LockPendOn(l, d) })).filter(x => x.n > 0)
           .sort((a,b) => a.date < b.date ? -1 : 1);
}
