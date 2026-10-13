/* ══════════════════════════════════════════════════════════════════════════
   §opsCommissions · commission payouts ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The commission owed to sellers of on-tour sales and upgrades. The server lists the items with
   what each seller is owed and which payout paid it; the browser only shows them and sends
   "pay these items". No amount is added up in the browser, nothing is kept in the blob.

   GET  /v1/commissions?from=&to=[&seller=][&paid=true|false]    items + totals per seller
   GET  /v1/commission-payouts?from=&to=[&seller=]
   POST /v1/commission-payouts {seller,items:[{kind,booking_id,id}],method,paid_on,ref,note}
                                409 not_collected | already_paid
   POST /v1/commission-payouts/:id/void {reason}

   Screen: nav item "Commission payouts" (view `commissions`) -> renderCommissions().
   Load order: after 30-ops-money.js, before 90-ops-boot.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var S = { from: '', to: '', seller: '', paid: '', data: null, payouts: [], picked: {}, loading: false, error: '' };

  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function n(v){ var x = Number(v); return Number.isFinite(x) ? x : 0; }
  function text(v){ return v == null ? '' : String(v); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function baht(v){ return '฿' + n(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function host(){ return document.getElementById('commissions-host'); }
  function ik(i){ return i.kind + '|' + i.booking_id + '|' + i.id; }

  function initRange(){
    if(S.from && S.to) return;
    var t = O.today(); S.from = t.slice(0, 8) + '01'; S.to = t;
  }
  function range(){ return { from: S.from, to: S.to }; }

  function load(){
    initRange();
    S.loading = true; S.error = '';
    var q = Object.assign(range(), S.seller ? { seller: S.seller } : {}, S.paid ? { paid: S.paid } : {});
    var pq = Object.assign(range(), S.seller ? { seller: S.seller } : {});
    return Promise.all([O.get('/v1/commissions', q), O.get('/v1/commission-payouts', pq)]).then(function(r){
      S.data = r[0] || { items: [], totals: [] }; S.payouts = (r[1] && r[1].payouts) || [];
      S.loading = false;
      // keep only picks that are still payable
      var ok = {}; (S.data.items || []).forEach(function(i){ if(canPay(i)) ok[ik(i)] = 1; });
      Object.keys(S.picked).forEach(function(k){ if(!ok[k]) delete S.picked[k]; });
      paint();
    }, function(e){ S.loading = false; S.error = (e && e.message) || 'Commissions could not load'; paint(); });
  }
  function canPay(i){ return !!i.collected && !i.payout_id; }

  function paint(){
    var h = host(); if(!h) return;
    var items = (S.data && S.data.items) || [];
    var head = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">'
      + '<label style="font-size:11px">From<br><input type="date" value="' + esc(S.from) + '" onchange="laOpsCommissions.set(\'from\',this.value)"></label>'
      + '<label style="font-size:11px">To<br><input type="date" value="' + esc(S.to) + '" onchange="laOpsCommissions.set(\'to\',this.value)"></label>'
      + '<label style="font-size:11px">Seller<br><input type="text" value="' + esc(S.seller) + '" placeholder="all" onchange="laOpsCommissions.set(\'seller\',this.value)"></label>'
      + '<label style="font-size:11px">Status<br><select onchange="laOpsCommissions.set(\'paid\',this.value)">'
      + [['', 'All'], ['false', 'Unpaid'], ['true', 'Paid']].map(function(o){ return '<option value="' + o[0] + '"' + (S.paid === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
      + '</select></label><button onclick="laOpsCommissions.reload()">Reload</button></div>';
    var body;
    if(S.error) body = '<div style="padding:32px;text-align:center;color:#A32D2D">' + esc(S.error) + '</div>';
    else if(S.loading && !S.data) body = O.loadingHtml('Loading commissions…');
    else body = totalsHtml() + itemsHtml(items) + payBox() + payoutsHtml();
    h.innerHTML = '<div style="padding:18px 20px">' + head + body + '</div>';
  }
  function totalsHtml(){
    var t = (S.data && S.data.totals) || [];
    if(!t.length) return '';
    return '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' + t.map(function(x){
      return '<div style="flex:1;min-width:190px;background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:12px 14px">'
        + '<div style="font-size:11px;font-weight:600">' + esc(x.seller || '(no seller)') + '</div>'
        + '<div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums">' + baht(x.commission) + '</div>'
        + '<div style="font-size:11px;color:#6b7686">paid ' + baht(x.paid) + ' · <b style="color:#A05A1A">unpaid ' + baht(x.unpaid) + '</b></div></div>';
    }).join('') + '</div>';
  }
  function itemsHtml(items){
    var cell = 'padding:8px 10px;font-size:12px;';
    var rows = items.map(function(i){
      var k = esc(ik(i)), st = i.payout_id ? '<span style="color:#0F6E56">paid</span>' : (i.collected ? 'owed' : '<span style="color:#6b7686">not collected</span>');
      return '<tr style="border-top:1px solid #eceef3"><td style="' + cell + '">'
        + (canPay(i) ? '<input type="checkbox" data-k="' + k + '"' + (S.picked[ik(i)] ? ' checked' : '') + ' onchange="laOpsCommissions.pick(this.getAttribute(\'data-k\'),this.checked)">' : '')
        + '</td><td style="' + cell + '">' + esc(i.date || '') + '</td><td style="' + cell + '">' + esc(i.voucher_ref || i.booking_id) + '</td>'
        + '<td style="' + cell + '">' + esc(i.kind === 'upgrade' ? 'Upgrade' : 'Tour sale') + ' · ' + esc(i.label) + '</td><td style="' + cell + '">' + esc(i.seller || '') + '</td>'
        + '<td style="' + cell + 'text-align:right">' + baht(i.total) + '</td><td style="' + cell + 'text-align:right">' + baht(i.to_company) + '</td>'
        + '<td style="' + cell + 'text-align:right"><b>' + baht(i.commission) + '</b></td><td style="' + cell + '">' + st + '</td></tr>';
    }).join('');
    return '<div style="background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:auto"><table style="width:100%;border-collapse:collapse">'
      + '<thead><tr style="background:#fafaf8;font-size:10px;text-transform:uppercase;color:#6b7686">'
      + ['', 'Date', 'Voucher', 'Item', 'Seller', 'Sold', 'To company', 'Commission', 'State'].map(function(h){ return '<th style="' + cell + 'text-align:left">' + h + '</th>'; }).join('')
      + '</tr></thead><tbody>' + (rows || '<tr><td colspan="9" style="padding:24px;text-align:center;color:#6b7686">No commissions in this range</td></tr>') + '</tbody></table></div>';
  }
  function pickedItems(){
    return ((S.data && S.data.items) || []).filter(function(i){ return S.picked[ik(i)] && canPay(i); });
  }
  function payBox(){
    var sel = pickedItems(); if(!sel.length) return '';
    var sellers = {}; sel.forEach(function(i){ sellers[i.seller || ''] = 1; });
    var one = Object.keys(sellers).length === 1;
    return '<div style="margin-top:14px;background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:14px 16px">'
      + '<div style="font-size:12px;font-weight:600;margin-bottom:8px">Pay out ' + sel.length + ' item(s)</div>'
      + (one ? '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'
        + '<label style="font-size:11px">Method<br><select id="cmp-method"><option value="cash">Cash</option><option value="transfer">Transfer</option></select></label>'
        + '<label style="font-size:11px">Paid on<br><input id="cmp-date" type="date" value="' + esc(O.today()) + '"></label>'
        + '<label style="font-size:11px">Reference<br><input id="cmp-ref" type="text"></label>'
        + '<label style="font-size:11px">Note<br><input id="cmp-note" type="text"></label>'
        + '<button onclick="laOpsCommissions.payOut()">Record payout</button></div>'
        : '<div style="color:#A32D2D;font-size:12px">Pick items of one seller at a time.</div>') + '</div>';
  }
  function payoutsHtml(){
    if(!S.payouts.length) return '';
    var cell = 'padding:8px 10px;font-size:12px;';
    return '<div style="margin-top:18px;font-size:12px;font-weight:600">Payouts</div>'
      + '<div style="background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse"><tbody>'
      + S.payouts.map(function(p){
        var v = !!p.voided_at;
        return '<tr style="border-top:1px solid #eceef3' + (v ? ';opacity:.55' : '') + '"><td style="' + cell + '">' + esc(p.paid_on) + '</td><td style="' + cell + '">' + esc(p.seller) + '</td>'
          + '<td style="' + cell + 'text-align:right"><b>' + baht(p.amount) + '</b></td><td style="' + cell + '">' + esc(p.method) + (p.ref ? ' · ' + esc(p.ref) : '') + '</td>'
          + '<td style="' + cell + '">' + (p.items || []).length + ' item(s)</td><td style="' + cell + '">' + esc(p.note || '') + '</td>'
          + '<td style="' + cell + '">' + (v ? 'void' + (p.void_reason ? ': ' + esc(p.void_reason) : '') : '<button data-id="' + esc(p.id) + '" onclick="laOpsCommissions.voidPayout(this.getAttribute(\'data-id\'))">Void</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ── actions ── */
  function payOut(){
    var sel = pickedItems(); if(!sel.length) return;
    var g = function(id){ var e = document.getElementById(id); return e && e.value != null ? String(e.value) : ''; };
    var body = { seller: sel[0].seller || '', method: g('cmp-method') || 'cash', paid_on: g('cmp-date') || O.today(),
      ref: g('cmp-ref').trim() || null, note: g('cmp-note').trim() || null,
      items: sel.map(function(i){ return { kind: i.kind, booking_id: i.booking_id, id: i.id }; }) };
    return O.queue(function(){ return O.post('/v1/commission-payouts', body); }).then(function(){
      S.picked = {};
      O.toast({ kind: 'success', title: 'Commission payout recorded', status: 'OK', sub: body.seller, dur: 4000 });
      return load();
    }, function(e){ O.fail('Payout was not recorded', e); return load(); });
  }
  function voidPayout(id){
    var reason = prompt('Reason for voiding this payout (optional)', ''); if(reason == null) return;
    return O.queue(function(){ return O.post('/v1/commission-payouts/' + enc(id) + '/void', { reason: reason.trim() || null }); })
      .then(load, function(e){ O.fail('Payout was not voided', e); });
  }
  function set(field, val){ S[field] = val; if(field === 'from' || field === 'to') S.picked = {}; return load(); }
  function pick(k, on){ if(on) S.picked[k] = 1; else delete S.picked[k]; paint(); }

  /* the screen has no legacy function to wrap: it is new, and the nav calls this */
  window.renderCommissions = function(){
    if(!O.enabled()){
      var h = host(); if(h) h.innerHTML = '<div style="padding:40px;text-align:center;color:#6b7686">Commission payouts need operation-backend</div>';
      return;
    }
    S.data = S.data || null; paint(); return load();
  };
  O.onChange(function(){ if(O.activeView() === 'commissions' && !O.busy()) load(); });

  window.laOpsCommissions = { set: set, pick: pick, payOut: payOut, voidPayout: voidPayout, reload: load, state: S };
})();
