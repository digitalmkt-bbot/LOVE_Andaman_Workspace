function bookingV2PaySlipsOpen(bkId){
  if(typeof pfmViewSlips!=='function'){ alert('หน้าจัดการสลิปไม่พร้อม'); return; }
  _bkV2PaySlipBack=bkId;
  try{ if(typeof acctModalClose==='function') acctModalClose(); }catch(_){ }
  pfmViewSlips(bkId);
}
