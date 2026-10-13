// §splitOwn · แถวแยก (ไม่ใช่จุดหลัก) ที่จุดรับเป็นโซนมาเอง · ไม่ต้องมีรถไปรับ
function bookingV2SplitIsSelf(s){
  if(!s || s.main) return false;
  var z=String(s.pickZone||'').trim(); if(z==='NoTransfer'||z==='NT') return true;
  var ar=(s.pickAreaId && typeof bookingV2GetArea==='function')?bookingV2GetArea(s.pickAreaId):null;
  return !!(ar && (ar.zone==='NoTransfer'||ar.zone==='NT'));
}
