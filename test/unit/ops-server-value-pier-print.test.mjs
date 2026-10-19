// Petty-cash print (waves 5c / 7c / 9): the day's booked side and keyed sums come from the pier-cash sheet the server sent;
// a tampered browser sum is overridden. Covers both sheet kinds ('lt' = longtail, 'pk' = park) after 83001b3c fixed the key lookup.
//   node --test test/unit/ops-server-value-pier-print.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const W5C = fs.readFileSync('allotment_v2/js/ops/82-ops-w5c-pier.js', 'utf8');
const W7C = fs.readFileSync('allotment_v2/js/ops/97-ops-w7c-pier.js', 'utf8');
const LT = { join_boats: 7, charter_boats: 2, amount: 12345 };
const PK = { ad_th: 4, heads: 11, amount: 999, dock: 55 };

function load({ enabled = true } = {}) {
  const ctx = { console, JSON, Array, String, Object, Date };
  ctx.window = ctx;
  ctx.laOps = { enabled: () => enabled, onWrite() {}, onChange() {}, get: () => new Promise(() => {}),
    pierCash: { cache: { sheet: {
      'longtail|panwa|2026-10': { month: '2026-10', totals: { amount: 5000 }, days: [{ date: '2026-10-19', totals: LT, booked: { join_heads: 30, charter_boats: 2 } }] },
      'park|panwa|2026-10': { month: '2026-10', days: [{ date: '2026-10-19', totals: PK, booked: { ad_th: 8, tot: 20 }, check: { due: 777 } }] },
    } } } };
  const tampered = { tampered: true };
  ctx.pcSheetTot = () => tampered;
  ctx.pcSheetBooked = () => tampered;
  ctx._pcYM = '2026-10';
  vm.createContext(ctx);
  vm.runInContext(W5C, ctx);
  vm.runInContext(W7C, ctx);
  return { ctx, tampered };
}

test('pcSheetBooked: both kinds read the server\'s days[].booked, not the browser\'s sum', () => {
  const { ctx } = load();
  assert.deepEqual({ ...ctx.pcSheetBooked('lt', 'panwa', '2026-10-19') }, { join_heads: 30, charter_boats: 2 });
  assert.equal(ctx.pcSheetBooked('pk', 'panwa', '2026-10-19').tot, 20);
});

test('pcSheetBooked: a day or pier the sheet does not hold keeps legacy\'s sum', () => {
  const { ctx, tampered } = load();
  assert.equal(ctx.pcSheetBooked('lt', 'panwa', '2026-10-20'), tampered);
  assert.equal(ctx.pcSheetBooked('lt', 'tublamu', '2026-10-19'), tampered);
});

test('pcSheetTot: the day\'s keyed sums are the server\'s for lt and pk', () => {
  const { ctx } = load();
  assert.equal(ctx.pcSheetTot('lt', 'panwa', '2026-10-19').join_boats, 7);
  assert.equal(ctx.pcSheetTot('pk', 'panwa', '2026-10-19').amount, 999);
});

test('pcSheetTot: the month figure (ds null) is the sheet\'s month totals', () => {
  const { ctx } = load();
  assert.equal(ctx.pcSheetTot('lt', 'panwa', null).amount, 5000);
});

test('legacy mode: the browser\'s own figure stands', () => {
  const { ctx, tampered } = load({ enabled: false });
  assert.equal(ctx.pcSheetTot('lt', 'panwa', '2026-10-19'), tampered);
  assert.equal(ctx.pcSheetBooked('lt', 'panwa', '2026-10-19'), tampered);
  assert.equal(ctx.pcPkSheetTotals('panwa', '2026-10-19'), null);
});

test('pcPkSheetTotals: the park print\'s day totals, due and booked heads are the server\'s', () => {
  const { ctx } = load();
  const t = ctx.pcPkSheetTotals('panwa', '2026-10-19');
  assert.deepEqual([t.ad_th, t.heads, t.amount, t.dock, t.due], [4, 11, 999, 55, 777]);
  assert.equal(t.booked.ad_th, 8);
  assert.equal(ctx.pcPkSheetTotals('panwa', '2026-10-20'), null);
});
