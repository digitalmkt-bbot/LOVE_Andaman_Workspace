/* ══════════════════════════════════════════════════════════════════════════
   §w7b (2026-10-19) · Calendar month grid chips ⇄ GET /v1/availability/summary routes[].days[].boats[]
   ──────────────────────────────────────────────────────────────────────────
   renderCal drew each day's chips (one per route: free seats, "Nb" boats, WX, CH, the boat-down mark, the sold %) from _calTripsFor, which
   rebuilt the seat allocation in the browser. The server answers it per boat: boats[] {boat_id, trips, free_seats, sold_percent, tier,
   chartered, down}; the route day carries tier, off_season, closed, sold_percent. window.laOpsCalGrid(year, monthIndex, pier) returns
   {ds: [{r, free, nb, wx, ch, dn, dnB, pct}]} (one entry per open route-day with a boat, closed days absent) or null while there is no
   answer (legacy's chips stay). It reads the answer 91-ops-cal-summary.js already holds: no second request. The route colour and
   the boat names shown in a tooltip stay the browser's. Classic script, after 91-ops-cal-summary.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  window.laOpsCalGrid = function(year, monthIdx, pier){
    if(typeof window.laOpsCalSummary !== 'function' || typeof window.getRoute !== 'function') return null;
    var cs = window.laOpsCalSummary(year, monthIdx, pier);
    if(!cs || !Array.isArray(cs.routes)) return null;
    var out = {};
    cs.routes.forEach(function(sr){
      var r = window.getRoute(sr.route_id); if(!r || !Array.isArray(sr.days)) return;
      sr.days.forEach(function(d){
        if(d.closed || !Array.isArray(d.boats) || !d.boats.length) return;     // closed day / no boat: no chip (legacy's rule, the server's flag)
        var dn = 0, dnB = [], ch = false, free = 0;
        d.boats.forEach(function(b){
          free += (+b.free_seats || 0);
          if(b.chartered) ch = true;
          if(b.down){ dn++; var bo = (typeof window.getBoat === 'function') ? window.getBoat(b.boat_id) : null; dnB.push((bo && bo.name) || b.boat_id); }
        });
        (out[d.service_date] = out[d.service_date] || []).push({ r: r, free: free, nb: d.boats.length, wx: d.tier === 'wx', ch: ch, dn: dn, dnB: dnB,
                                                              pct: d.sold_percent, full: d.tier === 'soldout' });
      });
    });
    return out;
  };
})();
