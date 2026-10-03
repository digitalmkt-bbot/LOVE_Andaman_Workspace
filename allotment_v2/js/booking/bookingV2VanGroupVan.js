/* §vanStop · รถที่กรุ๊ปนี้ถืออยู่ · คนละค่ากับ vanId รายใบ เพราะกรุ๊ปเป็นตัวถือรถ
   อ่านจากสมาชิกตัวแรกที่มีรถ เหมือนที่หน้าจอทำอยู่ ((mem.find(a=>a.vanId)||{}).vanId) */
function bookingV2VanGroupVan(date, routeId, zone, gid){
  let vid=null;
  _bkV2GrpApply(date,routeId,zone,gid,(b,s,o)=>{ if(vid) return; const v=s?s.vanId:o.vanId; if(v) vid=v; });
  return vid;
}
