function bookingV2LockUnalloc(parent){ return Math.max(0, (parent.qty||0) - bookingV2LockAllocated(parent)); }
