// §self-arrive pickup-time heal (2026-07-22) · เมื่อสลับ booking เป็น self-arrive (โซน No-Transfer / จุดรับเป็นท่า
// self-arrive) แต่ "เวลารับรถ" เดิม (เช่น 07:30-07:45) ยังค้างอยู่ → รถดูเหมือนยังไปรับ · normalize เป็นค่า default
// ของท่า ("Before 08:30 at pier") ให้ตรงกับ booking ที่ถูก. Targeted + idempotent: แตะเฉพาะ trip ที่เป็น
// self-arrive และเวลาเป็นช่วงนาฬิกาจริง (ไม่แตะ "…at pier" ที่ถูกอยู่แล้ว · ไม่แตะ hotelName).
// ── Private Van (เหมารถ) · van-ops helpers (Phase 2) ──
// A private van rides on a No-Transfer SEAT (so it isn't double-charged) but STILL needs a dedicated
// pickup — van ops must not treat it as self-arrive. Parse the "transfer-<route>-<zone>-<vehicle>" add-on
// for a trip; bookingV2EffZone then reports the van's real pickup zone (PK/KL) so every existing
// zone!=='NoTransfer' gate includes it automatically.
function bookingV2TripPrivateVan(b, t){
  if(!b || !t || !t.routeId || !Array.isArray(b.addOns)) return null;
  const pre = 'transfer-' + t.routeId + '-';
  const a = b.addOns.find(x => x && typeof x.type === 'string' && x.type.indexOf(pre) === 0);
  if(!a) return null;
  const m = a.type.match(/^transfer-(.+)-(PK|KL|NoTransfer)-([a-z]+)$/i);
  return { zone: m ? m[2] : '', vehicle: m ? m[3] : '', qty: Math.max(1, a.qty || 1), type: a.type };
}
