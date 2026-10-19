/* ══════════════════════════════════════════════════════════════════════════
   §w7b (2026-10-19) · Separate drop-off and "customer goes back on their own" ⇄ booking row drop {separate, name, self_return}
   ──────────────────────────────────────────────────────────────────────────
   bookingV2RetInfo(b, date) decided in the browser whether a booking has a separate drop-off (dropoffSame === false and a place), its
   name, and selfRet (the place is a NoTransfer area or a "self-arrive" name). The server reads all three on every booking row
   (drop.separate, drop.name, drop.self_return; ops/40 keeps them as bk.srvDrop). This wraps bookingV2RetInfo so every reader of
   .sep / .drop / .selfRet (return van sheet, guide sheet, return-point chip, "not arranged" alert, 08-app.js sites) gets the server's
   answer when the booking is a server row. A booking without srvDrop (new, offline) keeps legacy's reading. The return van that is
   arranged (arranged, retId, sameVan) stays the booking's ops; .alert is recomputed only where the server's reading differs from the browser's.
   Classic script, after 82-ops-w5c-vans.js and 40-ops-bookings.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window.bookingV2RetInfo;
  if(typeof orig !== 'function' || orig.__w7b) return;
  var w = function(bk){
    var ri = orig.apply(this, arguments);
    var d = bk && bk.srvDrop;
    if(!d || !ri || !O.enabled()) return ri;
    if(d.separate === ri.sep && d.selfReturn === ri.selfRet && (d.separate ? (d.name || '') === (ri.drop || '') : true)) return ri;
    var out = Object.assign({}, ri, { sep: d.separate, drop: d.separate ? d.name : '', selfRet: d.selfReturn });
    out.alert = d.separate && !ri.arranged && !d.selfReturn && !ri.sameVan;
    return out;
  };
  w.__w7b = true; w.__orig = orig; window.bookingV2RetInfo = w;
})();
