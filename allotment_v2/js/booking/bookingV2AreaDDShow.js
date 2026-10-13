function bookingV2AreaDDShow(kind){
  _bkV2AreaDDKind = kind; _bkV2AreaDDActive = -1;
  const inp = document.getElementById('bkv2-area-input-' + kind);
  bookingV2AreaDDRender(kind, inp?.value || '');
  document.getElementById('bkv2-area-dd-' + kind)?.classList.add('open');
  setTimeout(() => document.addEventListener('mousedown', bookingV2AreaDDOutside), 0);
}
