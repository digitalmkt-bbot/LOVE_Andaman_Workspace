function bookingV2WeatherNotify(bkId,pfx){
  const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); if(!bk||!bk.weatherResolve) return;
  bk.weatherResolve.status='notified'; bk.weatherResolve.notifiedAt=new Date().toISOString();
  bookingV2AddHistory(bk,'weather','Notified agent · awaiting customer decision (reschedule/cancel)','Notify');
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  const parts=String(bk.weatherResolve.event||'').split('|');
  if(pfx==='wxr-'){ if(typeof bookingV2Render==='function') bookingV2Render(); } else { bookingV2WeatherPanel(parts[0],parts[1]); }
}
