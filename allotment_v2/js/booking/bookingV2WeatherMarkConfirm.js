function bookingV2WeatherMarkConfirm(routeId,date){
  if(!tcxCan()) return;
  const note=((document.getElementById('wx-note')||{}).value||'').trim();
  const reason=TCX_R[window._tcxPick]?window._tcxPick:'weather';
  const c=SB_WEATHER_CLOSURES.find(x=>x.routeId===routeId&&x.date===date);
  const snap=c?null:tcxSnapNow(routeId,date);   /* ภาพก่อนแตะอะไร */
  if(c){
    const was=c.reason||'weather';
    c.note=note; c.reason=reason;
    if(was!==reason){ const sn=tcxSnapOf(routeId,date); if(sn){ (sn.log=sn.log||[]).push({at:new Date().toISOString(), by:laBy(), from:was, to:reason}); tcxSnapPutLater(routeId+'|'+date, sn); }
      bookingV2WeatherEventBookings(routeId,date).forEach(bk=>bookingV2AddHistory(bk,'weather','Cancel reason changed: '+TCX_R[was].en+' → '+TCX_R[reason].en,'Trip CXL')); }
  } else { SB_WEATHER_CLOSURES.push({routeId,date,reason,note,at:new Date().toISOString()}); }
  if(typeof bookingV2WeatherTagBookings==='function') bookingV2WeatherTagBookings(routeId,date);
  sbWeatherPersist();
  if(snap) tcxSnapPutLater(routeId+'|'+date, snap);
  tcxSnapFlush();
  acctModalClose();
  if(typeof renderOp==='function') renderOp();
  if(typeof bookingV2Render==='function' && typeof _bkV2!=='undefined' && _bkV2 && _bkV2.tab==='bytrip') bookingV2Render();
}
