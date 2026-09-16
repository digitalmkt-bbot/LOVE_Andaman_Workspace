// Effective pickup zone for VAN OPS ONLY (never for seat pricing — that stays on t.zone). A No-Transfer
// seat with a private van → the van's zone (PK/KL); otherwise the seat/booking zone unchanged.
function bookingV2EffZone(b, t){
  const base = (t && t.zone) || (b && b.pickupZone) || '';
  if(base && base !== 'NoTransfer' && base !== 'NT') return base;
  const pv = bookingV2TripPrivateVan(b, t);
  return (pv && pv.zone && pv.zone !== 'NoTransfer') ? pv.zone : base;
}
