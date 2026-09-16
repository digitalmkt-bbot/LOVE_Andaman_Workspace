// Auto-release locks past expiry (called on load) · month locks expire only when the month RANGE ends
function bookingV2LockExpireSweep(){
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  const ymNow = today.slice(0,7);
  let changed = false;
  SB_SEAT_LOCKS.forEach(l => {
    if(bookingV2LockSpansDays(l)){
      const to = bookingV2LockRange(l).to;
      // heal: a month lock wrongly expired by the OLD expiry-based sweep while still in range → reactivate (recovers long-term holds)
      if(l.status==='expired' && to && today <= to){ l.status='active'; (l.log=l.log||[]).push({date:today,type:'reactivate',note:'range still open'}); changed=true; return; }
      // expire only when the whole range has passed
      if(l.status==='active' && to && today > to){ l.status='expired'; (l.log=l.log||[]).push({date:today,type:'expire',note:'range ended'}); changed=true; }
    } else {
      if(l.status==='active' && l.expiry && l.expiry < today){ l.status='expired'; (l.log=l.log||[]).push({date:today,type:'expire'}); changed=true; }
    }
  });
  if(changed) sbSeatLocksPersist();
}
