function bookingV2NatDDFilter(key, val){
  _bkV2NatDDKey = key;
  _bkV2NatDDActive = -1;
  bookingV2NatDDRender(key);
  document.getElementById('bkv2-nat-dd-' + key)?.classList.add('open');
}
