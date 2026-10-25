function bookingV2AltWhoPicked(i, val){
  if(!_bkV2.newBooking || !Array.isArray(_bkV2.newBooking.altPickups)) return;
  const a=_bkV2.newBooking.altPickups[i]; if(!a) return;
  a.who=val;
  const ty=bookingV2AltWhoType(val).toLowerCase();
  if(PAX_K.indexOf(ty)<0 || bkPaxSum(bkAltPax(a))>1){ return; }
  PAX_K.forEach(k=>{ a[k]=(k===ty)?1:0; }); a.qty=1;
  bookingV2Render();
}
