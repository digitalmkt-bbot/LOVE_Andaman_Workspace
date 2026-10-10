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

  var failed = [];
  function step(name, fn){
    return function(){
      return Promise.resolve().then(fn).catch(function(e){
        failed.push(name);
        try{ console.error('[ops] ' + name + ' failed to load · ' + (e && e.message)); }catch(_){}
      });
    };
  }

  function redraw(){
    if(O.busy()) return;
    var el = document.querySelector('.nav-item.active[data-view]');
    try{ if(el && typeof window.nav === 'function') window.nav(el); }catch(_){}
  }

  var t0 = Date.now();
  Promise.resolve()
    .then(step('catalogue', function(){ return O.catalogue && O.catalogue.load(); }))
    .then(step('deployments', function(){ return O.deployments && O.deployments.load(); }))
    .then(step('seat locks', function(){ return O.locks && O.locks.load(); }))
    .then(function(){
      // Booking records are page-owned: Calendar loads its visible month and
      // By-trip its selected day. Never download a 120-day booking blob at boot.
      if(typeof bookingV2OpsResetCache==='function') bookingV2OpsResetCache();
      if(typeof bookingV2OpsAttachWriteInvalidation==='function') bookingV2OpsAttachWriteInvalidation();
    })
    .then(step('pending approvals', function(){ return O.bookings && O.bookings.loadPending(); }))
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
    });
})();
