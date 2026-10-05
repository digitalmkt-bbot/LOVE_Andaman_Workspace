function bookingV2PartialConfirm(bookingId, tripIdx){
  const bk=SB_BOOKINGS.find(b=>b.id===bookingId); if(!bk) return;
  const t=bk.trips[tripIdx]; if(!t){ acctModalClose(); return; }
  const category=(document.getElementById('bkp-cat')||{}).value||'';
  if(!category){ alert('กรุณาเลือกประเภทการยกเลิก'); return; }
  const note=((document.getElementById('bkp-note')||{}).value||'').trim();
  if(category==='other' && !note){ alert('กรุณาระบุรายละเอียดสำหรับ "อื่นๆ"'); return; }
  const removed={}; let totalRem=0;
  BKV2_PAX_KEYS.forEach(([k])=>{
    const el=document.getElementById('bkp-rm-'+k); if(!el) return;
    let n=Math.max(0,Math.min(parseInt(el.value)||0,t.pax[k]||0));
    if(n>0){ removed[k]=n; totalRem+=n; }
  });
  if(!totalRem){ alert('กรุณาระบุจำนวนผู้โดยสารที่จะลด'); return; }
  // charge / waive split
  let chargedCount=Math.max(0,Math.min(parseInt((document.getElementById('bkp-chg-cnt')||{}).value)||0,totalRem));
  const waivedCount=Math.max(0,totalRem-chargedCount);
  const chargeAmt=Math.max(0,Number((document.getElementById('bkp-chg-amt')||{}).value)||0);
  const waiveAmt=Math.max(0,Number((document.getElementById('bkp-waive-amt')||{}).value)||0);  // = refund (only the not-charged)
  const refund=waiveAmt;
  const refundMode=refund>0?'refund':'none';
  acctModalClose();
  /* §opsAction · server first · operation-backend matches the trip by its own id */
  const _apply=function(){
    bookingV2PartialCancel(bookingId, tripIdx, { removed, totalRem, category, note, refundMode, refund,
      charged:{count:chargedCount, amount:chargeAmt}, waived:{count:waivedCount, amount:waiveAmt} });
    if(typeof bookingV2Render==='function') bookingV2Render();
  };
  if(typeof laOpsBookingAction==='function' && bk.opsId && !t.opsTripId){
    if(typeof laSaveToast==='function') laSaveToast({kind:'error', title:'Reduce pax refused', id:bookingId, status:'NOT SYNCED',
      sub:'This trip has no operation-backend id yet · save the booking once, then try again', dur:9000});
    return;
  }
  if(typeof laOpsBookingAction==='function')
    laOpsBookingAction(bookingId, 'partial-cancel', { trip_id:t.opsTripId, pax:removed, category, note,
      charged:{count:chargedCount, amount:chargeAmt}, waived:{count:waivedCount, amount:waiveAmt} }, _apply, 'Reduce pax');
  else _apply();
}
