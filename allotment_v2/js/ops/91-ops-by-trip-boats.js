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
  /* §btBd · A/C/I/F of some routes (a variant, a programme's variants, the selected route): the sum of the server's routes[].pax {ad, chd, inf, foc}.
     The server leaves bookings waiting for approval out of pax (so out of this too); legacy counted them. null without an answer: the page keeps its own count. */
  window.laOpsByTripBd = function(srv, routeIds){
    if(!srv || !Array.isArray(srv.routes)) return null;
    var want = {}; (routeIds || []).forEach(function(r){ want[r] = 1; });
    var o = { ad: 0, chd: 0, inf: 0, foc: 0 };
    srv.routes.forEach(function(r){ if(!r || !want[r.route_id]) return; var p = r.pax || {}; ['ad', 'chd', 'inf', 'foc'].forEach(function(k){ o[k] += +p[k] || 0; }); });
    return o;
  };
  window.laOpsByTripBoats = function(srv, routeId){
    if(!srv || !Array.isArray(srv.routes)) return null;
    var r = srv.routes.filter(function(x){ return x && x.route_id === routeId; })[0];
    if(!r) return [];                                   // the server counts no boat on this trip
    if(!Array.isArray(r.boats)) return null;            // an answer without the field: legacy's list
    return r.boats.map(function(b){
      var c = '#5b6472';
      try{ if(typeof getBoatColor === 'function'){ var k = getBoatColor(b.boat_id); if(k && k.text) c = k.fill || k.text; } }catch(_){}
      return { id: b.boat_id, name: b.boat_name || b.boat_id, col: c, pax: +b.pax || 0, bd: b.pax_by_type || null, cap: +b.capacity || 0, over: !!b.over, overBy: +b.over_by || 0,   // bd: A/C/I/F of the boat (BE-1, computed)
               ovn: b.ovn_hold ? { bkId: b.ovn_hold.booking_id, from: b.ovn_hold.from, to: b.ovn_hold.to, routeId: routeId } : null };
    });
  };
})();
