/* ══════════════════════════════════════════════════════════════════════════
   §opsByTripBoats (w6-a, 2026-10-18) · By-trip "Boats running" card and route chips ⇄ GET /operations/by-trip routes[].boats[]
   ──────────────────────────────────────────────────────────────────────────
   bookingV2RenderTab2 (_btBoats) listed a trip's boats from Boat Operation plus the boats its bookings sat on, added the heads per boat and
   decided "over" (heads above the boat's seats) in the browser. The server answers it: routes[].boats[] {boat_id, boat_name, pax, capacity, over,
   over_by, ovn_hold {booking_id, from, to, day, days} | null}. window.laOpsByTripBoats(answer, routeId) returns the page's own row shape
   {id, name, col, pax, cap, over, overBy, ovn} from it, or null while there is no answer (legacy's list stays). The boat's colour is a display
   choice and stays the browser's (getBoatColor). Classic script, after 72-ops-by-trip.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  window.laOpsByTripBoats = function(srv, routeId){
    if(!srv || !Array.isArray(srv.routes)) return null;
    var r = srv.routes.filter(function(x){ return x && x.route_id === routeId; })[0];
    if(!r) return [];                                   // the server counts no boat on this trip
    if(!Array.isArray(r.boats)) return null;            // an answer without the field: legacy's list
    return r.boats.map(function(b){
      var c = '#5b6472';
      try{ if(typeof getBoatColor === 'function'){ var k = getBoatColor(b.boat_id); if(k && k.text) c = k.fill || k.text; } }catch(_){}
      return { id: b.boat_id, name: b.boat_name || b.boat_id, col: c, pax: +b.pax || 0, cap: +b.capacity || 0, over: !!b.over, overBy: +b.over_by || 0,
               ovn: b.ovn_hold ? { bkId: b.ovn_hold.booking_id, from: b.ovn_hold.from, to: b.ovn_hold.to, routeId: routeId } : null };
    });
  };
})();
