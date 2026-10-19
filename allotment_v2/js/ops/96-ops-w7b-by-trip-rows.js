/* ══════════════════════════════════════════════════════════════════════════
   §w7b (2026-10-19) · By-trip per-booking add-on figures ⇄ GET /operations/by-trip routes[].rows[]
   ──────────────────────────────────────────────────────────────────────────
   bookingV2RenderTab2 decided each booking's longtail join heads, longtail charter boats and transfer heads in the browser
   (bookingV2AddOnFlags + bookingV2LongtailExtraPax + bookingV2LongtailCharterExtraBoats + the linked B2C add-on lines).
   The server answers them per booking trip: routes[].rows[] {booking_id, code, lead_pax, trip_id, booking_mode, pax, lt_join_pax,
   lt_charter_boats, transfer_pax}. window.laOpsByTripRow(srv, routeId, r) takes the page's own row ({bk, t, routeId}) and returns
   {j, c, p} (join heads, charter boats, transfer heads), or null while there is no answer (legacy's decision stays).
   A booking with no row in an answer that exists (waiting for approval, linked B2C add-on line, not counted) is {0,0,0}: the server counted none.
   Classic script, after 72-ops-by-trip.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  window.laOpsByTripRow = function(srv, routeId, r){
    if(!srv || !Array.isArray(srv.routes) || !r || !r.bk) return null;
    var sr = srv.routes.filter(function(x){ return x && x.route_id === routeId; })[0];
    if(!sr) return { j: 0, c: 0, p: 0 };
    if(!Array.isArray(sr.rows)) return null;                      // an answer without rows: legacy's decision
    var tid = r.t && r.t.opsTripId, bid = r.bk.id, hit = null;
    sr.rows.forEach(function(x){
      if(!x || x.booking_id !== bid) return;
      if(tid){ if(x.trip_id === tid) hit = x; } else if(!hit) hit = x;
    });
    if(!hit) return { j: 0, c: 0, p: 0 };
    return { j: +hit.lt_join_pax || 0, c: +hit.lt_charter_boats || 0, p: +hit.transfer_pax || 0 };
  };
})();
