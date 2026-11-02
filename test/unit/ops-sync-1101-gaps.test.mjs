import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { runtime, plain } from './fe-harness.mjs';

// lk-inbox sync 2026-11-01 (compare-stack/sync-impact-1101.md): what the sync brought that saved only in the browser or showed less on main.
// Boat-level turn-back (§tbBoat), Insurance "Review all" per boat (§insBoat), people added at the pier (§paAdd) and Guest Insights (§guestIns).
const DAY = '2026-11-01';
const PRE = `
var SB_BOOKINGS = [
  { id: 'BK-1', opsId: 'ob_1', voucherRef: 'V1', ops: {}, trips: [{ date: '${DAY}', routeId: 'r1', opsTripId: 't_1', pax: { ad_fr: 4 } }], passengers: [] },
  { id: 'BK-2', opsId: 'ob_2', voucherRef: 'V2', ops: {}, trips: [{ date: '${DAY}', routeId: 'r1', opsTripId: 't_2', pax: { ad_fr: 2 } }], passengers: [] },
  { id: 'BK-3', opsId: 'ob_3', voucherRef: 'V3', ops: {}, trips: [{ date: '${DAY}', routeId: 'r1', opsTripId: 't_3', pax: { ad_fr: 2 } }], passengers: [] }];
var SB_EXTRAS = [];
function bkIsFirstDay(b, d){ return true; }
function bkOpsDate(b, d){ return d; }
function bkOpsFor(b, d){ return (b.ops = b.ops || {}); }
var called = []; function legacy(n){ return function(){ called.push(n); return 'legacy'; }; }
var tbBoatSave = legacy('tbBoatSave'), tbBoatRemove = legacy('tbBoatRemove'), paAddSave = legacy('paAddSave'), paAddUndo = legacy('paAddUndo'), paAddBillDone = legacy('paAddBillDone'),
  insReviewBoat = legacy('insReviewBoat'), insToggleReviewed = legacy('insToggleReviewed'), tbSave = legacy('tbSave'), tbRemove = legacy('tbRemove');
var closed = 0, after = [], walked = 0; function ckReasonClose(){ closed++; } function ckAfter(k){ after.push(k); } function ckGuard(){ return true; }
function paAddWalkOpen(){ walked++; }
function boatCapFor(){ return CAP; } function paBoatOcc(){ return 8; } var CAP = 60;
var MONEY = true; function paMoneyCan(){ return MONEY; }
function paAddsOf(b, d){ var a = (b.ops.pierCheckin && b.ops.pierCheckin.adds) || []; return a; }
function laCanEditArea(){ return true; } function laGuardEdit(){ return true; }
var ROWS = []; function tbBoatRows(){ return ROWS; }
var _tbB = {}, _pa = null;
var _insDate = '${DAY}', drew = 0;
function insTripsForDate(){ return [{ routeId: 'r1' }]; }
function insBoatsOf(){ return [{ bid: 'b1' }]; }
var INS = []; function insBoatRows(){ return { rows: INS }; }
function renderInsurance(){ drew++; }
`;
const form = (v, ticks = []) => ({
  getElementById: (id) => (id in v ? { value: v[id] } : null), querySelector: () => null, addEventListener: () => {}, activeElement: null,
  querySelectorAll: (sel) => (sel.includes('.tb-bk') ? ticks.map((value) => ({ checked: true, value })) : []),
});
const store = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
function rt(handlers, globals = {}, enabled = true) {
  const r = runtime({ files: [], handlers, pre: PRE, globals: { localStorage: store(), ...globals }, enabled });
  ['40-ops-bookings.js', '36-ops-day-actions.js'].forEach((f) => r.load(f));
  return r;
}
const wait = (r, ms = 1100) => new Promise((ok) => setTimeout(ok, ms)).then(() => r.settle());
const sent = (r, re) => r.requests.filter((q) => re.test(q.path) && q.method !== 'GET').map((q) => [q.method, q.path, q.body]);
const TB = (n) => ({ reason: 'weather', note: null, pax: n, money: { kind: 'pending', pct: null, amt: null, note: null, by: 'A', at: 'x' }, at: 'x', hm: '09:00', by: 'A', edited_at: null });
const rows = (r, list) => { r.ctx.ROWS = list; };

test('§tbBoat: one PUT per ticked booking, an unticked one with a record is withdrawn, a booking with neither is left alone', async () => {
  const r = rt({
    'PUT /operations/trip-ops/t_1/turn-back': { body: { trip: { operations: { turn_back: TB(4) } } } },
    'DELETE /operations/trip-ops/t_2/turn-back': { body: { trip: { operations: { turn_back: null } } } },
  }, { document: form({ 'tbb-note': 'wave', 'tbb-pct': '', 'tbb-mnote': '' }, ['BK-1']) });
  const [b1, b2, b3] = r.ctx.SB_BOOKINGS;
  b2.ops.turnBack = TB(2);
  rows(r, [{ b: b1, tb: null, booked: 4 }, { b: b2, tb: b2.ops.turnBack, booked: 2 }, { b: b3, tb: null, booked: 2 }]);
  r.ctx._tbB = { bid: 'b1', date: DAY, reason: 'weather', money: 'pending' };
  r.ctx.tbBoatSave(); await wait(r);
  assert.deepEqual(plain(sent(r, /turn-back/)), [
    ['PUT', '/operations/trip-ops/t_1/turn-back', { reason: 'weather', note: 'wave', money: { kind: 'pending', pct: null, amt: null, note: null } }],
    ['DELETE', '/operations/trip-ops/t_2/turn-back', null],
  ]);
  assert.equal(b1.ops.turnBack.pax, 4, 'the server\'s record');
  assert.equal(b2.ops.turnBack, undefined);
  assert.deepEqual([r.ctx.closed, plain(r.ctx.after)], [1, ['pier']]);
  assert.deepEqual(plain(r.ctx.called), [], 'not legacy\'s local save');
});

test('§tbBoat: "รอตกลง" keeps a money decision already made; a chosen refund goes to every booking', async () => {
  const r = rt({ 'PUT /operations/trip-ops/t_1/turn-back': { body: { trip: { operations: { turn_back: TB(4) } } } } }, { document: form({ 'tbb-note': '' }, ['BK-1']) });
  const b = r.ctx.SB_BOOKINGS[0];
  rows(r, [{ b, tb: { money: { kind: 'full', pct: null, amt: null, note: 'ok' } } }]);
  r.ctx._tbB = { bid: 'b1', date: DAY, reason: 'boat', money: 'pending' };
  r.ctx.tbBoatSave(); await wait(r);
  assert.equal(plain(sent(r, /turn-back/))[0][2].money.kind, 'full');
  const r2 = rt({}, { document: form({ 'tbb-pct': '' }, ['BK-1']) });
  rows(r2, [{ b: r2.ctx.SB_BOOKINGS[0], tb: null }]);
  r2.ctx._tbB = { bid: 'b1', date: DAY, reason: 'boat', money: 'refund' };
  r2.ctx.tbBoatSave(); await r2.settle();
  assert.match(r2.alerts[0], /refund %/);
  assert.deepEqual(sent(r2, /turn-back/), [], 'a refund with no % sends nothing');
});

test('§tbBoat: a refusal leaves the dialog open, says which booking, and the others stay saved', async () => {
  const r = rt({
    'PUT /operations/trip-ops/t_1/turn-back': { status: 409, body: { message: 'it did not sail' } },
    'PUT /operations/trip-ops/t_2/turn-back': { body: { trip: { operations: { turn_back: TB(2) } } } },
  }, { document: form({}, ['BK-1', 'BK-2']) });
  const [b1, b2] = r.ctx.SB_BOOKINGS;
  rows(r, [{ b: b1, tb: null }, { b: b2, tb: null }]);
  r.ctx._tbB = { bid: 'b1', date: DAY, reason: 'weather', money: 'pending' };
  r.ctx.tbBoatSave(); await wait(r);
  assert.equal(r.ctx.closed, 0);
  assert.equal(b2.ops.turnBack.pax, 2);
  assert.match(JSON.stringify(plain(r.toasts)), /Turn-back not saved · V1/);
});

test('§tbBoat: remove withdraws only the bookings with a record', async () => {
  const r = rt({ 'DELETE /operations/trip-ops/t_2/turn-back': { body: { trip: { operations: { turn_back: null } } } } }, { document: form({}) });
  const [b1, b2] = r.ctx.SB_BOOKINGS;
  rows(r, [{ b: b1, tb: null }, { b: b2, tb: TB(2) }]);
  r.ctx._tbB = { bid: 'b1', date: DAY };
  r.ctx.tbBoatRemove(); await wait(r);
  assert.deepEqual(plain(sent(r, /turn-back/)).map((x) => x[1]), ['/operations/trip-ops/t_2/turn-back']);
});

test('§insBoat: "Review all" sends each person; all reviewed unticks them all', async () => {
  const INSURED = { id: 'ob_1', status: 'confirmed', passengers: [], trips: [] };
  const r = rt({ 'PUT /v1/bookings/ob_1/insurance': { body: INSURED }, 'PUT /v1/bookings/ob_2/insurance': { body: { ...INSURED, id: 'ob_2' } } }, { document: form({}) });
  const [b1, b2] = r.ctx.SB_BOOKINGS;
  r.ctx.INS = [{ b: b1, p: { key: 'lead' }, rev: true }, { b: b2, p: { key: '0' }, rev: false }, { b: b2, p: null }];
  r.ctx.insReviewBoat('r1', 'b1'); await wait(r);
  assert.deepEqual(plain(sent(r, /insurance/)).map((x) => [x[1], /"reviewed":true/.test(JSON.stringify(x[2]))]),
    [['/v1/bookings/ob_1/insurance', true], ['/v1/bookings/ob_2/insurance', true]], 'not all reviewed: all ticked, the row with no person skipped');
  r.requests.length = 0;
  r.ctx.INS = [{ b: b1, p: { key: 'lead' }, rev: true }];
  r.ctx.insReviewBoat('r1', 'b1'); await wait(r);
  assert.match(JSON.stringify(plain(sent(r, /insurance/))[0][2]), /"reviewed":false/);
  assert.deepEqual(plain(r.ctx.called), []);
});

const PA = (over = {}) => ({ bid: 'b1', date: DAY, bk: 'BK-1', walk: false, n: { ad: 2, chd: 0, inf: 0, foc: 0 }, nat: 'fr', names: ['Ann', ' Bo '], pay: 'pier', method: 'transfer',
  price: { ad: 1500, chd: 1500 }, priceDef: { ad: 1500, chd: 1500 }, reason: '', ...over });
const SERVER_ADD = { id: 'pa_1', at: 'x', hm: '10:00', by: 'A', add: { ad: 2, chd: 0, inf: 0, foc: 0 }, nat: 'fr', names: ['Ann', 'Bo'], pay: 'pier', method: 'transfer', unit: { ad: 1500, chd: 1500 }, total: 3000,
  reason: null, sale_id: 'ex_1', slot: null, boat_id: null, bill: '', bill_by: null, bill_at: null, undone: null };
const SERVER_BOOKING = { id: 'ob_1', external_id: 'BK-1', status: 'confirmed', version: 3, passengers: [{ name: 'Ann', seq: 0 }],
  trips: [{ id: 't_1', route_id: 'r1', service_date: DAY, booking_mode: 'seat', pax: { ad_fr: 6 }, operations: { checkins: { van: [], pier: [] }, pier_adds: [SERVER_ADD] } }] };

test('the booking read maps pier_adds onto ops.pierCheckin.adds, with no check-in yet and beside one', () => {
  const r = rt({});
  const b = r.O.bookings.fromServer(SERVER_BOOKING);
  assert.deepEqual(plain(b.ops.pierCheckin.adds[0]), { id: 'pa_1', at: 'x', hm: '10:00', by: 'A', add: SERVER_ADD.add, nat: 'fr', names: ['Ann', 'Bo'], pay: 'pier', method: 'transfer', unit: SERVER_ADD.unit,
    total: 3000, reason: '', exId: 'ex_1', slot: null, bill: '', billBy: '', billAt: '' });
  const none = r.O.bookings.fromServer({ ...SERVER_BOOKING, trips: [{ ...SERVER_BOOKING.trips[0], operations: { checkins: { van: [], pier: [] } } }] });
  assert.equal(none.ops.pierCheckin, null, 'nothing at the pier: no check-in block');
});

test('§paAdd: the save goes to the server whole; the dialog closes on its answer and the sale is read back', async () => {
  const r = rt({
    'POST /operations/trip-ops/t_1/pier-adds': { status: 201, body: { booking: SERVER_BOOKING, add: SERVER_ADD } },
    'GET /v1/bookings/ob_1/tour-sales': { body: { tour_sales: [] } },
  }, { document: form({}) });
  r.ctx._pa = PA();
  r.ctx.paAddSave(); await wait(r);
  assert.deepEqual(plain(sent(r, /pier-adds/)), [['POST', '/operations/trip-ops/t_1/pier-adds', { add: { ad: 2, chd: 0, inf: 0, foc: 0 }, nat: 'fr', names: ['Ann', 'Bo'], pay: 'pier',
    unit: { ad: 1500, chd: 1500 }, reason: null, price_edited: false, boat_id: 'b1', method: 'transfer' }]]);
  assert.deepEqual([r.ctx.closed, plain(r.ctx.after), plain(r.ctx.called)], [1, ['pier'], []]);
  assert.ok(r.requests.some((q) => q.method === 'GET' && /tour-sales/.test(q.path)), 'the pier extra shows at once');
});

test('§paAdd: what the page refuses never reaches the server; a walk-in opens the booking form', async () => {
  const cases = [
    [PA({ n: { ad: 0, chd: 0, inf: 0, foc: 0 } }), /at least one/],
    [PA({ bk: '' }), /Pick a booking/],
    [PA({ pay: 'foc' }), /reason/],
    [PA({ price: { ad: 900, chd: 1500 } }), /reason/],
    [PA({ price: { ad: 0, chd: 0 }, priceDef: { ad: 0, chd: 0 } }), /price per person/],
  ];
  for (const [state, message] of cases) {
    const r = rt({}, { document: form({}) });
    r.ctx._pa = state;
    r.ctx.paAddSave(); await r.settle();
    assert.match(r.alerts[0], message);
    assert.deepEqual(sent(r, /pier-adds/), []);
  }
  const over = rt({}, { document: form({}) });
  over.ctx.CAP = 9; over.ctx._pa = PA();
  over.ctx.paAddSave(); await over.settle();
  assert.match(over.alerts[0], /Over the boat capacity/);
  const money = rt({}, { document: form({}) });
  money.ctx.MONEY = false; money.ctx._pa = PA({ pay: 'foc', reason: 'x' });
  money.ctx.paAddSave(); await money.settle();
  assert.match(money.alerts[0], /accounting edit rights/);
  const walk = rt({}, { document: form({}) });
  walk.ctx._pa = PA({ walk: true, bk: '' });
  walk.ctx.paAddSave(); await walk.settle();
  assert.equal(walk.ctx.walked, 1);
});

test('§paAdd: a refusal keeps the dialog open and changes nothing', async () => {
  const r = rt({ 'POST /operations/trip-ops/t_1/pier-adds': { status: 409, body: { message: 'it did not sail' } } }, { document: form({}) });
  r.ctx._pa = PA();
  r.ctx.paAddSave(); await wait(r);
  assert.equal(r.ctx.closed, 0);
  assert.deepEqual(plain(r.ctx.SB_BOOKINGS[0].trips[0].pax), { ad_fr: 4 });
});

test('§paAdd: undo and the agent bill go to the server by the record\'s id', async () => {
  const r = rt({
    'DELETE /operations/trip-ops/t_1/pier-adds/pa_1': { body: { booking: SERVER_BOOKING } },
    'POST /operations/trip-ops/t_1/pier-adds/pa_1/bill-done': { body: { booking: SERVER_BOOKING } },
    'GET /v1/bookings/ob_1/tour-sales': { body: { tour_sales: [] } },
  }, { document: form({}) });
  const b = r.ctx.SB_BOOKINGS[0];
  b.ops.pierCheckin = { adds: [{ id: 'pa_1', add: { ad: 2 } }] };
  r.ctx.paAddUndo('BK-1', DAY, 0); await wait(r);
  assert.deepEqual(plain(sent(r, /pier-adds/)).map((x) => [x[0], x[1]]), [['DELETE', '/operations/trip-ops/t_1/pier-adds/pa_1']]);
  r.requests.length = 0;
  r.ctx.paAddBillDone('BK-1', DAY, 'pa_1'); await wait(r);
  assert.deepEqual(plain(sent(r, /pier-adds/)).map((x) => [x[0], x[1]]), [['POST', '/operations/trip-ops/t_1/pier-adds/pa_1/bill-done']]);
  assert.deepEqual(plain(r.ctx.called), []);
});

test('§paAdd: a walk-in goes on the boat it came from once it is saved; a save that fails places nothing', async () => {
  const commit = `var _bkV2 = { newBooking: { _pierBoat: 'b7' } };
    function bookingV2CommitBooking(){ window._laOpsCommitSync = RESULT; return 'committed'; }`;
  const run = (result, handlers) => {
    const r = runtime({ files: [], handlers, pre: PRE + commit, globals: { localStorage: store(), RESULT: result, document: form({}) }, enabled: true });
    r.load('40-ops-bookings.js');
    return r;
  };
  const ok = run(Promise.resolve({ id: 'ob_9', trips: [{ id: 't_9' }] }), { 'PATCH /operations/trip-ops/t_9': { body: {} } });
  ok.ctx.bookingV2CommitBooking(); await wait(ok);
  assert.deepEqual(plain(sent(ok, /trip-ops/)), [['PATCH', '/operations/trip-ops/t_9', { boat_id: 'b7' }]]);
  const failed = Promise.reject(new Error('refused'));
  const no = run(failed, {});
  no.ctx.bookingV2CommitBooking(); await wait(no);
  assert.deepEqual(sent(no, /trip-ops/), []);
});

test('outside ops mode (lk-inbox itself) the new features are legacy\'s', () => {
  const r = rt({}, { document: form({}) }, false);
  r.ctx.tbBoatSave(); r.ctx.tbBoatRemove(); r.ctx.paAddSave(); r.ctx.paAddUndo(); r.ctx.paAddBillDone(); r.ctx.insReviewBoat();
  assert.deepEqual(plain(r.ctx.called), ['tbBoatSave', 'tbBoatRemove', 'paAddSave', 'paAddUndo', 'paAddBillDone', 'insReviewBoat']);
});

// ── Guest Insights ──
function guest({ enabled = true, load = null } = {}) {
  const host = { innerHTML: '' }, seen = [], toasts = [];
  const w = {
    laOps: { enabled: () => enabled, activeView: () => 'guestins', toast: (t) => toasts.push(t) },
    document: { getElementById: () => host },
    renderGuestInsights() { seen.push('drawn'); },
    giRange: () => ({ from: '2026-01-01', to: DAY }),
    // as the real one: a range answers its load once, then null
    bookingV2EnsureOpsRange: (r) => { seen.push(['load', r.from, r.to]); const l = load; load = null; return l; },
    Date,
  };
  vm.runInNewContext(fs.readFileSync('allotment_v2/js/ops/99-ops-guest-insights.js', 'utf8'), { window: w, document: w.document, Date });
  return { w, host, seen, toasts };
}
const tick = () => new Promise((r) => setImmediate(r));

test('§guestIns: the period is loaded by travel date first, with a note instead of partial numbers, then drawn', async () => {
  const g = guest({ load: Promise.resolve({ bookings: [] }) });
  g.w.renderGuestInsights();
  assert.match(g.host.innerHTML, /Loading the bookings/);
  assert.deepEqual(g.seen, [['load', '2026-01-01', DAY]]);
  await tick(); await tick();
  assert.ok(g.seen.length >= 2, 'drawn again once loaded');
});

test('§guestIns: already loaded draws at once; a failed load draws what there is and says so; legacy mode does not load', async () => {
  const done = guest({ load: null });
  done.w.renderGuestInsights();
  assert.deepEqual(done.seen, [['load', '2026-01-01', DAY], 'drawn']);
  const bad = guest({ load: Promise.reject(new Error('x')) });
  bad.w.renderGuestInsights();
  await tick(); await tick();
  assert.equal(bad.toasts.length, 1);
  assert.ok(bad.seen.includes('drawn'), 'not a loop: the second draw does not ask again');
  const off = guest({ enabled: false });
  off.w.renderGuestInsights();
  assert.deepEqual(off.seen, ['drawn']);
});
