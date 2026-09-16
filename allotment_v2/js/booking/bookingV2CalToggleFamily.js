// Calendar program filter (multi-select · empty = show all)
function bookingV2CalToggleFamily(id){
  let s = Array.isArray(_bkV2.calFams) ? _bkV2.calFams.slice() : [];
  const i = s.indexOf(id);
  if(i >= 0) s.splice(i, 1); else s.push(id);
  _bkV2.calFams = s;
  bookingV2Render();
}
