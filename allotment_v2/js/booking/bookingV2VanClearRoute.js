function bookingV2VanClearRoute(date, routeId){
  const rows=baSeatBookingsForRoute(date,routeId).filter(({b})=>{ const o=bkOpsRead(b,date); return o.vanId||(Array.isArray(o.vanSplits)&&o.vanSplits.some(s=>s.vanId)); });
  if(!rows.length) return;
  if(!confirm('Clear van assignments for this program on '+date+'? ('+rows.length+' booking(s))')) return;
  rows.forEach(({b})=>{ const o=bkOpsFor(b, bkOpsDate(b,date)); if(Array.isArray(o.vanSplits)){ o.vanSplits.forEach(s=>{ s.vanId=null; }); } else { o.vanId=null; } });   /* §per-trip ops · เคลียร์เฉพาะวันที่กดเท่านั้น */
  acctPersistBookings();
  if(_bkV2&&_bkV2.vanAssignMode&&typeof bookingV2Render==='function') bookingV2Render();
}
