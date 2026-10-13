/* ══ §lkPendSub (2026-10-02) · ล็อกที่ยังรอที่ว่าง ก็แบ่งกรุ๊ปย่อยได้ ═══════════════════
   ผู้ใช้ขอ "ตัว Pending ให้ระบุกรุ๊ปย่อยได้เหมือน Lockseat" · เอเยนต์ส่งรายชื่อกรุ๊ปมาตั้งแต่ตอนขอ
   ไม่ได้รอให้ที่ว่างก่อน · ของเดิมแบ่งได้เฉพาะส่วนที่กันไว้จริง ใบที่รอทั้งใบจึงแบ่งไม่ได้เลย
   กรุ๊ปย่อยแบ่งจาก "จำนวนที่ขอ" ของใบแม่ (รวมส่วนที่รอ) · ส่วนที่นั่งที่กันไว้จริงมีแค่ก้อนเดียวที่ใบแม่
   จึงต้องมีกติกาว่าใครได้ก่อน: กรุ๊ปที่สร้างก่อนได้ที่ก่อน · ส่วนที่ยังไม่ได้แบ่งได้ท้ายสุด
   กรุ๊ปที่ยังไม่ถึงคิว = Pending ของกรุ๊ปนั้น ดึงไปจองไม่ได้ จนกว่าใบแม่จะได้ที่เพิ่ม (กดยืนยัน)
   ใช้เฉพาะตอนใบแม่มีส่วนที่รออยู่ · ใบที่ไม่มี pending คิดแบบเดิมทุกตัวเลข */
function bookingV2LockSubShares(p, date){
  let left = bookingV2LockHeldRemaining(p, date);
  const by = {};
  bookingV2LockChildren(p.id).forEach(c=>{
    const rem = Math.max(0, (c.qty||0) - bookingV2LockUsedOn(c, date));
    const h = Math.min(rem, left); left -= h;
    by[c.id] = { rem:rem, held:h, pend:rem-h };
  });
  const urem = Math.max(0, bookingV2LockUnalloc(p) - bookingV2LockUsedOn(p, date));
  const uh = Math.min(urem, left);
  return { by:by, un:{ rem:urem, held:uh, pend:urem-uh } };
}
