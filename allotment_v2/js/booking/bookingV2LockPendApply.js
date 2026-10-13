/* ตั้ง pend ตามผลที่ผู้ใช้เลือก · split = กันเท่าที่ว่าง ที่ขาดรอ · all = รอบที่ไม่พอ รอทั้งจำนวน */
function bookingV2LockPendApply(l, short, mode){
  if(!l || !short || !short.length) return 0;
  let tot=0;
  short.forEach(x=>{ const n = (mode==='all') ? x.want : x.short; bookingV2LockPendSet(l, x.date, n); tot+=n; });
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  const mx = short.reduce((m,x)=>Math.max(m, (mode==='all')?x.want:x.short), 0);
  (l.log=l.log||[]).push({ date:today, at:new Date().toISOString(), type:'pend', qty:mx,
    tripDate:(short.length===1?short[0].date:''), by:laBy(),
    note:(short.length===1 ? ('free '+short[0].free+' of '+short[0].want)
                           : (short.length+' rounds short: '+short.slice(0,6).map(x=>x.date.slice(5)+' ('+((mode==='all')?x.want:x.short)+')').join(', ')+(short.length>6?' ...':''))) });
  sbSeatLocksPersist();
  return tot;
}
