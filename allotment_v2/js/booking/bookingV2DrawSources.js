// Drawable SOURCES for a booking · expands each parent into its sub-groups (A/B/C) + the parent's unallocated remainder
function bookingV2DrawSources(routeId, date, agentId){
  const out=[];
  bookingV2LocksForAgent(routeId,date,agentId).forEach(l=>{
    const kids=bookingV2LockChildren(l.id);
    if(kids.length){
      kids.forEach(c=>{ const r=bookingV2LockRemaining(c,date); if(r>0) out.push({lockId:c.id, label:bookingV2LockHolderName(l)+' · '+(c.subName||'ย่อย'), remaining:r}); });
      const ur=bookingV2LockUnallocDrawable(l,date); if(ur>0) out.push({lockId:l.id, label:bookingV2LockHolderName(l)+' · ยังไม่จัด', remaining:ur});
    } else {
      const r=bookingV2LockRemaining(l,date); if(r>0) out.push({lockId:l.id, label:bookingV2LockHolderName(l), remaining:r});
    }
  });
  return out;
}
