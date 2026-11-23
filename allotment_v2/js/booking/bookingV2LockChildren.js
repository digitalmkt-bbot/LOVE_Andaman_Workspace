function bookingV2LockChildren(parentId, date){ return SB_SEAT_LOCKS.filter(x=>x.parentId===parentId && bookingV2LockKidOn(x, date)); }
