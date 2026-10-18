/* ══════════════════════════════════════════════════════════════════════════
   §opsByTripExtras (2026-10-18, w4-f3) · By-trip: re-confirm chip, overnight holding rows, return-van chip
   ──────────────────────────────────────────────────────────────────────────
   Backend guide: operation-backend todo/booking-list-model.md (By-trip), README "By-trip counts" and "Van board".
   Loads after 72-ops-by-trip.js. Classic script. bookingV2RenderTab2.js reads this file's two helpers in marked
   §opsByTripExtras edits.

   · re-confirm chip   GET /operations/by-trip -> warnings.reconfirm {bookings, pax, by_route}   (read in Tab2 from laOpsByTripFor)
   · overnight rows    GET /operations/by-trip -> ovn_holds[] (one zero-pax row per held night, live bookings only).
                       The booking of a hold usually has no trip on the day, so it is not in the day's load: the
                       missing ones are read here (GET /v1/bookings/{id}) and join SB_BOOKINGS, so the row has its
                       booking and the boat card sees the hold too.
   · return-van chip   GET /operations/van-board?date -> routes[].return_unarranged[] {booking_id, pax} (legacy
                       bookingV2RetInfo(...).alert). laOpsVanBoardFor(date) = the answer or null.

   NOT served (stay legacy, listed in docs/walk/w4-f3.md as MISSING-SERVER-FIELD): the mixed-van group conflict chip
   (bookingV2VanGroupConflicts) and the boats-running card's pax per boat / "over" flags.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var FAIL_MS = 15000;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function redraw(date){
    try{
      var st = window._bkV2;
      if(!st || st.tab !== 'bytrip' || st.newBooking) return;
      if(typeof window.bookingV2Tab2ActiveDate === 'function' && window.bookingV2Tab2ActiveDate() !== date) return;
      var a = document.activeElement;
      if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'bt-q') return;
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
    }catch(e){ console.warn('[ops] By-trip redraw failed', e); }
  }

  /* ── the van board of a day ──────────────────────────────────────────── */
  var vb = {};                                   // date -> { ok, res, json, stale, busy, failedAt }
  function loadBoard(date){
    var e = vb[date] = vb[date] || {};
    if(e.busy) return;
    e.busy = true;
    O.get('/operations/van-board', { date: date }).then(function(res){
      var json = JSON.stringify(res), changed = !e.ok || e.json !== json;
      vb[date] = { ok: true, res: res, json: json, stale: false, busy: false };
      if(changed) redraw(date);
    }, function(err){
      var old = vb[date] || {};
      vb[date] = { ok: !!old.res, res: old.res, json: old.json, stale: false, busy: false, failedAt: Date.now() };
      try{ console.warn('[ops] van board: the server did not answer, the return-van chip keeps its own count · ' + ((err && err.message) || err)); }catch(_){}
    });
  }
  window.laOpsVanBoardFor = function(date){
    if(!enabled() || !date) return null;
    var e = vb[date], failed = e && e.failedAt && Date.now() - e.failedAt < FAIL_MS;
    if(!failed && (!e || (e.stale && !e.busy) || (!e.ok && !e.busy))) loadBoard(date);
    e = vb[date];
    return e && e.ok && e.res ? e.res : null;
  };

  /* ── bookings behind the overnight holding rows ──────────────────────── */
  var asked = {};
  function ensureHoldBookings(date, res){
    var holds = (res && res.ovn_holds) || [];
    if(!holds.length || typeof SB_BOOKINGS === 'undefined') return;
    holds.forEach(function(h){
      if(!h || !h.booking_id || asked[h.booking_id]) return;
      if(SB_BOOKINGS.some(function(b){ return b && b.opsId === h.booking_id; })) return;
      asked[h.booking_id] = true;
      O.get('/v1/bookings/' + encodeURIComponent(h.booking_id)).then(function(ob){
        if(!ob || typeof window.bookingV2FromOpsBooking !== 'function' || typeof window._opsBookingMerge !== 'function') return;
        window._opsBookingMerge([window.bookingV2FromOpsBooking(ob)]);
        redraw(date);
      }, function(err){
        delete asked[h.booking_id];
        try{ console.warn('[ops] overnight hold booking not read · ' + ((err && err.message) || err)); }catch(_){}
      });
    });
  }
  var origFor = window.laOpsByTripFor;
  if(typeof origFor === 'function' && !origFor.__opsExtras){
    var w = function(date, land){
      var res = origFor.apply(this, arguments);
      if(res) ensureHoldBookings(date, res);
      return res;
    };
    w.__opsExtras = true; window.laOpsByTripFor = w;
  }

  /* any write may move a board: the old figures stay until the new ones are in */
  O.onWrite(function(){ Object.keys(vb).forEach(function(k){ if(vb[k]) vb[k].stale = true; }); asked = {}; });

  /* the overnight rows for Tab2: [{bk, t, h}] built from the server's ovn_holds, skipping a hold whose booking is not here yet */
  window.laOpsOvnRows = function(srv){
    var out = [];
    ((srv && srv.ovn_holds) || []).forEach(function(h){
      var bk = (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).filter(function(b){ return b && b.opsId === h.booking_id; })[0];
      if(!bk) return;
      var t = (bk.trips || []).filter(function(x){ return x && x.bookingMode === 'charter' && x.ovn === 'return' && x.routeId === h.route_id; })[0];
      if(!t) return;
      out.push({ bk: bk, t: t, h: h });
    });
    return out;
  };
  window.laOpsByTripExtras = { _board: vb };
})();
