function bookingV2NatDDHide(){
  if(_bkV2NatDDKey){
    document.getElementById('bkv2-nat-dd-' + _bkV2NatDDKey)?.classList.remove('open');
  }
  _bkV2NatDDKey = null;
  document.removeEventListener('mousedown', bookingV2NatDDOutside);
}
