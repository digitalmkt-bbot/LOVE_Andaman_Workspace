function bookingV2LockUnallocDrawable(parent, date){ return Math.max(0, bookingV2LockUnalloc(parent) - bookingV2LockUsedOn(parent, date)); }
