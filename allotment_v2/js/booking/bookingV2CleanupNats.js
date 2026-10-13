// Cleanup existing custom nationalities: fix names, drop junk, merge duplicates, remap bookings
function bookingV2CleanupNats(){
  if(typeof SB_CUSTOM_NATIONALITIES==='undefined') return {kept:0,removed:0,bookingsRemapped:0};
  const seen={}, remap={}, kept=[];
  SB_CUSTOM_NATIONALITIES.forEach(n=>{
    const clean=_bkNatClean(n.name); const k=_bkNatNorm(clean);
    if(!clean || !k){ remap[n.code]=''; return; }                                  // junk → drop
    if(clean.replace(/[^A-Za-z฀-๿]/g,'').length < 2){ remap[n.code]=''; return; }   // too short (e.g. stray "Q") → drop
    const bi=BKV2_NATIONALITIES.find(b=>_bkNatNorm(b.name)===k);
    if(bi){ remap[n.code]=bi.code; return; }                                       // duplicates a built-in → use built-in
    if(seen[k]){ remap[n.code]=seen[k]; return; }                                  // duplicate custom → merge
    seen[k]=n.code; remap[n.code]=n.code; n.name=clean; kept.push(n);
  });
  const removed=SB_CUSTOM_NATIONALITIES.length-kept.length;
  SB_CUSTOM_NATIONALITIES.length=0; kept.forEach(n=>SB_CUSTOM_NATIONALITIES.push(n));
  sbNationalitiesPersist();
  let changed=0;
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b=>{
    if(b.leadNationality && remap[b.leadNationality]!==undefined && remap[b.leadNationality]!==b.leadNationality){ b.leadNationality=remap[b.leadNationality]; changed++; }
    if(Array.isArray(b.passengers)) b.passengers.forEach(p=>{ if(p.nationality && remap[p.nationality]!==undefined && remap[p.nationality]!==p.nationality){ p.nationality=remap[p.nationality]; } });
  });
  if(changed && typeof acctPersistBookings==='function') acctPersistBookings();
  return {kept:kept.length, removed, bookingsRemapped:changed};
}
