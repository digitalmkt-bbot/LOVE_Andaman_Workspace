/* ══════════════════════════════════════════════════════════════════════════
   §opsCostingEff (w6-a, 2026-10-18) · ctEffLine (a cost line with the plan's override laid over it) ⇄ sheet.line_parts[].parts[].effective
   ──────────────────────────────────────────────────────────────────────────
   ctEffLine (08-app.js) copies the template line's parts and lays plan.ovr[line][part] over them. The Adjust tab's boxes, the formula text of a line
   (ctLineFx) and the ordered-extras rows (unit cost) read its result. The server's calc answer carries it for every line:
   sheet.line_parts[] {id, label, vat, line_off, parts[{...part, amount, effective, overridden[]}]}, where `effective` is the part with the plan's
   override laid over it (server field names; mapped back to legacy's with partFromServer from ops/44). With the cached answer for this plan under
   this template the line is rebuilt from it; without one (offline, an edited plan not asked yet, a line the answer does not know) legacy's own merge
   runs as before. Nothing is sent. Classic script, after 44-ops-costing-pl.js and 75-ops-costing-sheet.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window.ctEffLine;
  if(typeof orig !== 'function' || orig.__w6a) return;
  var w = function(line, pl){
    var L = orig.apply(this, arguments);
    try{
      var P = O.costingPL, C = window.__laOpsCostingCompat;
      if(!O.enabled() || !P || !C || !pl || typeof pl !== 'object' || !line) return L;
      var a = P.answer(pl), lp = a && a.sheet && a.sheet.line_parts && a.sheet.line_parts.filter(function(x){ return x.id === line.id; })[0];
      if(!lp || !Array.isArray(lp.parts) || lp.parts.length !== L.parts.length) return L;
      L.off = !!lp.line_off;
      L.parts = lp.parts.map(function(p){ return C.partFromServer(p.effective); });
    }catch(_){}
    return L;
  };
  w.__w6a = true; w.__orig = orig; window.ctEffLine = w;
})();
