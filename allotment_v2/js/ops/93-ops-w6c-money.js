/* ═════════════════════════════════════════════════════════════════════════
   §opsW6cMoney (2026-10-18, wave 6 group c) · Daily PFM: the prepay picker and the payment-correction totals, the server's answer
   ─────────────────────────────────────────────────────────────────────────
   Backend guides: operation-backend README "Invoices" ("Who can be invoiced": GET /v1/invoices/candidates?kind=prepay with no
   agent_id; payment-corrections with dry_run). todo/w5-c-model.md asks 5 and 6. docs/walk/w6-c.md has the per-function table.
   Classic script, after 30-ops-money.js / 82-ops-w5c-money.js, before 90-ops-boot.js. Legacy mode, and until an answer is here,
   every wrapper delegates.

     pfmPrepayCands(q)    the picker's list: every invoice agent's bookings still without an invoice, nearest travel first, the
                          search box's text sent as `q`, the page cut and the count left by the server (the list is padded to `count` so
                          the "+N ใบ" line is the server's number)
     pfmPrepayStart(id)   a booking that is on the list but not loaded in the browser is read from the server first
     _pfmEditTotals()     the edit dialog's "ยอดใบ · รับแล้ว · ค้าง/รับเกิน" line: POST /v1/invoices/{id}/payment-corrections with
                          dry_run: true -> the invoice as it WOULD read; nothing is stored. Only the user's edited rows are sent.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW6c) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var r = fn.apply(this, [orig, this].concat([].slice.call(arguments)));
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW6c = true; w.__orig = orig; window[name] = w;
  }
  function clientBookingId(id){
    var list = (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [];
    var b = list.find(function(x){ return x && x.opsId === id; });
    return b ? b.id : id;
  }

  /* ── the prepay picker ── */
  function relist(){
    try{
      if(typeof _pfmPre === 'undefined' || !_pfmPre) return;
      var el = document.getElementById('pfm-pre-list');
      if(el && typeof window.pfmPrepayListHTML === 'function') el.innerHTML = window.pfmPrepayListHTML();
    }catch(_){}
  }
  wrap('pfmPrepayCands', function(orig, self, q){
    q = String(q == null ? '' : q).trim();
    var params = { kind: 'prepay' }; if(q) params.q = q;
    var j = O.srv.read('w6c-prepay:' + q, '/v1/invoices/candidates', params, relist);
    if(!j || !Array.isArray(j.candidates)) return undefined;
    var out = j.candidates.map(function(c){
      var rt = (typeof getRoute === 'function') ? getRoute(c.route_id) : null;
      return {
        b: { id: clientBookingId(c.booking_id), opsId: c.booking_id, voucherRef: c.voucher_ref || '', code: c.code || '', leadPax: c.lead_pax || '', customerName: '' },
        a: { id: c.agent_id, name: c.agent_name || c.agent_id || '' },
        d0: c.service_date || '', tot: +c.invoice_total || 0, route: (rt && rt.name) || c.route_id || ''
      };
    });
    // the page is cut by the server: the rest is only counted ("+N" line); these placeholders are never drawn (the screen shows 40)
    for(var i = out.length; i < (+j.count || 0); i++) out.push({ b: { id: '' }, a: { name: '' }, d0: '', tot: 0, route: '' });
    return out;
  });
  wrap('pfmPrepayStart', function(orig, self, bkId){
    var list = (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [];
    if(!bkId || list.some(function(x){ return x && x.id === bkId; })) return undefined;
    var B = O.bookings; if(!B || typeof B.upsert !== 'function') return undefined;
    O.get('/v1/bookings/' + enc(bkId)).then(function(ob){
      B.upsert(ob);
      window.pfmPrepayStart(ob.external_id || ob.id);
    }, function(e){ O.fail('Could not open the booking', e); });
    return null;
  });

  /* ── the edit dialog's totals: the invoice as it would read ── */
  var DRY = {};          // signature -> { res } | { failed } | { timer }
  function sumAgain(){ try{ if(typeof window.pfmEditRefreshSum === 'function') window.pfmEditRefreshSum(); }catch(_){} }
  function ask(sig, invId, body){
    var e = DRY[sig] = { timer: setTimeout(function(){
      O.post('/v1/invoices/' + enc(invId) + '/payment-corrections', body).then(function(res){
        e.res = res; delete e.timer; sumAgain();
      }, function(){ e.failed = true; delete e.timer; });
    }, 120) };
  }
  O.onWrite(function(){ Object.keys(DRY).forEach(function(k){ if(DRY[k].timer) clearTimeout(DRY[k].timer); delete DRY[k]; }); });
  wrap('_pfmEditTotals', function(){
    var e = (typeof _pfmEdit !== 'undefined') ? _pfmEdit : null;
    var C = window.__laOpsMoneyCompat;
    if(!e || !e.invId || !C || typeof C.toCorrectionsBody !== 'function') return undefined;
    var body = C.toCorrectionsBody(e.rows, '', false);
    if(!body.payments.length) return undefined;                  // nothing edited: the invoice as it stands
    body.dry_run = true;
    var sig = e.invId + '|' + JSON.stringify(body.payments);
    var hit = DRY[sig];
    if(!hit){ ask(sig, e.invId, body); return undefined; }
    if(!hit.res) return undefined;                                // asked, not here yet (or refused): legacy's sum until it lands
    var r = hit.res;
    return { total: +r.total || 0, paid: +r.paid || 0, bal: (+r.overpaid > 0) ? -(+r.overpaid) : (+r.balance || 0) };
  });
})();
