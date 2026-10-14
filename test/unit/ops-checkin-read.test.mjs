// C-checkin-read: the booking GET carries trips[].operations.checkins {van:[],pier:[]} (snake_case
// records, operation-backend src/domain/checkin.ts). The LOAD (40-ops-bookings operationsFrom) must
// map them to bk.ops.pierCheckin / vanCheckin exactly as mergeTripOperations does after a write.
//   node --test test/unit/ops-checkin-read.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const B = fs.readFileSync('allotment_v2/js/ops/40-ops-bookings.js', 'utf8');
const D = fs.readFileSync('allotment_v2/js/ops/36-ops-day-actions.js', 'utf8');

function load() {
  const ctx = { console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, parseInt, parseFloat, isNaN, encodeURIComponent, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    SB_BOOKINGS: [] };
  ctx.window = ctx;
  const base = { enabled: () => true, clone: (x) => (x == null ? x : JSON.parse(JSON.stringify(x))) };
  ctx.laOps = new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => null), set: (t, k, v) => { t[k] = v; return true; } });
  vm.createContext(ctx);
  vm.runInContext(B, ctx);   // load order in the page: 40 before 36
  vm.runInContext(D, ctx);
  return ctx;
}
const rec = (kind, slot, extra) => Object.assign({ kind, slot, expected: 4, actual_pax: 3, no_show: 1, checked_in_at: '2026-10-20T01:00:00.000Z', checked_in_by: 'Pier A', events: [] }, extra);
const checkins = { van: [rec('van', 0), rec('van', 1, { actual_pax: 2, no_show: 2 })], pier: [rec('pier', 0, { flow: 'standby', arrived_by: 'X' })] };
const trip = (date, id, ck) => ({ id, route_id: 'r1', service_date: date, booking_mode: 'seat', pax: { ad_fr: 4 }, operations: { checkins: ck } });
const server = (trips) => ({ id: 'ob_1', status: 'confirmed', passengers: [], trips });
const J = (x) => JSON.parse(JSON.stringify(x));

test('load maps server checkins to pierCheckin / vanCheckin (slot 0 + _s for later slots)', () => {
  const ctx = load();
  const bk = ctx.laOps.bookings.fromServer(server([trip('2026-10-20', 't1', checkins)]));
  assert.equal(bk.ops.vanCheckin.expected, 4);
  assert.equal(bk.ops.vanCheckin.actualPax, 3);
  assert.equal(bk.ops.vanCheckin.by, 'Pier A');
  assert.equal(bk.ops.vanCheckin._s[1].actualPax, 2);
  assert.equal(bk.ops.pierCheckin.flow, 'standby');
  assert.equal(bk.ops.pierCheckin.arrivedBy, 'X');
});

test('load and mergeTripOperations (after a write) produce the same shape', () => {
  const ctx = load();
  const loaded = ctx.laOps.bookings.fromServer(server([trip('2026-10-20', 't1', checkins)]));
  const fresh = ctx.laOps.bookings.fromServer(server([trip('2026-10-20', 't1', { van: [], pier: [] })]));
  assert.equal(fresh.ops.pierCheckin, null);
  ctx.__laOpsDayActionsCompat.mergeTripOperations(fresh, '2026-10-20', trip('2026-10-20', 't1', checkins));
  assert.deepEqual(J(fresh.ops.pierCheckin), J(loaded.ops.pierCheckin));
  assert.deepEqual(J(fresh.ops.vanCheckin), J(loaded.ops.vanCheckin));
  assert.deepEqual(J(fresh.ops.checkins), J(loaded.ops.checkins));
});

test('a later service day keeps its check-ins on trip.ops; no records -> null', () => {
  const ctx = load();
  const bk = ctx.laOps.bookings.fromServer(server([trip('2026-10-20', 't1', { van: [], pier: [] }), trip('2026-10-22', 't2', checkins)]));
  assert.equal(bk.ops.vanCheckin, null);
  assert.equal(bk.trips[1].ops.vanCheckin.expected, 4);
});
