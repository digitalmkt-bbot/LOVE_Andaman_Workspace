/* ระหว่างคิดราคา ให้ทริปที่ upgrade ถือเส้นทางที่ขายชั่วคราว · จบแล้วคืนค่าเสมอ (ทำงานแบบ synchronous ทั้งหมด) */
function bookingV2WithSold(trips, fn){
  var sw=[];
  (trips||[]).forEach(function(t){ if(bkUpgActive(t)){ sw.push([t, t.routeId]); t.routeId=t.upg.fromRouteId; } });
  try{ return fn(); } finally{ sw.forEach(function(x){ x[0].routeId=x[1]; }); }
}
