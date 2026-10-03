function bookingV2CreateBoatLock(o){
  o = o || {};
  /* §bkLock · โปรแกรมบกไม่มีเรือให้ล็อก · ด่านอยู่ชั้นนี้ ไม่ใช่ชั้นฟอร์ม
     ชั้นฟอร์มซ่อนตัวเลือกให้เฉย ๆ · ทางเรียกอื่นจะข้ามไปได้ถ้าด่านอยู่แค่ตรงนั้น */
  if(typeof laIsLandRoute==='function' && laIsLandRoute(o.routeId)) return null;
  if(!bookingV2BoatLockCanTake(o.date, o.boatId)) return null;
  const l = bookingV2CreateLock({ scope:'boat', routeId:o.routeId, date:o.date, boatId:o.boatId,
    holderType:o.holderType||'office', holderId:o.holderId||null,
    qty:Math.max(0, parseInt(o.minCap,10)||0), reason:o.reason||'', expiry:o.expiry||'' });
  l.subName = (o.fixed===false) ? 'any' : 'fixed';
  bookingV2BoatLockCellSet(l);
  sbSeatLocksPersist(); _bkLockSaveOps();
  return l;
}
