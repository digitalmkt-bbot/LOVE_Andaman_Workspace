// Toggle the LEAD as FOC · lets the lead occupy a FOC seat even in a mixed group (no forced adult) · head count unchanged
function bookingV2ToggleLeadFoc(){
  const d = _bkV2.newBooking; if(!d) return;
  const totFoc = (d.trips||[]).reduce((s,t)=> s + ((typeof bookingV2PaxTot==='function')?bookingV2PaxTot(t.pax,'foc'):0), 0);
  if(totFoc <= 0){ alert('No FOC seats in this booking · add FOC count in the Trips section first'); return; }
  d.leadFoc = !d.leadFoc;
  bookingV2SyncPassengers();
  if(typeof bookingV2Render==='function') bookingV2Render();
}
