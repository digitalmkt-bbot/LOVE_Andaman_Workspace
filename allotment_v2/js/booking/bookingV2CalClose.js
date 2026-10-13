function bookingV2CalClose(){
  if(_bkV2CalIdx !== null) document.getElementById('bkv2-cal-pop-' + _bkV2CalIdx)?.classList.remove('open');
  _bkV2CalIdx = null;
  document.removeEventListener('mousedown', bookingV2CalOutside);
  document.removeEventListener('keydown', bookingV2CalKey);
}
