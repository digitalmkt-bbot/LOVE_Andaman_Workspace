// Boarding-pass / ticket header for the Voucher detail · left route panel + trip/date/VC hero
/* ══ §vcPay · แถบเงินบน voucher ═══════════════════════════════════════════
   voucher ถูกเปิดดูทั้งจากออฟฟิศและจากคนที่ต้องคุยกับ agent · บางรอบอยากเห็นยอด
   บางรอบไม่อยากให้ตัวเลขเงินติดไปกับหน้าจอที่หันให้คนอื่นดู จึงต้องปิดได้

   สวิตช์เก็บที่ blob ตรง ๆ ไม่ตั้งตัวแปร global · ตัวแปร global ต้องไปผูกตอนบูต
   อีกจุดหนึ่ง ลืมเมื่อไรค่าที่เซฟไว้ก็หายเงียบ (เจอมาแล้วกับ PIER_CFG)
   ค่าเริ่มต้น = เปิด · ต้องตั้งใจปิดเท่านั้นถึงจะหาย */
function bookingV2PayShow(){
  try{ var c=(laBlob()||{}).bk_cfg||{}; return !(c.vcPay===0||c.vcPay===false); }catch(_){ return true; }
}
