import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// lk-inbox sync 2026-10-30: the turn-back after departure (tbSave / tbRemove → /operations/trip-ops/{trip}/turn-back) and
// Ticket Management's shared scratch board (pkbGet / pkbPut → /v1/pier-office/park-board/{date}).
const PRE = `
var SB_BOOKINGS = [{ id: 'BK-1', opsId: 'ob_1', ops: {}, trips: [{ date: '2026-10-29', routeId: 'r1', opsTripId: 't_1', pax: { ad_fr: 4 } }] }];
function bkIsFirstDay(b, d){ return true; }
function bkOpsDate(b, d){ return d; }
function bkOpsFor(b, d){ return (b.ops = b.ops || {}); }
var _tb = { bkId: 'BK-1', date: '2026-10-29', reason: 'weather', money: 'refund' };
var called = []; function legacy(n){ return function(){ called.push(n); }; }
var tbSave = legacy('tbSave'), tbRemove = legacy('tbRemove'), pkbGet = legacy('pkbGet'), pkbPut = legacy('pkbPut');
var closed = 0, after = []; function ckReasonClose(){ closed++; } function ckAfter(k){ after.push(k); } function ckGuard(){ return true; }
var PIER_CFG = {}; var _poDate = '2026-10-29'; var drawn = 0; function renderPierPark(){ drawn++; }
`;
const TB = { reason: 'weather', note: 'wave 2 m', pax: 3, money: { kind: 'refund', pct: 50, amt: null, note: 'agent OK', by: 'Pier A', at: '2026-10-29T02:00:00.000Z' },
  at: '2026-10-29T02:00:00.000Z', hm: '09:00', by: 'Pier A', edited_at: null };
const form = (v) => ({ getElementById: (id) => (id in v ? { value: v[id] } : null), querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, activeElement: null });
const store = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m }; };
function rt(handlers, globals = {}, enabled = true) {
  const r = runtime({ files: [], handlers, pre: PRE, globals: { localStorage: store(), ...globals }, enabled });
  ['40-ops-bookings.js', '36-ops-day-actions.js', '32-ops-park-board.js'].forEach((f) => r.load(f));
  return r;
}
const wait = (r, ms = 1100) => new Promise((ok) => setTimeout(ok, ms)).then(() => r.settle());

test('turn-back: the booking read maps turn_back into ops.turnBack', () => {
  const r = rt({});
  const b = r.O.bookings.fromServer({ id: 'ob_1', status: 'confirmed', passengers: [],
    trips: [{ id: 't_1', route_id: 'r1', service_date: '2026-10-29', booking_mode: 'seat', pax: { ad_fr: 4 }, operations: { checkins: {}, turn_back: TB } }] });
  assert.deepEqual(plain(b.ops.turnBack), { at: TB.at, hm: '09:00', by: 'Pier A', reason: 'weather', note: 'wave 2 m', pax: 3,
    money: { kind: 'refund', pct: 50, amt: null, note: 'agent OK', by: 'Pier A', at: TB.at } });
  assert.equal(r.O.bookings.turnBackFrom(null), null);
});

test('tbSave: the dialog goes to PUT …/turn-back; the record shown is the server\'s; the dialog closes', async () => {
  const doc = form({ 'tb-note': 'wave 2 m', 'tb-pct': '50', 'tb-amt': '', 'tb-mnote': 'agent OK' });
  const r = rt({ 'PUT /operations/trip-ops/t_1/turn-back': { body: { trip: { operations: { turn_back: TB } } } } }, { document: doc });
  r.ctx.tbSave(); await r.settle();
  assert.deepEqual(r.requests.map((q) => [q.method + ' ' + q.path, plain(q.body)]), [['PUT /operations/trip-ops/t_1/turn-back',
    { reason: 'weather', note: 'wave 2 m', money: { kind: 'refund', pct: 50, amt: null, note: 'agent OK' } }]]);
  assert.equal(plain(r.ctx.SB_BOOKINGS[0].ops.turnBack).pax, 3);
  assert.deepEqual([r.ctx.closed, plain(r.ctx.after), plain(r.ctx.called)], [1, ['pier'], []]);
});

test('tbSave refused: the server\'s message, nothing stored, the dialog stays; a refund with neither % nor ฿ is not sent', async () => {
  const r = rt({ 'PUT /operations/trip-ops/t_1/turn-back': { status: 409, body: { statusCode: 409, code: 'cancelled', message: 'Booking ob_1 is cancelled: it did not sail' } } },
    { document: form({ 'tb-pct': '10' }) });
  r.ctx.tbSave(); await r.settle();
  assert.equal(r.ctx.SB_BOOKINGS[0].ops.turnBack, undefined);
  assert.equal(r.ctx.closed, 0);
  assert.ok(r.toasts.some((t) => /did not sail/.test(t.sub)), JSON.stringify(r.toasts));
  const r2 = rt({}, { document: form({ 'tb-pct': '', 'tb-amt': '' }) });
  r2.ctx.tbSave(); await r2.settle();
  assert.equal(r2.requests.length, 0);
  assert.equal(r2.alerts.length, 1);
});

test('tbRemove: DELETE …/turn-back after the confirm; the record goes', async () => {
  const r = rt({ 'DELETE /operations/trip-ops/t_1/turn-back': { body: { trip: { operations: { turn_back: null } } } } });
  r.ctx.SB_BOOKINGS[0].ops.turnBack = { reason: 'weather' };
  r.ctx.tbRemove(); await r.settle();
  assert.deepEqual(r.requests.map((q) => q.method + ' ' + q.path), ['DELETE /operations/trip-ops/t_1/turn-back']);
  assert.equal(r.ctx.SB_BOOKINGS[0].ops.turnBack, undefined);
  assert.equal(r.confirms.length, 1);
});

test('scratch board: the server\'s board is shown; the device copy goes up only after the server says it has none', async () => {
  const has = rt({ 'GET /v1/pier-office/park-board/2026-10-29': { body: { date: '2026-10-29', text: 'ผญ 72 × 100', updated_at: '2026-10-29T03:00:00.000Z', updated_by: 'Pier.Mgr' } } });
  has.ctx.localStorage.setItem('la_pk_board_2026-10-29', 'my old sheet');
  assert.equal(has.ctx.pkbGet(), 'my old sheet', 'until the server answers: the device copy, not sent');
  await has.settle();
  assert.deepEqual([has.ctx.pkbGet(), has.ctx.drawn, plain(has.ctx.PIER_CFG.parkBoard['2026-10-29']).by], ['ผญ 72 × 100', 1, 'Pier.Mgr']);
  await wait(has, 300);
  assert.deepEqual(has.requests.map((q) => q.method + ' ' + q.path), ['GET /v1/pier-office/park-board/2026-10-29'], 'the server had a board: nothing moved up');

  const none = rt({ 'GET /v1/pier-office/park-board/2026-10-29': { body: { date: '2026-10-29', text: '', updated_at: null, updated_by: null } },
    'PUT /v1/pier-office/park-board/2026-10-29': (body) => ({ body: { date: '2026-10-29', text: body.text, updated_at: '2026-10-29T03:01:00.000Z', updated_by: 'me' } }) });
  none.ctx.localStorage.setItem('la_pk_board_2026-10-29', 'my old sheet');
  none.ctx.pkbGet(); await wait(none, 400);
  assert.deepEqual(none.requests.map((q) => [q.method + ' ' + q.path, plain(q.body)]), [['GET /v1/pier-office/park-board/2026-10-29', null], ['PUT /v1/pier-office/park-board/2026-10-29', { text: 'my old sheet' }]]);
});

test('scratch board: typing saves once, 1 s after the last key; what was typed stays even if an older save answers late', async () => {
  // the harness runs timers at once; the debounce needs the real ones
  const r = rt({ 'GET /v1/pier-office/park-board/2026-10-29': { body: { date: '2026-10-29', text: '', updated_at: null, updated_by: null } },
    'PUT /v1/pier-office/park-board/2026-10-29': (body) => ({ body: { date: '2026-10-29', text: body.text, updated_at: '2026-10-29T03:02:00.000Z', updated_by: 'me' } }) },
  { setTimeout, clearTimeout });
  r.ctx.pkbGet(); await r.settle();
  r.ctx.pkbPut('1'); r.ctx.pkbPut('1 +'); r.ctx.pkbPut('1 + 2');
  await wait(r);
  const puts = r.requests.filter((q) => q.method === 'PUT');
  assert.deepEqual(puts.map((q) => plain(q.body)), [{ text: '1 + 2' }]);
  assert.equal(r.ctx.pkbGet(), '1 + 2');
  assert.equal(r.ctx.localStorage.getItem('la_pk_board_2026-10-29'), '1 + 2', 'the device copy stays as the fallback');
});

test('ops off: the legacy board and turn-back functions run as before', () => {
  const r = rt({}, {}, false);
  r.ctx.pkbGet(); r.ctx.pkbPut('x'); r.ctx.tbSave(); r.ctx.tbRemove();
  assert.deepEqual(plain(r.ctx.called), ['pkbGet', 'pkbPut', 'tbSave', 'tbRemove']);
  assert.equal(r.requests.length, 0);
});
