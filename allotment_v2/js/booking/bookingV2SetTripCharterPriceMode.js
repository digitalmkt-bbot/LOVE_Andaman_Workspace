// ── Charter price · Rate (auto) vs Flexible (manual override) ──
function bookingV2SetTripCharterPriceMode(idx, mode){
  const t = _bkV2.newBooking && _bkV2.newBooking.trips[idx];
  if(!t) return;
  t.charterPriceMode = mode;
  // Seed the manual field with the current rate total so the user edits from there
  if(mode === 'manual' && (!t.charterPriceManual || t.charterPriceManual === 0)){
    const sub = bookingV2TripSubtotal({ ...t, charterPriceMode:'rate' });
    t.charterPriceManual = sub.total || 0;
  }
  bookingV2Render();
}
