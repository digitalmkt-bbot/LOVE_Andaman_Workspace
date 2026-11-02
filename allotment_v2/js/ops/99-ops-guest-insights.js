/* ═══════════════════════════════════════════════════════════════════════════════
   §opsGuestIns (2026-11-01) · Overview › Guest Insights (13-guest-insights.js, lk-inbox §guestIns 9270583b)
   ───────────────────────────────────────────────────────────────────────────────
   giCollect counts the people of SB_BOOKINGS who travel in the chosen period (30 days, this quarter, this year). In ops mode
   SB_BOOKINGS holds only the days some view has loaded, so the page came out short. No endpoint gives these figures (they rest on
   the per-person Insurance overrides and the nationality merge in the browser), so the page loads the period first, by travel
   date (bookingV2EnsureOpsRange, GET /v1/bookings?from=&to=, paged), then draws again.
     - While that load runs the page shows a "loading" note instead of partial numbers.
     - If it fails the page draws from what is loaded (as before) and says so; a failed load is not retried for 5 minutes.
   Classic script · after 13-guest-insights.js.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window.renderGuestInsights;
  if(typeof orig !== 'function' || orig.__opsGi) return;
  var failedAt = 0;

  function on(){ return !!(O.enabled && O.enabled()); }
  function note(text){
    var host = document.getElementById('guestins-host');
    if(host) host.innerHTML = '<div style="padding:40px;text-align:center;color:#6B7280;font-size:13px">' + text + '</div>';
  }
  function open(){ return !O.activeView || O.activeView() === 'guestins'; }

  var w = function(){
    if(!on() || typeof window.bookingV2EnsureOpsRange !== 'function' || typeof window.giRange !== 'function') return orig.apply(this, arguments);
    if(Date.now() - failedAt < 300000) return orig.apply(this, arguments);   // the last load failed: show what is loaded
    var load = window.bookingV2EnsureOpsRange(window.giRange());
    if(!load) return orig.apply(this, arguments);                            // already loaded
    note('Loading the bookings of this period...');
    load.then(function(j){ if(!j) failedAt = Date.now(); }, function(){ failedAt = Date.now(); })
      .then(function(){
        if(!open()) return;
        window.renderGuestInsights();
        if(failedAt && typeof O.toast === 'function') O.toast({ kind: 'neutral', title: 'Guest Insights could not load the whole period: the figures are partial', dur: 6000 });
      });
    return undefined;
  };
  w.__opsGi = true; w.__orig = orig;
  window.renderGuestInsights = w;
})();
