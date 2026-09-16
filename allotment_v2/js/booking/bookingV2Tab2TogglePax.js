function bookingV2Tab2TogglePax(rowId){
  const el = document.getElementById(rowId);
  if(!el) return;
  const open = el.style.display === 'table-row';
  el.style.display = open ? 'none' : 'table-row';
  const ic = document.getElementById(rowId + '-ic');
  if(ic) ic.style.transform = open ? '' : 'rotate(180deg)';
}
