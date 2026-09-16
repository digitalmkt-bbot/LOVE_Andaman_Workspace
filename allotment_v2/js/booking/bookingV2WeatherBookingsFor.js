function bookingV2WeatherBookingsFor(routeId,date){
  return (SB_BOOKINGS||[]).filter(bk=>{
    if(['cancelled','rejected','cancelled_weather'].includes(bk.status)) return false;
    return (bk.trips||[]).some(t=>t.routeId===routeId && t.date===date && t.bookingMode!=='charter');
  });
}
