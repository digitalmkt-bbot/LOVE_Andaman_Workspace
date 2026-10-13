function bookingV2LockedTotal(routeId, date){ return bookingV2LocksFor(routeId,date).reduce((s,l)=>s+bookingV2LockPoolHold(l,date),0); }
