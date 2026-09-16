// ═══════════════════════════════════════════════════════════════
// P3 · Booking Detail · view / FOC approval / cancel / edit
// ═══════════════════════════════════════════════════════════════
function bookingV2OpenDetail(id){
  if(!id) return;
  _bkV2.detailId = id;
  bookingV2Render();
  // scroll top
  try { document.querySelector('main')?.scrollTo({top:0,behavior:'instant'}); } catch(e){}
  window.scrollTo({top:0});
}
