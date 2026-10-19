// Calendar month grid (96-ops-w7b-cal-grid.js): the chips are built from the server's availability summary routes[].days[].boats[].
//   node --test test/unit/ops-server-value-cal-grid.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/96-ops-w7b-cal-grid.js', 'utf8');
function load(summary) {
  const ctx = { Array };
  ctx.window = ctx;
  ctx.getRoute = (id) => (id === 'r1' ? { id: 'r1', name: 'Similan' } : null);
  ctx.getBoat = (id) => (id === 'b2' ? { name: 'Boat Two' } : null);
  ctx.laOpsCalSummary = () => summary;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const summary = { routes: [{ route_id: 'r1', days: [
  { service_date: '2026-10-19', tier: 'wx', sold_percent: 40, boats: [
    { boat_id: 'b1', free_seats: 10, chartered: false, down: false },
    { boat_id: 'b2', free_seats: 5, chartered: true, down: true }] },
  { service_date: '2026-10-20', closed: true, boats: [{ boat_id: 'b1', free_seats: 9 }] },
  { service_date: '2026-10-21', tier: 'soldout', sold_percent: 100, boats: [] },
  { service_date: '2026-10-22', tier: 'soldout', sold_percent: 100, boats: [{ boat_id: 'b1', free_seats: 0 }] },
] }] };

test('chips carry the server\'s free seats, boat count, tier, charter and down flags', () => {
  const g = load(summary).laOpsCalGrid(2026, 9, 'panwa');
  const c = g['2026-10-19'][0];
  assert.deepEqual([c.free, c.nb, c.wx, c.ch, c.dn, c.dnB[0], c.pct, c.full], [15, 2, true, true, 1, 'Boat Two', 40, false]);
  assert.equal(c.r.id, 'r1');
  assert.equal(g['2026-10-22'][0].full, true);
});

test('closed days and days with no boat draw no chip', () => {
  const g = load(summary).laOpsCalGrid(2026, 9, 'panwa');
  assert.equal(g['2026-10-20'], undefined);
  assert.equal(g['2026-10-21'], undefined);
});

test('no answer: null, so legacy\'s chips stay', () => {
  assert.equal(load(null).laOpsCalGrid(2026, 9, 'panwa'), null);
});
