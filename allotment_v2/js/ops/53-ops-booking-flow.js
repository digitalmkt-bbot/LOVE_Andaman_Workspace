/* ══════════════════════════════════════════════════════════════════════════
   §opsBookingFlow (2026-10-14) · Booking Flow ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   renderBookingFlow (08-app.js) groups SB_BOOKINGS by CREATION date (intake
   buckets, MoM delta) and by trip date (travel calendar, dual line, cohort).
   Bookings are no longer preloaded, so every bucket counted only whatever
   other views happened to load: last month showed 789 of 1171 bookings and
   the MoM delta compared a loaded month against an unloaded one (+199%).
   Fix (model: 41-ops-prpo.js / commit 5a6e6d3):
   - bucket TOTALS come from the server's own count,
     GET /v1/bookings/daily-counts (live bookings per sale day, 6 months in
     one request) — window._opsBfDaily tells the legacy render which cached
     window to read (§bfSrvTot in 08-app.js). No month is ever guessed from
     a partial browser store again, loaded or not. The by-market split of every bar comes from the
     same call (markets=1, §bfSrvMk in 08-app.js), so older bars are no longer gray "other".
   - booking DETAILS (market split, sales, pax, lead time) are loaded for the
     current + previous KPI bucket only: bookings CREATED from the earliest of
     [1st of month, Monday 7 weeks back, today−13] to today — the comparison
     windows of the month/week/day modes. Older bars keep the server total;
     their market split is the server's too.
   - trips for the travel calendar / dual line / cohort: service dates from
     min(today−14, 1st of month) to max(today+15, end of month).
   Load order: after js/booking/*.js and 40-ops-bookings.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }

  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsBf) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!enabled()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__opsBf = true; w.__orig = orig; window[name] = w;
  }

  function today(){ return (typeof window.TODAY_STR === 'string' && window.TODAY_STR) || O.today(); }
  function monthStart(ds){ return ds.slice(0, 8) + '01'; }
  function min(a, b){ return a < b ? a : b; }
  function max(a, b){ return a > b ? a : b; }

  function windows(){
    var t = today();
    var d = new Date(t + 'T12:00:00');
    // month mode shows 6 months; the daily-counts request covers them all in one call
    var six = new Date(d.getFullYear(), d.getMonth() - 5, 1);
    var dailyFrom = O.ymd ? O.ymd(six) : six.toISOString().slice(0, 10);
    // week mode compares the last 8 ISO weeks; its first Monday is the earliest detail day
    var mon = new Date(d); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - 7 * 7);
    var monYmd = O.ymd ? O.ymd(mon) : mon.toISOString().slice(0, 10);
    var createdFrom = min(min(monthStart(t), monYmd), O.shift(t, -13));
    var monthEnd = O.shift(monthStart(O.shift(monthStart(t), 32)), -1);
    return {
      t: t,
      daily: { from: dailyFrom, to: t },
      created: { from: createdFrom, to: t },
      trips: { from: min(O.shift(t, -14), monthStart(t)), to: max(O.shift(t, 15), monthEnd) }
    };
  }

  wrap('renderBookingFlow', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    var W = windows();
    var loads = [];
    if(typeof window.bookingV2OpsEnsureDailyCounts === 'function'){
      window._opsBfDaily = { from: W.daily.from, to: W.daily.to };        // §bfSrvTot reads this window
      loads.push(window.bookingV2OpsEnsureDailyCounts(W.daily.from, W.daily.to, true));
    }
    if(typeof window.bookingV2OpsEnsureCreated === 'function')
      loads.push(window.bookingV2OpsEnsureCreated(W.created.from, W.created.to));
    if(typeof window.bookingV2EnsureOpsRange === 'function')
      loads.push(window.bookingV2EnsureOpsRange({ from: W.trips.from, to: W.trips.to, limit: 500 }));
    loads = loads.filter(Boolean);
    if(!loads.length) return orig.apply(self, args);
    var host = document.getElementById('bookingflow-host');
    if(host && !host.firstChild) host.innerHTML = O.loadingHtml('Loading bookings for Booking Flow…');
    return Promise.all(loads).then(function(rs){
      if(rs.some(function(r){ return !r; }))
        console.warn('[ops] Booking Flow: a booking range did not load; numbers may be partial');
      if(O.activeView() && O.activeView() !== 'bookingflow') return;     // left the page while loading
      return orig.apply(self, args);
    });
  });
})();
