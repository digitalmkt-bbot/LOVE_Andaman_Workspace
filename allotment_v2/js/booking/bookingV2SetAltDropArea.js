/* §altDrop · จุดส่งของแถวแยก · โซนมาจากพื้นที่ที่เลือกอัตโนมัติเหมือนฝั่งรับ */
function bookingV2SetAltDropArea(i, areaId){
  if(!_bkV2.newBooking || !Array.isArray(_bkV2.newBooking.altPickups)) return;
  const a=_bkV2.newBooking.altPickups[i]; if(!a) return;
  a.dropAreaId=areaId||'';
  const ar=(areaId && typeof bookingV2GetArea==='function')?bookingV2GetArea(areaId):null;
  a.dropZone=ar?ar.zone:'';
  bookingV2Render();
}
