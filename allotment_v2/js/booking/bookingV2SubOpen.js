function bookingV2SubOpen(parentId){ const p=SB_SEAT_LOCKS.find(x=>x.id===parentId); if(!p) return; _bkV2SubModal={ parentId, name:'', qty:'', expiry:p.expiry||'', reason:'' }; bookingV2Render(); }
