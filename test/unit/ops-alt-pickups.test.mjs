// A booking's alt pickups (extra pickup points) round-trip to the server whole. The server replaces the
// list on every write and defaults what is missing, so an adapter that sent only the area and drop-off
// fields zeroed each pickup's heads and blanked its name, place and zone on every save.
//   node --test test/unit/ops-alt-pickups.test.mjs
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
const bk = (altPickups) => ({ id: 'B1', status: 'confirmed', leadPax: 'A', altPickups, passengers: [],
  trips: [{ routeId: 'r1', date: '2026-11-01', pickupTime: '', pax: { ad_fr: 4, chd_fr: 1 } }] });
const pick = { who: 'Somchai family', qty: 3, ad: 2, chd: 1, inf: 0, foc: 0, areaId: 'pa_kata', area: 'Kata', zone: 'PK',
  place: 'Kata Palm Resort', dropSame: false, dropAreaId: 'pa_patong', dropZone: 'PK', dropPlace: 'Patong Beach Hotel' };

test('toServer sends each alt pickup whole: name, heads, area, zone, place, drop-off', () => {
  const sent = load().laOps.bookings.toServer(bk([pick]), true).altPickups[0];
  assert.equal(sent.who, 'Somchai family');
  assert.deepEqual([sent.ad, sent.chd, sent.inf, sent.foc], [2, 1, 0, 0]);
  assert.equal(sent.area, 'Kata');
  assert.equal(sent.zone, 'PK');
  assert.equal(sent.place, 'Kata Palm Resort');
  assert.equal(sent.areaId, 'pa_kata');
  assert.equal(sent.dropPlace, 'Patong Beach Hotel');
  assert.equal(sent.dropSame, false);
});

test('a legacy qty-only entry goes as adults, like the server reads it', () => {
  const sent = load().laOps.bookings.toServer(bk([{ who: 'X', qty: 3, areaId: 'pa_1' }]), true).altPickups[0];
  assert.deepEqual([sent.ad, sent.chd, sent.inf, sent.foc], [3, 0, 0, 0]);
});

test('fromServer keeps every field, so a load-then-save sends the same pickup back', () => {
  const ctx = load();
  const server = { id: 'ob_1', status: 'confirmed', passengers: [], trips: [{ id: 't1', route_id: 'r1', service_date: '2026-11-01', pax: { ad_fr: 4, chd_fr: 1 } }],
    alt_pickups: [{ who: 'Somchai family', ad: 2, chd: 1, inf: 0, foc: 0, area_id: 'pa_kata', area: 'Kata', zone: 'PK', place: 'Kata Palm Resort',
      drop_same: false, drop_area_id: 'pa_patong', drop_area: null, drop_zone: 'PK', drop_place: 'Patong Beach Hotel' }] };
  const loaded = ctx.laOps.bookings.fromServer(server);
  const a = loaded.altPickups[0];
  assert.equal(a.who, 'Somchai family');
  assert.deepEqual([a.ad, a.chd, a.inf, a.foc, a.qty], [2, 1, 0, 0, 3]);
  assert.equal(a.zone, 'PK');
  assert.equal(a.place, 'Kata Palm Resort');
  const resent = ctx.laOps.bookings.toServer(loaded, false).altPickups[0];
  assert.equal(resent.who, 'Somchai family');
  assert.deepEqual([resent.ad, resent.chd], [2, 1]);
  assert.equal(resent.place, 'Kata Palm Resort');
});
