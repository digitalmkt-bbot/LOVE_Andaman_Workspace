function bookingV2SetPassenger(idx, key, val){
  if(!_bkV2.newBooking) return;
  bookingV2SyncPassengers();
  const p = _bkV2.newBooking.passengers[idx];
  if(!p) return;
  p[key] = val;
  // Auto-guess nationality when name changes and nationality is empty
  if(key === 'name' && !p.nationality){
    const guess = bookingV2GuessNationality(val);
    if(guess) p.nationality = guess;
  }
  // Don't re-render text inputs (focus loss)
  if(key === 'name') return;
  bookingV2Render();
}
