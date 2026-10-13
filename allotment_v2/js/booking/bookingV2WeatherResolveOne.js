function bookingV2WeatherResolveOne(bkId,pfx){
  pfx=pfx||'wx-';
  const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); if(!bk||!bk.weatherResolve) return;
  const parts=String(bk.weatherResolve.event||'').split('|'); const routeId=parts[0], date=parts[1];
  const out=(document.getElementById(pfx+'out-'+bkId)||{}).value||'reschedule';
  const rName=((typeof ROUTES!=='undefined'&&ROUTES.find(r=>r.id===routeId))||{}).name||routeId;
  const inv=(typeof acctBookingInvoice==='function')?acctBookingInvoice(bk.id):null;
  const paid=inv?acctInvoicePaid(inv):0;
  if(out==='reschedule'){
    const ndv=(document.getElementById(pfx+'date-'+bkId)||{}).value||date;
    // New day → the OLD boat/van assignment no longer applies (matches bookingV2RescheduleBooking / the edit-path
    // date change) · clear the OLD date's per-day ops block BEFORE moving the trip, using the shared
    // bkOpsRead/bkOpsFor-aware helper so it lands on bk.ops (day 1) or the right t.ops (later days).
    if(ndv!==date && typeof bkOpsClear==='function') bkOpsClear(bk, date);
    (bk.trips||[]).forEach(t=>{ if(t.routeId===routeId && t.date===date) t.date=ndv; });
    bk.rebook={from:date,to:ndv,reason:'weather',at:new Date().toISOString()};
    bk.weatherResolve.newDate=ndv;
    bookingV2AddHistory(bk,'weather','Rescheduled '+rName+' · '+date+' → '+ndv+' (weather)','Reschedule');
  } else {
    bk.status='cancelled_weather'; bk.cancelReason='weather'; bk.cancelledAt=new Date().toISOString();
    if(out==='refund'){ if(inv&&paid>0) SB_PAYMENTS.push({id:'pay_r'+Date.now()+Math.random().toString(36).slice(2,5),invoiceId:inv.id,agentId:bk.agentId,amount:-Math.abs(paid),method:'refund',date:new Date().toISOString(),type:'refund'}); if(inv&&typeof acctVoidInvoice==='function') acctVoidInvoice(inv.id); bk.refund={amount:paid,status:'due'}; }
    else if(out==='credit'){ if(bk.agentId&&paid>0&&typeof acctCreateDeposit==='function') acctCreateDeposit(bk.agentId,paid,'transfer','Weather-cancel '+(bk.code||bk.id)); if(inv&&typeof acctVoidInvoice==='function') acctVoidInvoice(inv.id); }
    else { if(inv&&typeof acctVoidInvoice==='function') acctVoidInvoice(inv.id); }
    bookingV2AddHistory(bk,'weather','Cancelled '+rName+' · '+date+' (weather) · '+(out==='refund'?('Refund ฿'+Math.round(paid).toLocaleString()):out==='credit'?('Kept as credit ฿'+Math.round(paid).toLocaleString()):'No refund'), (out==='refund'?'Refund':out==='credit'?'Credit':'Cancel'));
  }
  bk.weatherResolve.status='resolved'; bk.weatherResolve.outcome=out; bk.weatherResolve.resolvedAt=new Date().toISOString();
  if(typeof sbPaymentsPersist==='function') sbPaymentsPersist();
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  bookingV2Render(); if(pfx!=='wxr-') bookingV2WeatherPanel(routeId,date);
}
