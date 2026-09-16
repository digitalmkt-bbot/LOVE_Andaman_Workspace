// Total pax of a van-group (date|route|zone|gid) · split parts use their own pax, non-split use the matching trip's pax
function bookingV2VanGroupPax(date, routeId, zone, gid){
  let tot=0;
  _bkV2GrpApply(date,routeId,zone,gid,(b,s)=>{
    if(s){ tot += (+s.pax||0); return; }
    let n=0;
    (b.trips||[]).forEach(t=>{ if((t.date||'')!==date||(t.routeId||'')!==routeId) return; const z=(t.bookingMode==='charter')?'__CHARTER__':(t.zone||b.pickupZone||''); if(z!==zone) return; const p=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0; if(p>n)n=p; });
    tot += n;
  });
  return tot;
}
