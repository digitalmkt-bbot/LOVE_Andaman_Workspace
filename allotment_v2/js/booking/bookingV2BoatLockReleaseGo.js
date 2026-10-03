/* ══ ปุ่มบนแถว · ปล่อยลำ / เปลี่ยนลำ ══════════════════════════════════════════ */
function bookingV2BoatLockReleaseGo(id){
  const l=bookingV2BoatLockById(id); if(!l) return;
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  const nm=bookingV2BoatNameOf(l.boatId), cap=bookingV2BoatCapOn(l.boatId,l.date);
  if(!confirm('Release the whole-boat hold?\n\n'+nm+' ('+cap+' seats) on '+l.date
    +'\n\nThe boat goes back into the seat pool immediately and anyone can book it.')) return;
  bookingV2BoatLockRelease(id,'manual');
  if(typeof bookingV2Render==='function') bookingV2Render();
}
