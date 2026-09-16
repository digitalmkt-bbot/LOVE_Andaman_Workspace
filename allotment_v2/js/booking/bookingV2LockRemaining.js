function bookingV2LockRemaining(l, date){ return Math.max(0, (l.qty||0) - bookingV2LockUsedOn(l, date)); }
