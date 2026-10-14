/* §bkActivity · การเรียงของแท็บ All bookings · จำต่อเครื่อง */
function bookingV2SortMode(){
  if(!_bkV2.sort){ let v=''; try{ v=localStorage.getItem('la_bkSort')||''; }catch(_){} _bkV2.sort = ['activity','travel','created'].includes(v) ? v : 'activity'; }
  return _bkV2.sort;
}
