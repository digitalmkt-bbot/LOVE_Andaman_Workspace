// Weather-resolution pax tally for a route+date (cancelled / rescheduled / pending) · used by Calendar
function bookingV2WeatherCountsFor(routeId, date){
  const key=routeId+'|'+date; let cancelled=0, rescheduled=0, pending=0;
  (SB_BOOKINGS||[]).forEach(b=>{
    if(!b.weatherResolve || b.weatherResolve.event!==key) return;
    const wr=b.weatherResolve;
    const t=(b.trips||[]).find(tt=>tt.routeId===routeId) || {};
    const p=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
    if(wr.status==='resolved'){ if(wr.outcome==='reschedule') rescheduled+=p; else cancelled+=p; }
    else pending+=p;
  });
  return {cancelled, rescheduled, pending, total:cancelled+rescheduled+pending};
}
