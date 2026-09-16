function bookingV2LockDrawable(l, date){ return l.parentId ? bookingV2LockRemaining(l, date) : bookingV2LockUnallocDrawable(l, date); }
