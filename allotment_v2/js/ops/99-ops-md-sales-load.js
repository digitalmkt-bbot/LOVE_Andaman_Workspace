/* ══════════════════════════════════════════════════════════════════════════
   §opsMdSalesLoad (2026-10-20, server read 2026-11-25) · Market Data > "⑤ Sales & Agents" and "⑥ Agents" tabs
   ──────────────────────────────────────────────────────────────────────────
   mdTabSales and mdTabAgents (08-app.js) rank salespeople and agents by adding up SB_BOOKINGS (value, pax, cancels, no-shows, paid, AR,
   pax by programme family and pickup area, the discount / mix / market blocks). In ops mode SB_BOOKINGS holds only the days some view
   has loaded, so the tabs used to page the bookings of the last 12 months in first (~70 × GET /v1/bookings/recent, ~115 s).
   §mdSrvSales: operation-backend folds every booking once with legacy's rules (md-sales.ts) and answers the figures:
   GET /v1/market-stats/sales-agents (one call, ~0.7 s). window._opsMdSales() hands the answer to the two legacy renders, which use it
   in place of their own sums (§mdSrvSales in 08-app.js); markup and texts are legacy's.
     - While the answer loads the tab shows a "loading" note instead of partial numbers; a failed read says so (retried on the next open).
     - The answer is kept a minute; a write drops it.
   Classic script · after 93-ops-w6c-market.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var TABS = { mdTabSales: 'sales', mdTabAgents: 'agents' };
  var TTL = 60000, snap = { at: 0, data: null, load: null, failed: false };
  if(O.onWrite) O.onWrite(function(){ snap.at = 0; });

  function on(){ return !!(O.enabled && O.enabled()); }
  function repaint(tab){
    try{
      if(O.activeView && O.activeView() !== 'marketdata') return;
      if(typeof window.renderMarketData !== 'function') return;
      if(typeof _mdTab !== 'undefined' && _mdTab !== tab) return;
      window.renderMarketData();
    }catch(_){}
  }
  function note(text){ return typeof window.mdNote === 'function' ? window.mdNote(text) : '<div>' + text + '</div>'; }
  function load(tab){
    if(snap.load) return snap.load;
    snap.load = O.get('/v1/market-stats/sales-agents').then(function(d){
      if(!d || !d.totals || !Array.isArray(d.sales) || !Array.isArray(d.agents)) throw new Error('invalid Sales & Agents answer');
      snap.data = d; snap.at = Date.now(); snap.failed = false; snap.load = null;
      repaint(tab);
    }).catch(function(e){
      snap.load = null; snap.failed = true;
      if(typeof O.fail === 'function') O.fail('Sales & Agents did not load', e);
      repaint(tab);
    });
    return snap.load;
  }
  /* the legacy renders read this (null outside ops mode or before the first answer) */
  window._opsMdSales = function(){ return on() ? snap.data : null; };

  Object.keys(TABS).forEach(function(name){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsMdLoad) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var fresh = snap.data && Date.now() - snap.at < TTL;
      if(!fresh && !snap.load && !snap.failed) load(TABS[name]);
      if(snap.data) return orig.apply(this, arguments);               // fresh, or stale while the new answer loads
      if(snap.failed){ snap.failed = false; return note('Sales &amp; Agents could not load from operation-backend. Open the tab again to retry.'); }
      return note('Loading the sales figures from operation-backend...');
    };
    w.__opsMdLoad = true; w.__orig = orig;
    window[name] = w;
  });
})();
