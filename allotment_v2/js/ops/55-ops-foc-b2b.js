/* ════════════════════════════════════════════════════════════════════════
   §opsSalesAgg (2026-10-14) · FOC Detail + B2B Dashboard on operation-backend
   ────────────────────────────────────────────────────────────────────────
   Root cause: both screens aggregate over SB_BOOKINGS, which on operation-
   backend holds only the date ranges other views happened to load — their
   totals were partial and changed between visits with the cache.

   FOC Detail (renderFocDetail, 08-app.js) has no period UI, and the server
   has no FOC aggregate endpoint yet (proposed: GET /v1/bookings/foc-stats
   ?from=&to= → per-agent {agent_id, foc, paying_pax, value, trips:[{date,
   route_id, foc, reason, status}]}). Until that exists the screen gets a
   fixed, labelled window — trips in the last 90 days plus the next 30 (by
   travel date) — loaded with bookingV2EnsureOpsRange and shown with a
   period banner.

   B2B Dashboard (renderB2BDash, 08-app.js) already has explicit period
   windows (b2dWin: current + comparison); this adapter loads exactly those
   before the aggregate runs:
   · basis 'td' (travel date)  → GET /v1/bookings?from=&to=  (service-date range)
   · basis 'bd' (booking date) → GET /v1/bookings/recent?created_from=&created_to=
     A booking can be backdated, so booking_date ≤ created date (observed up
     to −51 days in production); each window loads created dates from the
     window start to 60 days past its end, capped at today.
   _b2d.ref defaults to today: on lk-inbox the "latest booking date" default
   was effectively today, and on the server it must not depend on the cache.

   Both renders run the legacy function against only the window's bookings
   (SB_BOOKINGS is swapped for the synchronous render, then restored), so
   the numbers never depend on what another screen loaded. Loads dedupe in
   the booking cache; the screen redraws once per completed load (at most
   one redraw subscription per window per 5 s).
   Legacy mode (!O.enabled()): both renders delegate to the original.
   Classic script · loads after 08-app.js and js/booking/.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var originals = {};
  ['renderFocDetail', 'renderB2BDash'].forEach(function(n){ if(typeof window[n] === 'function') originals[n] = window[n]; });
  function wrap(name, opsFn){
    var orig = originals[name];
    window[name] = function(){
      if(!O.enabled()) return orig ? orig.apply(this, arguments) : undefined;
      return opsFn.apply(this, arguments);
    };
  }

  function iso(s){ if(!s) return null; s = String(s).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
  function allBookings(){ return (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : null; }
  /* SB_BOOKINGS is a top-level `let` in 08-app.js — one global lexical binding shared by every
     classic script, so the swap is visible to the legacy render. It lasts only for the
     synchronous render and is always restored; async merges only ever see the real array. */
  function withBookings(subset, fn){
    if(allBookings() === null) return fn();
    var real = SB_BOOKINGS;
    SB_BOOKINGS = subset;
    try{ return fn(); } finally{ SB_BOOKINGS = real; }
  }

  /* one redraw subscription per window per 5 s · a failed load resolves null → no redraw, no loop */
  var kickedAt = {};
  function kick(sig, loads, redraw){
    loads = loads.filter(Boolean);
    if(!loads.length) return;
    var now = Date.now();
    if(kickedAt[sig] && now - kickedAt[sig] < 5000) return;
    kickedAt[sig] = now;
    Promise.all(loads).then(function(rs){ if(rs.every(Boolean)) redraw(); }).catch(function(){});
  }
  function viewIs(v){ try{ return O.activeView() === v; }catch(_){ return false; } }

  /* ════ FOC Detail · trips in [today−90d .. today+30d] ════ */
  var FOC_BACK = 89, FOC_FWD = 30;
  function focWindow(){ var t = O.today(); return { from: O.shift(t, -FOC_BACK), to: O.shift(t, FOC_FWD) }; }
  function tripIn(b, from, to){
    return !!b && (b.trips || []).some(function(t){ var d = t && iso(t.date); return d && d >= from && d <= to; });
  }
  function focBanner(w, loading){
    try{
      var host = document.getElementById('foc-host'); if(!host) return;
      var el = document.createElement('div');
      el.id = 'foc-ops-period';
      el.style.cssText = 'margin:0 0 10px;padding:8px 14px;border-radius:10px;background:#EDF4FB;color:#1B5E96;font-size:11.5px;font-weight:600';
      el.textContent = 'Period: trips ' + w.from + ' - ' + w.to + ' (last 90 days + next 30)'
        + (loading ? ' - loading from operation-backend...' : '')
        + ' - all-time totals need a server summary endpoint';
      host.insertBefore(el, host.firstChild);
    }catch(_){}
  }
  wrap('renderFocDetail', function(){
    var w = focWindow();
    var load = (typeof bookingV2EnsureOpsRange === 'function') ? bookingV2EnsureOpsRange({ from: w.from, to: w.to }) : null;
    var subset = (allBookings() || []).filter(function(b){ return tripIn(b, w.from, w.to); });
    var r = withBookings(subset, function(){ return originals.renderFocDetail ? originals.renderFocDetail() : undefined; });
    focBanner(w, !!load);
    kick('foc|' + w.from + '|' + w.to, [load], function(){ if(viewIs('focdetail')) window.renderFocDetail(); });
    return r;
  });

  /* ════ B2B Dashboard · the two windows b2dWin shows ════ */
  var BD_SLACK = 60;   // booking_date runs behind created_at by up to ~51 days in production
  function capToday(d){ var t = O.today(); return d > t ? t : d; }
  function basisOf(){ return (window._b2d && window._b2d.basis) === 'td' ? 'td' : 'bd'; }
  function b2bWindows(){
    if(window._b2d && typeof window._b2d === 'object' && !window._b2d.ref) window._b2d.ref = O.today();
    if(typeof window.b2dWin !== 'function') return null;
    return window.b2dWin([]);   // with _b2d.ref set, b2dWin ignores the lines argument
  }
  function b2bLoads(w){
    if(basisOf() === 'td'){
      if(typeof bookingV2EnsureOpsRange !== 'function') return [];
      return [bookingV2EnsureOpsRange({ from: w.ps, to: w.pe }), bookingV2EnsureOpsRange({ from: w.cs, to: w.ce })];
    }
    if(typeof bookingV2OpsEnsureCreated !== 'function') return [];
    if(O.shift(w.pe, 1) === w.cs) return [bookingV2OpsEnsureCreated(w.ps, capToday(O.shift(w.ce, BD_SLACK)))];
    return [bookingV2OpsEnsureCreated(w.ps, capToday(O.shift(w.pe, BD_SLACK))),
            bookingV2OpsEnsureCreated(w.cs, capToday(O.shift(w.ce, BD_SLACK)))];
  }
  function bdOf(b){ return iso(b.bookingDate) || iso(b.bookedAt) || iso(b.createdAt); }
  function inWin(d, w){ return !!d && ((d >= w.cs && d <= w.ce) || (d >= w.ps && d <= w.pe)); }
  wrap('renderB2BDash', function(){
    var w = b2bWindows();
    if(!w) return originals.renderB2BDash ? originals.renderB2BDash() : undefined;
    var basis = basisOf();
    var subset = (allBookings() || []).filter(function(b){
      if(!b) return false;
      if(basis === 'td') return (b.trips || []).some(function(t){ return inWin(t && iso(t.date), w); });
      return inWin(bdOf(b), w);
    });
    var loads = b2bLoads(w);
    var r = withBookings(subset, function(){ return originals.renderB2BDash ? originals.renderB2BDash() : undefined; });
    kick('b2b|' + basis + '|' + w.ps + '|' + w.ce, loads, function(){ if(viewIs('b2b-dash')) window.renderB2BDash(); });
    return r;
  });
})();
