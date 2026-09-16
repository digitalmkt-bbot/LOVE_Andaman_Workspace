function bookingV2TopbarMeta(){
  if(_bkV2.tab === 'cal'){
    const agg = bookingV2Aggregate();
    const ym = `${_bkV2.cursor.getFullYear()}-${String(_bkV2.cursor.getMonth()+1).padStart(2,'0')}`;
    let total = 0; const bkSet = new Set();
    Object.entries(agg.byDate).forEach(([d,x]) => {
      if(d.startsWith(ym)){ total += x.total; x.bookings.forEach(id => bkSet.add(id)); }
    });
    return `${total} pax &middot; ${bkSet.size} bookings`;
  } else if(_bkV2.tab === 'bytrip'){
    if(_bkV2.filterRoute || _bkV2.filterDate){
      const r = _bkV2.filterRoute ? bookingV2RouteShort(_bkV2.filterRoute) : 'any route';
      const d = _bkV2.filterDate ? bookingV2FmtDate(_bkV2.filterDate) : 'any date';
      return `${r} &middot; ${d}`;
    }
    return 'no filter';
  } else if(_bkV2.tab === 'locks'){
    const active = SB_SEAT_LOCKS.filter(l=>l.status==='active' && !l.parentId);
    const dRem = active.filter(l=>!bookingV2LockSpansDays(l)).reduce((s,l)=>s+bookingV2LockHeldRemaining(l),0);
    const bRem = active.filter(l=>bookingV2LockSpansDays(l)).reduce((s,l)=>s+(l.qty||0),0);
    return `${active.length} active &middot; ${dRem} seats held &middot; ${bRem}/รอบ`;
  } else if(_bkV2.tab === 'approvals'){
    const n = (SB_BOOKINGS||[]).filter(b=>b.status==='pending_approval').length;
    return `${n} รออนุมัติ`;
  } else if(_bkV2.tab === 'cancel'){
    const c = (SB_BOOKINGS||[]).filter(b=>b.status==='cancelled'||b.status==='cancelled_weather').length;
    return `${c} cancellation${c===1?'':'s'}`;
  } else {
    return `${SB_BOOKINGS.length} bookings total`;
  }
}
