/* ══ §ltCode (2026-09-19) · รหัส add-on หางยาวเป็น "ตระกูล" ไม่ใช่สตริงเดียว ══════════
   เว็บ B2C ส่ง code มาตรง ๆ (server.js · b2cMapAddOns) และใน catalog มีอยู่ 4 รหัส
     longtail-charter · longtail-charter-3 (จองล่วงหน้า 3 วัน) · longtail-charter-7-9 (ค่าท่านที่ 7-9)
     longtail-join · longtail-join-3
   ของเดิมเทียบ ty==='longtail-charter' แบบเป๊ะ รหัสลูกจึงตกไปเข้าเงื่อนไขไล่สุดท้าย
   (/longtail/ → join) — ใบเหมากลายเป็น "จอย" ทุกหน้าที่อ่านจาก bookingV2AddOnFlags
   (วอยเชอร์ · ใบงานไกด์ · สรุปเรือหน้าท่า · doc-check) ส่วนหน้าเช็คอินอ่าน label ดิบ
   จึงขึ้น "Longtail Charter" — สองหน้าพูดคนละอย่างบนใบเดียวกัน (เจอจริง 19 ก.ย. 2026 · LOV-3488828)
   วัดบนฐานข้อมูลจริงวันนั้น: 11 ใบ · 12 ลำ ไม่มีใครรู้ว่าต้องจัดเรือเหมารอ
   ข้อยกเว้น: '-7-9' คือค่าคนที่ 7-9 ของลำเดิม (qty = คน) ไม่ใช่ลำใหม่
     → นับเป็น "เหมา" แต่ไม่บวกจำนวนลำ · ใบที่มีแต่บรรทัดนี้ได้ 1 ลำจาก (+a.qty||1) ของ bkLtState */
function bookingV2LtAddOnKind(ty){
  const t=String(ty||'').toLowerCase();
  if(!/^longtail-(charter|join)(-|$)/.test(t)) return '';
  if(t.indexOf('longtail-join')===0) return 'join';
  return /-\d+-\d+$/.test(t) ? 'charter-pax' : 'charter';   /* ท้ายด้วยช่วงคน = ค่าคนเพิ่ม ไม่ใช่ลำ */
}
