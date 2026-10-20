function bookingV2WeatherTagBookings(routeId,date){
  const key=bookingV2WeatherKey(routeId,date); let tagged=0;
  const rName=((typeof ROUTES!=='undefined'&&ROUTES.find(r=>r.id===routeId))||{}).name||routeId;
  (SB_BOOKINGS||[]).forEach(bk=>{
    if(['cancelled','rejected','cancelled_weather'].includes(bk.status)) return;
    const onTrip=(bk.trips||[]).some(t=>t.routeId===routeId && t.date===date && t.bookingMode!=='charter');
    if(onTrip && !(bk.weatherResolve && bk.weatherResolve.event===key)){ bk.weatherResolve={event:key,status:'awaiting'}; const _R=TCX_R[tcxReason(routeId,date)]||TCX_R.weather; bookingV2AddHistory(bk,'weather','Trip '+rName+' · '+date+' cancelled · reason: '+_R.en,_R===TCX_R.weather?'Weather':'Trip CXL'); tagged++; }
  });
  if(tagged && typeof acctPersistBookings==='function') acctPersistBookings();
}
