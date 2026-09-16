// Create a sub-group (child) under a parent lock · carves from the parent's unallocated qty
function bookingV2CreateSubLock(parentId, subName, qty, opt){
  opt = opt||{};
  const p = SB_SEAT_LOCKS.find(x=>x.id===parentId); if(!p){ return null; }
  const q = Number(qty)||0; if(q<=0){ alert('Enter the number of seats for this sub-group'); return null; }
  /* §lkOver · ต้องหักที่นั่งที่ล็อคแม่ขายไปเองแล้วออกก่อน
     ไม่หัก = แบ่งที่นั่งที่ขายไปแล้วลงกรุ๊ปย่อยได้ ล็อคจ่ายที่นั่งเกินจำนวนที่มีจริง */
  const room = (typeof bookingV2LockUnallocDrawable==='function') ? bookingV2LockUnallocDrawable(p) : bookingV2LockUnalloc(p);
  if(q > room){
    const _raw=bookingV2LockUnalloc(p), _pu=Number(p.used)||0;
    alert('เกินจำนวนที่เหลือแบ่งได้ (เหลือ '+room+' ที่)'
      +((_pu>0 && _raw>room)?('\n\nยังไม่ได้แบ่ง '+_raw+' ที่ แต่ล็อคแม่ขายไปเองแล้ว '+_pu+' ที่'):''));
    return null;
  }
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  const nowTs = new Date().toISOString();
  const c = { id:LA_UID('lk'), parentId:parentId, subName:String(subName||'').trim()||'ย่อย',
    scope:p.scope, routeId:p.routeId, date:p.date||'', monthFrom:p.monthFrom||'', monthTo:p.monthTo||'', month:p.month||'', boatId:p.boatId||null,
    dateFrom:p.dateFrom||'', dateTo:p.dateTo||'', dow:Array.isArray(p.dow)?p.dow.slice():[], usedBy:{},   // §lkBulk · กรุ๊ปย่อยใช้ช่วงเดียวกับล็อกแม่
    holderType:p.holderType, holderId:p.holderId, qty:q, used:0,
    releaseDaysBefore:(p.releaseDaysBefore!=null?p.releaseDaysBefore:null), releaseTime:p.releaseTime||'',   // inherit parent's rolling cutoff
    reason:opt.reason||'', expiry:opt.expiry||p.expiry||'', status:'active', createdAt:nowTs, createdBy:laBy(),
    log:[{date:today, at:nowTs, type:'create', qty:q, by:laBy(), sub:true}] };
  SB_SEAT_LOCKS.push(c); sbSeatLocksPersist(); return c;
}
