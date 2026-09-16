function bookingV2VanGroupSetTime(date, routeId, zone, gid, val){ const t=(val||'').trim(); _bkV2GrpApply(date,routeId,zone,gid,(b,s,o)=>{ o.pickupTimeFinal=t; }); acctPersistBookings(); }
