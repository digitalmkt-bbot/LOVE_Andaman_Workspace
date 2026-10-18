/* ══════════════════════════════════════════════════════════════════════════
   §opsCloseImpact (w6-a, 2026-10-18) · "Close anyway" impact dialog ⇄ 409 bookings_on_closed_day `details`
   ──────────────────────────────────────────────────────────────────────────
   Legacy counted what a closed season / day strands from the bookings and deployments this browser had loaded (progCountBookingImpact), and
   asked before sending. The server judges every change that can close a day and answers 409 with details {route_id, bookings[{booking_id, ref,
   service_date, pax, lead_name, status}], boats[{boat_id, service_date}]}: all of them, from today on, loaded or not. ops/10-ops-catalogue.js
   already opens legacy's modal from that answer (askCloseAnyway, now filled from `details`). What is left here is the browser's own pre-count:
   in operation mode it answers "nothing found", so the guards (saveNewSeasonGuarded, toggleDayOverrideGuarded) send the change and the server's
   list is the one the person sees. Offline: legacy's scan, unchanged. Classic script, after 10-ops-catalogue.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window.progCountBookingImpact;
  if(typeof orig !== 'function' || orig.__w6a) return;
  var w = function(){
    if(!O.enabled()) return orig.apply(this, arguments);
    return { bookings: [], totalPax: 0, trips: [] };
  };
  w.__w6a = true; w.__orig = orig; window.progCountBookingImpact = w;
})();
