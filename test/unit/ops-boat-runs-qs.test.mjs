// §qsRuns (parity round 8, 2026-11-27): the rented-boat tab's sailing days per boat (legacy ctRentTabHtml runs) are the server's
// runs (GET /v1/costing/boat-rents), mapped to legacy's shape; the browser's TRIPS holds only some days.
import test from 'node:test';
import assert from 'node:assert/strict';
import { plain, read, runtime } from './fe-harness.mjs';

const APP = read('allotment_v2/js/08-app.js');
const from = APP.indexOf('function ctRentBlank(');
const to = APP.indexOf('function ctYmdAdd(');
assert.ok(from > 0 && to > from, 'legacy rent functions found in 08-app.js');
assert.ok(APP.includes('var runs = ctBoatRuns();'), 'ctRentTabHtml asks ctBoatRuns');
const PRE = `
  function ctRead(k){ return null; }
  function ctWrite(k, v){}
  function ctRender(){}
  function getBoat(id){ return { id: id, name: id.toUpperCase(), cap: 60 }; }
  function getRoute(id){ return { id: id, name: 'Route ' + id }; }
  function ctBoatRuns(){ return { legacy: true }; }
` + APP.slice(from, to);

test('ctBoatRuns: the server\'s runs in legacy\'s shape once costing is loaded; legacy\'s own count before', async () => {
  const runs = { b5: { n: 7, first: '2026-10-01', last: '2026-11-20', no_deal: 1, routes: { r12: { n: 7, no_deal: 1, first: '2026-10-01', last: '2026-11-20' } } } };
  const rt = runtime({
    files: ['44-ops-costing-pl.js'], pre: PRE,
    handlers: {
      'GET /v1/costing/template': { body: { vat_rate: 7, dropped: [], lines: [] } },
      'GET /v1/costing/plans': { body: { plans: [] } },
      'GET /v1/costing/boat-rents': { body: { rents: [], runs } },
    },
  });
  assert.deepEqual(plain(rt.ctx.ctBoatRuns()), { legacy: true });
  await rt.O.costingPL.loadCosting();
  assert.deepEqual(plain(rt.ctx.ctBoatRuns()), { b5: { n: 7, first: '2026-10-01', last: '2026-11-20', noDeal: 1, rt: { r12: { n: 7, noDeal: 1, first: '2026-10-01', last: '2026-11-20' } } } });
});
