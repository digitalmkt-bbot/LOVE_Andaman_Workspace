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
  function shift(ds, n){ var d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return O.ymd(d); }

  function monthAnswer(ds){
    var first = ds.slice(0, 8) + '01';
    O.dashboard.ensure(first, 'month');   // answers from the cache unless a write made it stale
    var j = O.dashboard.get(first, 'month');
    return j && Array.isArray(j.series) ? j : null;
  }
  function yearAnswer(y){
    var first = y + '-01-01';
    O.dashboard.ensure(first, 'year');
    var j = O.dashboard.get(first, 'year');
    return j && Array.isArray(j.series) ? j : null;
  }
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
      var days = [], need = {};
      for(var d = -29; d <= 0; d++) days.push(shift(sel, d));
      days.forEach(function(ds){ need[ds.slice(0, 7)] = ds; });
      var answers = {}, missing = false;
      Object.keys(need).forEach(function(m){ var a = monthAnswer(need[m]); if(a) answers[m] = a; else missing = true; });
      if(missing) return null;
      var by = {};
      Object.keys(answers).forEach(function(m){ answers[m].series.forEach(function(b){ by[b.bucket] = b; }); });
      var out = [];
      for(var i = 0; i < days.length; i++){
        var b = by[days[i]]; if(!b) return null;
        out.push(asBucket(b, { ds: days[i], dt: new Date(days[i]), isSel: i === days.length - 1, isToday: days[i] === todayStr }));
      }
      return out;
    }
    if(mode === 'year'){
      var anchor = new Date(sel), y1 = anchor.getFullYear(), ya = yearAnswer(y1), yb = yearAnswer(y1 - 1);
      if(!ya || !yb) return null;
      var bm = {}; ya.series.concat(yb.series).forEach(function(b){ bm[b.bucket] = b; });
      var res = [];
      for(var off = -11; off <= 0; off++){
        var md = new Date(anchor.getFullYear(), anchor.getMonth() + off, 1);
        var key = md.getFullYear() + '-' + String(md.getMonth() + 1).padStart(2, '0'), s = bm[key];
        if(!s) return null;
        res.push(asBucket(s, { dt: md, isSel: off === 0, isToday: key === todayStr.slice(0, 7) }));
      }
      return res;
    }
    return null;
  };
})();
