/* รอบที่ที่ว่างไม่พอกับจำนวนที่ขอ · want = ส่วนที่ยังต้องกัน (ขอ − ขายไปแล้ว) · short = ส่วนที่ขาด */
function bookingV2LockShort(sp, self){
  const out=[];
  bookingV2LockSpecDates(sp).forEach(d=>{
    const free = bookingV2LockFreeOn(sp.routeId, d, self||null);
    if(free==null) return;
    const used = self ? bookingV2LockUsedTotal(self, d) : 0;
    const want = Math.max(0, (Number(sp.qty)||0) - used);
    if(want > free) out.push({ date:d, free:free, want:want, short:want-free });
  });
  return out;
}
