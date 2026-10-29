/* ═════════════════════════════════════════════════════════════════════════
   §opsNotYet (2026-10-28) · lk-inbox features that arrived with the 10-27 sync (#31) but that
   operation-backend does not save yet. Each one writes the legacy blob, which is local-only here, so
   staff would see a save that is gone on the next reload. In ops mode they are refused with a plain
   message instead (or, for a banner that only leads to one, not drawn). Remove a block when its
   adapter or endpoint lands.
   (§cxWhy, the reason of a booking cancelled without one, saves since 2026-10-28: ops/41-ops-cancel-reason.js →
    POST /v1/bookings/{id}/cancel-reason; the banner, the detail card and the Cancellations tab count are drawn again)
   (§poXfer, Pier Office equipment transfers between piers, save since 2026-10-29: pier transfers, migration 581)
   (§ovnBoatBack, charter OVN "boat returns to the pier the same day", saves since 2026-10-28: ovn_boat_back, migration 580)
   (§flnWd, parts withdrawn while adding work, saves since 2026-10-28: ops/24-ops-fleet-jobs.js → O.fleetStock.withdrawForJob)
   From the 10-29 sync:
     · §eqLink     Fleet › Equipment: link a gearbox / propeller / engine by position (saves through flSave, a no-op here;
                   swap and remove still save: ops/23-ops-fleet-assets.js)
     · §rentDay    Costing › เรือเช่า: the daily charter rate per boat and per route (the server's boat rent has no such
                   fields, so the adapter drops them); the other rent fields still save
   (§tcxPartner, Send to partner, saves since 2026-10-28: ops/27-ops-weather.js → POST /v1/weather-closures/{id}/send-to-partner)
   Loaded after every other ops adapter (just before 90-ops-boot.js), so these wrappers run first.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps;
  if(!O) return;

  function refuse(what){
    alert(what + ' is not available yet: operation-backend does not save it, so it would be lost on reload.');
    return false;
  }
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsNotYet) return;
    var w = function(){ if(!O.enabled()) return orig.apply(this, arguments); return fn.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsNotYet = true; window[name] = w;
  }
  function block(names, what){ names.forEach(function(n){ wrap(n, function(){ return refuse(what); }); }); }

  /* §eqLink · the picker still opens and shows what it would link; choosing and linking are refused. Swap / remove are the server's. */
  block(['flEqChoose', 'flEqLinkPair', 'flEqQuickLink', 'flEqTakeOut'], 'Linking engines, gearboxes and propellers by position (use Swap / Remove for now)');

  /* §rentDay · only the daily-rate fields are refused; the box is put back by redrawing the page */
  wrap('ctRentSet', function(orig, boatId, k, v){
    if(String(k || '').indexOf('day.') === 0){
      refuse('The daily charter rate');
      try{ if(typeof window.ctRender === 'function') window.ctRender(); }catch(_){}
      return false;
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });
})();
