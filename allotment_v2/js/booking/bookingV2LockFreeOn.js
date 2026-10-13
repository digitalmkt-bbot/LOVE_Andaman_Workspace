/* ที่ว่างจริงของรอบ · null = ยังไม่มีเรือ/โควตาให้เทียบ (ปล่อยผ่านเหมือนเดิม ไม่งั้นล็อกล่วงหน้าไม่ได้เลย)
   self = ล็อกใบที่กำลังแก้ · ที่นั่งที่มันกันอยู่แล้วนับเป็นของมันเอง ไม่ใช่ของคนอื่น */
function bookingV2LockFreeOn(routeId, date, self){
  const al = (typeof getAllotment==='function') ? getAllotment(routeId, date) : null;
  if(!al || !al.hasAllotment) return null;
  const own = (self && bookingV2LocksFor(routeId, date).indexOf(self)>=0) ? bookingV2LockPoolHold(self, date) : 0;
  return Math.max(0, (al.availableCapacity||0) - (al.seatsConsumed||0) - (al.lockedSeats||0) + own);
}
