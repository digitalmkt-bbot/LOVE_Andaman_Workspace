/* ══ ปุ่ม "เหมาลำ" · ใบล็อกส่งไม้ต่อให้ใบจองจริง ═══════════════════════════════
   เรียกจาก bookingV2CommitBooking ตอนที่ใบใหม่ถูกเก็บลง SB_BOOKINGS แล้ว แต่ยังไม่ถึง
   ขั้นเขียนช่อง TRIPS · ช่องจึงเปลี่ยนมือจาก boatLockId เป็น charterBookingId
   ในจังหวะเดียว ที่นั่งไม่เคยกลับเข้าพูลระหว่างทาง ไม่มีช่องให้ใครแทรก           */
function bookingV2BoatLockOnConvert(lockId, newBk){
  if(!lockId || !newBk) return false;
  const l = bookingV2BoatLockById(lockId); if(!l || l.status!=='active') return false;
  const hit = (newBk.trips||[]).some(t => t && t.bookingMode==='charter'
    && t.charterBoatId===l.boatId && (t.date||'')===l.date);
  if(!hit) return false;                      /* ใบที่บันทึกจริงไม่ตรงกับที่ล็อกไว้ · ปล่อยล็อกค้างไว้ให้คนตัดสิน */
  const today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  bookingV2BoatLockCellClear(l);                   /* ถอด boatLockId ออก · ตัวเขียน charter ข้างล่างจะรับช่องต่อ */
  l.status = 'converted';
  l.convertedTo = newBk.id;
  (l.log=l.log||[]).push({date:today, at:new Date().toISOString(), type:'convert',
    bookingId:newBk.id, note:'เหมาลำ '+bookingV2BoatNameOf(l.boatId), by:laBy()});
  sbSeatLocksPersist();
  return true;
}
