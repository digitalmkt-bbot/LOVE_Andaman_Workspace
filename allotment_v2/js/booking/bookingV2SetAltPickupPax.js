// §pax breakdown ต่อจุดรับ · เก็บ ad/chd/inf/foc แยกกัน แล้ว qty = ผลรวม (ของเดิมทั้งระบบยังอ่าน qty ได้เหมือนเดิม)
function bookingV2SetAltPickupPax(i, key, val){
  if(!_bkV2.newBooking || !Array.isArray(_bkV2.newBooking.altPickups)) return;
  const a = _bkV2.newBooking.altPickups[i]; if(!a) return;
  if(PAX_K.indexOf(key)<0) return;
  PAX_K.forEach(k=>{ if(a[k]==null) a[k] = (k==='ad') ? Math.max(0,parseInt(a.qty)||0) : 0; });   // เลื่อนของเก่า (มีแต่ qty) ขึ้นมาก่อน
  a[key] = Math.max(0, parseInt(val)||0);
  a.qty  = bkPaxSum(bkAltPax(a));   // qty เป็นค่าที่คำนวณจาก 4 ช่อง ไม่ใช่ค่าที่พิมพ์เอง
  bookingV2Render();
}
