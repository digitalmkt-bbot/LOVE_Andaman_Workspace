/* ══════════════════════════════════════════════════════════════════════════
   §opsDashWindow (w6-a, 2026-10-18) · Dashboard "Bookings overview" month / year ⇄ GET /v1/dashboard?window=rolling
   ──────────────────────────────────────────────────────────────────────────
   73-ops-dash-series.js stitched the screen's windows (the last 30 days, the last 12 months) from two calendar answers and left the
   top three routes, "Other", the best / slowest bar and the averages to renderDash. The server now answers the windows themselves:
   ?mode=month|year&date=<picked day>&window=rolling  ->  series[], top_routes[], other_routes_pax, series_stats{}, window{from,to}.
   Here: window.laOpsDashSeries (the bars) and window.laOpsDashStats (the figures under them) read that one answer. Nothing is sent but
   the picked day and the mode. Until the answer is in (or offline) both return null and renderDash keeps legacy's own sums.
   Classic script, after 73-ops-dash-series.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var cache = {}, loading = {}, failed = {}, stale = {};
  function k(mode, sel){ return mode + '|' + sel; }
  function ok(sel){ return /^\d{4}-\d{2}-\d{2}$/.test(sel || ''); }
  function redraw(){
    if((O.busy() && !window._dashLoaderShown) || O.activeView() !== 'dashboard' || typeof window.renderDash !== 'function') return;
    window.renderDash();
  }
  /* The answer for this mode and day: the cached one (stale ones stay on screen while the new one comes), or null. */
  function answer(mode, sel){
    if(!O.enabled() || (mode !== 'month' && mode !== 'year') || !ok(sel)) return null;
    var key = k(mode, sel);
    if((!cache[key] || stale[key]) && !loading[key] && !failed[key]){
      loading[key] = O.get('/v1/dashboard', { date: sel, mode: mode, window: 'rolling' }).then(function(j){
        if(!j || !Array.isArray(j.series) || !j.series_stats || !j.window) throw new Error('invalid dashboard window response');
        cache[key] = j; delete stale[key];
      }).catch(function(e){ failed[key] = true; O.fail('Dashboard data did not load', e);
      }).then(function(){ delete loading[key]; redraw(); });
    }
    return cache[key] || null;
  }
  O.onWrite(function(){ Object.keys(cache).forEach(function(x){ stale[x] = true; }); failed = {}; });

  function charterBoats(list){
    var o = {}; (list || []).forEach(function(c){ if(c.pax > 0) o[c.boat_id || ''] = (o[c.boat_id || ''] || 0) + c.pax; });
    return o;
  }
  window.laOpsDashSeries = function(mode, sel, todayStr){
    var j = answer(mode, sel); if(!j) return null;
    var n = j.series.length;
    return j.series.map(function(b, i){
      var x = { booked: +b.booked || 0, capacity: +b.capacity || 0, charter: +b.charter_pax || 0, wx: +b.weather_routes || 0,
                routeBooked: Object.assign({}, b.route_booked || {}), charterBoats: charterBoats(b.charter_boats), isSel: i === n - 1 };
      if(mode === 'month'){ x.ds = b.bucket; x.dt = new Date(b.bucket); x.isToday = b.bucket === todayStr; }
      else { x.dt = new Date(+b.bucket.slice(0, 4), +b.bucket.slice(5, 7) - 1, 1); x.isToday = b.bucket === String(todayStr).slice(0, 7); }
      return x;
    });
  };
  /* the figures under the bars, as the server counted them over the same bars */
  window.laOpsDashStats = function(mode, sel){
    var j = answer(mode, sel); if(!j) return null;
    var s = j.series_stats;
    return { top: j.top_routes || [], other: +j.other_routes_pax || 0, charter: +s.charter_pax || 0, weather: +s.weather_routes || 0,
             total: +s.total_pax || 0, capacity: +s.total_capacity || 0, fill: +s.fill_percent || 0, average: +s.average_per_bucket || 0,
             best: s.best || null, slowest: s.slowest || null, from: j.window.from, to: j.window.to };
  };
})();
