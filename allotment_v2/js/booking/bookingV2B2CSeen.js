function bookingV2B2CSeen(id, quiet){
  if(typeof acctCanEditBookings==='function' && !acctCanEditBookings()){ if(!quiet) alert('View only - cannot mark as seen'); return false; }
  const bk=(SB_BOOKINGS||[]).find(b=>b && b.id===id); if(!bk) return false;
  const p=bookingV2B2CPending(bk); if(!p) return false;
  const sum=p.segs.map(s=>s.label).join(', ') || (p.isNew?'new booking':'');
  bookingV2AddHistory(bk,'b2c_seen','B2C change reviewed'+(sum?(' ('+sum+')'):''),'Seen');
  if(quiet) return true;
  bookingV2PersistBookings();
  bookingV2B2CAfter();
  return true;
}
