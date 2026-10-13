function bookingV2RouteDDOutside(e){
  if(_bkV2RouteDDIdx === null) return;
  const dd = document.getElementById('bkv2-route-dd-' + _bkV2RouteDDIdx);
  const inp = document.getElementById('bkv2-route-input-' + _bkV2RouteDDIdx);
  if(!dd) return;
  if(dd.contains(e.target) || inp === e.target) return;
  bookingV2RouteDDHide();
}
