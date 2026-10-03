function bookingV2LockPendConfirmGo(lockId, date){
  if(typeof laGuardEdit==='function' && !laGuardEdit('booking')) return;
  const r = bookingV2LockPendConfirm(lockId, date);
  if(!r.ok && r.why==='full') alert('No free seats on this trip yet - the lock stays pending');
  bookingV2Render();
}
