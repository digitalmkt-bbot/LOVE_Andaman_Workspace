// Aggregate every trip (date+route) across all bookings · for calendar dots + prev/upcoming lists
function bookingV2Tab2AllTrips(){
  const map = {};
  SB_BOOKINGS.forEach(bk=>{
    if(bk.schemaVer===2){
      (bk.trips||[]).forEach(t=>{ if(!t.date||!t.routeId) return; const k=t.date+'|'+t.routeId; (map[k]=map[k]||{date:t.date,routeId:t.routeId,pax:0}); map[k].pax += bookingV2PaxAllTot(t.pax||{}); });
    } else if(bk.travelDate && bk.programId){
      const k=bk.travelDate+'|'+bk.programId; (map[k]=map[k]||{date:bk.travelDate,routeId:bk.programId,pax:0}); map[k].pax += (bk.pax?.adult||0)+(bk.pax?.child||0)+(bk.pax?.infant||0);
    }
  });
  return Object.values(map);
}
