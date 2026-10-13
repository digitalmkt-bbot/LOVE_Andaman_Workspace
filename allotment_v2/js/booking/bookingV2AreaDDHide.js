function bookingV2AreaDDHide(){
  if(_bkV2AreaDDKind) document.getElementById('bkv2-area-dd-' + _bkV2AreaDDKind)?.classList.remove('open');
  _bkV2AreaDDKind = null;
  document.removeEventListener('mousedown', bookingV2AreaDDOutside);
}
