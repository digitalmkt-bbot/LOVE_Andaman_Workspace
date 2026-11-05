function bookingV2LockReleaseRoundGo(lockId, tripDate){
  const l = SB_SEAT_LOCKS.find(x=>x.id===lockId);
  if(!l){ alert('ไม่พบล็อกนี้แล้ว · กดรีเฟรชหน้าแล้วลองใหม่'); return; }
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')){
    alert('ปล่อยที่นั่งไม่ได้ · บัญชีนี้ไม่มีสิทธิ์แก้ไขหมวด "ปฏิบัติการ"\n\nให้ผู้ที่มีสิทธิ์กดปล่อย หรือขอเพิ่มสิทธิ์ที่ผู้ดูแลระบบ'); return; }
  if(bookingV2LockRoundReleased(l, tripDate)){ alert('รอบ '+tripDate+' ของล็อกนี้ถูกปล่อยไปแล้ว'); return; }
  const seats = bookingV2LockPoolHold(l, tripDate);
  if(seats<=0){ alert('รอบ '+tripDate+' ไม่มีที่นั่งค้างให้ปล่อย (ใช้ครบแล้วหรือเป็นล็อกลูก)'); return; }
  const nm = (typeof bookingV2LockHolderName==='function')?bookingV2LockHolderName(l):'';
  laAskSheet({ title:'ปล่อยที่นั่งคืนเข้า pool?',
    body: nm+' · '+tripDate+' · '+seats+' ที่\nที่นั่งจะกลับไปขายให้ใครก็ได้ทันที'+(bookingV2LockSpansDays(l)?'\nรอบอื่นของล็อกนี้ไม่กระทบ':''),
    okLabel:'ปล่อย '+seats+' ที่', color:'#A32D2D',
    onYes:function(){
      const n=bookingV2LockReleaseRound(lockId, tripDate);
      bookingV2Render();
      try{ var tt=document.createElement('div'); tt.textContent='✓ ปล่อยแล้ว '+n+' ที่ · '+nm+' · '+tripDate; tt.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:100060;background:#0F6E56;color:#fff;padding:10px 16px;border-radius:10px;font:700 12.5px system-ui;box-shadow:0 6px 18px rgba(0,0,0,.2)'; document.body.appendChild(tt); setTimeout(function(){ tt.remove(); },3500); }catch(_){}
    } });
}
