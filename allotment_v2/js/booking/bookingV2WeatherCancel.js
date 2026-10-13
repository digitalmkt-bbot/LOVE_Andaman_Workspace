function bookingV2WeatherCancel(routeId,date){
  const rname=((typeof ROUTES!=='undefined'&&ROUTES.find(r=>r.id===routeId))||{}).name||routeId;
  const list=bookingV2WeatherBookingsFor(routeId,date);
  if(!confirm('ยกเลิกทริปนี้เพราะสภาพอากาศ?\n'+rname+' · '+date+'\nมี '+list.length+' booking ที่ต้องจัดการ')) return;
  if(!bookingV2IsWeatherClosed(routeId,date)){ SB_WEATHER_CLOSURES.push({routeId,date,reason:'weather',at:new Date().toISOString()}); sbWeatherPersist(); }
  bookingV2WeatherPanel(routeId,date);
}
