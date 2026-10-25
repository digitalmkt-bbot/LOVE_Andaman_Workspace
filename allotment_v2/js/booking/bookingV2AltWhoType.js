/* §altWhoType (2026-10-22) · เลือกชื่อที่จุดรับเพิ่มแล้ว ประเภทของคนนั้นต้องตามมาด้วย
   เจ้าของ: "ตรวจเคส FOC จริงๆ ตอนเลือกเป็น วิศรุต เป็น FOC แต่ตอนโชว์" (22 ต.ค. · Suntan Tour · Similan)
   ของเดิม: แถวจุดรับเพิ่มเริ่มที่ AD 1 เสมอ · เลือกชื่อไกด์ที่เป็น FOC แล้วช่อง 4 ช่องไม่ขยับ
   → แถวแยกโชว์เป็นผู้ใหญ่ 1 · ส่วน FOC ไปตกอยู่กับกลุ่มหลักแทน (ใบงานรถ/เรือนับคนผิดประเภท)
   กติกา: ชื่อตรงกับ Lead หรือผู้โดยสารในส่วน Guests และแถวนี้ยังเป็นคนเดียว → ตั้ง 4 ช่องตามประเภทของคนนั้น
   แถวที่ผู้ใช้ตั้งไว้หลายคนแล้ว (เช่น "2 คน") ไม่แตะ · ชื่อที่ไม่ตรงใคร ไม่แตะ */
function bookingV2AltWhoType(name){
  const d=_bkV2&&_bkV2.newBooking; if(!d) return '';
  const n=String(name||'').trim().toLowerCase(); if(!n) return '';
  if(String(d.leadPax||'').trim().toLowerCase()===n) return String(d.leadType||'AD');
  const p=(d.passengers||[]).find(x=>x && String(x.name||'').trim().toLowerCase()===n);
  return p ? String(p.type||(p.foc?'FOC':'AD')) : '';
}
