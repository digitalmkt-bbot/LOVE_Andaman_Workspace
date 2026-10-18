/* ══════════════════════════════════════════════════════════════════════════
   §opsSalesW5 (w5-b, 2026-10-18) · booking-side rules that were still answered by browser lookups ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Wiring recheck rows (operation-backend docs/verify/wire2/wire-04.md):

     bookingV2GetPickupTime  ← GET /v1/pickup-time?route_id&area_id&date  {pickup_time, pickup_time_end?, pickup_at_pier?} or 404
                               (the profile covering the date, the area's own cell, else its time group's, else the fallback profile)
     acctBookingTotal        ← the booking's `owed` (what the agent owes: price + fee items), served on every booking read
     mdDirTot                ← the day's `total` (official total when there is one, else the sum of the rows) on GET /v1/market-stats

   Pickup time: the form asks synchronously, the server answers later. The first ask starts the read and legacy's lookup answers; when the
   server's answer differs the form is drawn again with it. An answer is kept until the Pickup Setup is changed.
   Classic script, after js/ops/21-ops-pickup.js, 31-ops-pfm.js, 40-ops-bookings.js, 64-ops-market-data.js, 66-ops-row-flags.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w5b) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__w5b = true; w.__orig = orig; window[name] = w;
  }

  /* ── pickup time of an area on a day ─────────────────────────────────────── */
  var times = {}, asking = {}, redrawT = null;
  O.onWrite(function(kind){ if(kind === 'pickup') { times = {}; asking = {}; } });
  function redraw(){
    clearTimeout(redrawT);
    redrawT = setTimeout(function(){
      if(O.busy()) return;
      try{ if(O.activeView() === 'booking' && typeof window.bookingV2Render === 'function') window.bookingV2Render(); }catch(_){}
    }, 120);
  }
  wrap('bookingV2GetPickupTime', function(orig, routeId, areaId, dateStr){
    var legacy = orig.apply(this, [].slice.call(arguments, 1));
    if(!routeId || !areaId || !dateStr || !O.pickup || !O.pickup.resolve) return legacy;
    var k = [routeId, areaId, dateStr].join('|');
    if(Object.prototype.hasOwnProperty.call(times, k)) return times[k];
    if(!asking[k]){
      asking[k] = true;
      O.pickup.resolve(routeId, areaId, dateStr).then(function(r){
        times[k] = O.pickup.cellText(r) || null;
        if(times[k] !== legacy) redraw();
      }, function(e){
        if(e && e.status === 404 && /^No pickup time/.test(String(e.message || ''))){ times[k] = null; if(legacy) redraw(); }   // the server says the area has no time that day
        else if(e && e.status === 404) times[k] = legacy;     // the server does not know the area (a screen-made pseudo area): legacy's answer stays
        else delete asking[k];            // not answered: legacy's lookup stays, asked again on the next draw
      });
    }
    return legacy;
  });

  /* ── what the agent owes: the server's `owed` (ops/66 keeps it on the booking as srvFlags) ─────────────── */
  wrap('acctBookingTotal', function(orig, bk){
    var f = bk && bk.srvFlags;
    return (f && typeof f.owed === 'number') ? f.owed : orig.apply(this, [].slice.call(arguments, 1));
  });

  /* ── a day's arrivals / departures total: the server's total (ops/64 keeps it as inTotal / outTotal) ──────── */
  wrap('mdDirTot', function(orig, d, dir){
    var t = d && d[dir + 'Total'];
    return (d && d[dir] && typeof t === 'number') ? t : orig.apply(this, [].slice.call(arguments, 1));
  });
})();
