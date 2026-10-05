function bookingV2BoatUpgrade(bkId, routeId, date){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  var b=SB_BOOKINGS.find(function(x){ return x.id===bkId; }); if(!b) return;
  date=date||((typeof bookingV2Tab2ActiveDate==='function')?bookingV2Tab2ActiveDate():'')||(typeof _baDate!=='undefined'?_baDate:'');
  var t=bkUpgTripOn(b, date, routeId) || bkUpgTripOn(b, date, '');
  if(!t){ alert('No seat trip on '+date+' for this booking.'); return; }
  if(bkUpgActive(t)){ bookingV2UpgUndo(bkId, t.routeId, date); return; }
  if(t.ovnLeg || t.ovn){ alert('Overnight trips cannot be upgraded here. Edit the booking instead.'); return; }
  if((Number(t.lockUse)||0)>0 || (t.seatSource && Number(t.seatSource.locked)>0)){
    alert('This booking draws seats from a seat lock on '+bkUpgRouteName(t.routeId)+'.\nRelease the lock draw first (edit the booking), then upgrade.'); return; }
  _bkUpg={ bkId:bkId, date:date, from:t.routeId, to:'', reason:'', charge:'' };
  bookingV2UpgModal();
}
