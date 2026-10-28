// ═══════════════════════════════════════════════════════════════
// P3 · Booking Detail · view / FOC approval / cancel / edit
// ═══════════════════════════════════════════════════════════════
function bookingV2OpenDetail(id){
  if(bkLimProg()) return;   /* §bkLim */
  if(!id) return;
  if(typeof laPierScoped==='function' && laPierScoped()){ const _b=(SB_BOOKINGS||[]).find(x=>x&&x.id===id); if(_b && !laBkOk(_b)){ alert('This booking belongs to another pier.'); return; } }   /* §pierScope */
  _bkV2.detailId = id;
  bookingV2Render();
  // scroll top
  try { document.querySelector('main')?.scrollTo({top:0,behavior:'instant'}); } catch(e){}
  window.scrollTo({top:0});
}
