/* ═════════════════════════════════════════════════════════════════════════
   §opsW6cPier (2026-10-18, wave 6 group c) · the park sheet's paid - due difference, the server's answer
   ─────────────────────────────────────────────────────────────────────────
   Backend guide: operation-backend README "Pier office: petty cash" (park sheet `check { due, paid, diff, diff_paid }` on a day and
   on the sheet). todo/w5-c-model.md ask 11. docs/walk/w6-c.md has the per-function table. Classic script, after 46-ops-pier-cash.js /
   82-ops-w5c-pier.js, before 90-ops-boot.js. Legacy mode, and while the sheet is not loaded, legacy's subtraction answers.

     pcPkDiffPaid(pier, ds, legacy)   check.diff_paid of the park sheet's day `ds`, or of the month's sheet when ds is null:
                                      paid - due over only the boats that have both (null = no such boat). Used by the day line
                                      and the KPI of the park sheet (pc2PKDay, pc2PK) and by the print layout (pcDiffCellPaid).
   Not here: the difference of a route group inside a day (the server sends the day's and the sheet's, not a group's).
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  var orig = window.pcPkDiffPaid;
  if(typeof orig !== 'function' || orig.__opsW6c) return;
  var w = function(pier, ds, legacy){
    if(!on() || !pier) return orig.apply(this, arguments);
    var c = O.pierCash && O.pierCash.cache; if(!c || !c.sheet) return orig.apply(this, arguments);
    var ym = ds ? String(ds).slice(0, 7) : (typeof _pcYM !== 'undefined' ? _pcYM : '');
    var ks = Object.keys(c.sheet);
    for(var i = 0; i < ks.length; i++){
      var j = c.sheet[ks[i]];
      if(ks[i].indexOf('park|' + pier + '|') !== 0 || !j || j === true || j.month !== ym) continue;
      var chk = null;
      if(ds){
        var d = (j.days || []).filter(function(x){ return x.date === ds; })[0];
        chk = d && d.check;
      } else if(!j.date){ chk = j.check; }
      if(chk && chk.diff_paid !== undefined) return chk.diff_paid === null ? null : Math.round(+chk.diff_paid);
    }
    return orig.apply(this, arguments);
  };
  w.__opsW6c = true; w.__orig = orig; window.pcPkDiffPaid = w;
})();
