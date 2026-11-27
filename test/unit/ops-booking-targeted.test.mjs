// §targetedWrites (2026-11-27) · a booking edit sends only what changed (40-ops-bookings.js planEdit): one list item through its
// endpoint (operation-backend booking-items.ts), else the changed header fields and only the lists that changed.
//   node --test test/unit/ops-booking-targeted.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PICKUP = fs.readFileSync('allotment_v2/js/ops/00-ops-pickup.js', 'utf8');
const SRC = fs.readFileSync(process.env.BOOKINGS_SRC || 'allotment_v2/js/ops/40-ops-bookings.js', 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));

function load() {
  const ctx = { console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    encodeURIComponent, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} }, SB_BOOKINGS: [] };
  ctx.window = ctx;
  ctx.laOps = new Proxy({ enabled: () => true }, { get: (t, k) => (k in t ? t[k] : () => null) });
  vm.createContext(ctx);
  vm.runInContext(PICKUP, ctx);
  vm.runInContext(SRC, ctx);
  return ctx.laOps.bookings;
}
const server = () => ({
  id: 'ob_1', external_id: 'B1', status: 'confirmed', version: 4, lead_pax: 'Anna', notes: 'n', passengers: [],
  trips: [{ id: 't1', route_id: 'r1', service_date: '2026-12-01', pax: { ad: 2, chd: 1 }, zone: 'PK', pickup_time: '07:30', lock_draws: {}, thai_passengers: null }],
  adjustments: [{ seq: 0, kind: 'discount', mode: 'amount', value: 100, label: 'Repeat' }],
  alt_pickups: [{ who: 'Mr B', ad: 1, chd: 0, inf: 0, foc: 0, area_id: null, area: 'Kata', zone: 'PK', place: 'Kata Palm', drop_same: false, drop_area_id: null, drop_area: '', drop_zone: '', drop_place: '' }],
  upgrades: [{ id: 'u1', label: 'Speedboat', sell_price: 500, to_company: 300, collected: false, settle: 'pending', fee_pct: 0, slips: [] }],
  allergy_list: [{ name: 'Peanut', qty: 1 }], attachments: [],
});
const edit = (fn) => { const B = load(); const bk = B.fromServer(server()); fn(bk); return plain(B.planEdit(bk, B.toServer(bk, false))); };

test('no change: an empty PATCH (the server still answers and moves the version, as the whole PATCH did)', () => {
  assert.deepEqual(edit(() => {}), { patch: {} });
});

test('a header field: only that field', () => {
  assert.deepEqual(edit((bk) => { bk.leadPax = 'Anna Smith'; }), { patch: { leadPax: 'Anna Smith' } });
});

test('one trip changed: PATCH /trips/{id} with the changed fields only', () => {
  assert.deepEqual(edit((bk) => { bk.trips[0].pax = { ad: 3, chd: 1 }; }), { item: { method: 'PATCH', path: '/trips/t1', body: { pax: { ad: 3, chd: 1 } } } });
  assert.deepEqual(edit((bk) => { bk.trips[0].pickupTime = '08:00-08:15'; }).item.body, { pickupTime: '08:00', pickupTimeEnd: '08:15', pickup_text: '08:00-08:15' });
});

test('a trip added at the end: POST /trips; removed: DELETE /trips/{id}', () => {
  const add = edit((bk) => { bk.trips.push({ routeId: 'r1', date: '2026-12-02', pax: { ad: 1 }, pickupTime: '' }); });
  assert.equal(add.item.method, 'POST'); assert.equal(add.item.path, '/trips'); assert.equal(add.item.body.date, '2026-12-02');
  const B = load(); const ob = server(); ob.trips.push({ id: 't2', route_id: 'r1', service_date: '2026-12-02', pax: { ad: 1 }, lock_draws: {}, thai_passengers: null });
  const bk = B.fromServer(ob); bk.trips.splice(1, 1);
  assert.deepEqual(plain(B.planEdit(bk, B.toServer(bk, false))), { item: { method: 'DELETE', path: '/trips/t2', body: {} } });
});

test('adjustments, alternate pickups and allergies by position; upgrades by id', () => {
  assert.deepEqual(edit((bk) => { bk.adjustments.push({ kind: 'extra', mode: 'amount', value: 50 }); }),
    { item: { method: 'POST', path: '/adjustments', body: { kind: 'extra', mode: 'amount', value: 50 } } });
  assert.deepEqual(edit((bk) => { bk.adjustments[0].value = 150; }), { item: { method: 'PATCH', path: '/adjustments/0', body: { value: 150 } } });
  assert.deepEqual(edit((bk) => { bk.altPickups = []; }), { item: { method: 'DELETE', path: '/alt-pickups/0', body: {} } });
  assert.deepEqual(edit((bk) => { bk.specialMeals.allergyList.push({ name: 'Milk', qty: 2 }); }), { item: { method: 'POST', path: '/allergies', body: { name: 'Milk', qty: 2 } } });
  assert.deepEqual(edit((bk) => { bk.upgrades[0].sellPrice = 650; }), { item: { method: 'PATCH', path: '/upgrades/u1', body: { sell_price: 650 } } });
});

test('more than one change is ONE PATCH: the changed header fields and only the lists that changed, whole', () => {
  const r = edit((bk) => { bk.notes = 'm'; bk.adjustments.push({ kind: 'extra', mode: 'amount', value: 50 }); });
  assert.deepEqual(Object.keys(r.patch).sort(), ['adjustments', 'notes']);
  assert.equal(r.patch.adjustments.length, 2);
  const two = edit((bk) => { bk.adjustments[0].value = 150; bk.allergyList = null; bk.specialMeals.allergyList.push({ name: 'Milk', qty: 2 }); });
  assert.deepEqual(Object.keys(two.patch).sort(), ['adjustments', 'allergy_list'], 'two list items: one request, no trips sent');
});

test('a reorder or an insert in the middle has no item form: that list goes whole in the PATCH', () => {
  const r = edit((bk) => { bk.adjustments.unshift({ kind: 'extra', mode: 'amount', value: 50 }); });
  assert.deepEqual(Object.keys(r.patch), ['adjustments']);
});

test('the rate choice ("use today\'s rate") goes with the item write too', () => {
  const B = load(); const bk = B.fromServer(server()); bk.trips[0].pax = { ad: 4 };
  const body = B.toServer(bk, false); body.rate = 'agent';
  assert.deepEqual(plain(B.planEdit(bk, body)).item.body, { pax: { ad: 4 }, rate: 'agent' });
});

test('a booking this tab never read from the server is sent whole', () => {
  const B = load(); const bk = { id: 'B9', opsId: 'ob_9', trips: [], status: 'confirmed' };
  const body = B.toServer(bk, false);
  assert.deepEqual(plain(B.planEdit(bk, body)), { patch: plain(body) });
});
