function bookingV2WeatherToggleDate(bkId,pfx){ pfx=pfx||'wx-'; const o=document.getElementById(pfx+'out-'+bkId); const d=document.getElementById(pfx+'date-'+bkId); if(o&&d) d.style.display=(o.value==='reschedule')?'':'none';
  const m=document.getElementById(pfx+'mv-'+bkId); if(o&&m) m.style.display=(o.value==='move')?'':'none'; }
