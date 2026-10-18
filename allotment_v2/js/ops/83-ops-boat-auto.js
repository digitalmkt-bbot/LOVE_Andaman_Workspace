/* ═════════════════════════════════════════════════════════════════
   §opsBoatAuto (w5-d, 2026-10-18) · "Auto assign boats" from the server

   Legacy baAutoAssign(date, routeId) picked a boat for every unassigned seat booking in the browser (first boat with room, else the
   least loaded one within capacity + 2). 37-ops-boat-assign.js answered it with a "NOT YET" toast. The server does it now:

     POST /operations/deployments/{date}/auto-assign   { route_id }  (nothing else: the server picks the boats)
          -> { service_date, route_id, assigned: [{ trip_id, boat_id }], unassigned: [trip_id] }
          409 no_boats (no boat deployed on the route that day): the message is shown as legacy's alert.

   The answer is drawn into the bookings the screen holds (the trip's boat), and the boat-assign view and the check-in sheets redraw.
   Nothing about the boats is decided here; the request carries the route only.

   Load order: after 37-ops-boat-assign.js (whose toast this replaces). Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }

  var prev = window.baAutoAssign;
  window.baAutoAssign = function(date, routeId){
    if(!enabled()) return typeof prev === 'function' ? prev.apply(this, arguments) : undefined;
    if(!date || !routeId) return typeof prev === 'function' ? prev.apply(this, arguments) : undefined;
    return O.queue(function(){ return O.post('/operations/deployments/' + enc(date) + '/auto-assign', { route_id: routeId }); }).then(function(res){
      var list = (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [], byTrip = {};
      list.forEach(function(b){ ((b && b.trips) || []).forEach(function(t){ if(t && t.opsTripId) byTrip[t.opsTripId] = { b: b, t: t }; }); });
      var n = 0;
      ((res && res.assigned) || []).forEach(function(a){
        var hit = byTrip[a.trip_id]; if(!hit || typeof window.bkOpsFor !== 'function') return;
        window.bkOpsFor(hit.b, hit.t.date || date).boatId = a.boat_id; n++;
      });
      O.wrote('trip-boat');
      try{
        if(typeof _bkV2 !== 'undefined' && _bkV2 && _bkV2.boatAssignMode && typeof window.bookingV2Render === 'function') window.bookingV2Render();
        else if(typeof window.renderBoatAssign === 'function') window.renderBoatAssign();
      }catch(_){}
      if(typeof window.renderCheckinAll === 'function'){ try{ window.renderCheckinAll(); }catch(_){} }
      return res;
    }, function(e){
      // legacy said it with an alert: the server's own words
      alert((e && e.message) || 'Auto assign did not run');
      return null;
    });
  };
  window.baAutoAssign.__opsBoatAuto = true;
})();
