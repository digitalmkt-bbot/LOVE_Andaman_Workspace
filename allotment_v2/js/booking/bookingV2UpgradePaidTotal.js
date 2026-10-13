function bookingV2UpgradePaidTotal(bkId){ return pckN(bookingV2UpgradesFor(bkId).reduce((s,u)=>s+(+u.sellPrice||0),0)); }
