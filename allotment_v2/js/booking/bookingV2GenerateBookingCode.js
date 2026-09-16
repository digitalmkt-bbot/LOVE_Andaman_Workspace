function bookingV2GenerateBookingCode(){
  // BK-YYMMNNNN-XXX · readable month+sequence + random suffix.
  // ⚠ MULTI-USER SAFETY: the sequence alone is NOT unique across concurrent users/tabs
  // (two clients with the same count generate the same number → the diff-merge keys by id →
  //  one booking silently overwrites the other = data loss). The random suffix makes every id
  //  globally unique so concurrent bookings never collide. Sequence uses MAX (not count) so
  //  cancelled/merged rows don't cause a number to be reused.
  const now = new Date();
  const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth()+1).padStart(2,'0')}`;
  const prefix = `BK-${ym}`;
  let maxN = 0;
  (SB_BOOKINGS||[]).forEach(b=>{ if(b && b.id && b.id.indexOf(prefix)===0){ const m=String(b.id).slice(prefix.length).match(/^(\d{4})/); if(m){ const n=parseInt(m[1],10); if(n>maxN) maxN=n; } } });
  const seq = String(maxN+1).padStart(4,'0');
  const rand = (Math.random().toString(36).slice(2,6)+'0000').slice(0,4).toUpperCase();
  return `${prefix}${seq}-${rand}`;
}
