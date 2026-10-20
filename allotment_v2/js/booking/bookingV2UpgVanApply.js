function bookingV2UpgVanApply(go){
  var U=_bkUpgVan; if(!U) return;
  var m=bkUpgVanMembers(U.date, U.from, U.gid);
  if(!m.length){ alert('No booking in this van group.'); bookingV2UpgVanClose(); return; }
  var bad=m.filter(function(x){ return !!x.why; });
  if(bad.length){ alert(bad.length+' booking(s) in this group cannot be moved. See the red box.'); bookingV2UpgVanModal(); return; }
  if(!U.to){ alert('Pick the destination programme.'); return; }
  var reason=String(U.reason||'').trim(); if(!reason){ alert('Enter a reason.'); var r0=document.getElementById('bkupgvan-reason'); if(r0) r0.focus(); return; }
  var charge=Math.max(0, Math.round((parseFloat(String(U.charge).replace(/[^0-9.]/g,''))||0)*100)/100);
  var pax=m.reduce(function(s,x){ return s+x.pax; },0);
  if(typeof bookingV2IsRouteOpenOn==='function' && !bookingV2IsRouteOpenOn(U.to, U.date)){ alert(bkUpgRouteName(U.to)+' is not running on '+U.date+'.'); return; }
  var al=(typeof getAllotment==='function')?getAllotment(U.to, U.date, null):null;
  if(al && al.hasAllotment && pax>al.seatsAvailable){
    alert('Not enough free seats on '+bkUpgRouteName(U.to)+' ('+U.date+').\nNeeds '+pax+', free '+al.seatsAvailable+'.'); return; }
  var pick=String(U.pick||'').trim(), pickChanged=(pick!==String(U.pick0||'').trim());
  var fromNm=bkUpgRouteName(U.from), toNm=bkUpgRouteName(U.to);
  if(go!==true){ bookingV2UpgVanConfirmView({ m:m, pax:pax, fromNm:fromNm, toNm:toNm, pf:bkUpgPierOf(U.from), pt:bkUpgPierOf(U.to), charge:charge, reason:reason, pick:pick, pickChanged:pickChanged, dFrom:bkUpgVanDepart(U.from), dTo:bkUpgVanDepart(U.to) }); return; }
  /* ลงมือ · เลขกรุ๊ปใหม่ใต้ปลายทาง จองก่อนแตะใบไหน (นับจากใบที่อยู่ปลายทางตอนนี้) */
  var newGid=(typeof _bkV2VanNextGroup==='function')?_bkV2VanNextGroup(U.date, U.to, U.zone):1;
  var key='uv_'+Date.now(), by=laBy(), at=new Date().toISOString();
  m.forEach(function(x){
    var b=x.b, t=x.t, O=bkOpsFor(b, U.date), upgId='';
    if(charge>0){
      if(!Array.isArray(b.upgrades)) b.upgrades=[];
      upgId='up_'+Date.now()+'_'+Math.floor(Math.random()*1e4);
      b.upgrades.push({ id:upgId, label:'Upgrade > '+toNm, sellPrice:charge, toCompany:charge, commission:0, collected:false,
        note:reason, seller:'', settle:'pending', at:at, method:'cash', feePct:0, fee:0, customerPaid:charge, slips:[] });
    }
    var tgt=x.s||O;                                   /* แถวแยกรับ → ค่าอยู่ที่ตัว split */
    var oldPick=x.s?String(x.s.pickTime||''):String(O.pickupTimeFinal||'');
    t.upg={ fromRouteId:U.from, toRouteId:U.to, date:U.date, reason:reason, charge:charge, upgId:upgId, by:by, at:at,
            van:{ key:key, gid:U.gid, newGid:newGid, vanId:U.vanId||'', pick:oldPick, pickChanged:pickChanged } };
    t.routeId=U.to;
    tgt.vanGroup=newGid;
    if(pickChanged){ if(x.s && bkSplitOwnPick(x.s)) x.s.pickTime=pick; else O.pickupTimeFinal=pick; }
    O.boatId=null; if(O.boatSplits) delete O.boatSplits;
    if(b.ops && b.ops.upgrade) b.ops.upgrade=null;
    if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'edit','Upgrade route (whole van) · '+fromNm+' > '+toNm+' · van group '+U.gid+' > '+newGid+' · '+reason+(charge>0?(' · +THB '+charge.toLocaleString()):' · no charge')+(pickChanged?(' · pickup '+(oldPick||'-')+' > '+(pick||'-')):''),'Edit');
  });
  /* จุดแวะของรถ+กรุ๊ปนี้ ย้ายคีย์ตามโปรแกรม */
  bkUpgVanMoveStops(U.date, U.from, U.gid, U.to, newGid, U.vanId);
  acctPersistBookings();
  bookingV2UpgVanClose();
  if(typeof bookingV2RenderKeep==='function') bookingV2RenderKeep(); else if(typeof bookingV2Render==='function') bookingV2Render();
}
