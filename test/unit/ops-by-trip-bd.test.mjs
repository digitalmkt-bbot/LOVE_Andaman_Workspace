import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// FE-8: A/C/I/F on By trip come from the server (routes[].pax and routes[].boats[].pax_by_type), pending-approval bookings left out as the server's pax does.
const SRV = { routes: [
  { route_id: 'r1', pax: { ad: 10, chd: 2, inf: 1, foc: 0, total: 13 }, boats: [
    { boat_id: 'b1', boat_name: 'Boat 1', pax: 8, pax_by_type: { ad: 6, chd: 2, inf: 0, foc: 0 }, capacity: 10, over: false, over_by: 0, ovn_hold: null },
    { boat_id: 'b2', boat_name: 'Boat 2', pax: 5, pax_by_type: { ad: 4, chd: 0, inf: 1, foc: 0 }, capacity: 10, over: false, over_by: 0, ovn_hold: null }] },
  { route_id: 'r2', pax: { ad: 3, chd: 0, inf: 0, foc: 1, total: 4 }, boats: [] },
] };

test('a variant, a family and the selected route are sums of the server\'s routes[].pax; no answer = null (the page keeps its own count)', () => {
  const r = runtime({ files: ['91-ops-by-trip-boats.js'] });
  const bd = r.ctx.laOpsByTripBd;
  assert.deepEqual(plain(bd(SRV, ['r1'])), { ad: 10, chd: 2, inf: 1, foc: 0 });
  assert.deepEqual(plain(bd(SRV, ['r1', 'r2'])), { ad: 13, chd: 2, inf: 1, foc: 1 });
  assert.deepEqual(plain(bd(SRV, ['r9'])), { ad: 0, chd: 0, inf: 0, foc: 0 });
  assert.equal(bd(null, ['r1']), null);
});

test('a boat row carries the server\'s pax_by_type, and the four types add up to the boat\'s pax', () => {
  const r = runtime({ files: ['91-ops-by-trip-boats.js'] });
  const rows = plain(r.ctx.laOpsByTripBoats(SRV, 'r1'));
  assert.deepEqual(rows.map((b) => b.bd), [{ ad: 6, chd: 2, inf: 0, foc: 0 }, { ad: 4, chd: 0, inf: 1, foc: 0 }]);
  rows.forEach((b) => assert.equal(b.bd.ad + b.bd.chd + b.bd.inf + b.bd.foc, b.pax));
});
