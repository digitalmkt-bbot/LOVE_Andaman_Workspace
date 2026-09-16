function bookingV2CalNav(delta){
  if(_bkV2CalIdx === null) return;
  const [y, m] = _bkV2CalMonth.split('-').map(Number);
  const ref = new Date(y, m - 1 + delta, 1);
  _bkV2CalMonth = ref.getFullYear() + '-' + String(ref.getMonth()+1).padStart(2,'0');
  // Defer render so the outside-click handler completes before innerHTML destroys the button
  setTimeout(bookingV2CalRender, 0);
}
