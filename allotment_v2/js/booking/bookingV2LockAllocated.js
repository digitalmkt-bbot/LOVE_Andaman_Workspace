function bookingV2LockAllocated(parent){ return bookingV2LockChildren(parent.id).reduce((s,c)=>s+(c.qty||0),0); }
