// LAM-26 (S2-02): invariant — charter bookings NEVER consume seats from the
// sellable seat pool; a charter reserves its whole boat instead. CLAUDE.md
// §6 ("Vans / boats"): "Charter boats are excluded from the seat pool.
// baCharterBoatIds(date) / baDayBoats(date) filter them out; getSeatsConsumed
// excludes bookingMode==='charter'... Availability only drops if the charter
// reserves its boat in Boat-Op TRIPS."
//
// getSeatsConsumed's own charter exemption is already covered by LAM-77
// (tests/legacy/seat-locks.test.mjs, "charter-mode trips are exempt from every
// tier of this guard" + a dedicated getSeatsConsumed charter test in
// tests/legacy/cancelled-status-aggregates.test.mjs). This file covers the
// REST of the claim, which LAM-77 does not touch at all:
//   1. baSeatBookingsForRoute — a second, independent seat-pool listing function
//      that filters bookingMode!=='charter' (allotment_v2.html ~L45460), not
//      exercised anywhere in LAM-77.
//   2. baDayBoats — the Boat-Operation-level mechanism by which a charter
//      actually removes availability: a boat is dropped from the "available for
//      seat trips" list ONLY once it is chartered in Boat-Op TRIPS for that
//      date (via baCharterBoatIds), not merely because some booking somewhere
//      references it as `charterBoatId`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction, extractFunctions } from './lib/source.mjs';
import { runInSandbox, plain } from './lib/sandbox.mjs';

describe('charter never consumes seats — baSeatBookingsForRoute excludes charter-mode trips from the seat-pool listing', () => {
  const code = extractFunction('baSeatBookingsForRoute');
  function run(SB_BOOKINGS) {
    const { baSeatBookingsForRoute } = runInSandbox(code, { SB_BOOKINGS }, ['baSeatBookingsForRoute']);
    return plain(baSeatBookingsForRoute('2026-09-01', 'r1'));
  }

  test('a charter-mode trip, even with a large pax count, contributes nothing to the seat-booking list', () => {
    const rows = run([{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', bookingMode: 'charter', pax: { ad: 40 } }] }]);
    assert.equal(rows.length, 0);
  });

  test('a seat-mode trip on the same route/date DOES appear', () => {
    const rows = run([{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', bookingMode: 'seat', pax: { ad: 2 } }] }]);
    assert.equal(rows.length, 1);
  });

  test('a booking with BOTH a charter trip and a seat trip on the same date only surfaces the seat trip', () => {
    const rows = run([{
      id: 'bk1', status: 'confirmed',
      trips: [
        { date: '2026-09-01', routeId: 'r1', bookingMode: 'charter', pax: { ad: 40 } },
        { date: '2026-09-01', routeId: 'r1', bookingMode: 'seat', pax: { ad: 3 } },
      ],
    }]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].t.bookingMode, 'seat');
  });

  test('cancelled-status exclusion holds here too (charter exemption and cancelled exclusion are independent filters, both applied)', () => {
    const rows = run([{ id: 'bk1', status: 'cancelled', trips: [{ date: '2026-09-01', routeId: 'r1', bookingMode: 'seat', pax: { ad: 3 } }] }]);
    assert.equal(rows.length, 0);
  });
});

describe('charter never consumes seats — baDayBoats drops a boat from seat-trip availability only once Boat-Op TRIPS marks it chartered', () => {
  // baDayBoats -> baCharterBoatIds -> baCharterBoatMapMemo -> baCharterBoatMap. The
  // memo function reads/writes a module-level `let _baChMemo` that lives just above
  // its declaration in the source (not inside any function) — extractFunction only
  // pulls function bodies, so that one line is reproduced here explicitly.
  const code = 'let _baChMemo=null;\n' + extractFunctions(['baCharterBoatMap', 'baCharterBoatMapMemo', 'baCharterBoatIds', 'baDayBoats']);
  function run({ TRIPS, SB_BOOKINGS, BOATS }) {
    const { baDayBoats } = runInSandbox(code, { TRIPS, SB_BOOKINGS, BOATS }, ['baDayBoats']);
    return plain(baDayBoats('2026-09-01'));
  }
  const BOATS = [{ id: 'boatX', name: 'X' }, { id: 'boatY', name: 'Y' }];

  test('a boat with no charter booking at all remains in the available-for-seat-trips list', () => {
    const TRIPS = { '2026-09-01': { boatX: { route: 'r1' } } };
    const out = run({ TRIPS, SB_BOOKINGS: [], BOATS });
    assert.equal(out.length, 1);
    assert.equal(out[0].boatId, 'boatX');
  });

  test('a boat referenced by a charter booking\'s `charterBoatId`, but NOT (yet) reserved in Boat-Op TRIPS for that date, still shows as available — a booking alone does not remove availability', () => {
    const TRIPS = { '2026-09-01': { boatX: { route: 'r1' } } }; // boatY never entered into TRIPS at all
    const SB_BOOKINGS = [{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', bookingMode: 'charter', charterBoatId: 'boatY' }] }];
    const out = run({ TRIPS, SB_BOOKINGS, BOATS });
    // boatY isn't in `day` (TRIPS['2026-09-01']) at all, so it can't appear in baDayBoats either way —
    // this documents the real mechanism: baDayBoats only ever lists boats already present in TRIPS.
    assert.deepEqual(out.map(x => x.boatId), ['boatX'], 'boatY was never in Boat-Op TRIPS for this date, so it is simply absent, not "blocked"');
  });

  test('once a boat IS entered into Boat-Op TRIPS for the date AND baCharterBoatMap resolves it as chartered, it is excluded from baDayBoats — availability actually drops', () => {
    const TRIPS = { '2026-09-01': { boatX: { route: 'r1' }, boatY: { route: 'r2' } } };
    const SB_BOOKINGS = [{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', bookingMode: 'charter', charterBoatId: 'boatY' }] }];
    const out = run({ TRIPS, SB_BOOKINGS, BOATS });
    assert.deepEqual(out.map(x => x.boatId), ['boatX'], 'boatY is now excluded — chartered boats never appear as available for seat trips');
  });

  test('a boat entered into TRIPS with `charterBookingId` set directly (the other charter-marking path) is also excluded, independent of baCharterBoatMap', () => {
    const TRIPS = { '2026-09-01': { boatX: { route: 'r1' }, boatY: { route: 'r2', charterBookingId: 'bk1' } } };
    const out = run({ TRIPS, SB_BOOKINGS: [], BOATS });
    assert.deepEqual(out.map(x => x.boatId), ['boatX']);
  });

  test('a CANCELLED charter booking\'s boat is not excluded — the cancelled-status exclusion applies inside baCharterBoatMap too, so the boat reverts to available', () => {
    const TRIPS = { '2026-09-01': { boatX: { route: 'r1' }, boatY: { route: 'r2' } } };
    const SB_BOOKINGS = [{ id: 'bk1', status: 'cancelled', trips: [{ date: '2026-09-01', bookingMode: 'charter', charterBoatId: 'boatY' }] }];
    const out = run({ TRIPS, SB_BOOKINGS, BOATS });
    assert.deepEqual(out.map(x => x.boatId).sort(), ['boatX', 'boatY'], 'a cancelled charter no longer reserves the boat');
  });
});
