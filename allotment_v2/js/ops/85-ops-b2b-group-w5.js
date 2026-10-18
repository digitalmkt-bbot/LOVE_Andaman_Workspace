/* ══════════════════════════════════════════════════════════════════════════
   §opsB2bGroupW5 (w5-f, 2026-10-18) · B2B Sales Dashboard: a route group made of several server families
   ──────────────────────────────────────────────────────────────────────────
   73-ops-b2b-dash.js answers a route group that is exactly ONE server family from GET /v1/reports/b2b by_trip[]. Phi Phi and Other
   are 2 or more families (decision Q13, ops/67): their period figures (b2dSum: revenue, pax, bookings and the compared period) are the
   sum of the server's family figures of the same answer, instead of the browser's sum over every trip line.
   Still the browser's (MISSING-SERVER-FIELD, docs/walk/w5-f.md): b2dAgents / b2dBridge / b2dShiftSignal of such a group and the
   agent / sales / market detail pages, which need each agent's class on the group and per-agent detail the report does not serve.
   Legacy mode and everything else: 73's answer. Classic script · after 73-ops-b2b-dash.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.b2bDash) return;
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  var orig = window.b2dSum;
  if(typeof orig !== 'function' || orig.__w5f) return;
  var w = function(L, from, to, filter){
    var args = [].slice.call(arguments);
    if(!(O.enabled && O.enabled()) || !filter) return orig.apply(this, args);
    var win = typeof window.b2dWin === 'function' ? window.b2dWin(L) : null, j = win && O.b2bDash.report(win);
    if(!j) return orig.apply(this, args);
    var isCur = from === win.cs && to === win.ce, isPrev = from === win.ps && to === win.pe;
    if(!isCur && !isPrev) return orig.apply(this, args);
    var g = O.b2bDash.groupOfFilter(filter); if(!g) return orig.apply(this, args);
    var fams = O.b2bDash.familiesOf(j, g);
    if(fams.length < 2) return orig.apply(this, args);                    // none or one family: 73's answer
    var s = { rev: 0, pax: 0, bookings: 0 };
    fams.forEach(function(f){
      if(isCur){ s.rev += n(f.revenue); s.pax += n(f.pax); s.bookings += n(f.bookings); }
      else s.rev += n(f.previous);
    });
    return s;
  };
  w.__w5f = true; w.__orig = orig; window.b2dSum = w;
})();
