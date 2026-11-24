function bookingV2LockUnalloc(parent, date){ return Math.max(0, (parent.qty||0) - bookingV2LockAllocated(parent, date)); }
