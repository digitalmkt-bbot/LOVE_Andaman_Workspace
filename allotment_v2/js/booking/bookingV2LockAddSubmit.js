function bookingV2LockAddSubmit(){
  const m=_bkV2AddModal; if(!m) return;
  const n=parseInt(m.add,10)||0;
  if(n<=0){ alert('ใส่จำนวนที่จะเพิ่ม'); return; }
  if(bookingV2LockAddSeats(m.lockId, n, m.note)){ _bkV2AddModal=null; bookingV2Render(); }
}
