/* ══ §ltJoinQty · Longtail Join ระบุจำนวนคนได้ ══════════════════════════════════════════════════
   ของเดิมจอยคือ "ติ๊กแล้วคิดทุกหัวบนเรือ" · ของจริงไม่เคยเป็นแบบนั้น
   กรุ๊ป 9 คนอาจลงหางยาวแค่ 2 คน ที่เหลือนั่งรอบนเรือ
   (เคสเดียวกับที่หน้าต้นทุนเจอ · 16 ส.ค. Oceanus 35 หัว ซื้อจอยจริง 2 คน สูตรคิดเกิน 17 เท่า
    จนต้องปิดบรรทัดทิ้ง แล้ว P&L ก็เลยไม่คิดตามไปด้วย)
   ⚠ ตั้งต้นเท่าที่จองไว้ · ติ๊กแล้วได้เลขเดิมเป๊ะ ใบเก่าที่ไม่มีเลขนี้ก็คิดเต็มเหมือนเดิม
     ของใหม่จึงไม่ทำให้ตัวเลขของใครขยับโดยไม่ตั้งใจ
   ⚠ ต้องไปถึงฝั่งปฏิบัติการด้วย · ไม่งั้นหน้าจอบอก 2 แต่ใบสั่งงานกับต้นทุนยังคิด 9
     (bookingV2AddOnFlags → bkLtState → pxLongtail) */
function bookingV2LtJoinMax(){
  var rt = bookingV2AddOnRT(), d = _bkV2.newBooking, A = 0, C = 0;   /* §aoRT */
  var ltn = (typeof _rtNormalizeLongtail === 'function')
    ? _rtNormalizeLongtail(rt && rt.addOns && rt.addOns.longtail) : null;
  if(ltn && d) (d.trips || []).forEach(function(t){
    if(!t.routeId) return;
    if(ltn.applies.length && ltn.applies.indexOf(t.routeId) < 0) return;
    A += bookingV2PaxTot(t.pax, 'ad'); C += bookingV2PaxTot(t.pax, 'chd');
  });
  return { A:A, C:C };
}
