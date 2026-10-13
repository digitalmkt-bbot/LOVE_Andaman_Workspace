function bookingV2SetAdjustment(i, field, val){
  const a = _bkV2.newBooking && _bkV2.newBooking.adjustments && _bkV2.newBooking.adjustments[i];
  if(!a) return;
  if(field === 'value') a.value = Number(val) || 0;
  else a[field] = val;
  // value / mode changes affect the total -> re-render · label/note are text only -> skip
  if(field === 'value' || field === 'mode') bookingV2Render();
}
