function bookingV2BoatLocksOn(ds){ return bookingV2BoatLocks().filter(l=>l.status==='active' && l.date===ds); }
