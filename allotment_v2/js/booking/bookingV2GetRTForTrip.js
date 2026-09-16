// The rate type to price a given trip with: promo (if any active) else the booking's base rate.
// Defensive: only adopt the promo rate if it actually prices this route (seat or charter) — else keep base.
function bookingV2GetRTForTrip(trip){
  const base = bookingV2GetRT();
  if(!trip || !trip.routeId || !trip.date) return base;
  const d = _bkV2.newBooking; if(!d || !d.agentId) return base;
  const rtId = bookingV2ResolveRateType(d.agentId, trip.routeId, trip.date);
  if(!rtId || rtId===d.rateTypeRef) return base;
  const rt = (SB_RATE_TYPES||[]).find(r => r.id===rtId);
  if(rt && (rt.seatRates?.[trip.routeId] || rt.charterRates?.[trip.routeId])) return rt;
  return base;
}
