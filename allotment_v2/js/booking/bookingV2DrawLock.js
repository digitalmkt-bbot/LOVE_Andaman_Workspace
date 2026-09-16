// §lkBulk · tripDate จำเป็นสำหรับล็อกแบบช่วง · โควตาแยกรายรอบ
function bookingV2DrawLock(lockId, qty, bookingId, tripDate){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId); if(!l) return 0;
  const n = Math.min(Math.max(0, qty|0), bookingV2LockDrawable(l, tripDate)); if(n<=0) return 0;   // parent draws only its unallocated remainder
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  l.used = (l.used||0) + n;                                    // ยอดสะสมไว้ทำรายงาน
  if(bookingV2LockSpansDays(l) && tripDate){                        // ยอดของรอบนั้น ๆ ไว้คำนวณที่ว่าง
    l.usedBy = l.usedBy || {};
    l.usedBy[tripDate] = (Number(l.usedBy[tripDate])||0) + n;
  }
  (l.log=l.log||[]).push({date:today,at:new Date().toISOString(),type:'draw',qty:n,bookingId:bookingId||'',tripDate:tripDate||'',by:laBy()});
  // ล็อกแบบช่วงไม่ปิดตัวเองเพราะเต็มรอบเดียว · รอบอื่นยังมีที่อยู่
  if(!bookingV2LockSpansDays(l) && bookingV2LockDrawable(l) <= 0 && (l.parentId || !bookingV2LockChildren(l.id).length)) l.status='depleted';
  sbSeatLocksPersist(); return n;
}
