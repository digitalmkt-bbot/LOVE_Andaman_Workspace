// ── Van assign ──
/* ══ §vanAssignScroll (2026-09-18) · จัดรถ/กดบันทึกแล้วตารางเด้งกลับหัว ═══════
   ทุกฟังก์ชันของโหมดจัดรถเรียก bookingV2Render() = วาดใหม่ทั้งหน้า · .t2-wrap กลายเป็น
   กล่องใหม่ scrollTop จึงเป็น 0 ทุกครั้ง · ต้องเลื่อนกลับลงมาเองหลังจัดรถทุกคัน
   เปลี่ยนมาใช้ bookingV2RenderKeep() (§btTickScroll) ที่เก็บตำแหน่งเลื่อนไว้ก่อนวาด
   แล้วคืนให้หลังวาดเสร็จ · ครอบทั้งจัดรถไป/รถกลับ · จัดกรุ๊ป · แยกคน · บันทึก */
function bookingV2AssignVan(bkId, vanId, date){ const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return; const _o=bkOpsFor(b, bkOpsDate(b,date)); _o.vanId=vanId||null; acctPersistBookings(); if(_bkV2&&_bkV2.vanAssignMode) bookingV2RenderKeep(); else if(typeof renderVehicles==='function') renderVehicles(); }
