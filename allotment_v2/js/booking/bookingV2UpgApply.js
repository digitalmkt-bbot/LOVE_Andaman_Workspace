function bookingV2UpgApply(){
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
  if(!confirm('Confirm upgrade?\n\nFROM: '+fromNm+'  ['+_pf+']\nTO:   '+toNm+'  ['+_pt+']'
      +(_pf!==_pt?'\n\n*** DIFFERENT PIER - the boarding point changes ***':'')
      +'\n\nGuest: '+String(b.leadPax||b.customerName||b.voucherRef||b.id)+' - '+pax+' pax - '+U.date
      +'\nExtra charge: '+(charge>0?('THB '+charge.toLocaleString()):'none')
      +'\nReason: '+reason
      +'\n\nOK = upgrade now   Cancel = go back')) return;
  if(charge>0){
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
  acctPersistBookings();
  bookingV2UpgModalClose();
  if(_bkV2 && _bkV2.boatAssignMode && typeof bookingV2Render==='function') bookingV2Render(); else if(typeof bookingV2Render==='function' && document.getElementById('bkv2-host')) bookingV2Render(); else renderBoatAssign();
}
