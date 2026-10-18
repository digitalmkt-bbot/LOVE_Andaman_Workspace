/* ══════════════════════════════════════════════════════════════════════════
   §opsByTrip (2026-10-18) · By-trip counts ⇄ GET /operations/by-trip?date=[&land=true]   (Q47)
   ──────────────────────────────────────────────────────────────────────────
   bookingV2RenderTab2 (js/booking/bookingV2RenderTab2.js) counted the day's pax, the prep chips
   (languages, veg, vegan, halal, allergy, longtail join / charter) and the "ยังจัดไม่ครบ" Boat and
   Van figures from whatever bookings the browser held. The server counts them now.

   window.laOpsByTripFor(date, land) -> the server's answer for that day and page, or null.
     · a miss asks once; the page is drawn again when the answer arrives (only if it changed)
     · a write (booking, lock, van, boat …) marks the answer stale; the old figures stay on screen
       until the new ones arrive, so the numbers never flicker back to the browser's own count
     · a failed ask is remembered for 15 s and the page keeps legacy's own count meanwhile
   The page reads it in six places (each marked §opsByTrip in bookingV2RenderTab2.js).

   NOT served by the server, so they stay on legacy: the trip-level bundle / longtailManual flags, the
   return-van / re-confirm / mixed-van chips, the boats-running card and the seat figures (allotment).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var FAIL_MS = 15000;
  var cache = {};                       // 'date|land' -> { ok, at, stale, res, json, busy }

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function key(date, land){ return date + '|' + (land ? 'land' : 'marine'); }

  function redraw(date){
    try{
      var st = window._bkV2;
      if(!st || st.tab !== 'bytrip' || st.newBooking) return;
      if(typeof window.bookingV2Tab2ActiveDate === 'function' && window.bookingV2Tab2ActiveDate() !== date) return;
      var a = document.activeElement;
      if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'bt-q') return;     // not under somebody typing
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
    }catch(e){ console.warn('[ops] By-trip redraw failed', e); }
  }

  function load(date, land, k){
    var e = cache[k] = cache[k] || {};
    if(e.busy) return;
    e.busy = true;
    O.get('/operations/by-trip', { date: date, land: land ? 'true' : '' }).then(function(res){
      var json = JSON.stringify(res), changed = !e.ok || e.json !== json;
      cache[k] = { ok: true, at: Date.now(), stale: false, res: res, json: json, busy: false };
      if(changed) redraw(date);
    }, function(err){
      var old = cache[k] || {};
      cache[k] = { ok: !!old.res, res: old.res, json: old.json, at: Date.now(), stale: false, failedAt: Date.now(), busy: false };
      try{ console.warn('[ops] By-trip counts: the server did not answer, the page keeps its own count · ' + ((err && err.message) || err)); }catch(_){}
    });
  }

  window.laOpsByTripFor = function(date, land){
    if(!enabled() || !date) return null;
    var k = key(date, land), e = cache[k];
    if(!e || (e.stale && !e.busy && !(e.failedAt && Date.now() - e.failedAt < FAIL_MS)) || (!e.ok && !e.busy && !(e.failedAt && Date.now() - e.failedAt < FAIL_MS))) load(date, land, k);
    e = cache[k];
    return e && e.ok && e.res ? e.res : null;
  };

  /* any write may move a count · the figures stay until the new ones are in */
  O.onWrite(function(){ Object.keys(cache).forEach(function(k){ if(cache[k]) cache[k].stale = true; }); });

  window.laOpsByTrip = { _cache: cache };
})();
