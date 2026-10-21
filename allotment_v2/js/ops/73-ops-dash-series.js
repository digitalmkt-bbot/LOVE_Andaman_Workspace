/* ══════════════════════════════════════════════════════════════════════════
   §opsDashSeries (w4-f1, 2026-10-18) · Dashboard "Bookings overview" month / year bars ⇄ GET /v1/dashboard series
   ──────────────────────────────────────────────────────────────────────────
   Legacy renderDash worked out every bar itself (_bkDay: boats deployed, seats consumed per route, charter heads per
   boat, weather-closed routes, for each of 30 days / 12 months) from the bookings in the browser. The server now
   answers one bar per day (mode=month) or per month (mode=year): {bucket, booked, charter_pax, capacity, weather_routes,
   route_booked{}, charter_boats[]} (operation-backend todo/b1-sales-dashboard-model.md).

   The screen keeps its own windows: the LAST 30 DAYS ending on the picked day and the LAST 12 MONTHS ending on the
   picked month. The server's month is a calendar month and its year a calendar year, so a window is put together
   from two answers (this month and the one before; this year and the one before): the bars are the server's, the
   window is legacy's. The top three routes, "Other", the best / slowest bar and the averages that sit under the
   bars are still added up by renderDash over those bars (the server's own series_stats / top_routes describe its
   calendar month, not this window).

   renderDash calls window.laOpsDashSeries(mode, selectedDay, today) at the marked line in 04-data-core.js. It
   answers an array of buckets in renderDash's shape, or null while an answer is missing (legacy's sum stays on
   screen, and the Dashboard redraws when the answer lands: 60-ops-dashboard.js ensure()).
   Classic script, after 60-ops-dashboard.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.dashboard) return;
  function charterBoats(list){
    var o = {}; (list || []).forEach(function(c){ if(c.pax > 0) o[c.boat_id || ''] = (o[c.boat_id || ''] || 0) + c.pax; });
    return o;
  }
  function asBucket(b, extra){
    return Object.assign({ booked: +b.booked || 0, capacity: +b.capacity || 0, charter: +b.charter_pax || 0, wx: +b.weather_routes || 0,
                           routeBooked: Object.assign({}, b.route_booked || {}), charterBoats: charterBoats(b.charter_boats) }, extra);
  }

  window.laOpsDashSeries = function(mode, sel, todayStr){
    if(!O.enabled() || !/^\d{4}-\d{2}-\d{2}$/.test(sel || '')) return null;
    if(mode === 'month'){
      /* the server's own rolling window (30 days ending on the picked day), asked with the day answer */
      var rm = O.dashboard.get(sel, 'rolling_month');
      if(!rm || !Array.isArray(rm.series) || rm.series.length !== 30) return null;
      return rm.series.map(function(b, i){
        return asBucket(b, { ds: b.bucket, dt: new Date(b.bucket), isSel: i === rm.series.length - 1, isToday: b.bucket === todayStr });
      });
    }
    if(mode === 'year'){
      var ry = O.dashboard.get(sel, 'rolling_year');
      if(!ry || !Array.isArray(ry.series) || ry.series.length !== 12) return null;
      var anchor = new Date(sel);
      return ry.series.map(function(b, i){
        var md = new Date(anchor.getFullYear(), anchor.getMonth() - (11 - i), 1);
        return asBucket(b, { dt: md, isSel: i === 11, isToday: b.bucket === todayStr.slice(0, 7) });
      });
    }
    return null;
  };
})();
