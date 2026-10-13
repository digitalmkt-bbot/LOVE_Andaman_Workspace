function bookingV2LockAddSubmit(){
  const m=_bkV2AddModal; if(!m) return;
  const n=parseInt(m.add,10)||0;
  if(n<=0){ alert('ใส่จำนวนที่จะเพิ่ม'); return; }
  /* §lkPend · เพิ่มที่นั่งก็คือขอที่จากพูลเพิ่ม · ที่ว่างไม่พอ = ถามก่อน (ใบลูกแบ่งจากแม่ ไม่เกี่ยวกับพูล) */
  const _l = SB_SEAT_LOCKS.find(x=>x.id===m.lockId);
  if(_l && !_l.parentId && !bookingV2IsBoatLock(_l)){
    const _sp = { scope:(bookingV2LockSpansDays(_l)?'bulk':'day'), routeId:_l.routeId, date:_l.date||'', dateFrom:_l.dateFrom||'', dateTo:_l.dateTo||'', dow:(_l.dow||[]), qty:(_l.qty||0)+n };
    const _sh = bookingV2LockShort(_sp, _l).filter(x => x.short > bookingV2LockPendOn(_l, x.date));
    if(_sh.length){
      _bkV2LkPendAsk = { kind:'add', routeId:_l.routeId, short:_sh,
        run:()=>{ if(bookingV2LockAddSeats(m.lockId, n, m.note)){ bookingV2LockPendApply(_l, _sh, 'split'); _bkV2AddModal=null; } bookingV2Render(); } };
      bookingV2Render(); return;
    }
  }
  if(bookingV2LockAddSeats(m.lockId, n, m.note)){ _bkV2AddModal=null; bookingV2Render(); }
}
