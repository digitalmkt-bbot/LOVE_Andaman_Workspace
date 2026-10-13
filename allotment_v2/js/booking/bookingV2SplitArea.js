/* ══ §splitZone · พื้นที่รับของแถวที่แยกคนออกมา ═══════════════════════════════
   ผู้ใช้แจ้ง 30 ก.ย. "แยกคนแล้วไม่ขึ้น Zone เช่นที่ La Green Hotel and Residence"

   ของเดิม แถวที่ไม่ใช่จุดหลักอ่านพื้นที่จากตัว split อย่างเดียว
   แต่การแยกคนส่วนใหญ่ไม่ได้เลือกพื้นที่ใหม่ — จุดรับเดิมนั่นแหละ แค่แยกคนออกมา
   พอ split ไม่มี areaId ของตัวเอง ช่องโซนเลยว่างเป็นขีด ทั้งที่บุคกิ้งแม่รู้พื้นที่อยู่แล้ว
   คนจัดรถเห็นขีดก็จัดกลุ่มตามพื้นที่ไม่ได้ ต้องเปิดใบจองดูทีละใบ

   คืนค่ามาพร้อมธง inherited เพื่อให้หน้าจอบอกได้ว่ายืมมาจากบุคกิ้งแม่
     inherited=false · จุดแยกไม่มีจุดรับของตัวเอง หรือชื่อจุดรับเดียวกับบุคกิ้งแม่
                       = ที่เดียวกันจริง ไม่ใช่การเดา ขึ้นป้ายเต็มเหมือนแถวปกติ
     inherited=true  · จุดแยกมีจุดรับคนละที่ แต่ยังไม่ได้เลือกพื้นที่ให้มัน
                       ขึ้นแบบจาง ๆ บอกว่าเป็นของบุคกิ้งแม่ ไม่ใช่ยืนยันว่าจุดนี้อยู่พื้นที่นั้น */
function bookingV2SplitArea(bk, pick, baseArea){
  var g=function(id){ return (id && typeof bookingV2GetArea==='function') ? bookingV2GetArea(id) : null; };
  var own=g(pick && pick.areaId);
  if(own) return { area:own, name:own.name||'', inherited:false };
  var base=baseArea || g(bk && bk.pickupAreaId);
  var bn=base ? (base.name||'') : String((bk && bk.pickupArea)||'').trim();
  if(!bn) return { area:null, name:'', inherited:false };
  var n=function(x){ return String(x||'').replace(/\s+/g,' ').trim().toLowerCase(); };
  var ph=n(pick && pick.hotel);
  var same = !ph || ph===n(bk && bk.hotelName) || ph===n(bk && bk.pickup);
  return { area:base||null, name:bn, inherited:!same };
}
