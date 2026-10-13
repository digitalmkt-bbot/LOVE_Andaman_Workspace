/* เปิดฟอร์มจองใหม่แบบเหมาลำ กรอกให้ล่วงหน้าจากใบล็อก · คนกรอกแค่จำนวนหัวกับราคา */
function bookingV2BoatLockToCharter(id){
  const l = bookingV2BoatLockById(id); if(!l || l.status!=='active') return;
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  if(typeof bookingV2NewBooking!=='function'){ alert('Booking form is not available'); return; }
  bookingV2NewBooking();
  const d = _bkV2.newBooking; if(!d) return;
  if(l.holderType==='agent' && l.holderId) d.agentId = l.holderId;
  d._boatLockId = l.id;
  const t = (d.trips||[])[0]; if(t){
    t.routeId = l.routeId; t.date = l.date;
    t.bookingMode = 'charter'; t.charterBoatId = l.boatId;
  }
  _bkV2.tab = 'new';
  if(typeof bookingV2Render==='function') bookingV2Render();
}
