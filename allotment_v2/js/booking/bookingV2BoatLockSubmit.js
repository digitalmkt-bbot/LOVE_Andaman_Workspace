function bookingV2BoatLockSubmit(){
  const f=_bkBoatForm; if(!f) return;
  if(!f.routeId){ alert('Choose a route'); return; }
  if(!f.date){ alert('Choose a date'); return; }
  if(!f.boatId){ alert('Choose a boat'); return; }
  /* §lkNoAuto · ที่นั่งเว้นวันหมดอายุได้ · เรือทั้งลำเว้นไม่ได้
     ของค้างเงียบหนึ่งวันของเรือทั้งลำคือ 40-65 ที่ที่ขายไม่ได้ ไม่ใช่หลักสิบ */
  if(!f.expiry){ alert('Expiry date is required for a whole-boat hold'); return; }
  if(f.expiry > f.date){ alert('Expiry must be on or before the travel date'); return; }
  const cap=Math.max(0,parseInt(f.minCap,10)||0);
  if(cap<=0){ alert('Enter the minimum seats promised'); return; }
  let holderId=null;
  if(f.holderType==='agent'){
    const nm=String(f.holderName||'').trim();
    if(!nm){ alert('Type the agent that holds the boat'); return; }
    const m=(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).find(a=>a&&String(a.name||'').toLowerCase()===nm.toLowerCase());
    holderId = m ? m.id : nm;
  }
  if(f.editId){
    const cur=bookingV2BoatLockById(f.editId);
    if(!cur){ _bkBoatForm=null; if(typeof bookingV2Render==='function') bookingV2Render(); return; }
    /* สัญญาลำเจาะจงไว้ · เปลี่ยนลำเงียบ ๆ ไม่ได้ เหตุผลเดียวกับปุ่มเปลี่ยนลำ */
    if(cur.boatId!==f.boatId && bookingV2BoatLockFixed(cur)){
      if(!confirm('This hold names a specific boat for '+bookingV2LockHolderName(cur)+'.\n\n'
        +bookingV2BoatNameOf(cur.boatId)+' -> '+bookingV2BoatNameOf(f.boatId)+'\n\nThe agent may already be selling that boat name. Tell them first. Continue?')) return;
    }
    const r=bookingV2BoatLockEdit(f.editId,{ routeId:f.routeId, date:f.date, boatId:f.boatId,
      holderType:f.holderType, holderId:holderId, minCap:cap, fixed:f.fixed!==false,
      expiry:f.expiry, reason:f.reason });
    if(!r.ok){
      alert(r.why==='taken' ? 'That boat is not free on this date'
        : r.why==='small' ? 'That boat has fewer seats than the minimum promised'
        : r.why==='land'  ? 'A land programme has no boat to hold'
        : 'Could not save the changes ('+r.why+')');
      return;
    }
    _bkBoatForm=null;
    if(typeof bookingV2Render==='function') bookingV2Render();
    return;
  }
  { const _B=bookingV2BoatLockBlockers(f.date,f.boatId,f.routeId);
    if(_B.otherRoute){ alert('That boat is already placed on '+bookingV2BoatLockRouteNm(_B.otherRoute)+' for '+f.date+'.\nA boat placed on another programme cannot be held here. Move it in Boat Operation first, or pick another boat.'); return; } }
  if(!bookingV2BoatLockCanTake(f.date,f.boatId,f.routeId)){ alert('That boat is no longer free on this date'); return; }
  const l=bookingV2CreateBoatLock({ routeId:f.routeId, date:f.date, boatId:f.boatId,
    holderType:f.holderType, holderId:holderId, minCap:cap, fixed:f.fixed!==false,
    expiry:f.expiry, reason:f.reason });
  if(!l){ alert('Could not create the hold'); return; }
  _bkBoatForm=null;
  if(typeof bookingV2Render==='function') bookingV2Render();
}
