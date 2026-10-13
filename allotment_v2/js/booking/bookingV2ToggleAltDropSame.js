function bookingV2ToggleAltDropSame(i){
  if(!_bkV2.newBooking || !Array.isArray(_bkV2.newBooking.altPickups)) return;
  const a=_bkV2.newBooking.altPickups[i]; if(!a) return;
  a.dropSame = (a.dropSame===false) ? true : false;
  if(a.dropSame){ a.dropAreaId=''; a.dropZone=''; a.dropPlace=''; }
  bookingV2Render();
}
