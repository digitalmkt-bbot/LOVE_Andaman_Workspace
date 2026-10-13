function bookingV2LockReleaseOverdueGo(dateStr){
  const list = bookingV2LockOverdueOn(dateStr);
  if(!list.length) return;
  const seats = list.reduce((a,l)=>a+bookingV2LockPoolHold(l,dateStr),0);
  if(!confirm('ปล่อยที่นั่งของทุกล็อกที่เลยกำหนดในวันนี้\n\n'+dateStr+' · '+list.length+' ล็อก · '+seats+' ที่'
    +'\n\nที่นั่งทั้งหมดจะกลับไปขายให้ใครก็ได้ทันที\nล็อกที่ยังไม่ถึงกำหนดไม่กระทบ\n\nยืนยัน?')) return;
  list.forEach(l=>bookingV2LockReleaseRound(l.id, dateStr));
  bookingV2Render();
}
