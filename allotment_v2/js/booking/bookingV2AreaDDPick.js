function bookingV2AreaDDPick(kind, label){
  const inp = document.getElementById('bkv2-area-input-' + kind);
  if(inp) inp.value = label;
  bookingV2AreaDDHide();
  if(kind === 'pickup') bookingV2PickPickupAreaByText(label);
  else if(kind === 'dropoff') bookingV2PickDropoffAreaByText(label);
}
