/* ══════════════════════════════════════════════════════════════════════════
   §opsBoot (2026-10-05) · load everything from operation-backend, in order
   ──────────────────────────────────────────────────────────────────────────
   catalogue → deployments → seat locks → bookings → pending approvals →
   charter cells → availability. The order matters:
     · deployments name boats and routes      → catalogue first
     · bookings' lock draws name server locks → locks before bookings
     · charter cells come from bookings       → after bookings
   A step that fails is reported and skipped. Its writer stays OFF
   (deployments/locks only sync after a successful load), so a failed load
   can never push the local seed data to the server as if it were real.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.enabled()) return;

  /* §opsRefresh · the topbar ↻ Refresh and 💾 Backup were legacy's: refreshData pulled /api/load (404 here) and flBackupData
     downloaded this browser's localStorage copy, which in this deployment is only seed data.
       ↻ Refresh  → reload the page: every cache (bookings, catalogue, adapters) is rebuilt from operation-backend and the
                    router puts the user back on the same view (the token stays in sessionStorage). A write in flight is waited for.
       💾 Backup  → hidden: the data lives in operation-backend's database, whose backup is the server's, not a browser file. */
  window.refreshData = function(){
    if(O.busy && O.busy()){ setTimeout(window.refreshData, 600); return; }
    location.reload();
  };
  try{ document.querySelectorAll('[onclick="flBackupData()"]').forEach(function(b){ b.style.display = 'none'; }); }catch(_){}

  var failed = [];
  function step(name, fn){
    return function(){
      try{ if(window.laOpsBootScreen) window.laOpsBootScreen.show('Loading '+name+'…'); }catch(_){}
      return Promise.resolve().then(fn).catch(function(e){
        failed.push(name);
        try{ console.error('[ops] ' + name + ' failed to load · ' + (e && e.message)); }catch(_){}
      });
    };
  }

  var selfNav = false;   // our own redraw, not a person opening a screen
  function redraw(){
    if(O.busy()) return;
    var el = document.querySelector('.nav-item.active[data-view]');
    selfNav = true;
    try{ if(el && typeof window.nav === 'function') window.nav(el); }catch(_){}
    finally{ selfNav = false; }
  }

  /* §bootLater · a screen opened while the background loads are still queued may read their data
     (fleet, money): run what is left at once; the redraw when they are in fills the screen.
     §loadOnOpen · a load only some screens read (laOps.later's `views`) starts when one of them opens; the
     screen is drawn again when it is in, if the person is still on it. */
  function openLoads(view){
    O.later.open(view).then(function(fresh){
      var el = document.querySelector('.nav-item.active[data-view]');
      if(fresh && el && el.dataset.view === view) redraw();
    }, function(){});
  }
  (function(){
    var orig = window.nav;
    if(typeof orig !== 'function' || !O.later) return;
    window.nav = function(el){
      if(O.state.loaded && !selfNav) openLoads(el && el.dataset ? el.dataset.view : '');
      return orig.apply(this, arguments);
    };
  })();

  var t0 = Date.now();
  Promise.resolve()
    .then(step('catalogue', function(){ return O.catalogue && O.catalogue.load(); }))
    // w5-a · CS's embed token (POST /v1/embed/token) reads the calendar and By-trip pages only: the loads those pages do not need would all be 403
    .then(step('staff & welfare', function(){ return !window.__laEmbedToken && O.staff && O.staff.load(); }))
    .then(step('nationalities', function(){ return !window.__laEmbedToken && O.nationalities && O.nationalities.load(); }))
    .then(step('cancel reasons', function(){ return !window.__laEmbedToken && O.cancelCategories && O.cancelCategories.load(); }))
    .then(step('park tickets', function(){ return !window.__laEmbedToken && O.park && O.park.load(); }))
    .then(step('add-on types', function(){ return !window.__laEmbedToken && O.addonTypes && O.addonTypes.load(); }))
    .then(step('deployments', function(){ return O.deployments && O.deployments.load(); }))
    .then(step('seat locks', function(){ return O.locks && O.locks.load(); }))
    .then(step('weather closures', function(){ return O.weather && O.weather.load(); }))
    // §loadOnOpen · market stats (SB_MARKET_STATS / _MONTHLY, ~370 KB) are read by Market Data, the Pickup Map arrivals and
    // Accounting's market chip only: they load when one of those opens, not at every login
    .then(function(){ if(!window.__laEmbedToken && O.marketData && O.later) O.later('market data', function(){ return O.marketData.load(); }, 6, ['marketdata', 'pickupmap', 'accounting']); })
    .then(step('meal venues and trip actuals', function(){ return !window.__laEmbedToken && O.meals && O.meals.load(); }))
    .then(function(){
      // Booking records are page-owned: Calendar loads its visible month and
      // By-trip its selected day. Never download a 120-day booking blob at boot.
      if(typeof bookingV2OpsResetCache==='function') bookingV2OpsResetCache(true);
      if(typeof bookingV2OpsAttachWriteInvalidation==='function') bookingV2OpsAttachWriteInvalidation();
    })
    // Pending approvals are an all-date queue. Load them only when its tab is
    // opened; doing it here pages up to 2,000 unrelated bookings at every login.
    .then(step('charter cells', function(){ return O.deployments && O.deployments.markCharters(typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []); }))
    .then(function(){
      O.state.loaded = true;
      O.state.failed = failed.slice();
      try{ if(O.availability) O.availability.preload(); }catch(_){}
      try{ console.log('[ops] loaded in ' + (Date.now() - t0) + 'ms' + (failed.length ? ' · FAILED: ' + failed.join(', ') : '')); }catch(_){}
      if(failed.length){
        O.toast({ kind: 'error', title: 'Some data did not load from operation-backend', status: 'PARTIAL',
          sub: failed.join(' · ') + ' · those screens show local data and will not save', dur: 12000 });
      }
      redraw();
      // Render has been requested; remove the gate on the next frame so users
      // never see a half-built app after a successful login.
      requestAnimationFrame(function(){ try{ if(window.laOpsBootScreen) window.laOpsBootScreen.hide(); }catch(_){} });
      // §bootLater · now the rest (money, fleet), two at a time, then draw the screen once more with it
      if(O.later){
        var tl = Date.now();
        O.later.whenDone(function(){
          try{ console.log('[ops] background loads in ' + (Date.now() - tl) + 'ms · ' + O.later.names().join(', ')); }catch(_){}
          redraw();
        });
        O.later.start();
        // the first screen (the one the router restored) may be one that loads on open
        var first = document.querySelector('.nav-item.active[data-view]');
        if(first) openLoads(first.dataset.view);
      }
    });
})();
