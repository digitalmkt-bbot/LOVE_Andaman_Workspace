function bookingV2ReleaseModalCommit(){
  const m = _bkV2ReleaseModal; if(!m) return;
  const n = Math.min(Math.max(0, m.value|0), m.max);
  _bkV2ReleaseModal = null;
  if(n > 0) bookingV2ReleaseLock(m.lockId, n);
  bookingV2Render();
}
