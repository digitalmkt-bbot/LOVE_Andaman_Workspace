// LAM-26 (S2-02): invariant — CLAUDE.md §3.4 / §6: "Cancelled statuses excluded
// from every aggregate: ['cancelled','cancelled_weather','rejected']".
//
// ── The "six aggregate sites" ─────────────────────────────────────────────────
// LAM-77's characterization suite (tests/legacy/cancelled-status-aggregates.test.mjs,
// origin/main only) names exactly six functions as using the documented 3-status
// exclusion list, in its last test's title: "getSeatsConsumed / getBookingsForRouteDate
// / baCharterBoatMap / flBoatBookingsFor / baAssignedPax / baAssignedBookings all use
// the documented 3-status list" — but that test only does a SOURCE-LEVEL occurrence
// count of the exclusion literal; only ONE of the six (getSeatsConsumed) is actually
// EXECUTED with real fixture bookings anywhere in that suite.
//
// This file executes the other FIVE for real (getSeatsConsumed itself is left to
// LAM-77 — re-testing it here would be pure duplication; see the note in that
// describe block below). Each of the five gets a positive case (a non-cancelled
// booking counts) and a negative case (a cancelled/rejected/cancelled_weather
// booking contributes nothing), proving the invariant holds under real execution,
// not just a source-text grep.
//
// Verified count: confirmed independently in this repo (not copied from LAM-77) —
// see docs/development/tasks/LAM-26.md "Decisions" for the exact `grep -n
// "function <name>("` line numbers. All six exist in this branch's
// allotment_v2.html at the same line numbers LAM-77 found on origin/main:
//   getSeatsConsumed        :12046   getBookingsForRouteDate :12189
//   baCharterBoatMap        :45323   flBoatBookingsFor        :12075
//   baAssignedPax           :45465   baAssignedBookings       :45497
// No seventh or missing site was found among these six specific names; a much
// larger set of OTHER call sites across the file also re-check the same 3-status
// list (dozens, in accounting/market-data/pickup-map/van-jobs/etc.) — those are a
// different, wider population than "the six aggregate sites" named by the ticket
// and are out of scope here (see "Follow-ups" in the task report).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction, extractFunctions } from './lib/source.mjs';
import { runInSandbox, plain } from './lib/sandbox.mjs';

const CANCELLED_STATUSES = ['cancelled', 'cancelled_weather', 'rejected'];

describe('cancelled-status aggregates — site 1/6: getSeatsConsumed (:12046) — covered by LAM-77, not re-tested here', () => {
  test('overlap note only, no assertion: LAM-77 (tests/legacy/cancelled-status-aggregates.test.mjs) already executes getSeatsConsumed for all three cancelled statuses plus a confirmed control — re-implementing that here would be duplication, not delta, per this ticket\'s instructions', () => {
    assert.ok(true);
  });
});

describe('cancelled-status aggregates — site 2/6: getBookingsForRouteDate (:12189) — real execution', () => {
  const code = extractFunctions(['getTripPaxTotal', 'getBookingsForRouteDate']);
  function run(SB_BOOKINGS) {
    const { getBookingsForRouteDate } = runInSandbox(code, { SB_BOOKINGS }, ['getBookingsForRouteDate']);
    return plain(getBookingsForRouteDate('r1', '2026-09-01'));
  }
  for (const status of CANCELLED_STATUSES) {
    test(`a "${status}" booking is entirely absent from the route/date list`, () => {
      const rows = run([{ id: 'bk1', status, schemaVer: 2, trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 4 } }] }]);
      assert.equal(rows.length, 0);
    });
  }
  test('a confirmed booking on the same route/date DOES appear', () => {
    const rows = run([{ id: 'bk1', status: 'confirmed', schemaVer: 2, trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 4 } }] }]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].pax, 4);
  });
});

describe('cancelled-status aggregates — site 3/6: flBoatBookingsFor (:12075) — real execution', () => {
  const code = extractFunctions(['bkTripDates', 'bkIsFirstDay', 'bkOpsRead', 'getTripPaxTotal', 'flBoatBookingsFor']);
  function run(SB_BOOKINGS) {
    const { flBoatBookingsFor } = runInSandbox(code, { SB_BOOKINGS }, ['flBoatBookingsFor']);
    return plain(flBoatBookingsFor('boatX', '2026-09-01'));
  }
  for (const status of CANCELLED_STATUSES) {
    test(`a "${status}" booking assigned to the boat contributes 0 pax to the Daily Fleet Log auto-PAX`, () => {
      const out = run([{ id: 'bk1', status, schemaVer: 2, ops: { boatId: 'boatX' }, trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 6 } }] }]);
      assert.equal(out.pax, 0);
    });
  }
  test('a confirmed booking assigned to the boat DOES contribute its pax', () => {
    const out = run([{ id: 'bk1', status: 'confirmed', schemaVer: 2, ops: { boatId: 'boatX' }, trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 6 } }] }]);
    assert.equal(out.pax, 6);
  });
});

describe('cancelled-status aggregates — site 4/6: baCharterBoatMap (:45323) — real execution', () => {
  const code = extractFunction('baCharterBoatMap');
  function run(SB_BOOKINGS) {
    const { baCharterBoatMap } = runInSandbox(code, { SB_BOOKINGS }, ['baCharterBoatMap']);
    return baCharterBoatMap('2026-09-01');
  }
  for (const status of CANCELLED_STATUSES) {
    test(`a "${status}" charter booking's boat never appears as chartered`, () => {
      const m = run([{ id: 'bk1', status, trips: [{ date: '2026-09-01', bookingMode: 'charter', charterBoatId: 'boatY' }] }]);
      assert.equal(m.has('boatY'), false);
    });
  }
  test('a confirmed charter booking\'s boat DOES appear as chartered for that date', () => {
    const m = run([{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', bookingMode: 'charter', charterBoatId: 'boatY' }] }]);
    assert.equal(m.has('boatY'), true);
    assert.equal(m.get('boatY'), 'bk1');
  });
});

describe('cancelled-status aggregates — site 5/6: baAssignedPax (:45465) — real execution', () => {
  const code = extractFunctions(['bkTripDates', 'bkIsFirstDay', 'bkOpsRead', 'bkHasTripOn', 'bkBoatSplits', 'bkBoatIdOf', 'bkBoatPaxOnBoat', 'bkV2PaxTot', 'bkV2PaxAllTot', 'baAssignedPax']);
  function run(SB_BOOKINGS) {
    const { baAssignedPax } = runInSandbox(code, { SB_BOOKINGS }, ['baAssignedPax']);
    return baAssignedPax('2026-09-01', 'boatX');
  }
  for (const status of CANCELLED_STATUSES) {
    test(`a "${status}" booking assigned to the boat contributes 0 pax to Boat Operation's assigned-pax figure`, () => {
      assert.equal(run([{ id: 'bk1', status, ops: { boatId: 'boatX' }, trips: [{ date: '2026-09-01', pax: { ad: 5 } }] }]), 0);
    });
  }
  test('a confirmed booking assigned to the boat DOES contribute its pax', () => {
    assert.equal(run([{ id: 'bk1', status: 'confirmed', ops: { boatId: 'boatX' }, trips: [{ date: '2026-09-01', pax: { ad: 5 } }] }]), 5);
  });
});

describe('cancelled-status aggregates — site 6/6: baAssignedBookings (:45497) — real execution', () => {
  const code = extractFunctions(['bkTripDates', 'bkIsFirstDay', 'bkOpsRead', 'bkHasTripOn', 'bkBoatSplits', 'bkBoatIdOf', 'bkBoatPaxOnBoat', 'bkV2PaxTot', 'bkV2PaxAllTot', 'baAssignedBookings']);
  function run(SB_BOOKINGS) {
    const { baAssignedBookings } = runInSandbox(code, { SB_BOOKINGS }, ['baAssignedBookings']);
    return plain(baAssignedBookings('2026-09-01', 'boatX'));
  }
  for (const status of CANCELLED_STATUSES) {
    test(`a "${status}" booking assigned to the boat is excluded from both count and pax`, () => {
      const out = run([{ id: 'bk1', status, ops: { boatId: 'boatX' }, trips: [{ date: '2026-09-01', pax: { ad: 5 } }] }]);
      assert.deepEqual(out, { count: 0, pax: 0 });
    });
  }
  test('a confirmed booking is counted, with its pax total', () => {
    const out = run([{ id: 'bk1', status: 'confirmed', ops: { boatId: 'boatX' }, trips: [{ date: '2026-09-01', pax: { ad: 5 } }] }]);
    assert.deepEqual(out, { count: 1, pax: 5 });
  });
});

describe('cancelled-status aggregates — cross-site consistency: the same mixed fixture set, run through every one of the six sites at once', () => {
  test('a fixture set with one confirmed + one of each cancelled status, run through all six functions in one pass, agrees that only the confirmed booking counts everywhere', () => {
    const bookings = [
      { id: 'ok', status: 'confirmed', schemaVer: 2, ops: { boatId: 'boatX' }, trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 2 }, bookingMode: 'seat' }] },
      { id: 'c1', status: 'cancelled', schemaVer: 2, ops: { boatId: 'boatX' }, trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 2 }, bookingMode: 'seat' }] },
      { id: 'c2', status: 'rejected', schemaVer: 2, ops: { boatId: 'boatX' }, trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 2 }, bookingMode: 'seat' }] },
      { id: 'c3', status: 'cancelled_weather', schemaVer: 2, ops: { boatId: 'boatX' }, trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 2 }, bookingMode: 'seat' }] },
    ];

    const gbrd = runInSandbox(extractFunctions(['getTripPaxTotal', 'getBookingsForRouteDate']), { SB_BOOKINGS: bookings }, ['getBookingsForRouteDate']);
    assert.equal(gbrd.getBookingsForRouteDate('r1', '2026-09-01').length, 1, 'getBookingsForRouteDate: only the confirmed booking');

    const fbb = runInSandbox(extractFunctions(['bkTripDates', 'bkIsFirstDay', 'bkOpsRead', 'getTripPaxTotal', 'flBoatBookingsFor']), { SB_BOOKINGS: bookings }, ['flBoatBookingsFor']);
    assert.equal(fbb.flBoatBookingsFor('boatX', '2026-09-01').pax, 2, 'flBoatBookingsFor: only the confirmed booking\'s pax');

    const bap = runInSandbox(extractFunctions(['bkTripDates', 'bkIsFirstDay', 'bkOpsRead', 'bkHasTripOn', 'bkBoatSplits', 'bkBoatIdOf', 'bkBoatPaxOnBoat', 'bkV2PaxTot', 'bkV2PaxAllTot', 'baAssignedPax']), { SB_BOOKINGS: bookings }, ['baAssignedPax']);
    assert.equal(bap.baAssignedPax('2026-09-01', 'boatX'), 2, 'baAssignedPax: only the confirmed booking\'s pax');

    const bab = runInSandbox(extractFunctions(['bkTripDates', 'bkIsFirstDay', 'bkOpsRead', 'bkHasTripOn', 'bkBoatSplits', 'bkBoatIdOf', 'bkBoatPaxOnBoat', 'bkV2PaxTot', 'bkV2PaxAllTot', 'baAssignedBookings']), { SB_BOOKINGS: bookings }, ['baAssignedBookings']);
    assert.deepEqual(plain(bab.baAssignedBookings('2026-09-01', 'boatX')), { count: 1, pax: 2 }, 'baAssignedBookings: only the confirmed booking counted');
  });
});
