function bookingV2LockCreateSubmit(){
  const f = _bkV2LockForm;
  if(!f.routeId){ alert('เลือกเส้นทางก่อน'); return; }
  if(f.scope==='bulk'){
    if(!f.dateFrom){ alert('เลือกวันเริ่มของช่วง'); return; }
    if(f.dateTo && f.dateTo < f.dateFrom){ alert('วันจบต้องไม่ก่อนวันเริ่ม'); return; }
  }
  else if(!f.date){ alert('เลือกวันที่'); return; }
  if(!(Number(f.qty) > 0)){ alert('ใส่จำนวนที่นั่งที่จะกันไว้'); return; }
  let holderId = null;
  if(f.holderType==='agent'){
    const nm = (f.holderName||'').trim();
    if(!nm){ alert('Type the agent that holds the lock'); return; }
    const match = (typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).find(a => a.name.toLowerCase() === nm.toLowerCase());
    holderId = match ? match.id : nm;   // free-text holder allowed
  }
  const isB = f.scope==='bulk';
  bookingV2CreateLock({ scope:f.scope, routeId:f.routeId, date:isB?'':f.date,
    dateFrom:isB?f.dateFrom:'', dateTo:isB?(f.dateTo||f.dateFrom):'', dow:isB?(f.dow||[]):[],
    holderType:f.holderType, holderId:holderId, qty:Number(f.qty), reason:f.reason,
    expiry:isB?'':f.expiry,                                                   // bulk locks use the rolling cutoff, not a hard expiry
    releaseDaysBefore:isB?f.releaseDaysBefore:null, releaseTime:isB?f.releaseTime:'' });
  _bkV2LockForm.qty=''; _bkV2LockForm.reason=''; _bkV2LockForm.expiry='';     // reset (fixes stale-expiry carrying to the next lock)
  _bkV2LockModalOpen = false;   // close if opened from Calendar
  bookingV2Render();
}
