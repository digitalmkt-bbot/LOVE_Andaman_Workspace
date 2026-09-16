function bookingV2SetAltPickupQty(i, val){
  // (ยังคงไว้เพื่อความเข้ากันได้) จำนวนคนที่จุดนี้ · clamp >=1 · re-render เพื่ออัปเดตสรุป "จุดรับหลัก"
  if(!_bkV2.newBooking || !Array.isArray(_bkV2.newBooking.altPickups)) return;
  const a = _bkV2.newBooking.altPickups[i]; if(!a) return;
  a.qty = Math.max(1, parseInt(val)||1);
  bookingV2Render();
}
