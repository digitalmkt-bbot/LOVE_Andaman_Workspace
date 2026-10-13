function bookingV2ExtraTotal(bkId){ return pckN(bookingV2ExtrasFor(bkId).reduce((s,e)=>s+(e.total||0),0)); }
