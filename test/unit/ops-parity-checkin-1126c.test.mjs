// parity G1/G2 (2026-11-26, operation-backend fix/parity-checkin-1126c-qf):
//   G1 · cancellation.reason is the server's cancellation_reason (legacy's display text), which ckStrandWhy prints on the check-in rows
//   G2 · SB_BOOKINGS stays in legacy's booking-id order ("BK-…" before "b2c_…"), whatever order the server's answers arrive in
//   node --test test/unit/ops-parity-checkin-1126c.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PICKUP = fs.readFileSync('allotment_v2/js/ops/00-ops-pickup.js', 'utf8');
const SRC = fs.readFileSync('allotment_v2/js/ops/40-ops-bookings.js', 'utf8');
const LOADER = fs.readFileSync('allotment_v2/js/booking/bookingV2LoadFromOpsBackend.js', 'utf8');

function load() {
  const ctx = { console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    SB_BOOKINGS: [] };
  ctx.window = ctx;
  ctx.laOps = new Proxy({ enabled: () => true }, { get: (t, k) => (k in t ? t[k] : () => null) });
  vm.createContext(ctx);
  vm.runInContext(PICKUP, ctx);
  vm.runInContext(LOADER, ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const ob = (id, extra = {}) => ({ id: 'lg_' + id, external_id: id, status: 'confirmed', trips: [], passengers: [], ...extra });

test('G1: the cancel reason is the server\'s display text, else the label and the note', () => {
  const ctx = load();
  const bk = ctx.laOps.bookings.fromServer(ob('BK-1', { status: 'cancelled', cancellation_reason: 'Customer cancelled / changed plan (ลูกค้ายกเลิกเอง / เปลี่ยนแผน)',
    cancellation: { category: 'customer_cancel', note: null, charge_type: 'none', at: '2026-11-26T03:00:00Z', by: 'RSVN1' } }));
  assert.equal(bk.cancellation.reason, 'Customer cancelled / changed plan (ลูกค้ายกเลิกเอง / เปลี่ยนแผน)');
  const old = ctx.laOps.bookings.fromServer(ob('BK-2', { status: 'cancelled', cancellation: { category: 'other', note: 'typo' } }));
  assert.equal(old.cancellation.reason, 'other · typo', 'no display text: the label (here the code, no catalogue loaded) and the note');
});

test('G2: bookings land in legacy\'s id order, code unit by code unit', () => {
  const ctx = load();
  ['b2c_LOV-1601617_1', 'BK-26112309-46OE', 'BK-26090051-W2SC'].forEach((id) => ctx.laOps.bookings.upsert(ob(id)));
  ctx.window._opsBookingMerge([ctx.laOps.bookings.fromServer(ob('BK-26102401-YD97')), ctx.laOps.bookings.fromServer(ob('b2c_LOV-0007686_1'))]);
  assert.deepEqual(ctx.SB_BOOKINGS.map((b) => b.id), ['BK-26090051-W2SC', 'BK-26102401-YD97', 'BK-26112309-46OE', 'b2c_LOV-0007686_1', 'b2c_LOV-1601617_1']);
});
