function bookingV2RouteDDPick(idx, label){
  const inp = document.getElementById('bkv2-route-input-' + idx);
  if(inp) inp.value = label;
  bookingV2RouteDDHide();
  bookingV2PickRouteByText(idx, label);
}
