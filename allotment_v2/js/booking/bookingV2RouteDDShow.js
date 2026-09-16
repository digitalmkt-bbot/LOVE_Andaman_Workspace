function bookingV2RouteDDShow(idx){
  _bkV2RouteDDIdx = idx; _bkV2RouteDDActive = -1;
  const inp = document.getElementById('bkv2-route-input-' + idx);
  bookingV2RouteDDRender(idx, inp?.value || '');
  document.getElementById('bkv2-route-dd-' + idx)?.classList.add('open');
  setTimeout(() => document.addEventListener('mousedown', bookingV2RouteDDOutside), 0);
}
