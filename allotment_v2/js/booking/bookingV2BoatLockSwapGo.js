function bookingV2BoatLockSwapGo(id){
  const l=bookingV2BoatLockById(id); if(!l) return;
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  const free=bookingV2BoatLockPickList(l.date,l.routeId).filter(b=>b.ok && b.id!==l.boatId);
  if(!free.length){ alert('No other boat is free on this date'); return; }
  const min=bookingV2BoatLockMinCap(l);
  const lines=free.map((b,i)=>(i+1)+') '+b.name+' - '+b.cap+' seats'+(b.cap<min?'  [below promised '+min+']':'')).join('\n');
  const pick=prompt('Swap '+bookingV2BoatNameOf(l.boatId)+' to which boat?\n\n'+lines+'\n\nType the number:');
  const n=parseInt(pick,10); if(!n || n<1 || n>free.length) return;
  const tgt=free[n-1];
  /* สัญญาลำเจาะจงไว้ · เอเยนต์อาจเอาชื่อเรือไปขายต่อแล้ว สลับเงียบ ๆ ไม่ได้ */
  if(bookingV2BoatLockFixed(l)){
    if(!confirm('This hold names a specific boat for '+bookingV2LockHolderName(l)+'.\n\n'
      +bookingV2BoatNameOf(l.boatId)+' -> '+tgt.name+'\n\nThe agent may already be selling that boat name. Tell them first. Continue?')) return;
  }
  if(!bookingV2BoatLockSwap(id,tgt.id)){
    alert(tgt.cap < min
      ? ('That boat has '+tgt.cap+' seats - below the '+min+' promised to the agent. Pick a bigger boat.')
      : 'Swap failed - that boat is no longer free');
    return;
  }
  if(typeof bookingV2Render==='function') bookingV2Render();
}
