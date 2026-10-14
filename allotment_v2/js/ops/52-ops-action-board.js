/* ══════════════════════════════════════════════════════════════════════════
   §opsActionBoard (2026-10-14) · Action Board ⇄ operation-backend bookings
   ──────────────────────────────────────────────────────────────────────────
   abRender (09-action-board.js) sums SB_BOOKINGS three ways:
   - the seat matrix: getAllotment per route-day for TODAY → +13. Its seat
     numbers come from /v1/availability (50-ops-availability.js), but the
     capacity side (availableCapacity = deployed caps minus CHARTERED boats)
     and the per-agent bars (_abAgentSplit) are computed from the bookings in
     the browser. With the 14-day trip range not loaded, chartered boats stay
     in the pool (fill% too low, free too high) and the agent bars miss pax.
   - the agent cards: bookings by CREATION month, current vs previous month
     (same days). Nothing loaded those months, so both sides were partial.
   Fix (model: 41-ops-prpo.js / commit 5a6e6d3): load exactly the windows the
   board displays, then run the legacy render once.
   - trips    GET /v1/bookings?from=today&to=today+13 (trip service date)
   - created  GET /v1/bookings/recent for the current month (1 → today) and
              the whole previous month (the card's comparison period)
   The two cards that reach back three months (Was big · Steady senders) would
   need the browser to hold ~4 months of bookings — nearly the whole database
   today. They stay computed over what is loaded (current + previous month)
   until the server grows a per-agent month aggregate (see commit message).
   Load order: after js/booking/*.js and 40-ops-bookings.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }

  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsAb) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!enabled()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__opsAb = true; w.__orig = orig; window[name] = w;
  }

  function today(){ return (typeof window.TODAY_STR === 'string' && window.TODAY_STR) || O.today(); }
  function monthStart(ds){ return ds.slice(0, 8) + '01'; }
  function prevMonth(ds){
    var d = new Date(ds.slice(0, 7) + '-01T12:00:00'); d.setDate(0);           // last day of previous month
    var last = O.ymd ? O.ymd(d) : d.toISOString().slice(0, 10);
    return { from: monthStart(last), to: last };
  }

  /* All three ensure-calls return null when their range is already cached and
     one shared in-flight promise otherwise, so re-renders (filter clicks, the
     availability redraw) never refetch and never stack loads. */
  function kickLoads(){
    var t = today(), pm = prevMonth(t);
    var loads = [];
    if(typeof window.bookingV2EnsureOpsRange === 'function')
      loads.push(window.bookingV2EnsureOpsRange({ from: t, to: O.shift(t, 13), limit: 500 }));
    if(typeof window.bookingV2OpsEnsureCreated === 'function'){
      loads.push(window.bookingV2OpsEnsureCreated(monthStart(t), t));
      loads.push(window.bookingV2OpsEnsureCreated(pm.from, pm.to));
    }
    return loads.filter(Boolean);
  }

  wrap('abRender', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    var loads = kickLoads();
    if(!loads.length) return orig.apply(self, args);
    var host = document.getElementById('ab-wrap');
    if(host && !host.firstChild) host.innerHTML = O.loadingHtml('Loading bookings for the Action Board…');
    return Promise.all(loads).then(function(rs){
      if(rs.some(function(r){ return !r; }))
        console.warn('[ops] Action Board: a booking range did not load; numbers may be partial');
      if(O.activeView() && O.activeView() !== 'actionboard') return;   // left the page while loading
      return orig.apply(self, args);
    });
  });
})();
