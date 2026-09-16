// §lkBulk · เพิ่มจำนวนที่นั่งในล็อกที่มีอยู่ · เดิมมีแต่ Release ต้องลบทิ้งสร้างใหม่ ประวัติหาย
function bookingV2LockAddSeats(lockId, add, note){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId); if(!l) return false;
  const n = Math.max(0, parseInt(add,10)||0); if(n<=0) return false;
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  if(l.parentId){                                   // กรุ๊ปย่อย · ต้องมีที่ว่างในล็อกแม่พอ
    const p = SB_SEAT_LOCKS.find(x=>x.id===l.parentId);
    if(p){ const room = bookingV2LockUnalloc(p); if(n > room){ alert('ล็อกแม่เหลือแบ่งได้แค่ '+room+' ที่'); return false; } }
  }
  l.qty = (l.qty||0) + n;
  if(l.status==='depleted' || l.status==='released') l.status='active';   // มีที่ว่างแล้วกลับมาใช้ได้
  (l.log=l.log||[]).push({date:today, at:new Date().toISOString(), type:'add', qty:n, note:String(note||''), by:laBy()});
  sbSeatLocksPersist(); return true;
}
