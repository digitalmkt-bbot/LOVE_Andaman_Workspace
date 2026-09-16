function bookingV2IsWeatherClosed(routeId,date){ return SB_WEATHER_CLOSURES.some(c=>c.routeId===routeId && c.date===date); }
