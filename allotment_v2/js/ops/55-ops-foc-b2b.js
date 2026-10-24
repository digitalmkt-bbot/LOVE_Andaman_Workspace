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
   GET /v1/bookings/b2b-lines (§b2bLines: the server's trip lines, all time)
   — see the section below.

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
  /* legacy ranks every booking ever made (all-time FOC pax, agents and value); a 120-day window showed 490 FOC pax against lk's 652.
     So the window is the whole history; the first open pages it in once (limit 500), later opens read the cached range. */
  var FOC_BACK = 3650, FOC_FWD = 400;
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
      if(!loading) return;          // the whole history is shown: legacy has no period line, only a note while the rest is still coming in
      el.textContent = 'Loading every booking from operation-backend... the totals fill in when it lands';
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
     So the screen reads the server's B2B trip lines into its own snapshot and runs the legacy render
     over exactly that snapshot — never over SB_BOOKINGS, whose contents depend on which screens were
     opened first. The snapshot is not merged into SB_BOOKINGS (other screens keep their own ranges).
     In-session edits: a cached booking with a newer opsVersion replaces its snapshot lines; the
     snapshot is refetched in the background after a write or after 5 minutes.

     §b2bLines (2026-10-15) · GET /v1/bookings/b2b-lines answers every confirmed B2B booking as one
     line per trip, with legacy's rules already applied on the server (operation-backend
     src/domain/b2b-lines.ts): which bookings, the sale day and its fallback, the tiered adult+child
     pax, the total split across trips by pax share (unrounded), and lk-inbox's order (booking id,
     then trip). It replaces paging every confirmed booking (~23 MB, ~12 s on first open). Each line
     becomes a one-trip booking whose total IS the line's revenue, so b2dLines gives back exactly the
     server's line: rev = total (one trip), pax = ad_fr, bkid = the booking id (b2dSum/b2dAgents
     count distinct bkid, so a 2-trip booking still counts once). */
  var B2D_TTL = 5 * 60 * 1000;
  var B2D_RETRY = 30 * 1000;   // after a failed load, no automatic refetch for 30 s (the Retry button skips the wait)
  var b2dSnap = { rows: null, at: 0, stale: false, load: null, err: null, errAt: 0 };
  /* one server line → the booking fields b2dLines reads (status, agentId, bookingDate, marketSnapshot,
     priceBreakdown.total, trips[].{date,routeId,pax}, id) · a booking with no trips arrives as one line
     with no date/route, which b2dLines treats as legacy's [{}] trip */
  function b2dFromLines(j){
    if(!j || !Array.isArray(j.fields) || !Array.isArray(j.lines)) throw new Error('b2b-lines did not return lines');
    var at = {}; j.fields.forEach(function(f, i){ at[f] = i; });
    ['booking_id', 'version', 'agent_id', 'booking_date', 'market', 'service_date', 'route_id', 'pax', 'revenue'].forEach(function(f){
      if(at[f] == null) throw new Error('b2b-lines has no ' + f);
    });
    return j.lines.map(function(l){
      var b = { id: l[at.booking_id], opsVersion: l[at.version], status: 'confirmed', agentId: l[at.agent_id],
                bookingDate: l[at.booking_date] || '', priceBreakdown: { total: l[at.revenue] },
                trips: [{ date: l[at.service_date], routeId: l[at.route_id], pax: { ad_fr: l[at.pax] } }] };
      if(l[at.market]) b.marketSnapshot = { market: l[at.market] };
      return b;
    });
  }
  function b2dEnsure(){
    if(b2dSnap.load) return b2dSnap.load;
    var fresh = b2dSnap.rows && !b2dSnap.stale && (Date.now() - b2dSnap.at) < B2D_TTL;
    if(fresh) return null;
    if(b2dSnap.err && Date.now() - b2dSnap.errAt < B2D_RETRY) return null;   // never a fetch → fail → redraw loop
    b2dSnap.load = O.get('/v1/bookings/b2b-lines').then(function(j){
      b2dSnap.rows = b2dFromLines(j);   // in the server's order: lk-inbox's booking-id order, then trip
      b2dSnap.at = Date.now(); b2dSnap.stale = false; b2dSnap.err = null; b2dSnap.load = null;
      try{ console.log('[opsSync] B2B dashboard: ' + b2dSnap.rows.length + ' B2B trip line(s) from operation-backend'); }catch(_){}
      return true;
    }, function(e){
      b2dSnap.load = null; b2dSnap.err = e; b2dSnap.errAt = Date.now();
      try{ console.warn('[opsSync] B2B dashboard: B2B lines did not load · ' + ((e && e.message) || e)); }catch(_){}
      return false;
    });
    return b2dSnap.load;
  }
  if(typeof O.onWrite === 'function') O.onWrite(function(){ b2dSnap.stale = true; });
  /* the snapshot, with any cached booking the browser holds in a newer version swapped in for all
     of its lines (once, where its first line was) · keyed by booking id = the lines' booking_id */
  function b2dData(){
    var rows = b2dSnap.rows || [], cached = allBookings() || [], newer = {}, used = {}, out = [];
    cached.forEach(function(b){ if(b && b.opsId && b.opsVersion != null) newer[b.id] = b; });
    rows.forEach(function(s){
      var c = newer[s.id];
      if(!(c && s.opsVersion != null && +c.opsVersion > +s.opsVersion)){ out.push(s); return; }
      if(!used[s.id]){ used[s.id] = 1; out.push(c); }
    });
    return out;
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
