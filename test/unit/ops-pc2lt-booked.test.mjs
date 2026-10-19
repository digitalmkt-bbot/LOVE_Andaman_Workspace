// The on-screen longtail month view (pc2LT / pc2LTDay) takes its booked join heads / charter boats from the server's sheet
// (days[].booked, sheet-level booked), over whatever the browser summed; undefined keeps legacy's own sum.
//   node --test test/unit/ops-pc2lt-booked.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/82-ops-w5c-pier.js', 'utf8');
const APP = fs.readFileSync('allotment_v2/js/08-app.js', 'utf8');

function load({ enabled = true, sheet = {} } = {}) {
  const ctx = { console, JSON, Array, String, Object, Math };
  ctx.window = ctx;
  ctx._pcYM = '2026-10';
  ctx.laOps = { enabled: () => enabled, onWrite() {}, onChange() {}, pierCash: { cache: { sheet } } };
  ctx.pcSheetBooked = () => null;           // 08-app.js stub
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const sheet = { 'longtail|p1|2026-10': { month: '2026-10', booked: { join_heads: 40, charter_boats: 5 },
  days: [{ date: '2026-10-03', booked: { join_heads: 12, charter_boats: 2 } }] } };

test('day and month answers come from the server sheet', () => {
  const c = load({ sheet });
  assert.deepEqual({ ...c.pcSheetBooked('lt', 'p1', '2026-10-03') }, { join_heads: 12, charter_boats: 2 });
  assert.deepEqual({ ...c.pcSheetBooked('lt', 'p1', null) }, { join_heads: 40, charter_boats: 5 });
});

test('a tampered browser sum is overridden by the server value (the call-site idiom)', () => {
  const c = load({ sheet });
  let gj = 9999, gc = 9999;                 // what a tampered browser summed
  const sb = c.pcSheetBooked('lt', 'p1', null); if (sb) { gj = sb.join_heads; gc = sb.charter_boats; }
  assert.deepEqual([gj, gc], [40, 5]);
});

test('no server answer, or legacy mode: legacy\'s own sum stands', () => {
  assert.equal(load({ sheet: {} }).pcSheetBooked('lt', 'p1', null), null);
  assert.equal(load({ enabled: false, sheet }).pcSheetBooked('lt', 'p1', null), null);
  assert.equal(load({ sheet }).pcSheetBooked('lt', 'p1', '2026-10-09'), null);
});

test('pc2LT and pc2LTDay both read the server booked side', () => {
  assert.match(APP, /_sbLT=pcSheetBooked\('lt',pier,ds\); if\(_sbLT\)\{ dj=_sbLT\.join_heads; dc=_sbLT\.charter_boats;/);
  assert.match(APP, /_sbM=pcSheetBooked\('lt',pier,null\); if\(_sbM\)\{ gj=_sbM\.join_heads; gc=_sbM\.charter_boats;/);
});
