function bookingV2UpgUndo(bkId, routeId, date){
  var b=SB_BOOKINGS.find(function(x){ return x.id===bkId; }); if(!b) return;
  var t=bkUpgTripOn(b, date, routeId); if(!t || !bkUpgActive(t)) return;
  var u=t.upg, fromNm=bkUpgRouteName(u.fromRouteId), toNm=bkUpgRouteName(u.toRouteId);
  var item=(u.upgId && Array.isArray(b.upgrades))?b.upgrades.find(function(x){ return x.id===u.upgId; }):null;
  var pax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
  if(typeof bookingV2IsRouteOpenOn==='function' && !bookingV2IsRouteOpenOn(u.fromRouteId, date)){
    alert('Cannot undo: '+fromNm+' is not running on '+date+'.'); return; }
  var al=(typeof getAllotment==='function')?getAllotment(u.fromRouteId, date, null):null;
  if(al && al.hasAllotment && pax>al.seatsAvailable){
    alert('Cannot undo: not enough free seats on '+fromNm+' ('+date+').\nNeeds '+pax+', free '+al.seatsAvailable+'.'); return; }
  if(!confirm('Undo the upgrade?\n'+toNm+' > back to '+fromNm+'\n'+(item?(item.collected?'The extra charge was already collected - it stays on the booking.':'The uncollected extra charge (THB '+(+item.sellPrice||0).toLocaleString()+') will be removed.'):'')+'\nThe boat must be assigned again.')) return;
  if(item && !item.collected) b.upgrades=b.upgrades.filter(function(x){ return x.id!==u.upgId; });
  t.routeId=u.fromRouteId; delete t.upg;
  var O=bkOpsFor(b, date); O.boatId=null; if(O.boatSplits) delete O.boatSplits;
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'edit','Upgrade undone · back to '+fromNm,'Edit');
  acctPersistBookings();
  if(typeof bookingV2Render==='function' && document.getElementById('bkv2-host')) bookingV2Render(); else renderBoatAssign();
}
