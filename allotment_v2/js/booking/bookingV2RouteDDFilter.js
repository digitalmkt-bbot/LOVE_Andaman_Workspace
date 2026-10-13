function bookingV2RouteDDFilter(idx, val){
  _bkV2RouteDDIdx = idx; _bkV2RouteDDActive = -1;
  bookingV2RouteDDRender(idx, val);
  document.getElementById('bkv2-route-dd-' + idx)?.classList.add('open');
}
