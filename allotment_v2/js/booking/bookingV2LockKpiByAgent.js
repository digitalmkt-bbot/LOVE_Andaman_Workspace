// KPI · per agent · locked vs converted (drawn)
function bookingV2LockKpiByAgent(agentId){
  const ls = SB_SEAT_LOCKS.filter(l => l.holderType==='agent' && l.holderId===agentId);
  const lockedQty = ls.reduce((s,l)=>s+(l.qty||0),0);
  const usedQty   = ls.reduce((s,l)=>s+(l.used||0),0);
  return { lockCount:ls.length, lockedQty, usedQty,
    conversion: lockedQty ? Math.round(usedQty/lockedQty*100) : 0,
    active: ls.filter(l=>l.status==='active').length,
    released: ls.filter(l=>l.status==='released').length,
    expired: ls.filter(l=>l.status==='expired').length };
}
