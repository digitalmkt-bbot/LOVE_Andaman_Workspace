function bookingV2CalGoToday(){
  if(_bkV2CalIdx === null) return;
  _bkV2CalMonth = TODAY_STR.slice(0,7);
  setTimeout(bookingV2CalRender, 0);
}
