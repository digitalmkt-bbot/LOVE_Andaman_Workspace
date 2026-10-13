import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/30-ops-money.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false, onChange: () => {} } };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt });
  return window.__laOpsMoneyCompat;
}

test('invoice, payment, deposit, and refund response mappers preserve server-computed fields', () => {
  const c = compat();
  const inv = c.fromServerInvoice({
    id: 'inv_1',
    number: 'INV-2610-0001',
    agent_id: 'ag_1',
    kind: 'booking',
    fee_type: null,
    vat_mode: 'exclude',
    vat_rate: 0.07,
    subtotal: 2000,
    net_amount: 2000,
    vat_amount: 140,
    total: 2140,
    wht_amount: 60,
    payment_amount: 2080,
    paid: 1000,
    balance: 1140,
    refunded: 0,
    credited: 0,
    overpaid: 0,
    status: 'partial',
    voided: false,
    issued_at: '2026-10-01T00:00:00Z',
    due_at: '2026-10-31T00:00:00Z',
    note: 'Monthly bill',
    ref: 'REF-1',
    dear: 'Khun A',
    accept_at: '2026-10-15',
    remark: 'Net 30',
    booking_ids: ['bk_1'],
    lines: [{ seq: 0, booking_id: 'bk_1', label: 'Phi Phi', amount: 2100, discount: 100, removed_at: null }],
    payments: [{ id: 'pay_1', invoice_id: 'inv_1', amount: 1000, method: 'transfer', paid_on: '2026-10-02', ref: 'TR-1', slips: [], deleted_at: null }],
    refunds: []
  });
  assert.equal(inv.id, 'inv_1');
  assert.equal(inv.agentId, 'ag_1');
  assert.equal(inv.total, 2140);
  assert.equal(inv.paid, 1000);
  assert.equal(inv.balance, 1140);
  assert.equal(inv.whtAmount, 60);
  assert.equal(inv.paymentAmount, 2080);
  assert.equal(inv.status, 'partial');
  assert.equal(inv.discounts['bk_1|0'], 100);
  assert.equal(inv.payments.length, 1);

  const dep = c.fromServerDeposit({
    id: 'dep_1',
    agent_id: 'ag_1',
    amount: 5000,
    method: 'transfer',
    received_on: '2026-10-03',
    ref: 'D-01',
    note: 'Advance',
    status: 'live',
    voided_at: null,
    slips: [],
    credit_balance: { credited: 0, deposited: 5000, used: 1000, available: 4000 }
  });
  assert.equal(dep.id, 'dep_1');
  assert.equal(dep.agentId, 'ag_1');
  assert.equal(dep.amount, 5000);

  const ref = c.fromServerRefund({
    id: 'ref_1',
    kind: 'refund',
    invoice_id: 'inv_1',
    invoice_number: 'INV-2610-0001',
    booking_id: 'bk_1',
    agent_id: 'ag_1',
    amount: 500,
    reason: 'weather',
    created_at: '2026-10-04T00:00:00Z',
    payout: { refund_id: 'ref_1', paid_on: '2026-10-05', method: 'transfer', ref: 'PO-1', slips: [] }
  });
  assert.equal(ref.id, 'ref_1');
  assert.equal(ref.payout.method, 'transfer');
});

test('request builders emit exact documented endpoints and payloads without generic status/amount patches', () => {
  const c = compat();
  assert.deepEqual(JSON.parse(JSON.stringify(c.toCreateInvoiceBody('ag_1', ['bk_1'], { kind: 'prepay', note: 'prepay', ref: 'R1' }))), {
    agent_id: 'ag_1',
    booking_ids: ['bk_1'],
    kind: 'prepay',
    note: 'prepay',
    ref: 'R1'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toHeaderPatchBody('whtAmount', '150'))), { wht_amount: 150 });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toHeaderPatchBody('acceptAt', '2026-10-20'))), { accept_at: '2026-10-20' });
  assert.throws(() => c.toHeaderPatchBody('total', 999), /cannot be patched/);
  assert.throws(() => c.toHeaderPatchBody('status', 'paid'), /cannot be patched/);

  const inv = { lines: [{ seq: 3, booking_id: 'bk_1', amount: 2000, removed_at: null }] };
  assert.deepEqual(JSON.parse(JSON.stringify(c.toDiscountsBody(inv, 'bk_1|0', '250'))), {
    lines: [{ seq: 3, discount: 250 }]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toPaymentBody(1200, 'deposit', { ref: 'CREDIT-USE' }))), {
    amount: 1200,
    method: 'credit',
    ref: 'CREDIT-USE'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toCorrectionsBody([
    { id: 'pay_1', amount: 900, method: 'cash', ymd: '2026-10-05', del: false, orig: { amount: 1000, method: 'transfer', ymd: '2026-10-02' } },
    { id: 'pay_2', amount: 500, method: 'transfer', ymd: '2026-10-02', del: true, orig: { amount: 500, method: 'transfer', ymd: '2026-10-02' } }
  ], 'Fixed entry'))), {
    payments: [
      { id: 'pay_1', amount: 900, method: 'cash', paid_on: '2026-10-05' },
      { id: 'pay_2', deleted: true }
    ],
    reason: 'Fixed entry'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toDepositBody('ag_1', 3000, 'transfer', { note: 'Dep note', received_on: '2026-10-03' }))), {
    agent_id: 'ag_1',
    amount: 3000,
    method: 'transfer',
    received_on: '2026-10-03',
    note: 'Dep note'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toRefundPayoutBody({ method: 'cheque', paid_on: '2026-10-06', ref: 'CHQ-9' }))), {
    method: 'cheque',
    paid_on: '2026-10-06',
    ref: 'CHQ-9'
  });
});

function createRuntime(){
  const calls = [];
  let nextResolver = null;
  const SB_INVOICES = [];
  const SB_PAYMENTS = [];
  const SB_DEPOSITS = [];
  const SB_BOOKINGS = [{ id: 'bk_client_1', opsId: 'bk_srv_1', agentId: 'ag_1', total: 2000, invoiceId: null, paymentStatus: 'unpaid' }];
  const window = {};
  const O = {
    enabled: () => true,
    clone: v => v == null ? v : JSON.parse(JSON.stringify(v)),
    activeView: () => 'accounting',
    get: async (path, q) => {
      calls.push({ method: 'GET', path, q });
      if(path === '/v1/invoices') return { invoices: [] };
      if(path === '/v1/deposits') return { deposits: [] };
      if(path === '/v1/refunds') return { refunds: [] };
      return {};
    },
    post: (path, body) => O.call('POST', path, body),
    patch: (path, body) => O.call('PATCH', path, body),
    del: (path) => O.call('DELETE', path),
    call: (method, path, body) => new Promise((resolve, reject) => {
      calls.push({ method, path, body });
      nextResolver = { resolve, reject };
    }),
    queue: fn => Promise.resolve().then(fn),
    fail: (title, err) => calls.push({ fail: title, message: err && err.message, code: err && err.code }),
    wrote: kind => calls.push({ wrote: kind }),
    onChange: () => {}
  };
  window.laOps = O;
  window.acctCreateInvoice = () => 'legacy-create';
  window.acctRecordPayment = () => 'legacy-pay';
  window.acctVoidInvoice = () => 'legacy-void';
  window.acctInvoicePaid = () => 0;
  window.acctInvoiceBalance = () => 0;
  window.acctInvoiceState = () => 'issued';
  window.acctBookingInvoice = () => null;
  window.acctDocLineItems = () => [];
  window.acctAgentDepositAvail = () => 0;
  window.acctDepositHeldTotal = () => 0;
  window.renderAccounting = () => calls.push({ render: 'accounting' });
  window.sbInvoicesPersist = () => calls.push({ persist: 'invoices' });
  window.sbPaymentsPersist = () => calls.push({ persist: 'payments' });
  window.sbDepositsPersist = () => calls.push({ persist: 'deposits' });
  window.acctPersistBookings = () => calls.push({ persist: 'bookings' });

  const context = {
    window,
    document: { getElementById: () => null, querySelectorAll: () => [] },
    console,
    Number,
    String,
    Object,
    Array,
    JSON,
    Date,
    Promise,
    encodeURIComponent,
    parseFloat,
    parseInt,
    confirm: () => true,
    alert: msg => calls.push({ alert: msg }),
    SB_INVOICES,
    SB_PAYMENTS,
    SB_DEPOSITS,
    SB_BOOKINGS
  };
  vm.runInNewContext(SOURCE, context);
  return {
    window,
    context,
    calls,
    SB_INVOICES,
    SB_PAYMENTS,
    SB_DEPOSITS,
    SB_BOOKINGS,
    resolveNext: val => nextResolver.resolve(val),
    rejectNext: err => nextResolver.reject(err),
    tick: () => new Promise(r => setImmediate(r))
  };
}

test('mutations are server-first: no local mutation before response, no mutation on rejection, and no booking field patching', async () => {
  const rt = createRuntime();
  await rt.tick();

  // Issue invoice: pending call does not mutate SB_INVOICES or booking.invoiceId
  const createP = rt.window.acctCreateInvoice('ag_1', ['bk_client_1'], 30);
  await rt.tick();
  assert.equal(rt.SB_INVOICES.length, 0, 'no local invoice before server responds');
  assert.equal(rt.SB_BOOKINGS[0].invoiceId, null);

  rt.resolveNext({
    id: 'inv_10',
    number: 'INV-2610-0010',
    agent_id: 'ag_1',
    kind: 'booking',
    fee_type: null,
    vat_mode: 'none',
    vat_rate: 0.07,
    subtotal: 2000,
    net_amount: 2000,
    vat_amount: 0,
    total: 2000,
    wht_amount: null,
    payment_amount: 2000,
    paid: 0,
    balance: 2000,
    refunded: 0,
    credited: 0,
    overpaid: 0,
    status: 'issued',
    voided: false,
    issued_at: '2026-10-10T00:00:00Z',
    due_at: '2026-11-09T00:00:00Z',
    booking_ids: ['bk_srv_1'],
    lines: [{ seq: 0, booking_id: 'bk_srv_1', label: 'Similan', amount: 2000, discount: null, removed_at: null }],
    payments: [],
    refunds: []
  });
  await createP;
  assert.equal(rt.SB_INVOICES.length, 1);
  assert.equal(rt.SB_INVOICES[0].id, 'inv_10');
  assert.equal(rt.SB_BOOKINGS[0].invoiceId, null, 'booking.invoiceId is never patched locally');
  assert.equal(rt.SB_BOOKINGS[0].paymentStatus, 'unpaid', 'booking.paymentStatus is never patched locally');
  assert.equal(rt.window.acctBookingInvoice('bk_client_1').id, 'inv_10');

  // Record payment: rejected 409 overpayment leaves SB_INVOICES and SB_PAYMENTS unchanged
  const payP = rt.window.acctRecordPayment('inv_10', 5000, 'transfer');
  await rt.tick();
  assert.equal(rt.SB_PAYMENTS.length, 0, 'no local payment before server responds');
  const overErr = Object.assign(new Error('Total received is more than invoice total'), { status: 409, code: 'overpayment' });
  rt.rejectNext(overErr);
  await payP;
  assert.equal(rt.SB_PAYMENTS.length, 0, 'rejected payment does not mutate SB_PAYMENTS');
  assert.equal(rt.SB_INVOICES[0].balance, 2000, 'rejected payment leaves invoice balance untouched');
  assert.ok(rt.calls.some(x => x.fail === 'Could not record payment' && x.code === 'overpayment'));

  // Deposit spend uses method: 'credit' on invoice payments endpoint and does not locally decrement deposit
  const depP = rt.window.laOps.money.createDeposit('ag_1', 1500, 'transfer', { note: 'Dep' });
  await rt.tick();
  rt.resolveNext({
    id: 'dep_1',
    agent_id: 'ag_1',
    amount: 1500,
    method: 'transfer',
    received_on: '2026-10-10',
    status: 'live',
    voided_at: null,
    slips: [],
    credit_balance: { credited: 0, deposited: 1500, used: 0, available: 1500 }
  });
  await depP;
  assert.equal(rt.SB_DEPOSITS.length, 1);
  assert.equal(rt.SB_DEPOSITS[0].amount, 1500);

  const spendP = rt.window.acctApplyDeposit('ag_1', 'inv_10', 1500);
  await rt.tick();
  const creditCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/invoices/inv_10/payments' && x.body && x.body.method === 'credit');
  assert.ok(creditCall, 'deposit spend sends POST /v1/invoices/:id/payments with method credit');
  rt.resolveNext({
    id: 'inv_10',
    number: 'INV-2610-0010',
    agent_id: 'ag_1',
    kind: 'booking',
    total: 2000,
    paid: 1500,
    balance: 500,
    status: 'partial',
    voided: false,
    booking_ids: ['bk_srv_1'],
    lines: [{ seq: 0, booking_id: 'bk_srv_1', label: 'Similan', amount: 2000, discount: null, removed_at: null }],
    payments: [{ id: 'pay_c1', invoice_id: 'inv_10', amount: 1500, method: 'credit', paid_on: '2026-10-10', slips: [], deleted_at: null }],
    refunds: []
  });
  await spendP;
  assert.equal(rt.SB_DEPOSITS[0].amount, 1500, 'deposit record is not locally decremented');
  assert.equal(rt.SB_INVOICES[0].balance, 500);
  assert.equal(rt.calls.some(x => x.persist), false, 'no legacy blob persist called in ops mode');
});

test('legacy mode delegates to original functions and makes no API calls', () => {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => false,
      get: () => { calls.push('api'); return Promise.resolve({}); },
      call: () => { calls.push('api'); return Promise.resolve({}); },
      onChange: () => {}
    },
    acctCreateInvoice: (a, b, d) => { calls.push(['create', a, b, d]); return { id: 'legacy' }; },
    acctRecordPayment: (id, amt, m) => { calls.push(['pay', id, amt, m]); },
    acctVoidInvoice: id => { calls.push(['void', id]); }
  };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt });
  assert.deepEqual(window.acctCreateInvoice('ag_1', ['b1'], 30), { id: 'legacy' });
  window.acctRecordPayment('inv_1', 500, 'cash');
  window.acctVoidInvoice('inv_1');
  assert.equal(calls.includes('api'), false);
  assert.equal(calls.length, 3);
});
