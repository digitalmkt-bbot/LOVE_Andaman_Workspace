/* สลับลำ · ของเดิมไปเป็นรอบปกติ ลำใหม่รับช่องไป · ตัวตัดสินว่าสลับได้ไหมอยู่ที่ผู้เรียก */
function bookingV2BoatLockSwap(id, newBoatId){
  const l = bookingV2BoatLockById(id); if(!l || l.status!=='active' || !newBoatId || newBoatId===l.boatId) return false;
  if(!bookingV2BoatLockCanTake(l.date, newBoatId)) return false;
  /* สัญญาแบบ "เรือ 1 ลำ ไม่น้อยกว่า X ที่" · ลดขนาดต่ำกว่าที่รับปากไว้ไม่ได้
     กติกาอยู่ชั้นนี้ ไม่ใช่ชั้นปุ่ม · ไม่งั้นทางอื่นที่เรียกสลับลำจะข้ามด่านนี้ไปเงียบ ๆ
     แบบ "สัญญาลำนี้เลย" ไม่ตรวจขนาด เพราะสิ่งที่สัญญาคือชื่อเรือ · ชั้นปุ่มเป็นคนถามแทน */
  if(!bookingV2BoatLockFixed(l) && bookingV2BoatCapOn(newBoatId, l.date) < bookingV2BoatLockMinCap(l)) return false;
  const today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  const was = l.boatId;
  bookingV2BoatLockCellClear(l);
  l.boatId = newBoatId;
  if(!bookingV2BoatLockCellSet(l)){ l.boatId = was; bookingV2BoatLockCellSet(l); return false; }
  (l.log=l.log||[]).push({date:today, at:new Date().toISOString(), type:'edit',
    note:'boatId: '+bookingV2BoatNameOf(was)+' → '+bookingV2BoatNameOf(newBoatId), by:laBy()});
  sbSeatLocksPersist(); _bkLockSaveOps();
  return true;
}
