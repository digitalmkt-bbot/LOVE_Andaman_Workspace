function bookingV2LockPendSet(l, date, n){
  n = Math.max(0, parseInt(n,10)||0);
  if(bookingV2LockSpansDays(l)){
    if(!l.pendBy || typeof l.pendBy!=='object' || Array.isArray(l.pendBy)) l.pendBy = {};
    if(n) l.pendBy[date] = n; else delete l.pendBy[date];
  } else l.pendQty = n;
}
