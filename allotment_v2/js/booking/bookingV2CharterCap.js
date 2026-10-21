/* ══ §bkChCap (2026-10-20) · ทริปเหมาลำ ต้องเทียบคนกับ "ลำที่เหมา" ไม่ใช่ที่นั่งจอยของโปรแกรม ══
   owner: "อันนี้เป็นบั๊คไหม" · ZA261030Adele · เหมา Hermetis 3 พ.ย. 64 คน · หน้าจองขึ้น OVER 64/56
   56 = ที่นั่งจอยที่เหลือของ Phi Phi Bamboo วันนั้น (ลำอื่นที่ขายจอย) · ไม่เกี่ยวกับลำที่เหมา
   Hermetis 65 ที่ (ทะเบียน 75) · 64 คนจึงพอดี · ตัวกันตอนบันทึก (§lockViolation) ข้ามเหมาลำอยู่แล้ว เหลือแค่ป้ายที่ผิด
   ป้ายใหม่: เทียบกับที่นั่งของลำนั้นในวันนั้น (boatCapFor · รวมที่ปรับรายวัน) และที่นั่งตามทะเบียน */
function bookingV2CharterCap(t){
  if(!t || t.bookingMode!=='charter' || !t.charterBoatId) return null;
  var b=(typeof getBoat==='function')?getBoat(t.charterBoatId):null; if(!b) return null;
  var cap=(typeof boatCapFor==='function')?boatCapFor(b.id, t.date):(+b.cap||0);
  var lic=(typeof boatCapLicense==='function')?boatCapLicense(b.id):(+b.licensePax||+b.cap||0);
  var pax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
  return { name:b.name||b.id, cap:cap, lic:lic, pax:pax, overLic:lic>0 && pax>lic, overCap:cap>0 && pax>cap };
}
