/* §ltStale (2026-10-14) · ใบ BK-26100458-XPEN ติ๊ก Longtail Join ไว้ตอนเป็นเส้นทางที่มีหางยาว
   แล้วเปลี่ยนเส้นทางเป็น Similan · ฟอร์มเปลี่ยนแค่ routeId ไม่ได้ล้าง Add-on ที่ติ๊กไว้
   ตัวเลือกหายจากหน้าจอ คนแก้เลยเอาออกไม่ได้ · บันทึกออกมาเป็น "Longtail Join (0A + 0C)" ฿0
   หน้าท่า / By-trip / ใบงานไกด์ จึงเห็นว่าใบนี้มีหางยาว ทั้งที่ไม่มีใครลง
   ตัดทิ้งทันทีที่เส้นทางในใบไม่มีเส้นไหนรองรับหางยาวแล้ว · และเช็กซ้ำตอนบันทึก */
function bookingV2LtRoutesApply(){
  var d = _bkV2.newBooking; if(!d) return false;
  var rt = (typeof bookingV2AddOnRT === 'function') ? bookingV2AddOnRT() : null;
  var ltn = (rt && typeof _rtNormalizeLongtail === 'function') ? _rtNormalizeLongtail(rt.addOns && rt.addOns.longtail) : null;
  if(!ltn) return false;
  return (d.trips || []).some(function(t){
    return t.routeId && (!ltn.applies.length || ltn.applies.indexOf(t.routeId) >= 0);
  });
}
