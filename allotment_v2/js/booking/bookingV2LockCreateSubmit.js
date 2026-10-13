function bookingV2LockCreateSubmit(){
  const f = _bkV2LockForm;
  if(!f.routeId){ alert('เลือกเส้นทางก่อน'); return; }
  if(f.scope==='bulk'){
    if(!f.dateFrom){ alert('Pick the first day of the range'); return; }
    /* §lkZero · ต้นทางของเคส Panorama · ของเดิมปล่อยให้เว้นวันจบได้
       แล้ว bookingV2LockRange เติมเป็น to = dateFrom · ช่วงยุบเหลือวันเดียวเงียบ ๆ */
    if(!f.dateTo){ alert('Pick the last day of the range'); return; }
    if(f.dateTo < f.dateFrom){ alert('The last day cannot be before the first day'); return; }
    /* ล็อกที่ไม่ครอบรอบไหนเลย สร้างไปก็ไม่ขึ้น manifest วันไหน · กันตั้งแต่ตรงนี้ */
    const _rd = bookingV2LockRounds({ scope:'bulk', routeId:f.routeId, dateFrom:f.dateFrom,
                                 dateTo:f.dateTo, dow:(f.dow||[]) });
    if(!_rd.total){ alert('This lock covers no departure at all - check the date range and the weekdays you ticked'); return; }
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
  const _o = { scope:f.scope, routeId:f.routeId, date:isB?'':f.date,
    dateFrom:isB?f.dateFrom:'', dateTo:isB?(f.dateTo||f.dateFrom):'', dow:isB?(f.dow||[]).slice():[],
    holderType:f.holderType, holderId:holderId, qty:Number(f.qty), reason:f.reason,
    expiry:isB?'':f.expiry,                                                   // bulk locks use the rolling cutoff, not a hard expiry
    releaseDaysBefore:isB?f.releaseDaysBefore:null, releaseTime:isB?f.releaseTime:'' };
  const _mk = (short, mode) => {
    const l = bookingV2CreateLock(_o);
    if(short && short.length) bookingV2LockPendApply(l, short, mode);
    _bkV2LockForm.qty=''; _bkV2LockForm.reason=''; _bkV2LockForm.expiry='';   // reset (fixes stale-expiry carrying to the next lock)
    _bkV2LockModalOpen = false;   // close if opened from Calendar
    bookingV2Render();
  };
  /* §lkPend · ที่ว่างไม่พอ = ถามก่อน ไม่ล็อกเกินเงียบ ๆ อีกแล้ว */
  const _short = bookingV2LockShort(_o, null);
  if(_short.length){ _bkV2LkPendAsk = { kind:'create', routeId:_o.routeId, short:_short, run:(mode)=>_mk(_short, mode) }; bookingV2Render(); return; }
  _mk(null);
}
