// parity F4 (2026-11-26, operation-backend fix/parity-boats-1126c) · 50-ops-availability.js: a marine day with no boat is legacy
// getAllotment's untouched result, so seatsConsumed is 0 (Boat Operation's week cell shows "·", not "⚠ 20 pax no boat");
// a land route the server sells unlimited keeps the server's counts; a day with a boat takes the server's seats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './fe-harness.mjs';

const legacyShape = (routeId, dateStr) => ({ routeId, dateStr, hasAllotment: false, seatsConsumed: 0, seatsAvailable: 0, availableCapacity: 0, fillPct: 0, state: 'no-allotment' });
const days = [
  { route_id: 'rN', service_date: '2026-11-28', booked_pax: 20, locked_pax: 0, available_seats: 0, unplaced_pax: 20, deployments: [] },
  { route_id: 'rL', service_date: '2026-11-28', booked_pax: 7, locked_pax: 1, available_seats: null, unlimited: true, deployments: [] },
  { route_id: 'rB', service_date: '2026-11-28', booked_pax: 30, locked_pax: 2, available_seats: 8, deployments: [{ boat_id: 'b1', capacity: 40 }] },
];

test('boatless marine day: seatsConsumed 0 as legacy, the server count kept in serverBooked; unlimited and boat days keep theirs', async () => {
  const { ctx, O, settle } = runtime({
    files: ['50-ops-availability.js'],
    globals: { getAllotment: legacyShape },
    handlers: { 'GET /v1/availability': { body: { days } } },
  });
  O.state.loaded = true;
  ctx.getAllotment('rN', '2026-11-28');
  await settle();
  const n = ctx.getAllotment('rN', '2026-11-28'), l = ctx.getAllotment('rL', '2026-11-28'), b = ctx.getAllotment('rB', '2026-11-28');
  assert.deepEqual([n.hasAllotment, n.seatsConsumed, n.lockedSeats, n.serverBooked, n.unplacedPax], [false, 0, 0, 20, 20]);
  assert.deepEqual([l.seatsConsumed, l.lockedSeats, l.unlimited], [7, 1, true]);
  assert.deepEqual([b.seatsConsumed, b.lockedSeats, b.seatsAvailable], [30, 2, 8]);
});
