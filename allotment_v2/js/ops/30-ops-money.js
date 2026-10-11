/* ══════════════════════════════════════════════════════════════════════════
   §opsMoney · invoices, payments, deposits, refunds/credits ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   operation-backend is authoritative in operations mode. The server computes
   VAT, totals, paid, balance, refunded, credited, overpaid, and booking
   payment/invoice state. No legacy blob writer (sbInvoicesPersist,
   sbPaymentsPersist, sbDepositsPersist, acctPersistBookings) is called in
   operations mode, and booking.invoiceId / booking.paymentStatus are never
   patched locally.

   GET    /v1/invoices
   GET    /v1/invoices/:id
   POST   /v1/invoices
   PATCH  /v1/invoices/:id
   PUT    /v1/invoices/:id/discounts
   POST   /v1/invoices/:id/void
   POST   /v1/invoices/:id/payments
   POST   /v1/invoices/:id/payment-corrections
   GET    /v1/payments
   GET    /v1/deposits
   GET    /v1/deposits/:id
   POST   /v1/deposits
   POST   /v1/deposits/:id/void
   GET    /v1/refunds
   POST   /v1/refunds/:id/payout
   DELETE /v1/refunds/:id/payout
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var state = {
    loaded: false,
    failed: false,
    loading: null,
    refunds: [],
    creditBalances: {}
  };
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function nullable(v){ var s = text(v); return s ? s : null; }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function clone(v){ return O.clone ? O.clone(v) : (v == null ? v : JSON.parse(JSON.stringify(v))); }

  function listInvoices(){ return typeof SB_INVOICES !== 'undefined' && Array.isArray(SB_INVOICES) ? SB_INVOICES : []; }
  function listPayments(){ return typeof SB_PAYMENTS !== 'undefined' && Array.isArray(SB_PAYMENTS) ? SB_PAYMENTS : []; }
  function listDeposits(){ return typeof SB_DEPOSITS !== 'undefined' && Array.isArray(SB_DEPOSITS) ? SB_DEPOSITS : []; }
  function listBookings(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }

  function toServerBookingId(id){
    var s = text(id);
    if(!s) return '';
    var bk = listBookings().find(function(b){ return b && (b.id === s || b.opsId === s); });
    return (bk && bk.opsId) ? bk.opsId : s;
  }
  function toClientBookingId(id){
    var s = text(id);
    if(!s) return '';
    var bk = listBookings().find(function(b){ return b && (b.opsId === s || b.id === s); });
    return (bk && bk.id) ? bk.id : s;
  }

  function fromServerPayment(p, agentId){
    p = p || {};
    var method = p.method || 'transfer';
    return {
      id: p.id,
      invoiceId: p.invoice_id,
      agentId: agentId || p.agent_id || null,
      amount: num(p.amount),
      method: method,
      paidOn: p.paid_on || (p.date ? String(p.date).slice(0, 10) : ''),
      date: p.paid_on || p.recorded_at || p.date || '',
      ref: p.ref || null,
      type: method === 'credit' ? 'deposit' : 'payment',
      slips: Array.isArray(p.slips) ? clone(p.slips) : [],
      deletedAt: p.deleted_at || null,
      deletedBy: p.deleted_by || null,
      deleteReason: p.delete_reason || null,
      recordedBy: p.recorded_by || null,
      recordedAt: p.recorded_at || null
    };
  }

  function fromServerRefundPayment(r, agentId){
    r = r || {};
    return {
      id: r.id,
      invoiceId: r.invoice_id,
      agentId: r.agent_id || agentId || null,
      bookingId: r.booking_id ? toClientBookingId(r.booking_id) : null,
      amount: num(r.amount),
      method: r.kind || 'refund',
      date: r.created_at || '',
      type: 'refund',
      kind: r.kind || 'refund',
      reason: r.reason || ''
    };
  }

  function fromServerInvoice(v){
    v = v || {};
    var lines = Array.isArray(v.lines) ? v.lines : [];
    var liveLines = lines.filter(function(l){ return l && !l.removed_at; });
    var discounts = {};
    var gross0 = 0;
    liveLines.forEach(function(l, idx){
      var seq = l.seq != null ? l.seq : idx;
      var code = l.booking_id ? toClientBookingId(l.booking_id) : ('#' + idx);
      var key = String(code) + '|' + idx;
      gross0 += num(l.amount);
      if(num(l.discount) > 0){
        discounts[key] = num(l.discount);
        discounts['seq:' + seq] = num(l.discount);
      }
    });
    var bookingIds = (Array.isArray(v.booking_ids) ? v.booking_ids : []).map(toClientBookingId);
    return {
      id: v.id,
      number: v.number || '',
      agentId: v.agent_id || null,
      kind: v.kind || 'booking',
      feeType: v.fee_type || null,
      bookingIds: bookingIds,
      serverBookingIds: Array.isArray(v.booking_ids) ? v.booking_ids.slice() : [],
      lines: clone(lines),
      lineItems: liveLines.map(function(l, idx){
        return {
          seq: l.seq != null ? l.seq : idx,
          bookingId: l.booking_id ? toClientBookingId(l.booking_id) : null,
          serverBookingId: l.booking_id || null,
          label: l.label || '',
          amount: num(l.amount),
          discount: l.discount != null ? num(l.discount) : null,
          cotDate: l.cot_date || null
        };
      }),
      discounts: discounts,
      gross0: gross0,
      subtotal: num(v.subtotal),
      netAmount: v.net_amount != null ? num(v.net_amount) : num(v.subtotal),
      vatMode: v.vat_mode || 'none',
      vatRate: v.vat_rate != null ? num(v.vat_rate) : 0,
      vatAmount: num(v.vat_amount),
      whtAmount: v.wht_amount != null ? num(v.wht_amount) : null,
      total: num(v.total),
      paymentAmount: v.payment_amount != null ? num(v.payment_amount) : (num(v.total) - num(v.wht_amount)),
      paid: num(v.paid),
      balance: num(v.balance),
      refunded: num(v.refunded),
      credited: num(v.credited),
      overpaid: num(v.overpaid),
      status: v.status || (v.voided ? 'void' : 'issued'),
      voided: !!v.voided,
      voidedAt: v.voided_at || null,
      voidedBy: v.voided_by || null,
      voidReason: v.void_reason || null,
      issuedAt: v.issued_at || '',
      dueAt: v.due_at || '',
      createdBy: v.created_by || null,
      note: v.note != null ? v.note : (v.kind === 'prepay' ? 'prepay' : null),
      ref: v.ref || null,
      dear: v.dear || null,
      acceptAt: v.accept_at || null,
      remark: v.remark || null,
      payments: (Array.isArray(v.payments) ? v.payments : []).map(function(p){ return fromServerPayment(p, v.agent_id); }),
      refunds: Array.isArray(v.refunds) ? clone(v.refunds) : [],
      _fromOpsBackend: true
    };
  }

  function fromServerDeposit(d){
    d = d || {};
    if(d.credit_balance && d.agent_id && typeof d.credit_balance.available === 'number'){
      state.creditBalances[d.agent_id] = clone(d.credit_balance);
    }
    return {
      id: d.id,
      agentId: d.agent_id,
      amount: num(d.amount),
      method: d.method || 'transfer',
      receivedOn: d.received_on || '',
      date: d.received_on || d.recorded_at || '',
      ref: d.ref || null,
      note: d.note || '',
      status: d.status || (d.voided_at ? 'void' : 'live'),
      voidedAt: d.voided_at || null,
      voidedBy: d.voided_by || null,
      voidReason: d.void_reason || null,
      slips: Array.isArray(d.slips) ? clone(d.slips) : [],
      _fromOpsBackend: true
    };
  }

  function fromServerRefund(r){
    r = r || {};
    return {
      id: r.id,
      kind: r.kind || 'refund',
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number || r.invoice_id || '',
      bookingId: r.booking_id ? toClientBookingId(r.booking_id) : null,
      serverBookingId: r.booking_id || null,
      agentId: r.agent_id || null,
      amount: num(r.amount),
      reason: r.reason || '',
      createdBy: r.created_by || null,
      createdAt: r.created_at || '',
      payout: r.payout ? clone(r.payout) : null
    };
  }

  function rebuildPaymentsFromInvoices(){
    var out = [];
    listInvoices().forEach(function(inv){
      if(!inv) return;
      (inv.payments || []).forEach(function(p){
        if(p && !p.deletedAt) out.push(p);
      });
      (inv.refunds || []).forEach(function(r){
        if(r) out.push(fromServerRefundPayment(r, inv.agentId));
      });
    });
    var target = listPayments();
    target.length = 0;
    Array.prototype.push.apply(target, out);
    return out;
  }

  function replaceInvoices(rows){
    var mapped = (rows || []).map(fromServerInvoice);
    var target = listInvoices();
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    rebuildPaymentsFromInvoices();
    return mapped;
  }

  function upsertInvoice(row){
    var mapped = fromServerInvoice(row);
    var target = listInvoices();
    var idx = target.findIndex(function(x){ return x && x.id === mapped.id; });
    if(idx < 0) target.unshift(mapped);
    else target[idx] = mapped;
    rebuildPaymentsFromInvoices();
    return mapped;
  }

  function replaceDeposits(rows){
    var mapped = (rows || []).map(fromServerDeposit).filter(function(d){ return !d.voidedAt && d.status !== 'void'; });
    var target = listDeposits();
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function upsertDeposit(row){
    var mapped = fromServerDeposit(row);
    var target = listDeposits();
    var idx = target.findIndex(function(x){ return x && x.id === mapped.id; });
    if(mapped.voidedAt || mapped.status === 'void'){
      if(idx >= 0) target.splice(idx, 1);
    } else if(idx < 0){
      target.unshift(mapped);
    } else {
      target[idx] = mapped;
    }
    return mapped;
  }

  function replaceRefunds(rows){
    state.refunds = (rows || []).map(fromServerRefund);
    return state.refunds;
  }

  function upsertRefund(row){
    var mapped = fromServerRefund(row);
    var idx = state.refunds.findIndex(function(x){ return x && x.id === mapped.id; });
    if(idx < 0) state.refunds.push(mapped);
    else state.refunds[idx] = mapped;
    return mapped;
  }

  function redrawAccounting(){
    try{
      if(O.moneyReports && typeof O.moneyReports.clear === 'function') O.moneyReports.clear();
    }catch(_){}
    try{
      if(typeof window.renderAccounting === 'function' && document.getElementById('acct-body')) window.renderAccounting();
    }catch(_){}
    try{
      if(typeof window.renderDailyPFM === 'function' && document.getElementById('dailypfm-host') && O.activeView && O.activeView() === 'dailypfm') window.renderDailyPFM();
    }catch(_){}
    try{
      if(typeof window.bookingV2Render === 'function' && O.activeView && O.activeView() === 'booking') window.bookingV2Render();
    }catch(_){}
  }

  function loadAll(force){
    if(!enabled()) return Promise.resolve(false);
    if(state.loaded && !force) return Promise.resolve(true);
    if(state.loading) return state.loading;
    state.loading = Promise.all([
      O.get('/v1/invoices'),
      O.get('/v1/deposits'),
      O.get('/v1/refunds')
    ]).then(function(res){
      replaceInvoices((res[0] && res[0].invoices) || []);
      replaceDeposits((res[1] && res[1].deposits) || []);
      replaceRefunds((res[2] && res[2].refunds) || []);
      state.loaded = true;
      state.failed = false;
      return true;
    }).catch(function(e){
      state.failed = true;
      O.fail('Could not load finance data from operation-backend', e);
      throw e;
    }).finally(function(){
      state.loading = null;
    });
    return state.loading;
  }

  function toCreateInvoiceBody(agentId, bookingIds, opt){
    opt = opt || {};
    var ids = (Array.isArray(bookingIds) ? bookingIds : []).map(toServerBookingId).filter(Boolean);
    var body = {
      agent_id: text(agentId),
      booking_ids: ids
    };
    if(opt.kind === 'prepay' || opt.prepay === true || opt.note === 'prepay') body.kind = 'prepay';
    else if(opt.kind === 'booking') body.kind = 'booking';
    ['note', 'ref', 'dear', 'accept_at', 'remark'].forEach(function(k){
      var v = opt[k] !== undefined ? opt[k] : (k === 'accept_at' ? opt.acceptAt : undefined);
      if(v !== undefined) body[k] = nullable(v);
    });
    return body;
  }

  function toHeaderPatchBody(field, val){
    var body = {};
    if(field === 'whtAmount' || field === 'wht_amount'){
      var n = parseFloat(String(val == null ? '' : val).replace(/[^0-9.]/g, ''));
      body.wht_amount = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
      return body;
    }
    var key = field === 'acceptAt' ? 'accept_at' : field;
    if(['note', 'ref', 'dear', 'accept_at', 'remark'].indexOf(key) < 0){
      throw new Error(field + ' cannot be patched directly on an invoice');
    }
    body[key] = nullable(val);
    return body;
  }

  function resolveDiscountSeq(inv, key){
    if(!inv) return null;
    var k = String(key == null ? '' : key);
    if(/^seq:\d+$/.test(k)) return parseInt(k.slice(4), 10);
    var parts = k.split('|');
    var idx = parts.length > 1 ? parseInt(parts[parts.length - 1], 10) : parseInt(k, 10);
    var live = (inv.lines || []).filter(function(l){ return l && !l.removed_at; });
    if(Number.isFinite(idx) && live[idx] && live[idx].seq != null) return live[idx].seq;
    if(Number.isFinite(idx)) return idx;
    return null;
  }

  function toDiscountsBody(inv, key, val){
    var seq = resolveDiscountSeq(inv, key);
    if(seq == null || !Number.isFinite(seq)) throw new Error('Invalid invoice line for discount');
    var d = parseFloat(String(val == null ? '' : val).replace(/[^0-9.]/g, ''));
    var discount = Number.isFinite(d) && d > 0 ? Math.round(d * 100) / 100 : null;
    return { lines: [{ seq: seq, discount: discount }] };
  }

  function normalizePaymentMethod(method){
    var m = text(method).toLowerCase() || 'transfer';
    if(m === 'deposit') return 'credit';
    return m;
  }

  function toPaymentBody(amount, method, opt){
    opt = opt || {};
    var body = {
      amount: Math.round(num(amount) * 100) / 100,
      method: normalizePaymentMethod(method)
    };
    if(opt.paid_on || opt.paidOn || opt.date) body.paid_on = String(opt.paid_on || opt.paidOn || opt.date).slice(0, 10);
    if(opt.ref !== undefined && nullable(opt.ref)) body.ref = nullable(opt.ref);
    var slips = opt.slip_ids || opt.slips;
    if(Array.isArray(slips) && slips.length){
      body.slip_ids = slips.map(function(s){ return typeof s === 'string' ? s : (s && s.id); }).filter(Boolean);
    }
    if(opt.overpay_anyway || opt.overpayAnyway) body.overpay_anyway = true;
    return body;
  }

  function toCorrectionsBody(rows, reason, overpayAnyway){
    var payments = [];
    (rows || []).forEach(function(r){
      if(!r || !r.id) return;
      if(r.del || r.deleted || r.delete){
        payments.push({ id: r.id, deleted: true });
        return;
      }
      var amt = Math.round(num(r.amount) * 100) / 100;
      var method = normalizePaymentMethod(r.method);
      var ymd = String(r.paid_on || r.paidOn || r.ymd || r.date || '').slice(0, 10);
      var orig = r.orig || {};
      if(orig.amount !== undefined && amt === num(orig.amount) && method === (orig.method || method) && (!ymd || ymd === orig.ymd)){
        return;
      }
      var item = { id: r.id, amount: amt, method: method };
      if(ymd) item.paid_on = ymd;
      payments.push(item);
    });
    var out = { payments: payments };
    if(nullable(reason)) out.reason = nullable(reason);
    if(overpayAnyway) out.overpay_anyway = true;
    return out;
  }

  function toDepositBody(agentId, amount, method, opt){
    opt = typeof opt === 'string' ? { note: opt } : (opt || {});
    var body = {
      agent_id: text(agentId),
      amount: Math.round(num(amount) * 100) / 100,
      method: text(method) || 'transfer'
    };
    if(opt.received_on || opt.receivedOn || opt.date) body.received_on = String(opt.received_on || opt.receivedOn || opt.date).slice(0, 10);
    if(opt.ref !== undefined && nullable(opt.ref)) body.ref = nullable(opt.ref);
    if(opt.note !== undefined && nullable(opt.note)) body.note = nullable(opt.note);
    var slips = opt.slip_ids || opt.slips;
    if(Array.isArray(slips) && slips.length){
      body.slip_ids = slips.map(function(s){ return typeof s === 'string' ? s : (s && s.id); }).filter(Boolean);
    }
    return body;
  }

  function toRefundPayoutBody(opt){
    opt = opt || {};
    var body = {
      method: text(opt.method) || 'transfer'
    };
    if(opt.paid_on || opt.paidOn || opt.date) body.paid_on = String(opt.paid_on || opt.paidOn || opt.date).slice(0, 10);
    if(opt.ref !== undefined && nullable(opt.ref)) body.ref = nullable(opt.ref);
    var slips = opt.slip_ids || opt.slips;
    if(Array.isArray(slips) && slips.length){
      body.slip_ids = slips.map(function(s){ return typeof s === 'string' ? s : (s && s.id); }).filter(Boolean);
    }
    return body;
  }

  function createInvoiceServer(agentId, bookingIds, opt){
    var body = toCreateInvoiceBody(agentId, bookingIds, opt);
    return O.queue(function(){
      return O.post('/v1/invoices', body);
    }).then(function(res){
      var mapped = upsertInvoice(res);
      O.wrote('invoice-create');
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not issue invoice', e);
      throw e;
    });
  }

  function recordPaymentServer(invoiceId, amount, method, opt){
    opt = opt || {};
    var body = toPaymentBody(amount, method, opt);
    return O.queue(function(){
      return O.post('/v1/invoices/' + enc(invoiceId) + '/payments', body);
    }).then(function(res){
      var mapped = upsertInvoice(res);
      if(body.method === 'credit' && mapped.agentId && state.creditBalances[mapped.agentId]){
        state.creditBalances[mapped.agentId].available = Math.max(0, num(state.creditBalances[mapped.agentId].available) - body.amount);
      }
      O.wrote('invoice-payment');
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not record payment', e);
      throw e;
    });
  }

  function voidInvoiceServer(invoiceId, reason){
    var body = nullable(reason) ? { reason: nullable(reason) } : {};
    return O.queue(function(){
      return O.post('/v1/invoices/' + enc(invoiceId) + '/void', body);
    }).then(function(res){
      var mapped = upsertInvoice(res);
      O.wrote('invoice-void');
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not void invoice', e);
      throw e;
    });
  }

  function patchInvoiceHeaderServer(invoiceId, field, val){
    var body;
    try{ body = toHeaderPatchBody(field, val); }
    catch(err){ O.fail('Invalid invoice edit', err); return Promise.reject(err); }
    return O.queue(function(){
      return O.patch('/v1/invoices/' + enc(invoiceId), body);
    }).then(function(res){
      var mapped = upsertInvoice(res);
      O.wrote('invoice-patch');
      if(typeof window.acctOpenDoc === 'function' && typeof _acctDocId !== 'undefined' && _acctDocId === invoiceId){
        window.acctOpenDoc(invoiceId, 'invoice');
      }
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not update invoice', e);
      if(typeof window.acctOpenDoc === 'function' && typeof _acctDocId !== 'undefined' && _acctDocId === invoiceId){
        window.acctOpenDoc(invoiceId, 'invoice');
      }
      throw e;
    });
  }

  function setInvoiceDiscountServer(invoiceId, key, val){
    var inv = listInvoices().find(function(i){ return i && i.id === invoiceId; });
    if(!inv) return Promise.resolve(null);
    var body;
    try{ body = toDiscountsBody(inv, key, val); }
    catch(err){ O.fail('Invalid discount', err); return Promise.reject(err); }
    return O.queue(function(){
      return O.call('PUT', '/v1/invoices/' + enc(invoiceId) + '/discounts', body);
    }).then(function(res){
      var mapped = upsertInvoice(res);
      O.wrote('invoice-discount');
      if(typeof window.acctOpenDoc === 'function' && typeof _acctDocId !== 'undefined' && _acctDocId === invoiceId){
        window.acctOpenDoc(invoiceId, 'invoice');
      }
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not update invoice discount', e);
      if(typeof window.acctOpenDoc === 'function' && typeof _acctDocId !== 'undefined' && _acctDocId === invoiceId){
        window.acctOpenDoc(invoiceId, 'invoice');
      }
      throw e;
    });
  }

  function correctPaymentsServer(invoiceId, rows, reason, overpayAnyway){
    var body = toCorrectionsBody(rows, reason, overpayAnyway);
    if(!body.payments.length) return Promise.resolve(listInvoices().find(function(i){ return i && i.id === invoiceId; }) || null);
    return O.queue(function(){
      return O.post('/v1/invoices/' + enc(invoiceId) + '/payment-corrections', body);
    }).then(function(res){
      var mapped = upsertInvoice(res);
      O.wrote('invoice-payment-correction');
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not correct invoice payments', e);
      throw e;
    });
  }

  function createDepositServer(agentId, amount, method, opt){
    var body = toDepositBody(agentId, amount, method, opt);
    return O.queue(function(){
      return O.post('/v1/deposits', body);
    }).then(function(res){
      var mapped = upsertDeposit(res);
      O.wrote('deposit-create');
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not record deposit', e);
      throw e;
    });
  }

  function voidDepositServer(depositId, reason){
    var body = { reason: nullable(reason) || 'voided' };
    return O.queue(function(){
      return O.post('/v1/deposits/' + enc(depositId) + '/void', body);
    }).then(function(res){
      var mapped = upsertDeposit(res);
      O.wrote('deposit-void');
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not void deposit', e);
      throw e;
    });
  }

  function payoutRefundServer(refundId, opt){
    var body = toRefundPayoutBody(opt);
    return O.queue(function(){
      return O.post('/v1/refunds/' + enc(refundId) + '/payout', body);
    }).then(function(res){
      var mapped = upsertRefund(res);
      O.wrote('refund-payout');
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not record refund payout', e);
      throw e;
    });
  }

  function undoRefundPayoutServer(refundId){
    return O.queue(function(){
      return O.del('/v1/refunds/' + enc(refundId) + '/payout');
    }).then(function(res){
      var mapped = upsertRefund(res);
      O.wrote('refund-payout-undo');
      redrawAccounting();
      return mapped;
    }, function(e){
      O.fail('Could not undo refund payout', e);
      throw e;
    });
  }

  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsMoney = true;
    window[name] = w;
  }

  ['sbInvoicesPersist', 'sbPaymentsPersist', 'sbDepositsPersist', 'acctPersistBookings'].forEach(function(name){
    wrap(name, function(){ return; });
  });

  wrap('acctInvoicePaid', function(orig, inv){
    if(inv && inv._fromOpsBackend && typeof inv.paid === 'number'){
      var ret = num(inv.refunded) + num(inv.credited);
      return Math.max(0, Math.round((num(inv.paid) - ret) * 100) / 100);
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('acctInvoiceBalance', function(orig, inv){
    if(inv && inv._fromOpsBackend && typeof inv.balance === 'number') return num(inv.balance);
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('acctInvoiceState', function(orig, inv){
    if(inv && inv._fromOpsBackend && inv.status) return inv.status;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('acctBookingInvoice', function(orig, bkId){
    var cid = toClientBookingId(bkId);
    var sid = toServerBookingId(bkId);
    var live = listInvoices().filter(function(iv){
      if(!iv || iv.status === 'void' || iv.voided) return false;
      var bids = iv.bookingIds || [];
      var sids = iv.serverBookingIds || [];
      return bids.indexOf(cid) >= 0 || bids.indexOf(bkId) >= 0 || sids.indexOf(sid) >= 0;
    });
    if(!live.length) return null;
    live.sort(function(a, b){ return String(a.issuedAt || '').localeCompare(String(b.issuedAt || '')); });
    for(var i = live.length - 1; i >= 0; i--){
      if(live[i].kind !== 'fee' && !live[i].feeType) return live[i];
    }
    return live[live.length - 1];
  });

  wrap('acctDocLineItems', function(orig, inv){
    if(inv && inv._fromOpsBackend && Array.isArray(inv.lineItems) && inv.lineItems.length){
      return inv.lineItems.map(function(li){
        var b = li.bookingId ? listBookings().find(function(x){ return x && x.id === li.bookingId; }) : null;
        var t = (b && b.trips && b.trips[0]) || {};
        var pax = (typeof window.bookingV2PaxAllTot === 'function' && t.pax) ? window.bookingV2PaxAllTot(t.pax) : '';
        var date = t.date || (b && b.travelDate) || li.cotDate || '';
        return {
          seq: li.seq,
          code: (b && (b.voucherRef || b.code || b.id)) || li.bookingId || (inv.feeType ? 'FEE' : ''),
          desc: li.label || (b ? (t.routeId || 'Booking') : 'Item'),
          date: date,
          pax: pax,
          lead: (b && (b.leadPax || b.customerName)) || '',
          amount: num(li.amount)
        };
      });
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('acctAgentDepositAvail', function(orig, agentId){
    if(agentId && state.creditBalances[agentId] && typeof state.creditBalances[agentId].available === 'number'){
      return num(state.creditBalances[agentId].available);
    }
    var a = typeof window.sbGetAgent === 'function' ? window.sbGetAgent(agentId) : null;
    if(a && typeof a.creditBalance === 'number') return num(a.creditBalance);
    var depTotal = listDeposits().filter(function(d){ return d && d.agentId === agentId && !d.voidedAt; }).reduce(function(s, d){ return s + num(d.amount); }, 0);
    var credTotal = state.refunds.filter(function(r){ return r && r.agentId === agentId && r.kind === 'credit'; }).reduce(function(s, r){ return s + num(r.amount); }, 0);
    var used = listPayments().filter(function(p){ return p && p.agentId === agentId && (p.method === 'credit' || p.type === 'deposit') && !p.deletedAt; }).reduce(function(s, p){ return s + num(p.amount); }, 0);
    return Math.max(0, Math.round((depTotal + credTotal - used) * 100) / 100);
  });

  wrap('acctDepositHeldTotal', function(){
    var depTotal = listDeposits().filter(function(d){ return d && !d.voidedAt; }).reduce(function(s, d){ return s + num(d.amount); }, 0);
    var credTotal = state.refunds.filter(function(r){ return r && r.kind === 'credit'; }).reduce(function(s, r){ return s + num(r.amount); }, 0);
    var used = listPayments().filter(function(p){ return p && (p.method === 'credit' || p.type === 'deposit') && !p.deletedAt; }).reduce(function(s, p){ return s + num(p.amount); }, 0);
    return Math.max(0, Math.round((depTotal + credTotal - used) * 100) / 100);
  });

  wrap('renderAccounting', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    if(!state.loaded){
      var host = document.getElementById('acct-body');
      if(host && !state.loading) host.innerHTML = '<div style="padding:32px;text-align:center;color:var(--fd-ink-soft)">Loading invoices from operation-backend…</div>';
      return loadAll(false).then(function(){
        return orig.apply(self, args);
      }, function(){
        if(host) host.innerHTML = '<div style="padding:32px;text-align:center;color:#A32D2D">Invoices did not load from operation-backend.</div>';
      });
    }
    return orig.apply(self, args);
  });

  wrap('acctCreateInvoice', function(orig, agentId, bookingIds, dueDays, opt){
    var ids = (Array.isArray(bookingIds) ? bookingIds : []).filter(Boolean);
    if(!ids.length) return null;
    if(state.failed){ O.fail('Invoices not loaded', new Error('Reload before creating an invoice')); return null; }
    var options = Object.assign({}, opt || {});
    return createInvoiceServer(agentId, ids, options).catch(function(){ return null; });
  });

  wrap('acctCreateFeeInvoice', function(orig, agentId, bookingId){
    // Fee invoices are issued by the server on POST /v1/bookings/:id/cancel.
    // Refresh the booking's invoices from the server rather than creating a local fee invoice.
    var sid = toServerBookingId(bookingId);
    if(!sid) return null;
    return O.get('/v1/invoices', { booking_id: sid }).then(function(res){
      ((res && res.invoices) || []).forEach(upsertInvoice);
      redrawAccounting();
      return listInvoices().find(function(i){ return i && i.kind === 'fee' && (i.bookingIds || []).indexOf(toClientBookingId(bookingId)) >= 0; }) || null;
    }).catch(function(e){ O.fail('Could not load fee invoice', e); return null; });
  });

  wrap('acctNewInvoiceCreate', function(){
    var ids = [].slice.call(document.querySelectorAll('.acct-bk-cb:checked')).map(function(cb){ return cb.value; });
    if(!ids.length){ alert('Select at least one booking'); return; }
    var agentId = typeof _acctNewInvAgent !== 'undefined' ? _acctNewInvAgent : '';
    return createInvoiceServer(agentId, ids, { kind: 'booking' }).then(function(){
      if(typeof window.acctModalClose === 'function') window.acctModalClose();
    }).catch(function(){});
  });

  wrap('acctRecordPayment', function(orig, invoiceId, amount, method, opt){
    if(!invoiceId || !(num(amount) > 0)) return null;
    if(state.failed){ O.fail('Invoices not loaded', new Error('Reload before recording a payment')); return null; }
    return recordPaymentServer(invoiceId, amount, method, opt).catch(function(){ return null; });
  });

  wrap('acctPaySubmit', function(orig, invId){
    var amtEl = document.getElementById('acct-pay-amt');
    var methodEl = document.getElementById('acct-pay-method');
    var amt = num(amtEl && amtEl.value);
    var method = (methodEl && methodEl.value) || 'transfer';
    if(amt <= 0){ alert('Enter amount'); return; }
    return recordPaymentServer(invId, amt, method, {}).then(function(){
      if(typeof window.acctModalClose === 'function') window.acctModalClose();
    }).catch(function(){});
  });

  wrap('acctApplyDeposit', function(orig, agentId, invoiceId, amount){
    var amt = num(amount);
    if(!invoiceId || amt <= 0) return Promise.resolve(0);
    return recordPaymentServer(invoiceId, amt, 'credit', {}).then(function(){ return amt; }).catch(function(){ return 0; });
  });

  wrap('acctPayUseDeposit', function(orig, invId){
    var inv = listInvoices().find(function(i){ return i && i.id === invId; });
    if(!inv) return;
    var avail = window.acctAgentDepositAvail(inv.agentId);
    var bal = window.acctInvoiceBalance(inv);
    var amt = Math.min(bal, avail);
    if(amt <= 0){ alert('No deposit available'); return; }
    return recordPaymentServer(invId, amt, 'credit', {}).then(function(){
      if(typeof window.acctModalClose === 'function') window.acctModalClose();
    }).catch(function(){});
  });

  wrap('acctVoidInvoice', function(orig, invoiceId, reason){
    if(!invoiceId) return null;
    if(state.failed){ O.fail('Invoices not loaded', new Error('Reload before voiding an invoice')); return null; }
    return voidInvoiceServer(invoiceId, reason).catch(function(){ return null; });
  });

  wrap('acctVoidConfirm', function(orig, invId){
    if(!confirm('Void this invoice? Linked bookings return to unpaid (credit re-held).')) return;
    return voidInvoiceServer(invId, null).catch(function(){});
  });

  wrap('acctInvSet', function(orig, invId, field, val){
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('accounting')) return;
    return patchInvoiceHeaderServer(invId, field, val).catch(function(){});
  });

  wrap('acctInvDisc', function(orig, invId, key, val){
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('accounting')) return;
    return setInvoiceDiscountServer(invId, key, val).catch(function(){});
  });

  wrap('acctCreateDeposit', function(orig, agentId, amount, method, note){
    if(!agentId || !(num(amount) > 0)) return null;
    if(state.failed){ O.fail('Deposits not loaded', new Error('Reload before recording a deposit')); return null; }
    return createDepositServer(agentId, amount, method, { note: note }).catch(function(){ return null; });
  });

  wrap('acctDepositSubmit', function(){
    var agEl = document.getElementById('acct-dep-agent');
    var amtEl = document.getElementById('acct-dep-amt');
    var methodEl = document.getElementById('acct-dep-method');
    var noteEl = document.getElementById('acct-dep-note');
    var ag = text(agEl && agEl.value);
    var amt = num(amtEl && amtEl.value);
    var method = (methodEl && methodEl.value) || 'transfer';
    var note = (noteEl && noteEl.value) || '';
    if(!ag){ alert('เลือก agent'); return; }
    if(amt <= 0){ alert('ใส่จำนวนเงิน'); return; }
    return createDepositServer(ag, amt, method, { note: note }).then(function(){
      if(typeof window.acctModalClose === 'function') window.acctModalClose();
    }).catch(function(){});
  });

  wrap('bookingV2PayDoCreate', function(orig, bkId){
    var bk = listBookings().find(function(x){ return x && x.id === bkId; });
    if(!bk || !bk.agentId) return;
    return createInvoiceServer(bk.agentId, [bkId], { kind: 'booking' }).then(function(){
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
      if(typeof window.bookingV2RowPayAction === 'function') window.bookingV2RowPayAction(bkId);
    }).catch(function(){});
  });

  wrap('bookingV2PayDoRecord', function(orig, invId, bkId){
    var amtEl = document.getElementById('bkv2-pay-amt');
    var methodEl = document.getElementById('bkv2-pay-method');
    var amt = num(amtEl && amtEl.value);
    var method = (methodEl && methodEl.value) || 'transfer';
    if(amt <= 0){ alert('ใส่จำนวนเงิน'); return; }
    return recordPaymentServer(invId, amt, method, {}).then(function(){
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
      if(typeof window.bookingV2RowPayAction === 'function') window.bookingV2RowPayAction(bkId);
    }).catch(function(){});
  });

  wrap('pfmEditOpen', function(orig, bkId){
    if(typeof window.pfmEditCan === 'function' && !window.pfmEditCan()){ alert('No permission to edit accounting'); return; }
    var inv = window.acctBookingInvoice(bkId);
    if(!inv) return;
    var rows = listPayments().filter(function(p){ return p && p.invoiceId === inv.id && !p.deletedAt && p.type !== 'refund' && p.method !== 'credit'; }).map(function(p){
      var ymd = p.paidOn || (p.date ? String(p.date).slice(0, 10) : '');
      var o = { amount: Math.round(num(p.amount)), method: p.method || 'transfer', ymd: ymd };
      return { id: p.id, amount: o.amount, method: o.method, ymd: o.ymd, del: false, orig: o };
    });
    if(typeof _pfmEdit !== 'undefined'){
      _pfmEdit = { bkId: bkId, invId: inv.id, rows: rows, reason: '' };
    }
    if(typeof window.renderDailyPFM === 'function') window.renderDailyPFM();
  });

  wrap('pfmEditSubmit', function(){
    var e = typeof _pfmEdit !== 'undefined' ? _pfmEdit : null;
    if(!e || !e.invId) return;
    return correctPaymentsServer(e.invId, e.rows, e.reason, false).then(function(){
      _pfmEdit = null;
      if(typeof window.renderDailyPFM === 'function') window.renderDailyPFM();
    }).catch(function(){});
  });

  wrap('pfmEditVoidInvoice', function(){
    var e = typeof _pfmEdit !== 'undefined' ? _pfmEdit : null;
    if(!e || !e.invId) return;
    return voidInvoiceServer(e.invId, e.reason || null).then(function(){
      _pfmEdit = null;
      if(typeof window.renderDailyPFM === 'function') window.renderDailyPFM();
    }).catch(function(){});
  });

  window.acctVoidDeposit = function(depositId, reason){
    if(!enabled()) return null;
    return voidDepositServer(depositId, reason);
  };
  window.acctRefundPayout = function(refundId, opt){
    if(!enabled()) return null;
    return payoutRefundServer(refundId, opt);
  };
  window.acctUndoRefundPayout = function(refundId){
    if(!enabled()) return null;
    return undoRefundPayoutServer(refundId);
  };

  O.onChange(function(change){
    if(!change) return;
    if(['invoice', 'payment', 'deposit', 'refund', 'booking'].indexOf(change.entity_type) >= 0){
      state.loaded = false;
    }
  });

  var api = {
    load: function(){ return loadAll(true); },
    ensureLoaded: function(){ return loadAll(false); },
    createInvoice: createInvoiceServer,
    recordPayment: recordPaymentServer,
    voidInvoice: voidInvoiceServer,
    patchHeader: patchInvoiceHeaderServer,
    setDiscount: setInvoiceDiscountServer,
    correctPayments: correctPaymentsServer,
    createDeposit: createDepositServer,
    voidDeposit: voidDepositServer,
    payoutRefund: payoutRefundServer,
    undoRefundPayout: undoRefundPayoutServer,
    refunds: function(){ return state.refunds.slice(); }
  };

  O.money = api;
  window.laOpsMoney = api;
  window.__laOpsMoneyCompat = {
    fromServerInvoice: fromServerInvoice,
    fromServerPayment: fromServerPayment,
    fromServerDeposit: fromServerDeposit,
    fromServerRefund: fromServerRefund,
    toCreateInvoiceBody: toCreateInvoiceBody,
    toHeaderPatchBody: toHeaderPatchBody,
    toDiscountsBody: toDiscountsBody,
    toPaymentBody: toPaymentBody,
    toCorrectionsBody: toCorrectionsBody,
    toDepositBody: toDepositBody,
    toRefundPayoutBody: toRefundPayoutBody
  };

  if(enabled()) loadAll(false).catch(function(){});
})();
