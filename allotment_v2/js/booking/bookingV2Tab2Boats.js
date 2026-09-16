// Boats assigned to a route on a date (from TRIPS ops) + any charter boats passed in
function bookingV2Tab2Boats(routeId, dateStr, charterBoatIds){
  const names = [];
  const seen = new Set();
  const pushBoat = (bid)=>{ if(!bid || seen.has(bid)) return; seen.add(bid); const b=(typeof BOATS!=='undefined'?BOATS.find(x=>x.id===bid):null); names.push({id:bid, name:(b?b.name:bid)}); };
  try {
    const ops = (typeof TRIPS!=='undefined' && TRIPS[dateStr]) ? TRIPS[dateStr] : {};
    Object.entries(ops).forEach(([bid,op])=>{ if(op && op.route===routeId) pushBoat(bid); });
  } catch(e){}
  (charterBoatIds||[]).forEach(pushBoat);
  return names;
}
