// The rate type to price a given trip with: promo (if any active) else the booking's base rate.
// Defensive: only adopt the promo rate if it actually prices this route (seat or charter) — else keep base.
/* ══ §aoRT (2026-10-03) · add-on ต้องอ่านชุดราคาเดียวกับที่ใช้คิดราคาทริป ═══════════════
   ที่มา · ผู้ใช้เปิดแก้ใบเหมาลำของ PEGAS แล้วถามว่าทำไม Longtail Charter ไม่ขึ้นให้เลือก
     ทั้งที่ตั้งราคาไว้ใน Rate Type ของ PEGAS แล้ว (MISHA-SPECIA-3)
   เหตุ · ใบจองจำชุดราคาตอนสร้างไว้ที่ rateTypeRef (ใบนี้คือ MISHA-SPECIA ตัวเก่า ก่อนแยกชุดของ PEGAS ออกมา)
     ราคาทริปไม่ได้ใช้ตัวนั้นมานานแล้ว · bookingV2GetRTForTrip อ่านชุดปัจจุบันของเอเยนต์ตามวันเดินทาง
     แต่ส่วน add-on ยังอ่าน rateTypeRef ตัวเก่า · ใบเดียวกันจึงคิดราคาทริปจากชุดหนึ่ง แล้วหา add-on จากอีกชุด
   แก้ · add-on อ่านชุดหลักของเอเยนต์ ณ วันเดินทางของทริปแรก (ตารางฤดูกาล → ชุดปัจจุบันของเอเยนต์)
     ไม่ใช้ใบโปร · ใบโปรเป็นแผ่นราคาที่นั่ง ไม่มีตาราง add-on ของตัวเอง ใช้แล้ว add-on จะหายทั้งชุด
     หาไม่ได้ (ใบของบริษัท · B2C · ยังไม่เลือกทริป) = ถอยไปใช้ rateTypeRef เหมือนเดิม */
function bookingV2AddOnRT(){
  const base = bookingV2GetRT();
  const d = _bkV2 && _bkV2.newBooking;
  if(!d || !d.agentId) return base;
  if(typeof laIsCompanyBk==='function' && laIsCompanyBk(d)) return base;
  const t = (d.trips||[]).find(x => x && x.routeId && x.date);
  if(!t || typeof laMainRtFor!=='function') return base;
  const kept = bookingV2RtKeptFor(t);            /* §rtKeep · ใบที่ยึดเรทเดิม add-on ก็ต้องมาจากชุดเดิมด้วย */
  if(kept) return kept;
  try{ return laMainRtFor(d.agentId, t.date) || base; }catch(_){ return base; }
}
