function bookingV2LockSweepFixAll(){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;
  const S=bookingV2LockSweep();
  if(!S.nBad){ alert('ไม่มีล็อคไหนที่ตัวนับไม่ตรงกับใบจอง'); return; }
  if(!confirm('คืนที่นั่งที่ไม่มีใบจองรออยู่ กลับเข้าล็อคทั้งหมด?\n\n'
    +S.nBad+' ล็อค · '+S.seats+' ที่\n'
    +'· ใบย้ายวันไปแล้ว '+S.seatsMoved+' ที่\n'
    +'· ใบยกเลิกไปแล้ว '+S.seatsDead+' ที่\n\n'
    +'จำนวนที่กันไว้ (qty) ไม่เปลี่ยน · แก้เฉพาะตัวนับที่ใช้ไป')) return;
  let n=0, seats=0;
  S.rows.forEach(r=>{ const d=bookingV2LockFixUsed(r.id, true); if(d){ n++; seats+=d; } });
  if(typeof sbSeatLocksPersist==='function') sbSeatLocksPersist();
  alert('คืนแล้ว '+seats+' ที่ จาก '+n+' ล็อค');
  bookingV2Render();
}
