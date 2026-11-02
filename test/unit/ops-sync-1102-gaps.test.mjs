import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// lk-inbox sync 2026-11-02: what the sync brought that saved only in the browser. Guaranteed upgrades (§upgPromise),
// Love Kingdom's pickup changes on fields staff edited (§b2cOvrSeen) and mask repair parts in the pier's stock (§poRpPier).
const DAY = '2026-11-02';
const PRE = `
function setInterval(){ return 1; } function clearInterval(){}
var SB_BOOKINGS = [
  { id: 'BK-1', opsId: 'ob_1', version: 3, leadPax: 'Ann', history: [], ops: {}, trips: [{ date: '${DAY}', routeId: 'r2', opsTripId: 't_1', pax: { ad_fr: 2 },
    upg: { fromRouteId: 'r1', toRouteId: 'r2', date: '${DAY}', kind: 'promise', boatId: 'b1' } }], passengers: [] },
];
var BOATS = [{ id: 'b1', name: 'Andaman 1' }, { id: 'b2', name: 'Andaman 2' }];
var TRIPS = {}, SB_SEAT_LOCKS = [];
function bkOpsDate(b, d){ return d; }
function bkOpsRead(b, d){ return b.ops; }
function bkOpsFor(b, d){ return b.ops; }
var called = []; function legacy(n){ return function(){ called.push(n); return 'legacy'; }; }
var bookingV2AssignBoat = legacy('assign'), bookingV2BoatAssignSelected = legacy('selected'), bkB2cOvrPending = legacy('pending'), bkB2cOvrDecide = legacy('decide');
var closed = 0; function bkB2cOvrClose(){ closed++; }
function acctPersistBookings(){}
var _pckDate = '${DAY}', moved = 0, afterKind = [];
function pckMoveOpen(){} function pckMoveCan(){} function pckMoveCtx(){} var pckMoveSave = legacy('pckMoveSave');
function pckMoveClose(){ moved++; } function ckAfter(k){ afterKind.push(k); } function ckGuard(){ return true; }
function ckTripOn(b, d){ return b.trips[0]; }
`;
const rt = (handlers, globals = {}, files = ['37-ops-boat-assign.js']) => {
  const r = runtime({ files: [], handlers, pre: PRE, globals: { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, ...globals } });
  files.forEach((f) => r.load(f));
  return r;
};
const sent = (r, re) => r.requests.filter((q) => re.test(q.path) && q.method !== 'GET').map((q) => q.body);
const opsAfter = (over) => ({ boat_id: 'b2', boat_splits: [], boat_pulled: false, upgrade: { kind: 'promise', promised_boat_id: 'b2', broken: [{ from: 'b1', to: 'b2', reason: 'engine' }] }, ...over });
const guarded = { status: 409, body: { code: 'guaranteed_boat', message: 'promised' } };

test('§upgPromise: a read gives legacy\'s trip.upg its kind, boat and log; an old upgrade is a seat-fill', () => {
  const r = rt({}, {}, ['40-ops-bookings.js']);
  const trip = (upgrade) => ({ id: 't', route_id: 'r2', service_date: DAY, pax: {}, operations: { upgrade } });
  const up = { from_route_id: 'r1', to_route_id: 'r2', to_date: DAY, kind: 'promise', promised_boat_id: 'b1', broken: [{ from: 'b0', to: 'b1', reason: 'x' }] };
  const out = r.ctx.laOpsFromServer({ id: 'x', status: 'confirmed', trips: [trip(up), trip({ from_route_id: 'r1', to_route_id: 'r2', to_date: DAY })] });
  assert.deepEqual([out.trips[0].upg.kind, out.trips[0].upg.boatId, plain(out.trips[0].upg.broken)], ['promise', 'b1', plain(up.broken)]);
  assert.deepEqual([out.trips[1].upg.kind, out.trips[1].upg.boatId, out.trips[1].upg.broken], ['fill', undefined, undefined]);
});

test('§upgPromise: moving a promised booking asks for the reason and sends it; the promise follows on screen', async () => {
  let n = 0;
  const r = rt({ 'PATCH /operations/trip-ops/t_1': (body) => (n++ === 0 ? guarded : { body: { trip: { operations: opsAfter() } } }) }, { prompt: (m) => { assert.match(m, /promised boat Andaman 1 on 2026-11-02[\s\S]*to Andaman 2/); return ' engine '; } });
  await r.ctx.bookingV2AssignBoat('BK-1', 'b2', DAY);
  await r.settle();
  assert.deepEqual(plain(sent(r, /trip-ops/)), [{ boat_id: 'b2' }, { boat_id: 'b2', promise_reason: 'engine' }]);
  const b = r.ctx.SB_BOOKINGS[0];
  assert.deepEqual([b.ops.boatId, b.trips[0].upg.boatId, b.trips[0].upg.broken.length], ['b2', 'b2', 1]);
});

test('§upgPromise: staff cancel the reason and nothing moves; a booking taken off every boat goes back to seat-fill', async () => {
  const r = rt({ 'PATCH /operations/trip-ops/t_1': guarded }, { prompt: () => null });
  await r.ctx.bookingV2AssignBoat('BK-1', 'b2', DAY);
  await r.settle();
  assert.equal(r.requests.length, 1, 'no second try');
  assert.equal(r.ctx.SB_BOOKINGS[0].trips[0].upg.boatId, 'b1');
  const q = rt({ 'PATCH /operations/trip-ops/t_1': (body) => (body.promise_reason ? { body: { trip: { operations: opsAfter({ boat_id: null, upgrade: { kind: 'fill', promised_boat_id: null, broken: [{}] } }) } } } : guarded) }, { prompt: (m) => { assert.match(m, /off the boat/); return 'trip merged'; } });
  await q.ctx.bookingV2AssignBoat('BK-1', null, DAY);
  await q.settle();
  const u = q.ctx.SB_BOOKINGS[0].trips[0].upg;
  assert.deepEqual([u.kind, u.boatId], ['fill', undefined]);
});

test('§upgPromise: a bulk assign skips the promised row and does not stop to ask', async () => {
  const r = rt({ 'PATCH /operations/trip-ops/t_1': guarded }, { _bkV2BoatSel: { 'BK-1': true }, prompt: () => { throw new Error('a bulk move never asks'); } });
  await r.ctx.bookingV2BoatAssignSelected(DAY, 'r2', 'b2');
  await r.settle();
  assert.match(r.alerts[0], /Skipped 1: Ann \(guaranteed_boat\)/);
});

test('§upgPromise: the pier move asks too', async () => {
  let n = 0;
  const doc = { getElementById: (id) => ({ pmvwhy: { value: 'group' }, pmvnote: { value: '' } }[id] || null), querySelector: () => ({ value: 'b2' }), querySelectorAll: () => [], addEventListener: () => {} };
  const r = rt({ 'POST /operations/trip-ops/t_1/pier-move': () => (n++ === 0 ? guarded : { body: { trip: { operations: opsAfter() } } }) }, { document: doc, prompt: () => 'merged at the pier' }, ['37-ops-boat-assign.js', '83-ops-pier-move.js']);
  r.ctx.pckMoveSave('BK-1');
  await r.settle();
  assert.deepEqual(plain(sent(r, /pier-move/)), [{ boat_id: 'b2', reason: 'group' }, { boat_id: 'b2', reason: 'group', promise_reason: 'merged at the pier' }]);
  assert.deepEqual([r.ctx.moved, r.ctx.SB_BOOKINGS[0].trips[0].upg.boatId], [1, 'b2']);
});

test('§b2cOvrSeen: a read carries what is waiting; the flag reads it, in legacy\'s order, without the ones decided', () => {
  const r = rt({}, {}, ['40-ops-bookings.js', '44-ops-b2c-health.js']);
  const held = {
    pickuparea: { label: 'จุดรับ', from: 'A', to: 'B', at: 't2', decided_at: null }, hotelname: { label: 'ที่พัก', from: 'C', to: 'D', at: 't1', decided_at: null },
    pickupzone: { label: 'โซนรับ', from: 'E', to: 'F', at: 't3', decided_at: 't4' },
  };
  const b = r.ctx.laOpsFromServer({ id: 'x', status: 'confirmed', trips: [], b2c_override: ['hotelname'], b2c_held: held });
  assert.deepEqual(plain(b.b2cOverride), ['hotelname']);
  assert.deepEqual(plain(r.ctx.bkB2cOvrPending(b).map((x) => x.col)), ['hotelname', 'pickuparea']);
  assert.deepEqual(plain(r.ctx.bkB2cOvrPending({})), []);
});

test('§b2cOvrSeen: Use B2C goes to the server first and takes the booking it answers', async () => {
  const answer = { id: 'ob_1', version: 4, status: 'confirmed', hotel_name: 'Theirs', trips: [], b2c_override: [], b2c_held: {}, warnings: [{ code: 'pickup_area_unmatched', message: 'check the zone' }] };
  const r = rt({ 'POST /v1/bookings/ob_1/b2c-held/use': { body: answer } }, {}, ['40-ops-bookings.js', '44-ops-b2c-health.js']);
  await r.ctx.bkB2cOvrDecide('BK-1', 'use');
  await r.settle();
  assert.equal(r.requests.filter((q) => /b2c-held/.test(q.path)).length, 1);
  assert.deepEqual([r.ctx.SB_BOOKINGS[0].hotelName, r.ctx.closed, plain(r.ctx.called)], ['Theirs', 1, []]);
  assert.deepEqual(plain(r.alerts), ['check the zone']);
});

test('§b2cOvrSeen: a refusal leaves the dialog open', async () => {
  const r = rt({ 'POST /v1/bookings/ob_1/b2c-held/keep': { status: 409, body: { code: 'nothing_held', message: 'nothing' } } }, {}, ['40-ops-bookings.js', '44-ops-b2c-health.js']);
  await r.ctx.bkB2cOvrDecide('BK-1', 'keep');
  await r.settle();
  assert.equal(r.ctx.closed, 0);
});

test('off the backend, both go to legacy', () => {
  const r = runtime({ files: [], pre: PRE, enabled: false, globals: { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } } });
  ['40-ops-bookings.js', '44-ops-b2c-health.js'].forEach((f) => r.load(f));
  assert.equal(r.ctx.bkB2cOvrPending({}), 'legacy');
  assert.equal(r.ctx.bkB2cOvrDecide('BK-1', 'use'), 'legacy');
});

// ── Mask repair parts ──
const PIER = `
var _poPier = 'panwa', _poDate = '${DAY}', PIER_MOVES = [], PIER_CFG = {}, FL_CONSUMABLE_LOGS = [], modalClosed = 0, drew = 0, guard = true;
var _poFix = { itemId: 'pi_m', boat: 'b1', parts: [{ id: 'pi_p', q: 2 }, { id: 'pi_q', q: 0 }], f: 2, w: 1, note: ' new straps ' };
function poGuard(){ return guard; } function poFixSync(){} function poNum(v){ return +v || 0; } function poV(id){ return ({ pofix: 2, pofixw: 1 })[id]; }
function poModalClose(){ modalClosed++; } function renderPierOffice(){ drew++; }
var poFixSave = legacy('poFixSave');
`;
const office = (handlers, confirm) => {
  const r = runtime({ files: [], handlers, pre: PRE + PIER, confirm, globals: { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } } });
  ['42-ops-pier-core.js', '48-ops-pier-office.js'].forEach((f) => r.load(f));
  r.O.pier.loaded = true;
  return r;
};
const fixed = { moves: [
  { id: 'pm_1', pier: 'panwa', date: DAY, item_id: 'pi_m', boat_id: null, type: 'fixed', qty: 2, for_boat_id: 'b1', note: 'new straps', recorded_at: 't' },
  { id: 'pm_2', pier: 'panwa', date: DAY, item_id: 'pi_p', boat_id: null, type: 'part_use', qty: 2, for_boat_id: 'b1', fix_item_id: 'pi_m', fix_qty: 2, unit_cost: 40, cost: 80, consumable_id: 'cons_1', recorded_at: 't' },
], consumables: [{ id: 'cons_1' }], balances: [] };
const URL = 'POST /v1/pier-office/panwa/stock/repair-done';

test('§poRpPier: repair done goes to the server as one write and shows what it answers', async () => {
  const r = office({ [URL]: { status: 201, body: fixed } });
  await r.ctx.poFixSave('pi_m');
  await r.settle();
  assert.deepEqual(plain(sent(r, /repair-done/)), [{ date: DAY, item_id: 'pi_m', fixed: 2, written_off: 1, parts: [{ item_id: 'pi_p', qty: 2 }], boat_id: 'b1', note: 'new straps' }]);
  const [fix, part] = r.ctx.PIER_MOVES;
  assert.equal(fix.boatId, 'b1');
  assert.deepEqual([part.boatId, part.forBoat, part.fixItem, part.fixQty, part.unitCost, part.cost, part.consumeId], ['', 'b1', 'pi_m', 2, 40, 80, 'cons_1']);
  assert.deepEqual([r.ctx._poFix, r.ctx.modalClosed, r.ctx.drew > 0, plain(r.ctx.called)], [null, 1, true, []]);
});

test('§poRpPier: a part short asks first, and saves with allow_short; a no leaves the dialog open', async () => {
  const short = { status: 409, body: { code: 'stock_short', message: 'อะไหล่ในคลังท่าไม่พอ: Strap (มี 1)' } };
  const yes = office({ [URL]: (b) => (b.allow_short ? { status: 201, body: fixed } : short) });
  await yes.ctx.poFixSave('pi_m');
  await yes.settle();
  assert.deepEqual(plain(sent(yes, /repair-done/).map((b) => !!b.allow_short)), [false, true]);
  assert.equal(yes.ctx.modalClosed, 1);
  const no = office({ [URL]: short }, () => false);
  await no.ctx.poFixSave('pi_m');
  await no.settle();
  assert.deepEqual([sent(no, /repair-done/).length, no.ctx.modalClosed, no.ctx.PIER_MOVES.length], [1, 0, 0]);
  assert.match(no.confirms[0], /ไม่พอ[\s\S]*ยืนยัน/);
});

test('§poRpPier: a void on the Fleet side says the part goes back to the pier, and the pier reads again', async () => {
  const r = runtime({ files: [], handlers: {
    'DELETE /v1/fleet/consumables/cons_1': { status: 204 },
    'GET /v1/fleet/stock-items': { body: { items: [] } }, 'GET /v1/fleet/memos': { body: { memos: [] } },
    'GET /v1/fleet/consumables': { body: { consumables: [{ id: 'c', item_id: null, warehouse: null, pier: 'panwa', pier_move_id: 'pm_2', fix_item_id: 'pi_m', fix_qty: 2, boat_id: null }] } },
  }, pre: `${PRE}var LA_PIER_NAME = { panwa: { en: 'Visit Panwa' } }, FL_CONSUMABLE_LOGS = [{ id: 'cons_1', qty: 2, unit: 'อัน', pier: 'panwa' }], FL_INVENTORY = [], FL_MEMOS = []; function flConsumeDelete(){} function laCanEditArea(){ return true; }`, globals: { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } } });
  let stale = '';
  r.O.pierStockStale = (p) => { stale = p; };
  r.load('25-ops-fleet-stock.js');
  await r.ctx.flConsumeDelete('cons_1');
  await r.settle();
  assert.match(r.confirms[0], /อะไหล่ 2 อัน จะคืนเข้าคลังท่า/);
  assert.equal(stale, 'panwa');
  const c = r.ctx.FL_CONSUMABLE_LOGS[0];
  assert.deepEqual([c.location, c.src, c.pierMoveId, c.boatId, c.warehouse], ['คลังท่า Visit Panwa', 'pier_fix', 'pm_2', '', ''], 'read back, a part shows the pier as its store');
});
