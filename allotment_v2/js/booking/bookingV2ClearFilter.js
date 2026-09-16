function bookingV2ClearFilter(which){
  if(which === 'route') _bkV2.filterRoute = null;
  if(which === 'date') _bkV2.filterDate = null;
  bookingV2Render();
}
