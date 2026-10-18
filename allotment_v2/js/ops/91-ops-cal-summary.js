/* ══════════════════════════════════════════════════════════════════════════
   §opsCalSummary (w6-a, 2026-10-18) · Calendar month figures ⇄ GET /v1/availability/summary?month=YYYY-MM[&pier=]
   ──────────────────────────────────────────────────────────────────────────
   renderCal (04-data-core.js) added up _calTripsFor for every day of the month: trips and free seats of the month, the weekly average,
   each route's totals (route cards: free per week / day / total, trips per week), each day's sums and the sold-% of a matrix cell.
   The server answers them: {month, num_weeks, month_trips, month_free, weekly_average, days[{service_date, trips, free_seats}],
   routes[{route_id, month_trips, month_free, weekly_average, days_active, trips_per_week, average_free{week,day,total}, closed_all_month,
   off_season_trips, off_season_free, days[{service_date, trips, free_seats, sold_percent, tier, off_season, closed}]}]}.
   window.laOpsCalSummary(year, monthIndex, pier) returns that answer, or null while it is missing / offline (legacy's sums stay).
   Read only: nothing is sent but the month and the pier filter. Classic script, after 50-ops-availability.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var cache = {}, loading = {}, failed = {}, stale = {};
  function redraw(){
    if(O.busy() || O.activeView() !== 'calendar' || typeof window.renderCal !== 'function') return;
    try{ window.renderCal(); }catch(_){}
  }
  O.onWrite(function(){ Object.keys(cache).forEach(function(k){ stale[k] = true; }); failed = {}; });
  window.laOpsCalSummary = function(year, monthIdx, pier){
    if(!O.enabled()) return null;
    var month = year + '-' + String(monthIdx + 1).padStart(2, '0'), p = (!pier || pier === 'all') ? '' : pier, key = month + '|' + p;
    if((!cache[key] || stale[key]) && !loading[key] && !failed[key]){
      loading[key] = O.get('/v1/availability/summary', p ? { month: month, pier: p } : { month: month }).then(function(j){
        if(!j || !Array.isArray(j.routes) || !Array.isArray(j.days)) throw new Error('invalid calendar summary');
        cache[key] = j; delete stale[key];
      }).catch(function(e){ failed[key] = true; O.fail('Calendar figures did not load', e);
      }).then(function(){ delete loading[key]; redraw(); });
    }
    return cache[key] || null;
  };
})();
