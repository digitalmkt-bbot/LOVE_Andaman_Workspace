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

   B2B Dashboard (renderB2BDash, 08-app.js) · §b2dParity (2026-10-15): the
   legacy render reads the WHOLE confirmed history — default reference date
   = newest booking/travel date in the data (b2dLatestDate), KPI sparklines
   = one point per month over all history (b2dMonthlySeries), monthly
   stacked trends on By staff/trip/market. A two-window subset gave lk a
   different reference date, a 3-point sparkline and comparison figures that
   depended on stray cached bookings. It now runs over a private snapshot of
   GET /v1/bookings?status=confirmed (all pages) — see the section below.

   Both renders run the legacy function against a swapped SB_BOOKINGS (for
   the synchronous render only, then restored), so the numbers never depend
   on what another screen loaded.
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
    /* limit 500: the 120-day window holds ~4k bookings — at the default 100/page that is ~40
       sequential round-trips (~30 s before the screen fills); 500 cuts it to ~8 */
    var load = (typeof bookingV2EnsureOpsRange === 'function') ? bookingV2EnsureOpsRange({ from: w.from, to: w.to, limit: 500 }) : null;
    var subset = (allBookings() || []).filter(function(b){ return tripIn(b, w.from, w.to); });
    var r = withBookings(subset, function(){ return originals.renderFocDetail ? originals.renderFocDetail() : undefined; });
    focBanner(w, !!load);
    kick('foc|' + w.from + '|' + w.to, [load], function(){ if(viewIs('focdetail')) window.renderFocDetail(); });
    return r;
  });

  /* ════ B2B Dashboard · every confirmed booking, as lk-inbox sees it ════
     The legacy render needs the whole confirmed history, not two windows:
     · its default reference date is the newest booking (or travel) date in the data (b2dLatestDate);
     · the KPI sparklines are one point per month over all history (b2dMonthlySeries);
     · By staff / By trip / By market draw a monthly stacked trend over all history (b2dMonthlyHtml).
     So the screen reads GET /v1/bookings?status=confirmed (all pages) into its own snapshot and runs
     the legacy render over exactly that snapshot — never over SB_BOOKINGS, whose contents depend on
     which screens were opened first. The snapshot is not merged into SB_BOOKINGS (other screens keep
     their own ranges). In-session edits: a cached booking with a newer opsVersion replaces its
     snapshot copy; the snapshot is refetched in the background after a write or after 5 minutes.
     NEEDS-SERVER-WORK: a compact B2B trip-line read would replace the full booking payloads. */
  var B2D_PAGE = 1000, B2D_TTL = 5 * 60 * 1000;
  var B2D_RETRY = 30 * 1000;   // after a failed load, no automatic refetch for 30 s (the Retry button skips the wait)
  var b2dSnap = { rows: null, at: 0, stale: false, load: null, err: null, errAt: 0 };
  function b2dFetchAll(){
    var all = [], pages = 0;
    function page(cursor){
      return O.get('/v1/bookings', { status: 'confirmed', limit: B2D_PAGE, cursor: cursor }).then(function(j){
        if(!j || !Array.isArray(j.bookings)) throw new Error('booking list did not return bookings');
        Array.prototype.push.apply(all, j.bookings);
        if(j.next_cursor && ++pages < 200) return page(j.next_cursor);
        return all;
      });
    }
    return page(null);
  }
  function b2dEnsure(){
    if(b2dSnap.load) return b2dSnap.load;
    var fresh = b2dSnap.rows && !b2dSnap.stale && (Date.now() - b2dSnap.at) < B2D_TTL;
    if(fresh) return null;
    if(b2dSnap.err && Date.now() - b2dSnap.errAt < B2D_RETRY) return null;   // never a fetch → fail → redraw loop
    b2dSnap.load = b2dFetchAll().then(function(list){
      /* lk-inbox's store is in booking-id order; the legacy tables break revenue ties by first
         appearance, so the same order gives the same row order */
      b2dSnap.rows = list.map(bookingV2FromOpsBooking).sort(function(a, b){
        var x = String(a.id), y = String(b.id); return x < y ? -1 : (x > y ? 1 : 0);
      });
      b2dSnap.at = Date.now(); b2dSnap.stale = false; b2dSnap.err = null; b2dSnap.load = null;
      try{ console.log('[opsSync] B2B dashboard: ' + b2dSnap.rows.length + ' confirmed booking(s) from operation-backend'); }catch(_){}
      return true;
    }, function(e){
      b2dSnap.load = null; b2dSnap.err = e; b2dSnap.errAt = Date.now();
      try{ console.warn('[opsSync] B2B dashboard: confirmed bookings did not load · ' + ((e && e.message) || e)); }catch(_){}
      return false;
    });
    return b2dSnap.load;
  }
  if(typeof O.onWrite === 'function') O.onWrite(function(){ b2dSnap.stale = true; });
  /* the snapshot, with any cached booking the browser holds in a newer version swapped in */
  function b2dData(){
    var rows = b2dSnap.rows || [], cached = allBookings() || [], newer = {};
    cached.forEach(function(b){ if(b && b.opsId && b.opsVersion != null) newer[b.opsId] = b; });
    return rows.map(function(s){
      var c = s && newer[s.opsId];
      return (c && s.opsVersion != null && +c.opsVersion > +s.opsVersion) ? c : s;
    });
  }
  /* one redraw per load, however many renders ran while it was in flight */
  var redrawFor = null;
  function redrawAfter(load, quiet){
    if(redrawFor === load) return;
    redrawFor = load;
    load.then(function(ok){
      if(!viewIs('b2b-dash')) return;
      if(quiet && (!ok || O.busy())) return;   // a background refresh never redraws under the user
      window.renderB2BDash();
    });
  }
  window.b2dOpsRetry = function(){ b2dSnap.err = null; window.renderB2BDash(); };
  function b2dHost(html){ var h = document.getElementById('b2bdash-wrap'); if(h) h.innerHTML = html; }
  wrap('renderB2BDash', function(){
    var load = b2dEnsure();
    if(!b2dSnap.rows){
      if(load){
        b2dHost(O.loadingHtml('Loading B2B bookings from operation-backend…'));
        redrawAfter(load, false);
        return;
      }
      b2dHost('<div style="padding:24px;color:#B91C1C;font-size:13px">B2B bookings did not load from operation-backend'
        + ' <button onclick="b2dOpsRetry()" style="margin-left:8px;cursor:pointer">Retry</button></div>');
      return;
    }
    if(load) redrawAfter(load, true);
    return withBookings(b2dData(), function(){ return originals.renderB2BDash ? originals.renderB2BDash() : undefined; });
  });
})();
