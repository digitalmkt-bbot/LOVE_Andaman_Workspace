/* §lkSweepFast (2026-11-20) · owner: "หน้า Seat lock ค้างหนักกว่าหน้าอื่น เข้าก็ช้า ออกก็ช้า"
   วัดบนข้อมูลจริง · เปิดหน้า Seat Locks ใช้ 10.2 วินาที · 10.1 วินาทีอยู่ในการตรวจตัวนับ (bookingV2LockSweep)
   เพราะตรวจทีละล็อก (2,828 ใบ) และแต่ละใบไล่อ่านใบจองทั้งหมด (13,962 ใบ) ใหม่ทุกครั้ง = 39 ล้านรอบ
   ดัชนีนี้ไล่ใบจองรอบเดียว แล้วแจกให้ทุกล็อก · ผลลัพธ์ของ Claims/Audit เหมือนเดิมทุกตัว */
function bookingV2LockClaimsIndex(){
  const by = new Map(), lockOf = new Map();
  (typeof SB_SEAT_LOCKS!=='undefined'?SB_SEAT_LOCKS:[]).forEach(l => { if(l&&l.id!=null&&!lockOf.has(l.id)) lockOf.set(l.id, l); });
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b => {
    (b.trips||[]).forEach(t => { (t.lockDraws||[]).forEach(x => {
      if(!x || x.lockId==null) return;
      let a = by.get(x.lockId); if(!a){ a=[]; by.set(x.lockId, a); }
      a.push({ b:b, t:t, x:x });
    }); });
  });
  return { by:by, lockOf:lockOf };
}
