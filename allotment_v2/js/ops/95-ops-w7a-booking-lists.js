/* ══════════════════════════════════════════════════════════════════════════
   §opsW7aLists (w7-a, 2026-10-19) · booking read / list consumers of the computed fields addon_only, addon_of, order_lines, drop
   ──────────────────────────────────────────────────────────────────────────
   Backend: operation-backend README "Bookings" (GET /v1/bookings rows -> addon_only, addon_of; GET /v1/bookings/{id} -> order_lines;
   every read and list row -> drop {separate, name, self_return}); todo/remaining-wiring.md.
   40-ops-bookings.js keeps them on the booking, read only and never sent (marked §w7a): bk.srvAddonOnly, bk.addonOf (+ addonOfRead,
   94-ops-booking-w6.js), bk.srvOrderLines, bk.srvDrop. Loads after 82-ops-w5c-vans.js and 94-ops-booking-w6.js. Classic script.

   bkB2CAddonOnly(b)        <- the row's addon_only (bkB2CAddonTo / bkB2CAddonsOf already read addon_of through 94-ops-booking-w6.js, now
                               for list rows too: they carry the key); legacy's test until a row says
   _bkOrderLines(bk)        <- GET /v1/bookings/{id} order_lines[] (the other lines of the order, full rows). A booking this browser has
                               not read singly asks for it (Love Kingdom lines only, 4 at a time, kept 60 s); the By-trip chip
                               (bkOtherTrips) is drawn again when the answers land. Legacy's index answers meanwhile.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function on(){ return !!(O.enabled && O.enabled()); }
  function typing(){ var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW7aL) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] w7a lists · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW7aL = true; w.__orig = orig; window[name] = w;
  }

  /* ── add-on-only line ── */
  wrap('bkB2CAddonOnly', function(orig, a){
    var b = a[0];
    return (b && typeof b.srvAddonOnly === 'boolean') ? b.srvAddonOnly : undefined;
  });

  /* ── the other lines of a Love Kingdom order ── */
  var TTL_MS = 60000, MAX_PAR = 4;
  var state = Object.create(null);        // opsId -> { at, busy, failedAt }
  var queue = [], running = 0, redrawTimer = null;
  function redraw(){
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(function(){
      try{
        if(typing() || (O.busy && O.busy())) return;
        var f = window.bookingV2RenderKeep || window.bookingV2Render;
        if(typeof f === 'function') f();
      }catch(_){}
    }, 250);
  }
  function pump(){
    while(running < MAX_PAR && queue.length){
      (function(bk){
        var id = bk.opsId, s = state[id] = state[id] || {};
        running++;
        O.get('/v1/bookings/' + encodeURIComponent(id)).then(function(ob){
          var lines = (ob && Array.isArray(ob.order_lines)) ? ob.order_lines : [];
          var map = window.laOpsFromServer;
          if(typeof map === 'function') bk.srvOrderLines = lines.map(function(x){ return map(x); });
          s.at = Date.now(); s.busy = false; running--; pump();
          if(lines.length) redraw();
        }, function(){ s.failedAt = Date.now(); s.busy = false; running--; pump(); });
      })(queue.shift());
    }
  }
  function ask(bk){
    var id = bk.opsId, s = state[id] = state[id] || {};
    if(s.busy) return;
    if(s.failedAt && Date.now() - s.failedAt < 15000) return;
    if(s.at && Date.now() - s.at < TTL_MS) return;
    s.busy = true; queue.push(bk); pump();
  }
  O.onWrite(function(kind){ if(String(kind || '') === 'booking') Object.keys(state).forEach(function(k){ if(state[k].at) state[k].at = 1; }); });
  wrap('_bkOrderLines', function(orig, a){
    var bk = a[0];
    if(!bk) return undefined;
    if(Array.isArray(bk.srvOrderLines) && !(bk.opsId && state[bk.opsId] && state[bk.opsId].at === 1)) return bk.srvOrderLines;
    /* not read yet (or old): ask once for a Love Kingdom line; legacy's index answers meanwhile */
    if(bk.opsId && /^b2c_/.test(String(bk.id || ''))) ask(bk);
    return Array.isArray(bk.srvOrderLines) ? bk.srvOrderLines : undefined;
  });

  /* the drop-off reading (bookingV2RetInfo) is wrapped by 96-ops-w7b-drop.js */

  window.laOpsW7aLists = { _state: state };
})();
