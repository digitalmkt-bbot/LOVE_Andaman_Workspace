/* ลดจำนวนที่ขอ = ตัดส่วนที่รออยู่ออกก่อน · ของที่ยังไม่ได้ที่ ไม่มีอะไรให้คืนเข้าพูล */
function bookingV2LockPendShrink(l, n){
  n = Math.max(0, n|0); if(!l || n<=0) return;
  if(bookingV2LockSpansDays(l)){ Object.keys(l.pendBy||{}).forEach(d=>bookingV2LockPendSet(l, d, (Number(l.pendBy[d])||0) - n)); }
  else if(Number(l.pendQty)>0) l.pendQty = Math.max(0, Number(l.pendQty) - n);
}
