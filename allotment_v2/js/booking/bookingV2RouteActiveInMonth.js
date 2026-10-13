// Does route have ≥1 open day in the given month? (used to filter list)
function bookingV2RouteActiveInMonth(routeId, cursor){
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const lastDay = new Date(y, m+1, 0).getDate();
  for(let d = 1; d <= lastDay; d++){
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if(bookingV2IsRouteOpenOn(routeId, key)) return true;
  }
  return false;
}
