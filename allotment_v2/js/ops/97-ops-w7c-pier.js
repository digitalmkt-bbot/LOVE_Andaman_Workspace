/* ═════════════════════════════════════════════════════════════════════════
   §w7c (2026-10-19, wave 7 group c) · park sheet: a route group's own difference, and the printed day's totals, from the server
   ─────────────────────────────────────────────────────────────────────────
   Backend: GET /v1/pier-cash/{pier}/months/{yyyy-mm}/park  (README "The park sheet's check", "Server fields added 2026-10-19"):
     days[].route_groups[] { route_id, route_name, boats, heads, check { due, paid, diff, diff_paid } }
     days[].totals { ad_th..foc_fr, heads, amount, dock }      days[].check { due, paid, diff, diff_paid }
   Read from the sheet the pier-cash adapter (46-ops-pier-cash.js) already holds in O.pierCash.cache.sheet; nothing is asked here, and legacy's
   own figure answers while the sheet is not loaded (or in legacy mode). Classic script, after 93-ops-w6c-pier.js, before 90-ops-boot.js.

     pcPkGroupDiffPaid(pier, ds, rid, legacy)   a route group's check.diff_paid ("รวมเส้นทางนี้" in pc2PKDay). null = no boat with both figures.
     pcPkSheetTotals(pier, ds)                  the day's totals + check.due, for the petty-cash print (pcSheetPK, marked §w7c), or null.
   Still the browser's in the print: the "ตามใบจอง" (booked heads) day sum - the park sheet answer carries no booked-heads total.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function dayOf(pier, ds){
    var c = O.pierCash && O.pierCash.cache; if(!c || !c.sheet || !pier || !ds) return null;
    var ym = String(ds).slice(0, 7), ks = Object.keys(c.sheet);
    for(var i = 0; i < ks.length; i++){
      var j = c.sheet[ks[i]];
      if(ks[i].indexOf('park|' + pier + '|') !== 0 || !j || j === true || j.month !== ym) continue;
      var d = (j.days || []).filter(function(x){ return x.date === ds; })[0];
      if(d) return d;
    }
    return null;
  }
  window.pcPkGroupDiffPaid = function(pier, ds, rid, legacy){
    if(!on()) return legacy;
    var d = dayOf(pier, ds); if(!d || !Array.isArray(d.route_groups)) return legacy;
    var key = rid == null ? null : String(rid);
    var g = d.route_groups.filter(function(x){ return (x.route_id == null ? null : String(x.route_id)) === key; })[0];
    if(!g || !g.check || g.check.diff_paid === undefined) return legacy;
    return g.check.diff_paid === null ? null : Math.round(+g.check.diff_paid);
  };
  window.pcPkSheetTotals = function(pier, ds){
    if(!on()) return null;
    var d = dayOf(pier, ds); if(!d || !d.totals) return null;
    var t = {}; Object.keys(d.totals).forEach(function(k){ t[k] = +d.totals[k] || 0; });
    t.due = d.check && d.check.due != null ? +d.check.due : undefined;
    return t;
  };
})();
