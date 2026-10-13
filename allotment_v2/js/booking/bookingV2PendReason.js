// §pendNoApproval (2026-07-31) · ปุ่ม อนุมัติ / ไม่อนุมัติ กดแล้วเงียบ ไม่มีอะไรเกิดขึ้น
//   ทั้งสองฟังก์ชันขึ้นต้นด้วย  if(!b||!b.approval) return;  แต่รายการที่ b2c_sync พักไว้
//   ไม่เคยมี b.approval เลย — ฝั่งเซิร์ฟเวอร์ทำแค่ UPDATE sb_bookings SET status='pending_approval'
//   ไม่มี mapper ตัวไหนเขียนคอลัมน์ approval_* (ดูได้จากการ์ดที่ขึ้น "ขอโดย -" ว่างทั้งชื่อและวันที่)
//   รายการเข้ามาอยู่ในหน้านี้ได้เพราะลิสต์กรองด้วย status อย่างเดียว ไม่ได้เช็ค approval
//   → สร้าง approval ให้ตอนกดปุ่มแทนที่จะ return ทิ้ง · ของเดิมที่มี approval อยู่แล้วไม่ถูกแตะ
function bookingV2PendReason(b){
  if(!b) return 'over_cap';
  var closed=(b.trips||[]).some(function(t){
    return t && t.date && t.routeId && typeof bookingV2IsRouteOpenOn==='function' && !bookingV2IsRouteOpenOn(t.routeId, t.date); });
  if(closed) return 'closed_day';
  return /^b2c_/.test(String(b.id||'')) ? 'b2c_hold' : 'over_cap';
}
