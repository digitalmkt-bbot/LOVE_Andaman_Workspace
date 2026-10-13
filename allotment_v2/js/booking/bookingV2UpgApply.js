function bookingV2UpgApply(go){
  var U=_bkUpg; if(!U) return;
  var b=SB_BOOKINGS.find(function(x){ return x.id===U.bkId; }); if(!b) return;
  var t=bkUpgTripOn(b, U.date, U.from); if(!t){ alert('Trip not found.'); return; }
  if(!U.to){ alert('Pick the destination programme.'); return; }
  var reason=String(U.reason||'').trim(); if(!reason){ alert('Enter a reason.'); var r0=document.getElementById('bkupg-reason'); if(r0) r0.focus(); return; }
  var charge=Math.max(0, Math.round((parseFloat(String(U.charge).replace(/[^0-9.]/g,''))||0)*100)/100);
  var pax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
  var al=(typeof getAllotment==='function')?getAllotment(U.to, U.date, null):null;
  if(al && al.hasAllotment && pax>al.seatsAvailable){
    alert('Not enough free seats on '+bkUpgRouteName(U.to)+' ('+U.date+').\nNeeds '+pax+', free '+al.seatsAvailable+'.'); return; }
  var O=bkOpsFor(b, U.date), fromNm=bkUpgRouteName(U.from), toNm=bkUpgRouteName(U.to), upgId='';
  /* §upgConfirm (2026-10-03) · ผู้ใช้ขอ "กด Upgrade แล้วให้ขึ้นเตือนอีกรอบว่ายืนยันจะ Upgrade จากเส้นทางนี้เป็นเส้นทางนี้"
     ย้ายแล้วที่นั่งสองโปรแกรมเปลี่ยนทันทีและเรือเดิมถูกล้าง · ถามหลังตรวจทุกอย่างผ่านแล้ว จะได้ไม่ถามแล้วค่อยบอกว่าย้ายไม่ได้ */
  var _pEn=function(rid){ var p=bkUpgPierOf(rid); return ((typeof LA_PIER_NAME!=='undefined' && LA_PIER_NAME[p] && LA_PIER_NAME[p].en) || p || '-'); };
  var _pf=_pEn(U.from), _pt=_pEn(U.to);
  /* §upgConfirm2 (2026-10-11) · owner: "ปรับ UI" (ภาพกล่องยืนยันของเบราว์เซอร์ ตัวหนังสือล้นต้องเลื่อนอ่าน)
     กล่อง confirm() ของเบราว์เซอร์อ่านยาก ตัดคำ ต้องเลื่อน และไม่มีสี · ย้ายเป็นขั้นยืนยันในหน้าต่างเดิม
     กด Upgrade = ตรวจทุกอย่างแล้วโชว์หน้าสรุป · กดยืนยันในหน้าสรุป = เรียกตัวนี้อีกรอบด้วย go=true
     ตรวจซ้ำอีกรอบตอนยืนยัน (ที่นั่งอาจถูกคนอื่นจองไประหว่างนั้น) */
  if(go!==true){
    bookingV2UpgConfirmView({ b:b, pax:pax, fromNm:fromNm, toNm:toNm, pf:_pf, pt:_pt, charge:charge, reason:reason, date:U.date });
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
  t.upg={ fromRouteId:U.from, toRouteId:U.to, date:U.date, reason:reason, charge:charge, upgId:upgId, by:laBy(), at:new Date().toISOString() };
  t.routeId=U.to;
  O.boatId=null; if(O.boatSplits) delete O.boatSplits;       /* เรือของเส้นทางเดิมใช้ต่อไม่ได้ · จัดใหม่ในโปรแกรมปลายทาง */
  if(b.ops && b.ops.upgrade) b.ops.upgrade=null;              /* ธงแบบเก่า · เลิกใช้ */
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'edit','Upgrade route · '+fromNm+' > '+toNm+' · '+reason+(charge>0?(' · +THB '+charge.toLocaleString()):' · no charge'),'Edit');
  if(!opsOn) acctPersistBookings();
  bookingV2UpgModalClose();
  if(_bkV2 && _bkV2.boatAssignMode && typeof bookingV2Render==='function') bookingV2Render(); else if(typeof bookingV2Render==='function' && document.getElementById('bkv2-host')) bookingV2Render(); else renderBoatAssign();
  };
  /* Server first when operation-backend is on: POST /v1/bookings/:id/upgrade moves the trip, makes the sale
     and records the upgrade (undo-able). Nothing changes locally until it says yes. */
  var opsOn=!!(window.laOps && window.laOps.enabled && window.laOps.enabled() && typeof window.laOpsBookingAction==='function');
  if(opsOn){
    if(!b.opsId || !t.opsTripId){ alert('Save this booking to operation-backend first, then upgrade.'); return; }
    window.laOpsBookingAction(b.id,'upgrade',{trip_id:t.opsTripId, to_route_id:U.to, reason:reason, charge:charge},
      function(){ applyLocal(true); }, 'Upgrade route', true);
    return;
  }
  applyLocal(false);
}
