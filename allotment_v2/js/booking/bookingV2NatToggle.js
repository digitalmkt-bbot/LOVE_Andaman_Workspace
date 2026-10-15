function bookingV2NatToggle(idx){
  const nb=_bkV2.newBooking; if(!nb) return;
  nb._natOpen = nb._natOpen || {}; nb._natOpen[idx] = true;
  bookingV2Render();
}
