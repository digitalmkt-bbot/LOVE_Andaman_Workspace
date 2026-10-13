/* ปล่อยลำ · เปลี่ยนช่องกลับเป็นรอบปกติ ไม่ลบเซลล์ทิ้ง (ลบแล้วที่นั่งของวันนั้นหายทั้งลำ) */
function bookingV2BoatLockCellClear(l){
  if(!l || typeof TRIPS==='undefined') return false;
  const op = TRIPS[l.date] && TRIPS[l.date][l.boatId];
  if(!op || op.boatLockId!==l.id) return false;
  delete op.boatLockId;
  if(!op.charterBookingId) op.type = 'normal';
  return true;
}
