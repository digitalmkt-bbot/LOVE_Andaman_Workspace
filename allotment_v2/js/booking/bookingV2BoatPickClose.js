function bookingV2BoatPickClose(){
  const ov=document.getElementById('bkv2-boatpick'); if(ov) ov.remove();
  try{ document.removeEventListener('keydown', _bkV2BpkEsc); }catch(_){}
  document.querySelectorAll('td.bpk-cell').forEach(c=>c.classList.remove('bpk-cell'));
}
