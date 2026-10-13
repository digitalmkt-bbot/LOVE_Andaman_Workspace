function bookingV2LockEditSubmit(){
  const id = _bkV2LockEditId;
  const l = SB_SEAT_LOCKS.find(x=>x.id===id);
  if(!l){ _bkV2LockEditId=null; _bkV2LockModalOpen=false; bookingV2Render(); return; }
  const f = _bkV2LockForm;
  const isB = f.scope==='bulk';
  if(!f.routeId){ alert('Pick a route first'); return; }
  if(isB){
    if(!f.dateFrom){ alert('Pick the first day of the range'); return; }
    /* วันจบว่าง = ช่วงยุบเหลือวันเดียว ซึ่งคือกับดักที่ทำให้เคสนี้เงียบหายไป */
    if(!f.dateTo){ alert('Pick the last day of the range'); return; }
    if(f.dateTo < f.dateFrom){ alert('The last day cannot be before the first day'); return; }
  } else if(!f.date){ alert('Pick a date'); return; }
  const qty = Number(f.qty);
  if(!(qty>0)){ alert('Enter the number of seats'); return; }
  const peak = (typeof bookingV2LockPeakUsed==='function') ? bookingV2LockPeakUsed(l) : 0;
  const alloc = (typeof bookingV2LockAllocated==='function') ? bookingV2LockAllocated(l) : 0;
  const floor = Math.max(peak, alloc);
  if(qty < floor){
    alert('Seats cannot go below ' + floor
      + (peak>=alloc ? ' (already drawn on one round)' : ' (already split into sub-groups)'));
    return;
  }
  let holderId = l.holderId;
  if(f.holderType==='agent'){
    const nm=(f.holderName||'').trim();
    if(!nm){ alert('Type the agent that holds the lock'); return; }
    const m=(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).find(a=>a.name.toLowerCase()===nm.toLowerCase());
    holderId = m ? m.id : nm;
  } else holderId = null;

  const moveLocked = bookingV2LockEditLocked(l);
  /* §lkPend · จำนวนที่เพิ่ม หรือวัน/เส้นทางที่ย้ายไป ที่ว่างพอไหม
     ไม่ได้ย้าย = ถามเฉพาะเมื่อส่วนที่ขาดมากกว่าที่รออยู่เดิม (แก้หมายเหตุเฉย ๆ ไม่ต้องโดนถามทุกครั้ง)
     ย้าย = คิดใหม่ทั้งใบ · pend ของวันเดิมไม่มีความหมายกับวันใหม่ */
  const _spec = moveLocked
    ? { scope:(bookingV2LockSpansDays(l)?'bulk':'day'), routeId:l.routeId, date:l.date||'', dateFrom:l.dateFrom||'', dateTo:l.dateTo||'', dow:(l.dow||[]), qty:qty }
    : { scope:f.scope, routeId:f.routeId, date:isB?'':f.date, dateFrom:isB?f.dateFrom:'', dateTo:isB?f.dateTo:'', dow:isB?(f.dow||[]):[], qty:qty };
  const _moved = !moveLocked && (_spec.scope!==(bookingV2LockSpansDays(l)?'bulk':'day') || _spec.routeId!==l.routeId
    || String(_spec.date||'')!==String(l.date||'') || String(_spec.dateFrom||'')!==String(l.dateFrom||'')
    || String(_spec.dateTo||'')!==String(l.dateTo||'') || (_spec.dow||[]).join(',')!==(l.dow||[]).join(','));
  const _shortAll = l.parentId ? [] : bookingV2LockShort(_spec, _moved ? null : l);
  const _shortNew = _moved ? _shortAll : _shortAll.filter(x => x.short > bookingV2LockPendOn(l, x.date));
  if(_shortNew.length && !bookingV2LockEditSubmit._ok){
    _bkV2LkPendAsk = { kind:'edit', routeId:_spec.routeId, short:_shortNew,
      run:()=>{ bookingV2LockEditSubmit._ok = true; try{ bookingV2LockEditSubmit(); } finally { bookingV2LockEditSubmit._ok = false; } } };
    bookingV2Render(); return;
  }
  const _qtyWas = l.qty||0;
  const before = { scope:(bookingV2LockSpansDays(l)?'bulk':'day'), routeId:l.routeId, date:l.date||'',
                   dateFrom:l.dateFrom||'', dateTo:l.dateTo||'', dow:(l.dow||[]).join(','),
                   qty:l.qty||0, holderType:l.holderType, holderId:l.holderId||'',
                   rdb:l.releaseDaysBefore, rt:l.releaseTime||'', expiry:l.expiry||'', reason:l.reason||'' };
  /* ที่ขายไปแล้วห้ามย้าย · ช่องพวกนี้ถูกปิดในฟอร์มอยู่แล้ว แต่กันไว้อีกชั้นตรงนี้ */
  if(!moveLocked){
    l.scope = f.scope;
    l.routeId = f.routeId;
    l.date = isB ? '' : f.date;
    l.dateFrom = isB ? f.dateFrom : '';
    l.dateTo = isB ? f.dateTo : '';
    l.dow = isB ? (f.dow||[]).slice() : [];
    l.holderType = f.holderType;
    l.holderId = holderId;
  }
  l.qty = qty;
  if(!l.parentId){
    if(_moved) bookingV2LockPendClear(l);
    else if(qty < _qtyWas) bookingV2LockPendShrink(l, _qtyWas - qty);
    if(_shortNew.length) bookingV2LockPendApply(l, _shortNew, 'split');
  }
  l.reason = f.reason||'';
  l.expiry = isB ? '' : (f.expiry||'');
  l.releaseDaysBefore = isB ? ((f.releaseDaysBefore==='' || f.releaseDaysBefore==null) ? null : Math.max(0,parseInt(f.releaseDaysBefore,10)||0)) : null;
  l.releaseTime = isB ? (f.releaseTime||'') : '';
  /* กรุ๊ปย่อยกินที่นั่งจากล็อกแม่ · ช่วงวันกับเส้นทางต้องเดินตามแม่เสมอ
     ไม่งั้นลูกจะค้างอยู่กับช่วงเดิมแล้วคิดที่นั่งคนละรอบกับแม่ */
  if(!moveLocked && typeof bookingV2LockChildren==='function'){
    bookingV2LockChildren(l.id).forEach(c=>{
      c.scope=l.scope; c.routeId=l.routeId; c.date=l.date;
      c.dateFrom=l.dateFrom; c.dateTo=l.dateTo; c.dow=(l.dow||[]).slice();
      c.holderType=l.holderType; c.holderId=l.holderId;
      c.releaseDaysBefore=l.releaseDaysBefore; c.releaseTime=l.releaseTime;
    });
  }
  const after = { scope:l.scope, routeId:l.routeId, date:l.date||'', dateFrom:l.dateFrom||'',
                  dateTo:l.dateTo||'', dow:(l.dow||[]).join(','), qty:l.qty, holderType:l.holderType,
                  holderId:l.holderId||'', rdb:l.releaseDaysBefore, rt:l.releaseTime||'',
                  expiry:l.expiry||'', reason:l.reason||'' };
  const chg=[];
  Object.keys(after).forEach(k=>{ if(String(before[k])!==String(after[k])) chg.push(k+': '+(before[k]===''||before[k]==null?'—':before[k])+' → '+(after[k]===''||after[k]==null?'—':after[k])); });
  if(chg.length){
    const today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
    (l.log=l.log||[]).push({ date:today, at:new Date().toISOString(), type:'edit',
                             by:((typeof laBy==='function')?laBy():''), note:chg.join(' · ') });
    sbSeatLocksPersist();
  }
  _bkV2LockEditId=null; _bkV2LockModalOpen=false;
  _bkV2LockForm.qty=''; _bkV2LockForm.reason=''; _bkV2LockForm.expiry='';
  bookingV2Render();
}
