/* จำนวนที่กด "คืน" ได้ (ทั้งใบ) · ใช้ทั้งหน้าต่างยืนยันและตอนคืนจริง จะได้ตรงกัน */
function bookingV2LockReleasable(l){
  if(l.parentId) return Math.max(0, (l.qty||0) - bookingV2LockPeakUsed(l));
  return Math.max(0, (l.qty||0) - bookingV2LockParentFloor(l));
}
