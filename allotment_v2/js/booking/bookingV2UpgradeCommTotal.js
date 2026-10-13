function bookingV2UpgradeCommTotal(bkId){ return pckN(bookingV2UpgradesFor(bkId).reduce((s,u)=>s+(+u.commission||0),0)); }
