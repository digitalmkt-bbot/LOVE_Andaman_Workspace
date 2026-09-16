function bookingV2RouteDDHide(){
  if(_bkV2RouteDDIdx !== null) document.getElementById('bkv2-route-dd-' + _bkV2RouteDDIdx)?.classList.remove('open');
  _bkV2RouteDDIdx = null;
  document.removeEventListener('mousedown', bookingV2RouteDDOutside);
}
