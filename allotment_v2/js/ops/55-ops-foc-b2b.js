/* ════════════════════════════════════════════════════════════════════════
   §opsSalesAgg (2026-10-14) · FOC Detail + B2B Dashboard on operation-backend
   ────────────────────────────────────────────────────────────────────────
   Root cause: both screens aggregate over SB_BOOKINGS, which on operation-
   backend holds only the date ranges other views happened to load — their
   totals were partial and changed between visits with the cache.

   FOC Detail (renderFocDetail, 08-app.js) ranks every booking ever made.
   §focDetailSrv (2026-11-25): it no longer pages every booking in (28.7 s);
   it reads GET /v1/bookings/foc-detail (one call, ~0.2 s): the bookings with
   FOC heads whole, the others folded per agent and route (heads, value
   shared by heads) and per agent (value). focDetailBookings turns that into
   a small SB_BOOKINGS of stand-in bookings that add up to the same figures
   in legacy's render (see the section below).

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

  function viewIs(v){ try{ return O.activeView() === v; }catch(_){ return false; } }

  /* ════ FOC Detail · §focDetailSrv (2026-11-25) · GET /v1/bookings/foc-detail ════
     Legacy ranks every booking ever made (all-time FOC pax, agents and value). The server folds them (foc-detail.ts) and this
     builds the stand-in bookings legacy's render adds up to the same figures:
       · each booking with FOC heads, whole: its trips' heads as {ad: paying, foc: free}, its value (srvFlags.owed → laBkMoney),
         its FOC reason and approval state as focApproval, in legacy's booking order (reasons and ties follow it);
       · per agent (or none) and route, one booking with one trip of the folded heads and the value shared by heads (famVal);
       · per agent, one booking with no trip for the value of its bookings with no heads (in the agent's value, not in famVal).
     Routes are folded into families by legacy's own bkV2RouteFamily, as before. Cached a minute; a write drops it. */
  var FOC_TTL = 60000, focSnap = { at: 0, data: null, load: null };
  if(O.onWrite) O.onWrite(function(){ focSnap.at = 0; });
  function focDetailBookings(d){
    var out = [], n = 0;
    function own(v){ return { owed: Math.round((+v || 0) * 100) / 100 }; }
    (d.foc || []).forEach(function(f){
      out.push({ id: f.booking_id, status: 'confirmed', agentId: f.agent_id || null, b2cChannel: f.channel || '', srvFlags: own(f.value),
        focApproval: { status: f.approval || '', reason: f.reason || '' }, focReason: f.reason || '',
        trips: (f.trips || []).map(function(t){ return { date: t.date || '', routeId: t.route_id || '', pax: { ad: Math.max(0, (+t.pax || 0) - (+t.foc || 0)), foc: +t.foc || 0 } }; }) });
    });
    var shared = {};
    (d.shares || []).forEach(function(s){
      if(s.agent_id) shared[s.agent_id] = (shared[s.agent_id] || 0) + (+s.value || 0);
      out.push({ id: 'focd_s' + (n++), status: 'confirmed', agentId: s.agent_id || null, srvFlags: own(s.value),
        trips: [{ date: '', routeId: s.route_id || '', pax: { ad: +s.pax || 0 } }] });
    });
    (d.agents || []).forEach(function(a){
      var rest = (+a.value || 0) - (shared[a.agent_id] || 0);
      if(Math.abs(rest) >= 0.005) out.push({ id: 'focd_a' + (n++), status: 'confirmed', agentId: a.agent_id, srvFlags: own(rest), trips: [] });
    });
    return out;
  }
  O.focDetailBookings = focDetailBookings;
  function focLoad(){
    if(focSnap.load) return focSnap.load;
    focSnap.load = O.get('/v1/bookings/foc-detail').then(function(d){
      if(!d || !Array.isArray(d.foc) || !Array.isArray(d.shares) || !Array.isArray(d.agents)) throw new Error('invalid FOC detail answer');
      focSnap.data = focDetailBookings(d); focSnap.at = Date.now(); focSnap.load = null;
      return true;
    }, function(e){
      focSnap.load = null;
      if(typeof O.fail === 'function') O.fail('FOC detail did not load', e);
      return false;
    });
    return focSnap.load;
  }
  wrap('renderFocDetail', function(){
    var fresh = focSnap.data && Date.now() - focSnap.at < FOC_TTL;
    if(!fresh){
      var first = !focSnap.data;
      var p = focLoad();
      if(first){
        var host = document.getElementById('foc-host');
        if(host && typeof O.loadingHtml === 'function') host.innerHTML = O.loadingHtml('Loading FOC detail…');
        p.then(function(ok){
          if(!viewIs('focdetail')) return;
          if(ok) window.renderFocDetail();
          else if(host) host.innerHTML = '<div class="md-card" style="color:#8a9088;text-align:center;padding:30px">FOC detail could not load from operation-backend. Open the page again to retry.</div>';
        });
        return undefined;
      }
      p.then(function(ok){ if(ok && viewIs('focdetail')) window.renderFocDetail(); });   // stale: draw what we have, then the fresh answer
    }
    return withBookings(focSnap.data, function(){ return originals.renderFocDetail ? originals.renderFocDetail() : undefined; });
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
