// The booking GET carries slips:[{id,attachment_id,added_at,added_by}] (operation-backend
// POST/DELETE /v1/bookings/:id/slips). 40-ops-bookings.js maps them to bk.slips and treats them as
// server-owned: a merge replaces the local list, so a stale local slip cannot survive a refresh.
//   node --test test/unit/ops-booking-slips-map.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/40-ops-bookings.js', 'utf8');

function load() {
  const ctx = { console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    SB_BOOKINGS: [] };
  ctx.window = ctx;
  ctx.laOps = new Proxy({ enabled: () => true }, { get: (t, k) => (k in t ? t[k] : () => null) });
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const server = (slips) => ({ id: 'ob_1', status: 'confirmed', trips: [], passengers: [], slips });

test('fromServer maps booking slips (attachment_id -> attachmentId)', () => {
  const ctx = load();
  const bk = ctx.laOps.bookings.fromServer(server([{ id: 'bs_1', attachment_id: 'att_1', added_at: 'T', added_by: 'u' }, { attachment_id: 'no-id' }]));
  assert.equal(JSON.stringify(bk.slips), JSON.stringify([{ id: 'bs_1', attachmentId: 'att_1', addedAt: 'T', addedBy: 'u' }]));
});

test('a booking answered without slips has none; mergeInto takes the server list over the local one', () => {
  const ctx = load();
  assert.equal(ctx.laOps.bookings.fromServer(server(undefined)).slips.length, 0);
  const bk = ctx.laOps.bookings.fromServer(server([{ id: 'bs_1', attachment_id: 'att_1' }]));
  ctx.laOps.bookings.mergeInto(bk, server([{ id: 'bs_2', attachment_id: 'att_2' }]));
  assert.equal(JSON.stringify(bk.slips.map((s) => s.id)), JSON.stringify(['bs_2']));
  ctx.laOps.bookings.mergeInto(bk, server([]));
  assert.equal(bk.slips.length, 0);
});
