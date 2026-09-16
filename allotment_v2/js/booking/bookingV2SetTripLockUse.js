function bookingV2SetTripLockUse(idx, val){
  const t = _bkV2.newBooking && _bkV2.newBooking.trips[idx];
  if(!t) return;
  const pax = bookingV2PaxAllTot(t.pax);
  const rem = (typeof bookingV2LocksForAgent==='function')
    ? bookingV2LocksForAgent(t.routeId, t.date, _bkV2.newBooking.agentId).reduce((s,l)=>s+bookingV2LockRemaining(l,t.date),0) : 0;
  t.lockUse = Math.max(0, Math.min(Number(val)||0, pax, rem));
  bookingV2Render();
}
