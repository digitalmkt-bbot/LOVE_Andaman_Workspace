// UI parity L2 (2026-11-26, operation-backend fix/parity-fleet-van-1126d) · 91-ops-park-month.js: the park day view's month card
// (pk2Near) takes the neighbour days from the month read (boats, tickets to issue, names missing) instead of pkTkData, which in ops
// mode holds only the day on screen (Ranong 27 Nov read "0 · 0 · —", legacy "2 · 57 · 56"). The day on screen keeps the page's figures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './fe-harness.mjs';

const month = { pier: 'ranong', month: '2026-11', days: [
  { date: '2026-11-27', boats: [{ boat_id: 'b1' }, { boat_id: 'b2' }], tickets: 57, miss: 56 },
  { date: '2026-11-29', boats: [{ boat_id: 'b1' }, { boat_id: 'b2' }, { boat_id: 'b3' }], tickets: 0, miss: 0 },
], total: {}, routes: [] };
const legacyNear = () => [{ ds: 'legacy', boats: 0, tot: 0, miss: 0 }];

test('pk2Near: the neighbours from the month read; the day on screen as the page passes it; legacy until the read lands', async () => {
  const { ctx, O, settle } = runtime({
    files: ['91-ops-park-month.js'],
    globals: { pk2Month: () => ({}), pk2Near: legacyNear, renderPierPark: () => '', pkTypes: () => [] },
    handlers: { 'GET /v1/pier-office/ranong/park-tickets/month': { body: month } },
  });
  O.state.loaded = true;
  assert.equal(ctx.pk2Near('2026-11-26', 'ranong', { boats: 0, tot: 0, miss: 0 })[0].ds, 'legacy', 'no answer yet');
  await settle();
  const near = ctx.pk2Near('2026-11-26', 'ranong', { boats: 0, tot: 0, miss: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(near.map((x) => [x.ds.slice(8), x.boats, x.tot, x.miss]))),
    [['23', 0, 0, 0], ['24', 0, 0, 0], ['25', 0, 0, 0], ['26', 0, 0, 0], ['27', 2, 57, 56], ['28', 0, 0, 0], ['29', 3, 0, 0]]);
});
