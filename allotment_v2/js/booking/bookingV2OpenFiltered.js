function bookingV2OpenFiltered(routeId, date){
  _bkV2.filterRoute = routeId || null;
  _bkV2.filterDate = date || null;
  _bkV2.tab = 'bytrip';
  bookingV2Render();
}
