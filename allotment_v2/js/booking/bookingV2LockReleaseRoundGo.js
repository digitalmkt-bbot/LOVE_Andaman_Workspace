// Release · custom modal (replaces native prompt)
/* §lkNoAuto · กดปล่อยรอบเดียว · ถามก่อนเพราะที่นั่งจะกลับไปขายให้ใครก็ได้ทันที */
function bookingV2LockReleaseRoundGo(lockId, tripDate){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId); if(!l) return;
  const seats = bookingV2LockPoolHold(l, tripDate);
  if(seats<=0) return;
  const nm = (typeof bookingV2LockHolderName==='function')?bookingV2LockHolderName(l):'';
  if(!confirm('ปล่อยที่นั่งของรอบนี้คืนเข้า pool\n\n'+nm+' · '+tripDate+' · '+seats+' ที่'
    +'\n\nที่นั่งจะกลับไปขายให้ใครก็ได้ทันที'
    +(bookingV2LockSpansDays(l)?'\nรอบอื่นของล็อกนี้ไม่กระทบ':'')+'\n\nยืนยัน?')) return;
  bookingV2LockReleaseRound(lockId, tripDate);
  bookingV2Render();
}
