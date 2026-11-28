import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// §vanRefetchCalm (2026-11-28): which /v1/changes events make an open tab read a van day again.
const PICKUP = fs.readFileSync('allotment_v2/js/ops/00-ops-pickup.js', 'utf8');
const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
function ops() {
  const ctx = { console, Promise, Error, JSON, Object, Array, Set, Map, Number, String, Math, Date, setTimeout, clearTimeout,
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, setItem() {} }, document: { querySelector: () => null, addEventListener() {} },
    addEventListener() {}, fetch: () => Promise.reject(new Error('no network')) };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(PICKUP, ctx);
  vm.runInContext(CORE, ctx);
  return ctx.laOps;
}

test('a change touches a day only when its kind is a van-day kind and it names that day (or no day)', () => {
  const O = ops();
  const on = (d) => ({ route_id: 'r1', service_date: d });
  assert.equal(O.touches({ kind: 'booking', route_days: [on('2026-11-28')] }, O.VAN_DAY_KINDS, '2026-11-28'), true);
  assert.equal(O.touches({ kind: 'booking', route_days: [on('2026-12-15')] }, O.VAN_DAY_KINDS, '2026-11-28'), false);
  assert.equal(O.touches({ kind: 'van', route_days: null }, O.VAN_DAY_KINDS, '2026-11-28'), true);
  assert.equal(O.touches({ kind: 'seat_lock', route_days: [on('2026-11-28')] }, O.VAN_DAY_KINDS, '2026-11-28'), false);
  assert.equal(O.touches({ kind: 'invoice', route_days: null }, O.VAN_DAY_KINDS, '2026-11-28'), false);
  assert.equal(O.touches({ kind: 'booking', route_days: [on('2026-12-15')] }, O.VAN_DAY_KINDS), true, 'no date asks about any day');
  assert.equal(O.touches(null, O.VAN_DAY_KINDS, '2026-11-28'), false);
});

test("the feed's 'remote:' echo is not this tab's own write", () => {
  const O = ops();
  assert.equal(O.ownWrite('remote:booking'), false);
  assert.equal(O.ownWrite('van-arrival'), true);
  assert.equal(O.ownWrite(undefined), true);
});
