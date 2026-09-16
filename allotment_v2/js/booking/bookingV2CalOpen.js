function bookingV2CalOpen(idx){
  bookingV2CalClose();
  _bkV2CalIdx = idx;
  const t = _bkV2.newBooking?.trips?.[idx];
  // Initial month: trip date · or today
  const init = t?.date || TODAY_STR;
  _bkV2CalMonth = init.slice(0,7);
  bookingV2CalRender();
  document.getElementById('bkv2-cal-pop-' + idx)?.classList.add('open');
  setTimeout(() => document.addEventListener('mousedown', bookingV2CalOutside), 0);
  setTimeout(() => document.addEventListener('keydown', bookingV2CalKey), 0);
}
