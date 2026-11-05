function bookingV2LockReleaseOverdueGo(dateStr){
  const list = bookingV2LockOverdueOn(dateStr);
  if(!list.length) return;
  const seats = list.reduce((a,l)=>a+bookingV2LockPoolHold(l,dateStr),0);
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')){ alert('ปล่อยที่นั่งไม่ได้ · บัญชีนี้ไม่มีสิทธิ์แก้ไขหมวด "ปฏิบัติการ"'); return; }
  laAskSheet({ title:'ปล่อยทุกล็อกที่เลยกำหนด?', body:dateStr+' · '+list.length+' ล็อก · '+seats+' ที่\nที่นั่งทั้งหมดจะกลับไปขายให้ใครก็ได้ทันที\nล็อกที่ยังไม่ถึงกำหนดไม่กระทบ',
    okLabel:'ปล่อย '+seats+' ที่', color:'#A32D2D', onYes:function(){ list.forEach(l=>bookingV2LockReleaseRound(l.id, dateStr)); bookingV2Render(); } });   /* §lkRelSheet */
}
