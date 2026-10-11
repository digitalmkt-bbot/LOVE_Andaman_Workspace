import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/31-ops-pfm.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false, onWrite: () => {}, onChange: () => {} } };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent });
  return window.__laOpsPfmCompat;
}

test('PFM row mapping and request builders preserve server fields and exact payloads', () => {
  const c = compat();
  const row = c.mapRow({
    booking_id: 'bk_srv_1',
    version: 4,
    voucher_ref: 'VC-101',
    agent_id: 'ag_1',
    agent_name: 'Proforma Agent',
    sales_name: 'Khun Sale',
    kind: 'proforma',
    travel_date: '2026-10-15',
    route_id: 'r1',
    pax: 3,
    cutoff_at: '2026-10-14T11:00:00Z',
    past_cutoff: true,
    total: 4500,
    paid: 0,
    balance: 4500,
    invoice: { id: 'inv_1', number: 'INV-2610-0001', status: 'issued' },
    status: 'alert',
    decision: { decision: 'approved', approver: 'Khun Sale', by: 'staff1', at: '2026-10-14T12:00:00Z' },
    reminded_at: null,
    cot_deduct: 500
  });
  assert.equal(row.booking_id, 'bk_srv_1');
  assert.equal(row.version, 4);
  assert.equal(row.decision.decision, 'approved');
  assert.equal(row.decision.extendedBy, 'Khun Sale');
  assert.equal(row.cot_deduct, 500);
  assert.deepEqual(JSON.parse(JSON.stringify(c.toApproveBody('Khun Sale'))), { approver: 'Khun Sale' });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toRemindBody('2026-10-01', '2026-10-31'))), { from: '2026-10-01', to: '2026-10-31' });
});

function createRuntime(){
  const calls = [];
  let nextResolver = null;
  let pfmResponse = {
    from: '2026-10-15',
    to: '2026-10-15',
    rows: [{
      booking_id: 'bk_srv_1',
      version: 2,
      voucher_ref: 'VC-1',
      agent_id: 'ag_1',
      agent_name: 'Agent 1',
      sales_name: 'Sale A',
      kind: 'proforma',
      travel_date: '2026-10-15',
      route_id: 'r1',
      pax: 2,
      cutoff_at: '2026-10-14T11:00:00Z',
      past_cutoff: true,
      total: 3000,
      paid: 0,
      balance: 3000,
      invoice: { id: 'inv_1', number: 'INV-1', status: 'issued' },
      status: 'alert',
      decision: null,
      reminded_at: null,
      cot_deduct: 0
    }],
    totals: { count: 1, total: 3000, paid: 0, unpaid: 3000, collected_pct: 0, alert: 1, by_status: {} }
  };
  const SB_BOOKINGS = [{
    id: 'bk_client_1',
    opsId: 'bk_srv_1',
    opsVersion: 2,
    agentId: 'ag_1',
    total: 3000,
    ops: {},
    paymentSlips: []
  }];
  const window = {};
  const O = {
    enabled: () => true,
    today: () => '2026-10-15',
    get: async (path, q) => {
      calls.push({ method: 'GET', path, q });
      if(path === '/v1/pfm') return JSON.parse(JSON.stringify(pfmResponse));
      return {};
    },
    post: (path, body) => new Promise((resolve, reject) => {
      calls.push({ method: 'POST', path, body });
      nextResolver = { resolve, reject };
    }),
    bookingWrite: (method, path, bk, body) => new Promise((resolve, reject) => {
      calls.push({ method, path, body, version: bk && bk.opsVersion });
      nextResolver = { resolve, reject };
    }),
    queue: fn => Promise.resolve().then(fn),
    fail: (title, err) => calls.push({ fail: title, message: err && err.message }),
    wrote: kind => calls.push({ wrote: kind }),
    onWrite: () => {},
    onChange: () => {},
    money: {
      ensureLoaded: async () => true,
      createInvoice: async (agentId, bookingIds, opt) => {
        calls.push({ m1: 'createInvoice', agentId, bookingIds, opt });
        return { id: 'inv_prepay_1' };
      },
      recordPayment: async (invId, amt, method, opt) => {
        calls.push({ m1: 'recordPayment', invId, amt, method, opt });
        return { id: invId };
      }
    }
  };
  window.laOps = O;
  window.pfmPeriodRange = d => ({ from: d, to: d });
  window.pfmBookingsForPeriod = () => [];
  window.pfmIsProforma = () => true;
  window.pfmSalesName = () => 'Sale A';
  window.pfmCotWarn = () => null;
  window.acctBookingTotal = b => b.total || 0;
  window.acctBookingInvoice = () => null;
  window.renderDailyPFM = () => calls.push({ render: 'pfm' });
  window.pfmApproveTravel = () => 'legacy-approve';
  window.pfmHold = () => 'legacy-hold';
  window.pfmRemindAll = () => 'legacy-remind';
  window.pfmIssueInvoice = () => 'legacy-issue';
  window.pfmIssueAll = () => 'legacy-issue-all';
  window.pfmRecSubmit = () => 'legacy-rec-submit';

  const context = {
    window,
    document: { getElementById: () => ({ innerHTML: '' }) },
    console,
    Number,
    String,
    Object,
    Array,
    JSON,
    Date,
    Promise,
    encodeURIComponent,
    prompt: () => 'Khun Approver',
    confirm: () => true,
    alert: msg => calls.push({ alert: msg }),
    SB_BOOKINGS,
    _pfmDate: '2026-10-15',
    _pfmMode: 'daily',
    _pfmRec: null
  };
  vm.runInNewContext(SOURCE, context);
  return {
    window,
    context,
    calls,
    SB_BOOKINGS,
    setPfmResponse: val => { pfmResponse = val; },
    resolveNext: val => nextResolver.resolve(val),
    rejectNext: err => nextResolver.reject(err),
    tick: () => new Promise(r => setImmediate(r))
  };
}

test('PFM load, approve-travel, hold, remind, and M1 payment submit refresh server state without mutating bk.ops.pfm or bk.paymentSlips', async () => {
  const rt = createRuntime();
  await rt.window.renderDailyPFM();
  assert.ok(rt.calls.some(x => x.method === 'GET' && x.path === '/v1/pfm' && x.q.from === '2026-10-15'));

  // Approve travel: sends versioned POST /v1/bookings/:id/pfm/approve-travel
  const appP = rt.window.pfmApproveTravel('bk_client_1');
  await rt.tick();
  assert.equal(rt.SB_BOOKINGS[0].ops.pfm, undefined, 'bk.ops.pfm is never mutated before server responds');
  const appCall = rt.calls.find(x => x.path === '/v1/bookings/bk_srv_1/pfm/approve-travel');
  assert.ok(appCall);
  assert.equal(appCall.version, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(appCall.body)), { approver: 'Khun Approver' });

  // Rejected approve does not mutate local booking
  rt.rejectNext(new Error('before cutoff'));
  await appP;
  assert.equal(rt.SB_BOOKINGS[0].ops.pfm, undefined, 'rejected approve leaves bk.ops.pfm untouched');
  assert.ok(rt.calls.some(x => x.fail === 'Could not approve travel'));

  // Hold command succeeds and refreshes /v1/pfm
  const holdP = rt.window.pfmHold('bk_client_1');
  await rt.tick();
  const holdCall = rt.calls.find(x => x.path === '/v1/bookings/bk_srv_1/pfm/hold');
  assert.ok(holdCall);
  rt.setPfmResponse({
    from: '2026-10-15',
    to: '2026-10-15',
    rows: [{
      booking_id: 'bk_srv_1',
      version: 3,
      voucher_ref: 'VC-1',
      agent_id: 'ag_1',
      agent_name: 'Agent 1',
      sales_name: 'Sale A',
      kind: 'proforma',
      travel_date: '2026-10-15',
      route_id: 'r1',
      pax: 2,
      cutoff_at: '2026-10-14T11:00:00Z',
      past_cutoff: true,
      total: 3000,
      paid: 0,
      balance: 3000,
      invoice: { id: 'inv_1', number: 'INV-1', status: 'issued' },
      status: 'hold',
      decision: { decision: 'hold', approver: null, by: 'staff', at: '2026-10-14T13:00:00Z' },
      reminded_at: null,
      cot_deduct: 0
    }],
    totals: { count: 1, total: 3000, paid: 0, unpaid: 3000, collected_pct: 0, alert: 0, by_status: {} }
  });
  rt.resolveNext({
    booking_id: 'bk_srv_1',
    version: 3,
    kind: 'proforma',
    travel_date: '2026-10-15',
    route_id: 'r1',
    pax: 2,
    total: 3000,
    paid: 0,
    balance: 3000,
    status: 'hold',
    decision: { decision: 'hold', approver: null, by: 'staff', at: '2026-10-14T13:00:00Z' }
  });
  await holdP;
  assert.equal(rt.SB_BOOKINGS[0].ops.pfm, undefined, 'durable bk.ops.pfm is never written on SB_BOOKINGS');
  assert.equal(rt.SB_BOOKINGS[0].opsVersion, 3, 'booking version updated from server response');

  // Remind command sends POST /v1/pfm/remind {from,to}
  const remP = rt.window.pfmRemindAll();
  await rt.tick();
  const remCall = rt.calls.find(x => x.path === '/v1/pfm/remind');
  assert.ok(remCall);
  assert.deepEqual(JSON.parse(JSON.stringify(remCall.body)), { from: '2026-10-15', to: '2026-10-15' });
  rt.resolveNext({ reminded: ['bk_srv_1'] });
  await remP;

  // pfmRecSubmit delegates to M1 and does NOT write bk.paymentSlips[]
  rt.context._pfmRec = { bkId: 'bk_client_1', invId: null, prepay: true, amount: 1500, method: 'transfer', ref: 'REF-9', slips: [{ id: 'att_1', name: 'slip.jpg' }] };
  await rt.window.pfmRecSubmit();
  assert.equal(rt.SB_BOOKINGS[0].paymentSlips.length, 0, 'bk.paymentSlips[] is not written in ops mode');
  assert.ok(rt.calls.some(x => x.m1 === 'createInvoice' && x.opt.kind === 'prepay'));
  assert.ok(rt.calls.some(x => x.m1 === 'recordPayment' && x.invId === 'inv_prepay_1' && x.amt === 1500));
});

test('legacy mode delegates to original PFM functions without API requests', () => {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => false,
      get: () => { calls.push('api'); return Promise.resolve({}); },
      post: () => { calls.push('api'); return Promise.resolve({}); },
      onWrite: () => {},
      onChange: () => {}
    },
    pfmApproveTravel: id => { calls.push(['approve', id]); return 'ok'; },
    pfmHold: id => { calls.push(['hold', id]); return 'ok'; },
    pfmRemindAll: () => { calls.push(['remind']); return 'ok'; }
  };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent });
  assert.equal(window.pfmApproveTravel('b1'), 'ok');
  assert.equal(window.pfmHold('b1'), 'ok');
  assert.equal(window.pfmRemindAll(), 'ok');
  assert.equal(calls.includes('api'), false);
});
