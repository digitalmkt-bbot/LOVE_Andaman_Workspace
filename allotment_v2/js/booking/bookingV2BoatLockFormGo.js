/* จากในฟอร์มแก้ · ไปเหมาลำ หรือปล่อยลำ */
function bookingV2BoatLockFormGo(act){
  const id=_bkBoatForm && _bkBoatForm.editId; if(!id) return;
  if(act==='charter'){ _bkBoatForm=null; bookingV2BoatLockToCharter(id); return; }
  bookingV2BoatLockReleaseGo(id);                       /* ถามยืนยันเอง · กดยกเลิกแล้วฟอร์มต้องยังอยู่ */
  const l=bookingV2BoatLockById(id);
  if(!l || l.status!=='active'){ _bkBoatForm=null; if(typeof bookingV2Render==='function') bookingV2Render(); }
}
