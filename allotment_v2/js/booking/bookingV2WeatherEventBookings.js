function bookingV2WeatherEventBookings(routeId,date){ const key=bookingV2WeatherKey(routeId,date); return (SB_BOOKINGS||[]).filter(bk=>bk.weatherResolve && bk.weatherResolve.event===key); }
