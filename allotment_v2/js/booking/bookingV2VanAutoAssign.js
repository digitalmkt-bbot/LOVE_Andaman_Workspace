// Auto-group transfer bookings of a route+date into vans · prefer vans assigned to this program that day (matrix dayRoute), else zone vans · fill-first by capacity · keeps manual assignments
function bookingV2VanAutoAssign(date, routeId){
  const rows=baSeatBookingsForRoute(date,routeId).filter(({b,t})=>{ const z=t.zone||b.pickupZone||'NoTransfer'; return z!=='NoTransfer'&&z!=='NT'; });
  if(!rows.length){ alert('No transfer bookings to group on this program (all self-arrive or none).'); return; }
  const z=(typeof _vehRouteZone==='function')?_vehRouteZone(routeId):null;
  const dayVans=(SB_VEHICLES||[]).filter(v=>v.active && _vehDayRoutes(v,date).includes(routeId));
  const pool = dayVans.length?dayVans:((typeof vanVehiclesForZone==='function')?vanVehiclesForZone(z,date):[]);
  if(!pool.length){ alert('No van available for this program today.\nAssign vans to this program in Transfer Fleet > month matrix, or add a vehicle in the zone.'); return; }
  const load={}; pool.forEach(v=>load[v.id]=0);
  rows.forEach(({b,t})=>{ const vid=bkOpsRead(b,date).vanId; if(vid&&load[vid]!==undefined) load[vid]+=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0; });
  let assigned=0;
  rows.forEach(({b,t})=>{ if(bkOpsRead(b,date).vanId) return;
    const pax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
    let pick=pool.find(v=>load[v.id]+pax<=(v.capacity||0)) || pool.slice().sort((a,c)=>load[a.id]-load[c.id])[0];
    if(pick){ bkOpsFor(b, bkOpsDate(b,date)).vanId=pick.id; load[pick.id]+=pax; assigned++; }   /* §per-trip ops · อ่าน per-day อยู่แล้ว แต่เขียนลง b.ops (วันแรก) → auto-assign วันที่ 2 ไม่เคยติด */
  });
  acctPersistBookings();
  if(_bkV2&&_bkV2.vanAssignMode&&typeof bookingV2Render==='function') bookingV2Render();
}
