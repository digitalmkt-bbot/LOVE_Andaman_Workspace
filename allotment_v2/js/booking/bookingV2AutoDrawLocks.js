// One-click: fill this trip's lock draw from available sources up to pax (children first, then parent-unalloc)
function bookingV2AutoDrawLocks(idx){
  const t = _bkV2.newBooking && _bkV2.newBooking.trips[idx]; if(!t) return;
  const pax = bookingV2PaxAllTot(t.pax);
  const srcs = (typeof bookingV2DrawSources==='function') ? bookingV2DrawSources(t.routeId, t.date, _bkV2.newBooking.agentId) : [];
  const sel = {}; let need = pax;
  for(const s of srcs){ if(need<=0) break; const take = Math.min(need, s.remaining); if(take>0){ sel[s.lockId]=take; need-=take; } }
  t.lockDrawSel = sel;
  t.lockUse = Object.values(sel).reduce((a,b)=>a+(Number(b)||0),0);
  bookingV2Render();
}
