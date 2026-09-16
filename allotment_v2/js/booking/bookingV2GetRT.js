// ── Quote calculation helpers ──
function bookingV2GetRT(){
  if(!_bkV2.newBooking?.rateTypeRef) return null;
  return (SB_RATE_TYPES||[]).find(r => r.id === _bkV2.newBooking.rateTypeRef) || null;
}
