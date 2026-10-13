function bookingV2ReleaseModalSet(val){
  if(!_bkV2ReleaseModal) return;
  _bkV2ReleaseModal.value = Math.min(Math.max(0, Number(val)||0), _bkV2ReleaseModal.max);
  bookingV2Render();
}
