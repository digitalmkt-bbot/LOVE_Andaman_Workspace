/* §chManualNoRate · กรอกราคาจากกล่องแดง (เรือไม่มีเรทเหมา) = ราคาที่ตกลงกันเอง · สลับเป็น FLEXIBLE ให้ */
function bookingV2SetTripCharterManualForce(idx, val){
  const t = _bkV2.newBooking && _bkV2.newBooking.trips[idx];
  if(!t) return;
  t.charterPriceMode = 'manual';
  t.charterPriceManual = Math.max(0, Number(val) || 0);
  bookingV2Render();
}
