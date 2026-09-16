// Release · custom modal (replaces native prompt)
function bookingV2LockReleaseConfirm(id){
  const l = SB_SEAT_LOCKS.find(x=>x.id===id); if(!l) return;
  const peak = bookingV2LockPeakUsed(l);
  const rem = Math.max(0, (l.parentId ? (l.qty||0) : bookingV2LockUnalloc(l)) - peak);   // parent releases only its unallocated remainder
  _bkV2ReleaseModal = { lockId:id, max:rem, value:rem };
  bookingV2Render();
}
