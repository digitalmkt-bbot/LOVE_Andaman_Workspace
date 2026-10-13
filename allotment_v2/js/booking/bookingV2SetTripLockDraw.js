// Per-source draw picker (Option A · sub-groups) · stores t.lockDrawSel = {lockId:qty}
function bookingV2SetTripLockDraw(idx, lockId, qty){
  const t = _bkV2.newBooking && _bkV2.newBooking.trips[idx]; if(!t) return;
  const pax = bookingV2PaxAllTot(t.pax);
  t.lockDrawSel = t.lockDrawSel || {};
  const srcs = (typeof bookingV2DrawSources==='function') ? bookingV2DrawSources(t.routeId, t.date, _bkV2.newBooking.agentId) : [];
  const src = srcs.find(s=>s.lockId===lockId);
  const srcMax = src ? src.remaining : 0;
  let v = Math.max(0, Math.min(Number(qty)||0, srcMax));
  const others = Object.keys(t.lockDrawSel).reduce((s,k)=> s + (k===lockId?0:(Number(t.lockDrawSel[k])||0)), 0);
  v = Math.min(v, Math.max(0, pax - others));   // total across sources never exceeds pax
  if(v<=0) delete t.lockDrawSel[lockId]; else t.lockDrawSel[lockId]=v;
  t.lockUse = Object.values(t.lockDrawSel).reduce((s,x)=>s+(Number(x)||0),0);   // back-compat total
  bookingV2Render();
}
