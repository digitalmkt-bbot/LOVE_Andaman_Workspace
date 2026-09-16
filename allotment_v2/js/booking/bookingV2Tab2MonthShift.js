function bookingV2Tab2MonthShift(n){
  const c = _bkV2T2Cursor || bookingV2Tab2ActiveDate().slice(0,7);
  let [y,m] = c.split('-').map(Number); m += n;
  if(m<1){ m=12; y--; } if(m>12){ m=1; y++; }
  _bkV2T2Cursor = `${y}-${String(m).padStart(2,'0')}`; bookingV2Render();
}
