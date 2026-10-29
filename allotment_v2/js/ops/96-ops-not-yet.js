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
   (§rentDay / §rentRoute, the daily charter rate per boat and per route, saves since 2026-10-29: ops/44-ops-costing-pl.js maps
    the boat rent's day both ways → PUT /v1/costing/boat-rents/{boat_id}, migration 584; Trip P&L charges it on the server)
   (§eqLink, Fleet › Equipment: link a gearbox / propeller / engine by position, saves since 2026-10-29:
    ops/23-ops-fleet-assets.js → POST /v1/fleet/{engines|gearboxes|propellers}/{id}/link and /unlink)
   (§tcxPartner, Send to partner, saves since 2026-10-28: ops/27-ops-weather.js → POST /v1/weather-closures/{id}/send-to-partner)
   Nothing is refused since 2026-10-29: every feature from the 10-27 and 10-29 syncs saves (above). `refuse` and `wrap` stay
   for the next sync's features.
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
})();
