function bookingV2AreaDDOutside(e){
  if(!_bkV2AreaDDKind) return;
  const dd = document.getElementById('bkv2-area-dd-' + _bkV2AreaDDKind);
  const inp = document.getElementById('bkv2-area-input-' + _bkV2AreaDDKind);
  if(!dd) return;
  if(dd.contains(e.target) || inp === e.target) return;
  bookingV2AreaDDHide();
}
