function bookingV2BoatUpgrade(bkId){
  const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return;
  const _rerender=()=>{ if(_bkV2 && _bkV2.boatAssignMode && typeof bookingV2Render==='function') bookingV2Render(); else renderBoatAssign(); };
  if(b.ops&&b.ops.upgrade){ if(confirm('Remove the upgrade flag from this booking?')){ b.ops.upgrade=null; acctPersistBookings(); _rerender(); } return; }
  const reason=prompt('Upgrade / move this guest to another boat or route (emergency).\nReason:', '');
  if(reason===null) return;
  const chargeStr=prompt('Upgrade charge (THB) · 0 = goodwill/free', '0'); if(chargeStr===null) return;
  const charge=Math.max(0,Number(chargeStr)||0);
  b.ops=b.ops||{}; b.ops.upgrade={reason:(reason||'').trim(), charge, by:laBy(), at:new Date().toISOString()};
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'edit','Upgrade · '+(reason||'')+(charge>0?(' · ฿'+charge.toLocaleString()):' · free'),'Edit');
  acctPersistBookings(); _rerender();   // now the boat dropdown lists ALL day boats
}
