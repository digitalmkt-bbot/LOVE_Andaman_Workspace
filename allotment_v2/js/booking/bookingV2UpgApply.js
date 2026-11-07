function bookingV2UpgApply(go){
  var U=_bkUpg; if(!U) return;
  var b=SB_BOOKINGS.find(function(x){ return x.id===U.bkId; }); if(!b) return;
  var t=bkUpgTripOn(b, U.date, U.from); if(!t){ alert('Trip not found.'); return; }
  if(!U.to){ alert('Pick the destination programme.'); return; }
  if(!U.kind){ alert('Choose who asked for the move (step 2).'); return; }   /* §upgUi2 */
  var reason=String(U.reason||'').trim(); if(!reason){ alert('Enter a reason.'); var r0=document.getElementById('bkupg-reason'); if(r0) r0.focus(); return; }
  var charge=(U.chargeOn===false)?0:Math.max(0, Math.round((parseFloat(String(U.charge).replace(/[^0-9.]/g,''))||0)*100)/100);   /* §upgUi2 · กด "ไม่เก็บ" = 0 */
  var pax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
  var al=(typeof getAllotment==='function')?getAllotment(U.to, U.date, null):null;
  if(al && al.hasAllotment && pax>al.seatsAvailable){
    alert('Not enough free seats on '+bkUpgRouteName(U.to)+' ('+U.date+').\nNeeds '+pax+', free '+al.seatsAvailable+'.'); return; }
  var O=bkOpsFor(b, U.date), fromNm=bkUpgRouteName(U.from), toNm=bkUpgRouteName(U.to), upgId='';
  var kind=(U.kind==='promise')?'promise':'fill';   /* §upgPromise */
  if(kind==='promise'){
    if(!U.boat){ alert('Pick the boat promised to the customer.'); return; }
    if(!baBoatsForRoute(U.date, U.to).some(function(x){ return x.boatId===U.boat; })){ alert(bkUpgBoatNm(U.boat)+' is not running '+toNm+' on '+U.date+'. Pick another boat.'); return; }
    var _pc=(typeof boatCapFor==='function')?boatCapFor(U.boat,U.date):0, _pf2=_pc-baAssignedPax(U.date,U.boat);
    if(_pc>0 && pax>_pf2){ alert('Not enough room on '+bkUpgBoatNm(U.boat)+'.\nNeeds '+pax+', free '+Math.max(0,_pf2)+'.'); return; }
  }
  /* §upgConfirm (2026-10-03) · ผู้ใช้ขอ "กด Upgrade แล้วให้ขึ้นเตือนอีกรอบว่ายืนยันจะ Upgrade จากเส้นทางนี้เป็นเส้นทางนี้"
     ย้ายแล้วที่นั่งสองโปรแกรมเปลี่ยนทันทีและเรือเดิมถูกล้าง · ถามหลังตรวจทุกอย่างผ่านแล้ว จะได้ไม่ถามแล้วค่อยบอกว่าย้ายไม่ได้ */
  var _pEn=function(rid){ var p=bkUpgPierOf(rid); return ((typeof LA_PIER_NAME!=='undefined' && LA_PIER_NAME[p] && LA_PIER_NAME[p].en) || p || '-'); };
  var _pf=_pEn(U.from), _pt=_pEn(U.to);
  /* §upgConfirm2 (2026-10-11) · owner: "ปรับ UI" (ภาพกล่องยืนยันของเบราว์เซอร์ ตัวหนังสือล้นต้องเลื่อนอ่าน)
     กล่อง confirm() ของเบราว์เซอร์อ่านยาก ตัดคำ ต้องเลื่อน และไม่มีสี · ย้ายเป็นขั้นยืนยันในหน้าต่างเดิม
     กด Upgrade = ตรวจทุกอย่างแล้วโชว์หน้าสรุป · กดยืนยันในหน้าสรุป = เรียกตัวนี้อีกรอบด้วย go=true
     ตรวจซ้ำอีกรอบตอนยืนยัน (ที่นั่งอาจถูกคนอื่นจองไประหว่างนั้น) */
  if(go!==true){
    bookingV2UpgConfirmView({ b:b, pax:pax, fromNm:fromNm, toNm:toNm, pf:_pf, pt:_pt, charge:charge, reason:reason, date:U.date, kind:kind, boatNm:(kind==='promise'?bkUpgBoatNm(U.boat):'') });
    return;
  }
  /* opsOn · operation-backend is the master: the server makes the upgrade sale and returns it, so the
     local copy takes what the server returns and does not add its own sale. */
  var applyLocal=function(opsOn){
  if(charge>0 && !opsOn){
    if(!Array.isArray(b.upgrades)) b.upgrades=[];
    upgId='up_'+Date.now();
    b.upgrades.push({ id:upgId, label:'Upgrade > '+toNm, sellPrice:charge, toCompany:charge, commission:0, collected:false,
      note:reason, seller:'', settle:'pending', at:new Date().toISOString(), method:'cash', feePct:0, fee:0, customerPaid:charge, slips:[] });
  }
  t.upg={ fromRouteId:U.from, toRouteId:U.to, date:U.date, reason:reason, charge:charge, upgId:upgId, by:laBy(), at:new Date().toISOString(), kind:kind };
  if(kind==='promise') t.upg.boatId=U.boat;   /* §upgPromise */
  t.routeId=U.to;
  O.boatId=(kind==='promise')?U.boat:null; if(O.boatSplits) delete O.boatSplits;       /* เรือของเส้นทางเดิมใช้ต่อไม่ได้ · จัดใหม่ในโปรแกรมปลายทาง */
  if(b.ops && b.ops.upgrade) b.ops.upgrade=null;              /* ธงแบบเก่า · เลิกใช้ */
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'edit','Upgrade route · '+fromNm+' > '+toNm+' · '+reason+(charge>0?(' · +THB '+charge.toLocaleString()):' · no charge')+(kind==='promise'?(' · GUARANTEED boat '+bkUpgBoatNm(U.boat)):' · seat-fill'),'Edit');
  if(!opsOn) acctPersistBookings();
  bookingV2UpgModalClose();
  if(_bkV2 && _bkV2.boatAssignMode && typeof bookingV2Render==='function') bookingV2Render(); else if(typeof bookingV2Render==='function' && document.getElementById('bkv2-host')) bookingV2Render(); else renderBoatAssign();
  };
  /* Server first when operation-backend is on: POST /v1/bookings/:id/upgrade moves the trip, makes the sale
     and records the upgrade (undo-able). Nothing changes locally until it says yes. */
  var opsOn=!!(window.laOps && window.laOps.enabled && window.laOps.enabled() && typeof window.laOpsBookingAction==='function');
  if(opsOn){
    if(!b.opsId || !t.opsTripId){ alert('Save this booking to operation-backend first, then upgrade.'); return; }
    var upgBody={trip_id:t.opsTripId, to_route_id:U.to, reason:reason, charge:charge};
    if(kind==='promise'){ upgBody.kind='promise'; upgBody.boat_id=U.boat; }   /* §upgPromise · the server checks the boat and lands the booking on it */
    window.laOpsBookingAction(b.id,'upgrade',upgBody,
      function(){ applyLocal(true); }, 'Upgrade route', true);
    return;
  }
  applyLocal(false);
}
