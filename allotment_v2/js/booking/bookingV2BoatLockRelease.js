function bookingV2BoatLockRelease(id, note){
  const l = bookingV2BoatLockById(id); if(!l || l.status!=='active') return false;
  const today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  bookingV2BoatLockCellClear(l);
  l.status = 'released';
  (l.log=l.log||[]).push({date:today, at:new Date().toISOString(), type:'release',
    note:(note||'')+' · '+bookingV2BoatNameOf(l.boatId), by:laBy()});
  sbSeatLocksPersist(); _bkLockSaveOps();
  return true;
}
