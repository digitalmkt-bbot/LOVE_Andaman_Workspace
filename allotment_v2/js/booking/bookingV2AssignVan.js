// ── Van assign ──
function bookingV2AssignVan(bkId, vanId, date){ const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return; const _o=bkOpsFor(b, bkOpsDate(b,date)); _o.vanId=vanId||null; acctPersistBookings(); if(_bkV2&&_bkV2.vanAssignMode&&typeof bookingV2Render==='function') bookingV2Render(); else if(typeof renderVehicles==='function') renderVehicles(); }
