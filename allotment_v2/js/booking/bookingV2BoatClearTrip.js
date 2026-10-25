function bookingV2BoatClearTrip(boatId, date, rid){
  const S=bookingV2BoatClearScan(boatId, date, rid);
  const nm=(((typeof BOATS!=='undefined'?BOATS:[]).find(x=>x.id===boatId))||{}).name||boatId;
  const sk=S.split.length ? ('\n\n'+S.split.length+' booking(s) split across several boats are not changed - open each one to change its split:\n  '+S.split.map(b=>b.voucherRef||b.code||b.id).join(', ')) : '';
  if(!S.one.length){ if(S.split.length) alert('Nothing to remove from '+nm+' except split bookings.'+sk); return; }
  if(!confirm('Remove boat '+nm+' from '+S.one.length+' booking(s) ('+S.pax+' pax) on this trip?\n'+date+'\n\nThey go back to "not assigned".'+sk)) return;
  S.one.forEach(b=>{ const o=bkOpsFor(b, (typeof bkOpsDate==='function')?bkOpsDate(b,date):date); o.boatId=null; });
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  bookingV2RenderKeep();
}
