/* ══════════════════════════════════════════════════════════════════════════
   §opsCashLongtailW5 (w5-f, 2026-10-18) · petty cash, long-tail sheet: the booked side is the server's
   ──────────────────────────────────────────────────────────────────────────
   The sheet (pc2LTDay: one day, pc2LT: the month and its KPI cards) puts, beside what the pier keyed, what the bookings need:
   pxLongtail(date, boat) = { join (heads), chtr (boats), upg, upgDue }. Legacy walked every booking of the day. The server serves it as
   GET /v1/pier-office/{pier}/days/{date}/boats  boats[].booked { join_heads, charter_boats, upgrades, upgrades_due }  (read by
   47-ops-pier-job.js, kept per pier and day). While pc2LTDay / pc2LT draw, pxLongtail answers from it; a day that has not been read
   yet (or a boat the server did not list) shows legacy's own answer, and the sheet is drawn again when the day arrives.
   The keyed side (pcLtUsed over the sheet's cell: join_boats, charter_boats, used_boats) is already the server's.
   Legacy mode and every other caller of pxLongtail (P&L, print): the original. Classic script · after 46-ops-pier-cash.js, 47.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pier || !O.pier.dayBoats) return;
  function on(){ return !!(O.enabled && O.enabled() && O.pier.loaded); }
  var ctx = null, timer = null;
  function redraw(){
    if(timer) return;
    timer = setTimeout(function(){
      timer = null;
      try{ if(!O.busy() && typeof window.renderPierCash === 'function') window.renderPierCash(window._pcPier); }catch(_){}
    }, 80);
  }
  var px0 = window.pxLongtail;
  if(typeof px0 === 'function' && !px0.__w5f){
    var px = function(date, bid){
      if(!ctx || !on()) return px0.apply(this, arguments);
      var DB = O.pier.dayBoats, b;
      // one answer per pier and day; the sheet is drawn again when it lands. A day only counted in the month's cards is asked for once
      // (a write does not ask for all of them again); the days drawn on screen are asked for again after a write.
      if(!DB.entry(ctx.pier, date) || date === window._pcDate || window._pc2All) DB.want(ctx.pier, date, redraw);
      b = DB.boat(ctx.pier, date, bid);
      var bk = b && b.booked;
      if(!bk || bk.join_heads == null) return px0.apply(this, arguments);
      return { chtr: +bk.charter_boats || 0, join: +bk.join_heads || 0, upg: +bk.upgrades || 0, upgDue: +bk.upgrades_due || 0 };
    };
    px.__w5f = true; px.__orig = px0; window.pxLongtail = px;
  }
  ['pc2LTDay', 'pc2LT'].forEach(function(name){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w5f) return;
    var w = function(pier){
      // the pier office lists are read by the pier screens; petty cash can be the first screen opened: read them now (the sheet is drawn again)
      if(O.enabled() && !O.pier.loaded && typeof O.pier.ensure === 'function') O.pier.ensure('renderPierCash');
      var prev = ctx; ctx = { pier: pier };
      try{ return orig.apply(this, arguments); } finally { ctx = prev; }
    };
    w.__w5f = true; w.__orig = orig; window[name] = w;
  });
})();
