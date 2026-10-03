function bookingV2RtKeptFor(trip, any){
  const d = _bkV2 && _bkV2.newBooking, K = d && d._rtKeep;
  if(!K || !_bkV2.editingId || !trip) return null;
  if(!any && K.mode!=='keep') return null;
  const s = (K.trips||[]).find(function(x){ return x.routeId===trip.routeId && x.date===trip.date; });
  if(!s) return null;
  const get = function(id){ return id ? ((SB_RATE_TYPES||[]).find(function(r){ return r.id===id; })||null) : null; };
  return get(s.rtRef) || get(K.ref);
}
