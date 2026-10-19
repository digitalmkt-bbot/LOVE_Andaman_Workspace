/* ══════════════════════════════════════════════════════════════════════════
   §w7b (2026-10-19) · Van matrix cell click ⇄ the server's route calendar (GET /v1/routes?from=D&to=D, days[D] = {open, source})
   ──────────────────────────────────────────────────────────────────────────
   vehDayCellClick cycles a van's day through the routes that RUN that day (_vehRoutesOpenOn -> bookingV2IsRouteOpenOn -> getDayStatus).
   ops/10 holds the server's calendar for the 30 days back and 365 ahead; a day outside that window fell back to legacy's season scan.
   This wrapper asks the server for that one day first when this browser holds no answer for it, merges it into OPS_ROUTE_DAYS (getDayStatus
   is already server-first), then lets legacy's click run on the server's answer. A failed ask is told, and legacy's click runs on its own scan.
   Backend: there is no van-day endpoint that refuses a closed route (PUT /v1/vans/{id}/days/{date} stores route_ids as sent); the route
   calendar is the only server answer to "does the route run", and it is what this reads. Classic script, after 35-ops-vehicles.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window.vehDayCellClick;
  if(typeof orig !== 'function' || orig.__w7b) return;
  var YMD = /^\d{4}-\d{2}-\d{2}$/, asking = {};
  function known(date){
    var d = window.OPS_ROUTE_DAYS || {};
    return Object.keys(d).some(function(rid){ return d[rid] && d[rid][date]; });
  }
  var w = function(id, date){
    var self = this, args = arguments;
    if(!O.enabled() || !YMD.test(String(date || '')) || known(date)) return orig.apply(self, args);
    if(asking[date]) return;                                  // the first click is still waiting for the server
    asking[date] = true;
    O.get('/v1/routes', { from: date, to: date }).then(function(j){
      window.OPS_ROUTE_DAYS = window.OPS_ROUTE_DAYS || {};
      ((j && j.routes) || []).forEach(function(r){
        if(r && r.days && r.days[date]){ var m = window.OPS_ROUTE_DAYS[r.id] = window.OPS_ROUTE_DAYS[r.id] || {}; m[date] = r.days[date]; }
      });
    }).catch(function(e){ O.fail('Route calendar did not load', e); })
      .then(function(){ delete asking[date]; orig.apply(self, args); });
  };
  w.__w7b = true; w.__orig = orig; window.vehDayCellClick = w;
})();
