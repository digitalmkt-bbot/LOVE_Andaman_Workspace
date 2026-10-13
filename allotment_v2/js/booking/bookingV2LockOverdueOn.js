/* ปล่อยทุกใบที่เลยกำหนดของวันที่กำลังดูอยู่ · ที่นั่งค้างเป็นร้อยจะได้ไม่ต้องกดทีละใบ */
function bookingV2LockOverdueOn(dateStr){
  return (typeof bookingV2LocksOnDate==='function' ? bookingV2LocksOnDate(dateStr) : [])
    .filter(l => !l.parentId && bookingV2LockOverdue(l, dateStr) && bookingV2LockPoolHold(l, dateStr) > 0);
}
