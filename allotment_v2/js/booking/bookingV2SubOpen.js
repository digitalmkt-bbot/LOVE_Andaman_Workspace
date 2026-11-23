function bookingV2SubOpen(parentId, date){ const p=SB_SEAT_LOCKS.find(x=>x.id===parentId); if(!p) return;
  /* §lkSubDay · ใบแม่ Bulk ต้องเลือกวัน · เปิดจากหน้า By trip date ได้วันนั้นมาเลย */
  let d=''; if(bookingV2LockSpansDays(p)){ const ds=bookingV2LockSpecDates(p).filter(x=>!bookingV2LockRoundReleased(p,x)); d=(date && ds.indexOf(date)>=0)?date:''; }
  _bkV2SubModal={ parentId, name:'', qty:'', expiry:p.expiry||'', reason:'', date:d }; bookingV2Render(); }
