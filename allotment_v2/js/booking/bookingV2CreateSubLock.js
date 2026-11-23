// Create a sub-group (child) under a parent lock · carves from the parent's unallocated qty
function bookingV2CreateSubLock(parentId, subName, qty, opt){
  opt = opt||{};
  const p = SB_SEAT_LOCKS.find(x=>x.id===parentId); if(!p){ return null; }
  const q = Number(qty)||0; if(q<=0){ alert('Enter the number of seats for this sub-group'); return null; }
  /* §lkOver · ต้องหักที่นั่งที่ล็อคแม่ขายไปเองแล้วออกก่อน
     ไม่หัก = แบ่งที่นั่งที่ขายไปแล้วลงกรุ๊ปย่อยได้ ล็อคจ่ายที่นั่งเกินจำนวนที่มีจริง */
  /* §lkSubDay · ใบแม่ Bulk · กรุ๊ปย่อยต้องมีวันเดินทาง แบ่งจากยอดของวันนั้น */
  const _pB = bookingV2LockSpansDays(p);
  const _kd = _pB ? String(opt.date||'') : '';
  if(_pB){
    if(!_kd){ alert('เลือกวันเดินทางของกรุ๊ปย่อยก่อน'); return null; }
    if(bookingV2LockSpecDates(p).indexOf(_kd)<0){ alert('วันที่ '+_kd+' ไม่อยู่ในรอบของล็อกนี้'); return null; }
    if(bookingV2LockRoundReleased(p, _kd)){ alert('รอบ '+_kd+' ของล็อกนี้ถูกปล่อยไปแล้ว'); return null; }
  }
  const room = _pB ? bookingV2LockSubRoom(p, _kd) : bookingV2LockSubRoom(p);   /* §lkPendSub · แบ่งได้ถึงจำนวนที่ขอ รวมส่วนที่ยังรอที่ว่าง */
  if(q > room){
    const _raw=bookingV2LockUnalloc(p, _kd||undefined), _pu=_pB ? bookingV2LockUsedOn(p, _kd) : (Number(p.used)||0);
    alert('เกินจำนวนที่เหลือแบ่งได้'+(_kd?(' ของวันที่ '+_kd):'')+' (เหลือ '+room+' ที่)'
      +((_pu>0 && _raw>room)?('\n\nยังไม่ได้แบ่ง '+_raw+' ที่ แต่ล็อคแม่ขายไปเองแล้ว '+_pu+' ที่'):''));
    return null;
  }
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  const nowTs = new Date().toISOString();
  const c = { id:LA_UID('lk'), parentId:parentId, subName:String(subName||'').trim()||'ย่อย',
    scope:(_pB?'day':p.scope), routeId:p.routeId, date:(_pB?_kd:(p.date||'')), monthFrom:_pB?'':(p.monthFrom||''), monthTo:_pB?'':(p.monthTo||''), month:_pB?'':(p.month||''), boatId:p.boatId||null,
    dateFrom:_pB?'':(p.dateFrom||''), dateTo:_pB?'':(p.dateTo||''), dow:_pB?[]:(Array.isArray(p.dow)?p.dow.slice():[]), usedBy:{},   // §lkSubDay · ใต้ Bulk = กรุ๊ปของวันเดียว
    holderType:p.holderType, holderId:p.holderId, qty:q, used:0,
    releaseDaysBefore:(p.releaseDaysBefore!=null?p.releaseDaysBefore:null), releaseTime:p.releaseTime||'',   // inherit parent's rolling cutoff
    reason:opt.reason||'', expiry:(_pB ? _kd : (opt.expiry||p.expiry||'')), status:'active', createdAt:nowTs, createdBy:laBy(),
    log:[{date:today, at:nowTs, type:'create', qty:q, by:laBy(), sub:true, tripDate:_kd}] };
  SB_SEAT_LOCKS.push(c); sbSeatLocksPersist(); return c;
}
