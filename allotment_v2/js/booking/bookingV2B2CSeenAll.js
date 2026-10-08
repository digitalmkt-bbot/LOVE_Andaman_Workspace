function bookingV2B2CSeenAll(){
  const L=bookingV2B2CList(); if(!L.length) return;
  if(!confirm('Mark all '+L.length+' B2C changes as seen?')) return;
  let n=0; L.forEach(x=>{ if(bookingV2B2CSeen(x.bk.id,true)) n++; });
  if(n){ bookingV2PersistBookings(); }
  bookingV2B2CAfter();
}
