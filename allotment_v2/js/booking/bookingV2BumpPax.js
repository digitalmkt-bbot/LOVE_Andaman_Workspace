function bookingV2BumpPax(idx, paxKey, delta){
  if(!_bkV2.newBooking) return;
  const t = _bkV2.newBooking.trips[idx];
  if(!t || !t.pax) return;
  t.pax[paxKey] = Math.max(0, (t.pax[paxKey]||0) + delta);
  // Any pax bump can change the names-list size (lead can be AD/CHD/INF/FOC) → re-sync
  bookingV2SyncPassengers();
  bookingV2Render();
}
