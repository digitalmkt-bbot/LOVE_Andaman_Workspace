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

// §pkNearWeek (2026-11-28, UI parity pok-tublamu): the card reads its own 7 days (?from=&to=) instead of whole months (Tub Lamu's
// November read took 2-5 s, 12 s under load, while the card drew legacy's zeros); months already loaded for the month view answer it.
test('pk2Near: a week read (from..to) for the card; the month reads when the month view has them', async () => {
  const week = { pier: 'tublamu', month: null, days: [
    { date: '2026-11-25', boats: new Array(7).fill({}), tickets: 330, miss: 6 },
    { date: '2026-12-01', boats: new Array(5).fill({}), tickets: 0, miss: 0 },
  ], gaps: [], total: {}, routes: [] };
  const { ctx, O, settle, requests } = runtime({
    files: ['91-ops-park-month.js'],
    globals: { pk2Month: () => ({}), pk2Near: legacyNear, renderPierPark: () => '', pkTypes: () => [] },
    handlers: { 'GET /v1/pier-office/tublamu/park-tickets/month': (_b, path) => ({ body: /from=/.test(path) ? week : { ...month, pier: 'tublamu', month: path.includes('2026-12') ? '2026-12' : '2026-11', days: [] } }) },
  });
  O.state.loaded = true;
  assert.equal(ctx.pk2Near('2026-11-28', 'tublamu', { boats: 6, tot: 97, miss: 20 })[0].ds, 'legacy', 'no answer yet');
  await settle();
  assert.deepEqual(requests.map((r) => r.path.replace(/^.*\?/, '')), ['from=2026-11-25&to=2026-12-01'], 'one week read, not two months');
  const near = ctx.pk2Near('2026-11-28', 'tublamu', { boats: 6, tot: 97, miss: 20 });
  assert.deepEqual(JSON.parse(JSON.stringify(near.map((x) => [x.ds.slice(5), x.boats, x.tot, x.miss]))),
    [['11-25', 7, 330, 6], ['11-26', 0, 0, 0], ['11-27', 0, 0, 0], ['11-28', 6, 97, 20], ['11-29', 0, 0, 0], ['11-30', 0, 0, 0], ['12-01', 5, 0, 0]]);
  // the month view's reads land: the card answers from them, with no new request
  ctx.pk2Month('2026-11', 'tublamu'); ctx.pk2Month('2026-12', 'tublamu');
  await settle();
  const n = requests.length;
  ctx.pk2Near('2026-11-28', 'tublamu', { boats: 6, tot: 97, miss: 20 });
  await settle();
  assert.equal(requests.length, n);
  assert.equal(ctx.pk2Near('2026-11-28', 'tublamu', { boats: 6, tot: 97, miss: 20 })[0].boats, 0, 'the (empty) month answer, not the week');
});
