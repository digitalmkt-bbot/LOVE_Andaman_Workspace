// §non-operating · find the next date (from `fromDate`, inclusive) that this route actually runs.
// Used to default a trip's date to the next running day (skips closed/off-season/weather days).
// Caps the search at 120 days; returns fromDate unchanged if none found (the save-time guard will catch it).
function bookingV2NextOpenDate(routeId, fromDate){
  if(typeof bookingV2IsRouteOpenOn !== 'function') return fromDate;
  try{
    const base = fromDate ? new Date(fromDate + 'T00:00:00') : new Date();
    if(isNaN(base.getTime())) return fromDate;
    for(let i=0; i<=120; i++){
      const d = new Date(base.getTime() + i*864e5);
      const key = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(d) : d.toISOString().slice(0,10);
      if(bookingV2IsRouteOpenOn(routeId, key)) return key;
    }
  }catch(e){}
  return fromDate;
}
