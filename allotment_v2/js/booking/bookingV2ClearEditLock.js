function bookingV2ClearEditLock(bkId){ const bk=SB_BOOKINGS.find(b=>b.id===bkId); if(bk && bk.editLock){ delete bk.editLock; try{acctPersistBookings();}catch(e){} } }
