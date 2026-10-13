function bookingV2RenderActionMeta(){
  const d = _bkV2.newBooking;
  const q = bookingV2CalcQuote();
  const hasTrips = d.trips.some(t => t.routeId && t.date);
  if(!d.agentId) return `<div class="meta">Pick an agent to begin</div>`;
  if(!hasTrips) return `<div class="meta">Add at least 1 trip with route + date</div>`;
  const totPax = d.trips.reduce((s, t) => s + bookingV2PaxAllTot(t.pax), 0);
  return `<div class="meta"><strong style="color:var(--ink)">${totPax} pax · ${d.trips.filter(t=>t.routeId).length} trip${d.trips.filter(t=>t.routeId).length===1?'':'s'}</strong> &middot; <span style="font-family:Manrope,sans-serif;color:var(--bk-navy);font-weight:700;font-variant-numeric:tabular-nums;font-size:14px;letter-spacing:-.01em">฿${q.grandTotal.toLocaleString()}</span></div>`;
}
