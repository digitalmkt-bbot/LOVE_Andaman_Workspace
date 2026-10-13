import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (f) => fs.readFileSync('allotment_v2/js/ops/' + f, 'utf8');
const CORE = read('00-ops-core.js');
const PIER = read('44-ops-pier-money.js');
const VB = read('45-ops-van-bills.js');
const COMM = read('46-ops-commissions.js');
const D = '2026-10-13';
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

function runtime({ enabled = true, handlers = {}, confirmAnswer = true, promptAnswer = '' } = {}) {
  const requests = [], toasts = [], legacy = [], alerts = [];
  const hosts = {};
  const hostEl = (id) => (hosts[id] = hosts[id] || { id, innerHTML: '' });
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Number, String, Math, Date,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    document: { getElementById: hostEl, activeElement: null, querySelector: () => ({ dataset: { view: 'commissions' } }) },
    laSaveToast: (o) => toasts.push(plain(o)),
    confirm: () => confirmAnswer, prompt: () => promptAnswer, alert: (m) => alerts.push(m),
    setTimeout, clearTimeout,
    _pckDate: D,
    _pckPay: null,
    SB_BOOKINGS: [{ id: 'b1', opsId: 'lg_1', opsVersion: 3, pierPayments: [] }],
    _vb: { sup: '', van: '', ym: '', per: 2, edit: 0, open: {}, foc: '', mode: 'ov' },
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body, headers: plain(opts.headers) });
    const key = opts.method + ' ' + path.split('?')[0];
    const h = handlers[key];
    if (h === undefined) throw new Error('unexpected request ' + key);
    const r = typeof h === 'function' ? await h(body, path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  // legacy stand-ins
  ctx.pckMoney = (b, date) => { legacy.push(['pckMoney']); return { cot: 1, due: 999, pierPaid: 0, exCov: 0, extras: [], cur: 'THB' }; };
  ctx.renderPierCheckin = () => { legacy.push(['renderPierCheckin']); };
  ctx.pckPayOpen = (id) => { legacy.push(['pckPayOpen', id]); };
  ctx.pckPaySave = () => { legacy.push(['pckPaySave']); };
  ctx.pckPayDel = () => { legacy.push(['pckPayDel']); };
  ctx.pckPayAddSlip = () => { legacy.push(['pckPayAddSlip']); };
  ctx.pckLineNew = (amt) => ({ m: 'cash', amt, feeMode: 'pct', feePct: 3, fee: 0, note: '', slips: [] });
  ctx.pckPayRender = () => { legacy.push(['pckPayRender']); };
  ctx.renderVanBill = () => { legacy.push(['renderVanBill']); };
  ctx.vbPersist = () => { legacy.push(['vbPersist']); };
  ctx.vbSuppliers = () => ['Co A', 'Co B'];
  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);
  vm.runInContext(PIER, ctx);
  vm.runInContext(VB, ctx);
  vm.runInContext(COMM, ctx);
  const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
  return { ctx, requests, toasts, legacy, alerts, hosts, settle, O: ctx.laOps };
}

// ── pier money ───────────────────────────────────────────────

const pierRow = (over = {}) => ({ booking_id: 'lg_1', version: 4, route_id: 'r1', service_date: D, overnight_return: false,
  cot: 500, cot_currency: 'THB', cot_handling: null, cot_note: null, upgrades_due: 100, upgrades_got: 0, b2c_balance: 0,
  tour_sales_due: 50, tour_sales_got: 0, gross: 650, paid: 200, fees: 6, due: 450, got: 200, no_slip: 1, payments: [], ...over });

test('pier: pckMoney takes its numbers from the server row; the day loads once', async () => {
  const rt = runtime({ handlers: { 'GET /v1/pier-money': { body: { service_date: D, rows: [pierRow()] } } } });
  rt.ctx.renderPierCheckin();
  await rt.settle();
  const m = rt.ctx.pckMoney(rt.ctx.SB_BOOKINGS[0], D);
  assert.equal(m.due, 450); assert.equal(m.pierPaid, 200); assert.equal(m.gross, 650); assert.equal(m.noSlip, 1);
  assert.equal(m.upDue, 100); assert.equal(m.exDue, 50);
  assert.equal(rt.requests.filter((r) => r.path.startsWith('/v1/pier-money')).length, 1);
  assert.equal(rt.requests[0].path, '/v1/pier-money?date=' + D);
  rt.ctx.renderPierCheckin();
  await rt.settle();
  assert.equal(rt.requests.length, 1, 'a second paint inside the TTL does not re-fetch');
});

test('pier: legacy mode delegates and sends nothing', async () => {
  const rt = runtime({ enabled: false });
  assert.equal(rt.ctx.pckMoney(rt.ctx.SB_BOOKINGS[0], D).due, 999);
  rt.ctx.renderPierCheckin(); rt.ctx.pckPaySave();
  await rt.settle();
  assert.equal(rt.requests.length, 0);
});

test('pier: save sends lines, asks before overpaying, resends with overpay_anyway, keeps the version', async () => {
  let calls = 0;
  const rt = runtime({ handlers: {
    'GET /v1/bookings/lg_1/pier-money': { body: pierRow() },
    'POST /v1/bookings/lg_1/pier-payments': (body) => (calls++ === 0
      ? { status: 409, body: { statusCode: 409, code: 'overpayment', message: 'Received more than owed' } }
      : { status: 201, body: pierRow({ version: 5, due: 0, paid: 650, payments: [{ id: 'pp_1', service_date: D, method: 'card', amount: 650, fee: 19.5, fee_pct: 3, note: '', slips: [{ id: 's1', name: 'a.jpg', mime: 'image/jpeg', size: 1 }], by: 'u', at: 'x' }] }) }),
  } });
  rt.ctx.pckPayOpen('b1');
  await rt.settle();
  rt.ctx._pckPay = { bkId: 'b1', date: D, thenCk: false, lines: [
    { m: 'card', amt: 650, feeMode: 'pct', feePct: 3, fee: 0, note: '', slips: [{ id: 's1' }] },
    { m: 'cash', amt: 0, feeMode: 'pct', feePct: 3, fee: 0, note: '', slips: [] } ] };
  rt.ctx.pckPaySave();
  await rt.settle();
  const posts = rt.requests.filter((r) => r.method === 'POST');
  assert.equal(posts.length, 2);
  assert.deepEqual(plain(posts[0].body), { service_date: D, lines: [{ method: 'card', amount: 650, note: '', slip_ids: ['s1'], fee_pct: 3 }] });
  assert.equal(posts[0].headers['If-Match'], '"4"', 'sends the version it read');
  assert.equal(posts[1].body.overpay_anyway, true);
  const b = rt.ctx.SB_BOOKINGS[0];
  assert.equal(b.opsVersion, 5);
  assert.equal(b.pierPayments.length, 1); assert.equal(b.pierPayments[0].id, 'pp_1'); assert.equal(b.pierPayments[0].feePct, 3);
  assert.equal(rt.ctx.pckMoney(b, D).due, 0);
});

test('pier: declining the overpayment saves nothing on screen', async () => {
  const rt = runtime({ confirmAnswer: false, handlers: {
    'GET /v1/bookings/lg_1/pier-money': { body: pierRow() },
    'POST /v1/bookings/lg_1/pier-payments': { status: 409, body: { statusCode: 409, code: 'overpayment', message: 'Received more than owed' } },
  } });
  rt.ctx.pckPayOpen('b1'); await rt.settle();
  rt.ctx._pckPay = { bkId: 'b1', date: D, lines: [{ m: 'cash', amt: 9999, feeMode: 'pct', feePct: 3, fee: 0, note: '', slips: [] }] };
  rt.ctx.pckPaySave(); await rt.settle();
  assert.equal(rt.requests.filter((r) => r.method === 'POST').length, 1);
  assert.equal(rt.ctx.SB_BOOKINGS[0].pierPayments.length, 0);
  assert.equal(rt.toasts.length, 0, 'a declined dialog is not an error');
});

test('pier: a refused save shows the server message; delete goes to the server first', async () => {
  const rt = runtime({ handlers: {
    'GET /v1/bookings/lg_1/pier-money': { body: pierRow() },
    'POST /v1/bookings/lg_1/pier-payments': { status: 409, body: { statusCode: 409, code: 'stale_version', message: 'Booking changed' } },
    'DELETE /v1/bookings/lg_1/pier-payments/pp_9': { body: pierRow({ version: 6, paid: 0, due: 650, payments: [] }) },
  } });
  rt.ctx.pckPayOpen('b1'); await rt.settle();
  rt.ctx._pckPay = { bkId: 'b1', date: D, lines: [{ m: 'cash', amt: 10, feeMode: 'pct', feePct: 3, fee: 0, note: '', slips: [] }] };
  rt.ctx.pckPaySave(); await rt.settle();
  assert.equal(rt.toasts.length, 1); assert.match(rt.toasts[0].sub, /Booking changed/);
  rt.ctx.SB_BOOKINGS[0].pierPayments = [{ id: 'pp_9', date: D, amount: 650 }];
  rt.ctx.pckPayDel('pp_9'); await rt.settle();
  assert.equal(rt.ctx.SB_BOOKINGS[0].pierPayments.length, 0);
  assert.equal(rt.ctx.SB_BOOKINGS[0].opsVersion, 6);
});

// ── van bills ───────────────────────────────────────────────

const bill = (over = {}) => ({ partner: 'Co A', month: '2026-10', period: 2, from: '2026-10-11', to: '2026-10-20', label: 'x', saved: true,
  van_id: null, vans: [], per_pax: 100, rate: 0, route_rates: { PP: 1700 }, row_overrides: { 'K1': { rate: 1500, ex: null, cut: null, per: null } },
  codes: [{ code: 'PP', rows: 1, rate: 1700 }],
  rows: [{ key: '2026-10-12~r10~veh1', date: '2026-10-12', route_id: 'r10', code: 'PP', van_id: 'veh1', return_only: false, pax: 7, pickups: ['Patong'], rate: 1700, ex: 0, cut: 0, per_pax: 100, bill: 1700, sale: 700, pl: -1000, new: false }],
  extra_lines: [], totals: { vans: 1, pax: 7, bill: 1700, sale: 700, pl: -1000, ex: 0, cut: 0 }, by_code: [], missing_rate: 0, new_rows: [], seen: null,
  updated_at: null, updated_by: null, state: 'draft', sent: null, paid: null, ...over });

test('van bills: overview is drawn from the server, nothing computed locally', async () => {
  const rt = runtime({ handlers: { 'GET /v1/van-bills': { body: { month: '2026-10', period: 2, partners: [
    { partner: 'Co A', trips: 3, pax: 20, bill: 5100, sale: 2000, pl: -3100, missing_rate: 1, state: 'sent' }], totals: { trips: 3, pax: 20, bill: 5100, sale: 2000, pl: -3100 } } } } });
  rt.ctx._vb.ym = '2026-10';
  rt.ctx.renderVanBill();
  await rt.settle();
  const html = rt.hosts['vanbill-host'].innerHTML;
  assert.match(html, /Co A/); assert.match(html, /5,100/); assert.match(html, /1 without rate/);
  assert.equal(rt.requests[0].path, '/v1/van-bills?month=2026-10&period=2');
  assert.equal(rt.legacy.filter((l) => l[0] === 'renderVanBill').length, 0, 'the legacy renderer is not used');
  rt.ctx.vbPersist();
  assert.equal(rt.legacy.filter((l) => l[0] === 'vbPersist').length, 0, 'the blob writer is silenced');
});

test('van bills: an edit sends the whole override map and shows the server answer', async () => {
  let patched;
  const rt = runtime({ handlers: {
    'GET /v1/van-bills/Co%20A/2026-10/2': { body: bill() },
    'PATCH /v1/van-bills/Co%20A/2026-10/2': (body) => { patched = body; return { body: bill({ totals: { vans: 1, pax: 7, bill: 2100, sale: 700, pl: -1400, ex: 0, cut: 0 } }) }; },
  } });
  Object.assign(rt.ctx._vb, { ym: '2026-10', per: 2, mode: 'one', sup: 'Co A' });
  rt.ctx.renderVanBill(); await rt.settle();
  assert.match(rt.hosts['vanbill-host'].innerHTML, /Pickups/);
  rt.ctx.laOpsVanBills.setRow('2026-10-12~r10~veh1', 'rate', '2100'); await rt.settle();
  assert.deepEqual(plain(patched), { row_overrides: { K1: { rate: 1500, ex: null, cut: null, per: null }, '2026-10-12~r10~veh1': { rate: 2100, ex: null, cut: null, per: null } } });
  assert.match(rt.hosts['vanbill-host'].innerHTML, /2,100/);
});

test('van bills: a refused edit shows the server message and the screen keeps the server figures', async () => {
  const rt = runtime({ handlers: {
    'GET /v1/van-bills/Co%20A/2026-10/2': { body: bill({ state: 'paid', paid: { at: 'x', by: 'u', on: '2026-10-13', via: 'cash', ref: null, amount: 1700 } }) },
    'PATCH /v1/van-bills/Co%20A/2026-10/2': { status: 409, body: { statusCode: 409, code: 'bill_paid', message: 'The bill is paid: undo the payment first' } },
  } });
  Object.assign(rt.ctx._vb, { ym: '2026-10', per: 2, mode: 'one', sup: 'Co A' });
  rt.ctx.renderVanBill(); await rt.settle();
  rt.ctx.laOpsVanBills.setRate('5'); await rt.settle();
  assert.match(rt.toasts[0].sub, /undo the payment/);
  assert.match(rt.hosts['vanbill-host'].innerHTML, /1,700/);
  assert.match(rt.hosts['vanbill-host'].innerHTML, /Undo payment/);
});

test('van bills: send, pay and pull-rates go to their endpoints', async () => {
  const rt = runtime({ promptAnswer: 'transfer', handlers: {
    'GET /v1/van-bills/Co%20A/2026-10/2': { body: bill() },
    'POST /v1/van-bills/Co%20A/2026-10/2/send': { body: bill({ state: 'sent', sent: { at: '2026-10-13T00:00:00Z', by: 'u', bill: 1700, changed_since_sent: false } }) },
    'POST /v1/van-bills/Co%20A/2026-10/2/pay': (body) => ({ body: bill({ state: 'paid', paid: { at: 'x', by: 'u', on: D, via: body.via, ref: body.ref, amount: 1700 } }) }),
    'POST /v1/van-bills/Co%20A/2026-10/2/pull-rates': { status: 409, body: { statusCode: 409, code: 'no_van_rates', message: 'No rates set' } },
  } });
  Object.assign(rt.ctx._vb, { ym: '2026-10', per: 2, mode: 'one', sup: 'Co A' });
  rt.ctx.renderVanBill(); await rt.settle();
  rt.ctx.laOpsVanBills.send(); await rt.settle();
  assert.match(rt.hosts['vanbill-host'].innerHTML, /Mark paid/);
  rt.ctx.laOpsVanBills.pay(); await rt.settle();
  const pay = rt.requests.find((r) => r.path.endsWith('/pay'));
  assert.equal(pay.body.via, 'transfer'); assert.equal(pay.body.ref, 'transfer', 'ref is the second prompt');
  rt.ctx.laOpsVanBills.pullRates(); await rt.settle();
  assert.match(rt.toasts.at(-1).sub, /No rates set/);
});

// ── commissions ───────────────────────────────────────────────

const item = (id, over = {}) => ({ kind: 'tour_sale', id, booking_id: 'lg_1', voucher_ref: 'V1', label: 'Snorkel', date: D, seller: 'Noi',
  total: 1000, to_company: 800, commission: 200, collected: true, payout_id: null, ...over });

test('commissions: lists items and totals, pays out only the picked payable ones', async () => {
  let posted;
  const rt = runtime({ handlers: {
    'GET /v1/commissions': { body: { from: '2026-10-01', to: D, items: [item('ts1'), item('ts2', { collected: false }), item('ts3', { payout_id: 'cp_1' })],
      totals: [{ seller: 'Noi', commission: 600, paid: 200, unpaid: 400 }] } },
    'GET /v1/commission-payouts': { body: { payouts: [{ id: 'cp_1', seller: 'Noi', amount: 200, method: 'cash', paid_on: D, ref: null, note: null, items: [{}], voided_at: null }] } },
    'POST /v1/commission-payouts': (body) => { posted = body; return { status: 201, body: { id: 'cp_2' } }; },
    'POST /v1/commission-payouts/cp_1/void': { body: { id: 'cp_1', voided_at: 'x' } },
  } });
  rt.ctx.renderCommissions(); await rt.settle();
  const html = rt.hosts['commissions-host'].innerHTML;
  assert.match(html, /unpaid ฿400/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 1, 'only the collected, unpaid item can be picked');
  assert.match(rt.requests[0].path, /^\/v1\/commissions\?from=2026-10-01&to=/);
  rt.ctx.laOpsCommissions.pick('tour_sale|lg_1|ts1', true);
  rt.ctx.laOpsCommissions.pick('tour_sale|lg_1|ts2', true);   // not payable: ignored
  rt.ctx.laOpsCommissions.payOut(); await rt.settle();
  assert.deepEqual(plain(posted.items), [{ kind: 'tour_sale', booking_id: 'lg_1', id: 'ts1' }]);
  assert.equal(posted.seller, 'Noi'); assert.equal(posted.method, 'cash');
  rt.ctx.laOpsCommissions.voidPayout('cp_1'); await rt.settle();
  assert.ok(rt.requests.some((r) => r.path === '/v1/commission-payouts/cp_1/void'));
});

test('commissions: a refused payout shows the server message and reloads', async () => {
  const rt = runtime({ handlers: {
    'GET /v1/commissions': { body: { items: [item('ts1')], totals: [] } },
    'GET /v1/commission-payouts': { body: { payouts: [] } },
    'POST /v1/commission-payouts': { status: 409, body: { statusCode: 409, code: 'already_paid', message: 'Already paid (payout cp_9)' } },
  } });
  rt.ctx.renderCommissions(); await rt.settle();
  rt.ctx.laOpsCommissions.pick('tour_sale|lg_1|ts1', true);
  rt.ctx.laOpsCommissions.payOut(); await rt.settle();
  assert.match(rt.toasts[0].sub, /Already paid/);
  assert.equal(rt.requests.filter((r) => r.path.startsWith('/v1/commissions')).length, 2, 'reloaded after the refusal');
});
