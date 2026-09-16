// Locks a given booking/agent may draw from · agent's own + office + global
function bookingV2LocksForAgent(routeId, date, agentId){
  return bookingV2LocksFor(routeId, date).filter(l => !l.parentId && (l.holderType==='office' || l.holderType==='global' || (l.holderType==='agent' && l.holderId===agentId)));
}
