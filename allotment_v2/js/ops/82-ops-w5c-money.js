/* ═════════════════════════════════════════════════════════════════════════
   §opsW5cMoney (2026-10-18, wave 5 group c) · Daily PFM prepay amount from the server
   ─────────────────────────────────────────────────────────────────────────
   Backend guide: operation-backend README "Invoices": GET /v1/invoices/candidates?agent_id=&kind=prepay&q= answers, per booking, the
   `invoice_total` the invoice would carry (7% on top for an agent whose vat_mode is `exclude`; computed, nothing in it can be sent).

     pfmPrepayStart(bkId)    legacy opens the "Record payment" dialog with its own sum (booking total + 7% VAT); the server's
                             invoice_total for that booking replaces the amount when it arrives, if nobody has typed another
                             figure by then, and the dialog is drawn again
     pfmPrepayTotal(bk)      the server's invoice_total once it has been asked for that booking (the dialog's balance line),
                             else legacy's sum

   Not here (docs/walk/w5-c.md): pfmPrepayCands (the picker lists every credit agent's bookings; the candidates read needs one
   agent_id: MISSING-SERVER-FIELD), _pfmEditTotals (no dry run on payment-corrections), pfmChartBuckets (the numbers are already the
   server's, 31-ops-pfm.js; the 8 date windows are screen layout).
   Classic script, after 31-ops-pfm.js. Legacy mode: delegates.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  var tot = {};            // client booking id -> { at, total } the server's invoice_total
  var asking = {};

  var origTotal = window.pfmPrepayTotal;
  if(typeof origTotal === 'function' && !origTotal.__opsW5c){
    var wt = function(bk){
      if(enabled() && bk && bk.id && tot[bk.id] && Date.now() - tot[bk.id].at < 120000) return tot[bk.id].total;
      return origTotal.apply(this, arguments);
    };
    wt.__opsW5c = true; wt.__orig = origTotal; window.pfmPrepayTotal = wt;
  }

  var origStart = window.pfmPrepayStart;
  if(typeof origStart === 'function' && !origStart.__opsW5c){
    var ws = function(bkId){
      var r = origStart.apply(this, arguments);
      if(!enabled()) return r;
      var b = (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).filter(function(x){ return x && x.id === bkId; })[0];
      if(!b || !b.opsId || !b.agentId || asking[bkId]) return r;
      var legacyAmt = null;
      try{ legacyAmt = (typeof _pfmRec !== 'undefined' && _pfmRec && _pfmRec.bkId === bkId) ? _pfmRec.amount : null; }catch(_){}
      asking[bkId] = true;
      O.get('/v1/invoices/candidates', { agent_id: b.agentId, kind: 'prepay', q: b.opsId }).then(function(j){
        delete asking[bkId];
        var c = ((j && j.candidates) || []).filter(function(x){ return x && x.booking_id === b.opsId; })[0];
        if(!c || c.invoice_total == null) return;
        tot[bkId] = { at: Date.now(), total: +c.invoice_total };
        try{
          if(typeof _pfmRec !== 'undefined' && _pfmRec && _pfmRec.bkId === bkId && _pfmRec.prepay){
            var srvAmt = Math.round(+c.invoice_total);
            // nobody has changed the figure the dialog opened with: the server's replaces it
            if(_pfmRec.amount === legacyAmt && _pfmRec.amount !== srvAmt){
              _pfmRec.amount = srvAmt;
              if(typeof window.renderDailyPFM === 'function') window.renderDailyPFM();
            }
          }
        }catch(_){}
      }, function(e){ delete asking[bkId]; try{ console.warn('[ops] prepay amount: the server did not answer, the legacy sum stays · ' + (e && e.message)); }catch(_){} });
      return r;
    };
    ws.__opsW5c = true; ws.__orig = origStart; window.pfmPrepayStart = ws;
  }
  O.w5cMoney = { prepayTotals: tot };
})();
