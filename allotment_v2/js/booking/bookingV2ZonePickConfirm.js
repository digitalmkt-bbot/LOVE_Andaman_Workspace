function bookingV2ZonePickConfirm(){
  const st=window._bkV2ZonePick; if(!st || !st.sel) return;
  if(typeof acctCanEditBookings==='function' && !acctCanEditBookings()){ alert('View only - you cannot edit bookings.'); return; }
  const bk=(SB_BOOKINGS||[]).find(b=>b.id===st.bkId); if(!bk) return;
  if(st.sel===(bk.pickupAreaId||'')){ const ov=document.getElementById('bkv2-zonepick'); if(ov) ov.remove(); return; }
  const p=_bkV2ZonePickPlan(bk, st.sel); if(!p.area) return;
  const fromName=((bk.pickupAreaId&&bookingV2GetArea(bk.pickupAreaId))||{}).name || (bk.pickupArea||'').trim() || '—';
  const doTime=!!(document.getElementById('bkv2-zonepick-time')||{}).checked;
  bk.pickupAreaId=p.area.id;
  if(doTime) p.times.forEach(x=>{ x.t.pickupTime=x.to; });
  bookingV2AddHistory(bk, 'edit', 'Pickup zone: '+fromName+' -> '+(p.area.name||p.area.id)
    + (doTime&&p.times.length?(' · pickup time '+p.times.map(x=>(x.t.date||'')+' '+(x.from||'-')+'->'+x.to).join(', ')):''), 'Edited');
  acctPersistBookings();
  const ov=document.getElementById('bkv2-zonepick'); if(ov) ov.remove();
  bookingV2RenderKeep();
}
