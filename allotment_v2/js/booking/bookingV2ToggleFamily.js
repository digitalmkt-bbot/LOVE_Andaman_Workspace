// Toggle expand state for a family in Matrix
function bookingV2ToggleFamily(famId){
  if(_bkV2.expanded.has(famId)) _bkV2.expanded.delete(famId);
  else _bkV2.expanded.add(famId);
  bookingV2Render();
}
