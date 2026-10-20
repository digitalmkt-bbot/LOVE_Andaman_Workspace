/* ══════════════════════════════════════════════════════════════════════════
   §opsMdSalesLoad (2026-10-20) · workflow-compare gap 13 · Market Data > "Sales & Agents" and "Agents" tabs
   ──────────────────────────────────────────────────────────────────────────
   mdTabSales and mdTabAgents (08-app.js) rank salespeople and agents by adding up SB_BOOKINGS (value, pax, cancels, no-shows, paid, AR, pax by
   programme family and pickup area). In ops mode SB_BOOKINGS holds only the days some view has loaded, so the figures were partial.
   Server check (2026-10-20): no endpoint gives these per-person / per-agent figures (GET /v1/market-stats/our-mix is nationality and lead time,
   GET /v1/sales-board is the Sales Board's month; neither has paid / AR / family / area per agent). So the tabs load the period first:
   the bookings CREATED in the last 12 months (bookingV2OpsEnsureCreated, GET /v1/bookings/recent, paged), then draw again.
     - While that load runs the tab shows a "loading" note instead of partial numbers.
     - If it fails the tab draws from what is loaded (as before) and does not retry in a loop (the loader answers null once it has run).
   A failed load is not retried for 5 minutes. Classic script · after 93-ops-w6c-market.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var MONTHS = 12;
  var TABS = { mdTabSales: 'sales', mdTabAgents: 'agents' };
  var failedAt = 0;

  function on(){ return !!(O.enabled && O.enabled()); }
  function ymd(d){
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function range(){
    var now = new Date();
    return { from: ymd(new Date(now.getFullYear(), now.getMonth() - MONTHS, now.getDate())), to: ymd(now) };
  }
  function repaint(tab){
    try{
      if(O.activeView && O.activeView() !== 'marketdata') return;
      if(typeof window.renderMarketData !== 'function') return;
      if(typeof _mdTab !== 'undefined' && _mdTab !== tab) return;
      window.renderMarketData();
    }catch(_){}
  }

  Object.keys(TABS).forEach(function(name){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsMdLoad) return;
    var w = function(){
      if(!on() || typeof window.bookingV2OpsEnsureCreated !== 'function') return orig.apply(this, arguments);
      if(Date.now() - failedAt < 300000) return orig.apply(this, arguments);   // the last load failed: show what is loaded
      var r = range();
      var load = window.bookingV2OpsEnsureCreated(r.from, r.to);
      if(!load) return orig.apply(this, arguments);            // already loaded (or not an ops session)
      load.then(function(j){ if(!j) failedAt = Date.now(); repaint(TABS[name]); });   // a failed load is drawn once from what is loaded, then left alone
      return typeof window.mdNote === 'function'
        ? window.mdNote('Loading bookings of the last ' + MONTHS + ' months for this tab...')
        : '<div>Loading bookings...</div>';
    };
    w.__opsMdLoad = true; w.__orig = orig;
    window[name] = w;
  });
})();
