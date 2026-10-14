// Row 173 · a trip's really-Thai heads (t.nat) travel to and from the server's trips[].thai_passengers
// (migration 241).  Before this the adapter never mapped it: Thai counts typed in the booking form were
// lost on reload and the park tickets fell back to the price tier (400 vs 40 baht).
//   node --test test/unit/ops-thai-passengers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(process.env.BOOKINGS_SRC || 'allotment_v2/js/ops/40-ops-bookings.js', 'utf8');

function load() {
  const ctx = { console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    SB_BOOKINGS: [] };
  ctx.window = ctx;
  ctx.laOps = new Proxy({ enabled: () => true }, { get: (t, k) => (k in t ? t[k] : () => null) });
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const bk = (trip) => ({ id: 'B1', status: 'confirmed', leadPax: 'A', trips: [Object.assign({ routeId: 'r1', date: '2026-11-01', pickupTime: '', pax: { ad_th: 1, ad_fr: 1, chd_fr: 1 } }, trip)], passengers: [] });
const sent = (ctx, trip) => ctx.laOps.bookings.toServer(bk(trip), true).trips[0];

test('toServer sends t.nat as thai_passengers (snake_case keys, all four)', () => {
  const ctx = load();
  const t = sent(ctx, { nat: { ad: 2, chd: 1, inf: 0, foc: 0 } });
  assert.equal(JSON.stringify(t.thai_passengers), JSON.stringify({ adults: 2, children: 1, infants: 0, free_of_charge: 0 }));
});

test('no count typed -> null (server: nobody checked, read the grid); all zeros is a real answer', () => {
  const ctx = load();
  assert.equal(sent(ctx, {}).thai_passengers, null);
  assert.equal(sent(ctx, { nat: { ad: '', chd: null } }).thai_passengers, null);
  assert.equal(JSON.stringify(sent(ctx, { nat: { ad: 0, chd: 0, inf: 0, foc: 0 } }).thai_passengers), JSON.stringify({ adults: 0, children: 0, infants: 0, free_of_charge: 0 }));
});

test('a count above its category heads is clamped (the pax was lowered after it was typed): the server would 400', () => {
  const ctx = load();
  const t = sent(ctx, { nat: { ad: 9, chd: 5, inf: 2, foc: 1 } });   // heads: ad 2 (1 th + 1 fr), chd 1, inf 0, foc 0
  assert.equal(JSON.stringify(t.thai_passengers), JSON.stringify({ adults: 2, children: 1, infants: 0, free_of_charge: 0 }));
});

test('fromServer maps thai_passengers back to t.nat; a trip without it has no nat', () => {
  const ctx = load();
  const st = (extra) => ({ id: 'ob_1', status: 'confirmed', passengers: [], trips: [Object.assign({ id: 't1', route_id: 'r1', service_date: '2026-11-01', pax: { ad_th: 1, ad_fr: 1 } }, extra)] });
  const got = ctx.laOps.bookings.fromServer(st({ thai_passengers: { adults: 2, children: 0, infants: 0, free_of_charge: 1 } }));
  assert.equal(JSON.stringify(got.trips[0].nat), JSON.stringify({ ad: 2, chd: 0, inf: 0, foc: 1 }));
  assert.equal(ctx.laOps.bookings.fromServer(st({})).trips[0].nat, undefined);
  assert.equal(ctx.laOps.bookings.fromServer(st({ thai_passengers: null })).trips[0].nat, undefined);
});
