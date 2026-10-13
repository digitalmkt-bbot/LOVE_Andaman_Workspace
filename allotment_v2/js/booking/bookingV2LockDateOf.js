/* ใบจองที่ "ยังอ้างถึง" ล็อกนี้อยู่จริง ณ ตอนนี้ · แหล่งความจริงคือ trips[].lockDraws บนใบจอง
   ไม่ใช่ตัวนับ used ที่เชื่อไม่ได้ · ยกเลิกแล้วยังเก็บไว้แสดง แต่ไม่นับ */
/* §lkStale · วันของล็อคนี้ · ล็อคลูกยืมวันของแม่ · ล็อคแบบช่วงไม่มีวันเดียว คืนค่าว่าง */
function bookingV2LockDateOf(l){
  if(!l) return '';
  if(typeof bookingV2LockSpansDays==='function' && bookingV2LockSpansDays(l)) return '';
  if(l.date) return l.date;
  if(l.parentId && typeof SB_SEAT_LOCKS!=='undefined'){
    const p=SB_SEAT_LOCKS.find(y=>y.id===l.parentId);
    if(p && !(typeof bookingV2LockSpansDays==='function' && bookingV2LockSpansDays(p))) return p.date||'';
  }
  return '';
}
