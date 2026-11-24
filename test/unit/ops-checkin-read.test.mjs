// C-checkin-read: the booking GET carries trips[].operations.checkins {van:[],pier:[]} (snake_case
// records, operation-backend src/domain/checkin.ts). The LOAD (40-ops-bookings operationsFrom) must
// map them to bk.ops.pierCheckin / vanCheckin exactly as mergeTripOperations does after a write.
//   node --test test/unit/ops-checkin-read.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PICKUP = fs.readFileSync('allotment_v2/js/ops/00-ops-pickup.js', 'utf8');   // the one pickup reader (§pickupOneParser)
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
  vm.runInContext(PICKUP, ctx);
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

test('§opsVanMain: the main van part\'s group fills ops.vanGroup / vanId / vanSeq / vanReturnId on load (Re-confirm plate, check-in vans)', () => {
  const ctx = load();
  const ops = { van_parts: [{ idx: 0, source: 'main', ad: 1, chd: 0, inf: 0, foc: 0, sequence: 13, return_van_id: null,
    group: { id: 'vg4', number: 4, van_id: 'veh80', return_van_id: 'veh81', pickup_time: null } }], pickup_time_final: '05:00' };
  const bk = ctx.laOps.bookings.fromServer(server([{ id: 't1', route_id: 'r2', service_date: '2026-11-23', booking_mode: 'seat', pax: { ad_fr: 1 }, operations: ops }]));
  assert.deepEqual([bk.ops.vanGroup, bk.ops.vanId, bk.ops.vanSeq, bk.ops.vanReturnId, bk.ops.pickupTimeFinal], [4, 'veh80', 13, 'veh81', '05:00']);
  assert.equal(bk.ops.vanSplits, undefined, 'one main part is not a split');
  const none = ctx.laOps.bookings.fromServer(server([{ id: 't2', route_id: 'r2', service_date: '2026-11-23', booking_mode: 'seat', pax: { ad_fr: 1 }, operations: { van_parts: [{ idx: 0, source: 'main', ad: 1, group: null }] } }]));
  assert.equal(none.ops.vanId, undefined, 'no group: nothing set');
});
