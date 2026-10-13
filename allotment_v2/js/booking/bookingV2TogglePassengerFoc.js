// Toggle a specific passenger as FOC (free) · capped at the booking's FOC seat count (set in Trips) · FIFO evict when full
function bookingV2TogglePassengerFoc(i){
  const d = _bkV2.newBooking; if(!d || !Array.isArray(d.passengers) || !d.passengers[i]) return;
  const totFoc = (d.trips||[]).reduce((s,t)=> s + ((typeof bookingV2PaxTot==='function')?bookingV2PaxTot(t.pax,'foc'):0), 0);
  if(totFoc <= 0){ alert('No FOC seats in this booking · add FOC count in the Trips section first'); return; }
  const p = d.passengers[i];
  if(p.foc){ p.foc = false; }
  else {
    const flagged = d.passengers.filter(x=>x.foc);
    if(flagged.length >= totFoc){ const first = d.passengers.find(x=>x.foc); if(first) first.foc = false; }  // evict earliest
    p.foc = true;
  }
  bookingV2SyncPassengers();
  if(typeof bookingV2Render==='function') bookingV2Render();
}
