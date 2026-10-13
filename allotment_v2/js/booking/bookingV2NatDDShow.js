function bookingV2NatDDShow(key){
  _bkV2NatDDKey = key;
  _bkV2NatDDActive = -1;
  bookingV2NatDDRender(key);
  document.getElementById('bkv2-nat-dd-' + key)?.classList.add('open');
  setTimeout(() => document.addEventListener('mousedown', bookingV2NatDDOutside), 0);
}
