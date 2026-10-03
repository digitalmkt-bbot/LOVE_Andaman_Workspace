function bookingV2LockPendTotal(routeId, date){ return bookingV2LocksFor(routeId, date).reduce((s,l)=>s+bookingV2LockPendOn(l, date), 0); }
