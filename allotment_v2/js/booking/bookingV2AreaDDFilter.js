function bookingV2AreaDDFilter(kind, val){
  _bkV2AreaDDKind = kind; _bkV2AreaDDActive = -1;
  bookingV2AreaDDRender(kind, val);
  document.getElementById('bkv2-area-dd-' + kind)?.classList.add('open');
}
