// §wxUndo · ถอนคำสั่งยกเลิกทริป (ยกเลิกการยกเลิก) · ใบที่ "เคลียร์จบแล้ว" ไม่ย้อนให้
//   เลื่อนวัน/คืนเงินไปแล้ว แล้วมาลบ tag เงียบ ๆ แย่กว่าปล่อยไว้ — โชว์รายชื่อในกล่องยืนยันแทน
function bookingV2WeatherUncancel(routeId,date){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')){ alert('View only - no permission to edit operations'); return; }
  if(!bookingV2IsWeatherClosed(routeId,date)) return;
  const rname=((typeof ROUTES!=='undefined'&&ROUTES.find(r=>r.id===routeId))||{}).name||routeId;
  const key=bookingV2WeatherKey(routeId,date);
  const tagged=(SB_BOOKINGS||[]).filter(bk=>bk.weatherResolve && bk.weatherResolve.event===key);
  const back=tagged.filter(bk=>bk.weatherResolve.status!=='resolved');
  const kept=tagged.filter(bk=>bk.weatherResolve.status==='resolved');
  let msg='Re-open this trip? (undo the weather cancellation)\n'+rname+' \u00B7 '+date;
  if(back.length) msg+='\n\n'+back.length+' booking(s) go back to normal (weather tag removed)';
  if(kept.length) msg+='\n\n'+kept.length+' booking(s) already resolved - left as they are:\n  '
    +kept.map(bk=>(bk.code||bk.id)+' \u00B7 '+((bk.weatherResolve||{}).outcome||'resolved')).join('\n  ');
  if(!confirm(msg)) return;
  for(let i=SB_WEATHER_CLOSURES.length-1;i>=0;i--){ const c=SB_WEATHER_CLOSURES[i]; if(c&&c.routeId===routeId&&c.date===date) SB_WEATHER_CLOSURES.splice(i,1); }
  back.forEach(bk=>{ delete bk.weatherResolve; bookingV2AddHistory(bk,'weather','Trip '+rname+' \u00B7 '+date+' re-opened \u00B7 weather cancellation undone','Weather'); });
  sbWeatherPersist();
  if(back.length && typeof acctPersistBookings==='function') acctPersistBookings();
  acctModalClose();
  if(typeof renderOp==='function') renderOp();
  if(typeof bookingV2Render==='function' && typeof _bkV2!=='undefined' && _bkV2) bookingV2Render();
}
