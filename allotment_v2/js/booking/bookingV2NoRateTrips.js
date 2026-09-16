// Detect trips with no rate for the picked route × zone combination
function bookingV2NoRateTrips(){
  const d = _bkV2.newBooking;
  if(!d) return [];
  if(d.priceMode === 'manual') return [];   // manual price · rate-coverage not required
  const out = [];
  d.trips.forEach((t, i) => {
    if(!t.routeId || !t.zone) return;
    const sub = bookingV2TripSubtotal(t);
    if(sub?.noRate) out.push({ idx: i, trip: t, reason: sub.reason });
  });
  return out;
}
