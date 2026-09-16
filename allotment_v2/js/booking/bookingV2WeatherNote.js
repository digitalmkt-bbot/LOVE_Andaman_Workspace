function bookingV2WeatherNote(routeId,date){ const c=SB_WEATHER_CLOSURES.find(x=>x.routeId===routeId&&x.date===date); return c?(c.note||''):''; }
