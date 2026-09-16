function bookingV2WeatherMarkConfirm(routeId,date){
  const note=((document.getElementById('wx-note')||{}).value||'').trim();
  const c=SB_WEATHER_CLOSURES.find(x=>x.routeId===routeId&&x.date===date);
  if(c){ c.note=note; } else { SB_WEATHER_CLOSURES.push({routeId,date,reason:'weather',note,at:new Date().toISOString()}); }
  if(typeof bookingV2WeatherTagBookings==='function') bookingV2WeatherTagBookings(routeId,date);
  sbWeatherPersist(); acctModalClose();
  if(typeof renderOp==='function') renderOp();
  if(typeof bookingV2Render==='function' && typeof _bkV2!=='undefined' && _bkV2 && _bkV2.tab==='bytrip') bookingV2Render();
}
