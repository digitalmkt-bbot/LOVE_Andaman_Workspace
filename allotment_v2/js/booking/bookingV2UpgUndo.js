function bookingV2UpgUndo(bkId, routeId, date, _ok){
  var b=SB_BOOKINGS.find(function(x){ return x.id===bkId; }); if(!b) return;
  var t=bkUpgTripOn(b, date, routeId); if(!t || !bkUpgActive(t)) return;
  var u=t.upg, fromNm=bkUpgRouteName(u.fromRouteId), toNm=bkUpgRouteName(u.toRouteId);
  var item=(u.upgId && Array.isArray(b.upgrades))?b.upgrades.find(function(x){ return x.id===u.upgId; }):null;
  var pax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
  var _who=b.leadPax||b.customerName||b.voucherRef||b.id;
  if(typeof bookingV2IsRouteOpenOn==='function' && !bookingV2IsRouteOpenOn(u.fromRouteId, date)){
    bkUpgUndoBlocked({al:null, fromNm:fromNm, toNm:toNm, toRid:t.routeId, fromRid:u.fromRouteId, who:_who, vc:b.voucherRef||'', pax:pax, date:date}); return; }
  var al=(typeof getAllotment==='function')?getAllotment(u.fromRouteId, date, null):null;
  if(al && al.hasAllotment && pax>al.seatsAvailable){
    bkUpgUndoBlocked({al:al, fromNm:fromNm, toNm:toNm, toRid:t.routeId, fromRid:u.fromRouteId, who:_who, vc:b.voucherRef||'', pax:pax, date:date}); return; }
  if(!_ok){   /* §upgUndoUi · ถามด้วยกล่องของแอป · กดยืนยันแล้วเรียกตัวเองซ้ำพร้อมธง (ตรวจที่นั่งอีกรอบ ณ ตอนกด) */
    var _T=function(x){ return (typeof laT==='function')?laT(x):x; };
    bkUpgSheet({ mode:'ask', title:_T('ย้ายลูกค้ากลับโปรแกรมเดิม?'), toNm:toNm, fromNm:fromNm, toRid:t.routeId, fromRid:u.fromRouteId, who:_who, whoSub:(b.voucherRef?(b.voucherRef+' · '):'')+pax+' pax', pax:pax, date:date,
      rows:item?[[_T('ค่า Upgrade'), item.collected?_T('เก็บแล้ว · คงไว้ในบุคกิ้ง'):('<span style="color:#7A4A00">&#3647;'+(+item.sellPrice||0).toLocaleString()+'</span> '+_T('ยังไม่เก็บ · จะถูกลบออก'))]]:[],
      tip:_T('ย้ายกลับแล้วเรือที่จัดไว้จะถูกล้าง ต้องจัดเรือใหม่ในโปรแกรมเดิม'), okLabel:_T('ยืนยันยกเลิก Upgrade'),
      onYes:function(){ bookingV2UpgUndo(bkId, routeId, date, true); } });
    return; }
  if(item && !item.collected) b.upgrades=b.upgrades.filter(function(x){ return x.id!==u.upgId; });
  t.routeId=u.fromRouteId; delete t.upg;
  var O=bkOpsFor(b, date); O.boatId=null; if(O.boatSplits) delete O.boatSplits;
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'edit','Upgrade undone · back to '+fromNm,'Edit');
  acctPersistBookings();
  if(typeof bookingV2Render==='function' && document.getElementById('bkv2-host')) bookingV2Render(); else renderBoatAssign();
}
