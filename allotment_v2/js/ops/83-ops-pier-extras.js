/* ═════════════════════════════════════════════════════════════════
   §opsPierExtras (w5-d, 2026-10-18) · "is this on-tour sale collected / covered by the pier's cash" from the server

   Legacy bkxExCovered(x) works out, in the browser, whether a cash-on-tour sale that is still to collect has already been paid
   through the day's pier payments (the day's live pier payments >= everything owed that day: cash on tour + uncollected
   upgrades + balance + every uncollected sale), and bkxExGot(x) says "collected" from it. The server decides
   (README "Pier money"): every tour-sale row carries covered_by_pier, and `settle: done` when it is covered; collecting a covered
   sale is 409 covered_by_pier. 36-ops-day-actions.js keeps it on the mapped sale (x.coveredByPier); these two answer from it.

   A sale that did not come from the server (a draft not saved yet, offline) keeps legacy's rule.
   After a pier payment the sales already read are read again, since a payment can cover a sale (or a deleted payment uncover it).

   Load order: after 36-ops-day-actions.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsPierExtras) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r = fn.call(this, orig, arguments);
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsPierExtras = true; window[name] = w;
  }
  function fromServer(x){ return !!(x && x._fromOpsBackend && typeof x.coveredByPier === 'boolean'); }

  wrap('bkxExCovered', function(orig, a){
    var x = a[0]; if(!fromServer(x)) return undefined;
    return x.coveredByPier;
  });
  wrap('bkxExGot', function(orig, a){
    var x = a[0]; if(!fromServer(x)) return undefined;
    return !(x.method === 'cot' && x.settle !== 'done') || x.coveredByPier;
  });

  /* a pier payment can cover (or uncover) a sale: read the sales that are held again */
  var timer = null;
  O.onWrite(function(kind){
    if(!/^pier/i.test(String(kind || ''))) return;
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){
      timer = null;
      var D = O.dayActions; if(!enabled() || !D || typeof D.loadedSales !== 'function' || typeof D.loadTourSales !== 'function') return;
      D.loadedSales().forEach(function(cid){ try{ D.loadTourSales(cid); }catch(_){} });
    }, 400);
  });
})();
