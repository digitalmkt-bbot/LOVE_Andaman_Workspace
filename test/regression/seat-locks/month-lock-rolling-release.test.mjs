// LAM-26 (S2-02): invariant — month/bulk-scope locks release seats on a ROLLING
// PER-TRIP basis (releaseDaysBefore / releaseTime relative to each individual trip
// date), never via one single global expiry cutting off the whole lock at once.
// allotment_v2.html:41696 (bkV2LockReleaseCutoff) documents this directly:
//   "A month lock holds seats across a range; its seats for a SPECIFIC trip date
//    auto-release when now passes (tripDate − releaseDaysBefore days) at
//    releaseTime — the seats free up for THAT departure while the lock stays
//    active for later dates. No single global expiry."
// The companion sweep, bkV2LockExpireSweep, documents the complementary half of
// the same invariant: "month locks expire only when the month RANGE ends" — a
// stale/past `l.expiry` field (the day-lock global-expiry mechanism) must be
// IGNORED for a bulk/month-scope lock; only day-scope locks consult `l.expiry`.
//
// Relationship to LAM-77 (tests/legacy/seat-locks.test.mjs, origin/main only):
// that suite has one release-cutoff test, but on a lock WITHOUT scope:'bulk'/'month'
// (a plain day-scope lock reusing the same release fields) and a SEPARATE test for
// month-scope dow filtering without any release fields. Neither combines "this IS a
// month-scope lock" with "the per-date rolling release differs by date within that
// SAME lock" — which is the actual claim in the ticket ("month locks use rolling
// per-trip release not a global expiry"). This file adds that combined case, plus
// the bkV2LockExpireSweep half (stale `expiry` must not sweep a month lock; it does
// sweep a day lock), which LAM-77 does not test at all.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunctions } from './lib/source.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

const RELEASE_CLUSTER = [
  'bkV2LockSpansDays', 'bkV2LockRange', 'bkV2LockDowOk', 'bkV2LockUsedOn',
  'bkV2LockReleaseCutoff', 'bkV2LockReleasedForDate', 'bkV2LocksFor',
];

describe('seat locks — month-scope locks release per-trip-date, not via one global cutoff (:41696)', () => {
  test('the SAME month-scope lock is released for one trip date but still active for another, purely based on each date\'s own rolling cutoff', () => {
    const monthLock = {
      id: 'm1', routeId: 'r1', status: 'active', scope: 'bulk',
      dateFrom: '2000-01-01', dateTo: '2099-12-31', qty: 5,
      releaseDaysBefore: 3, releaseTime: '18:00',
    };
    const { bkV2LocksFor, bkV2LockReleasedForDate } = runInSandbox(
      extractFunctions(RELEASE_CLUSTER), { SB_SEAT_LOCKS: [monthLock] }, ['bkV2LocksFor', 'bkV2LockReleasedForDate']
    );

    const farPastDeparture = '2000-01-10'; // cutoff (releaseDaysBefore/releaseTime before this date) is long past "now"
    const farFutureDeparture = '2099-01-10'; // cutoff has not arrived yet
    const anotherFarFutureDeparture = '2099-06-15'; // a second, independent future date on the SAME lock

    assert.equal(bkV2LockReleasedForDate(monthLock, farPastDeparture), true,
      'the past departure\'s own rolling cutoff has passed → released for that date');
    assert.equal(bkV2LockReleasedForDate(monthLock, farFutureDeparture), false,
      'a future departure\'s cutoff has not arrived → still holds for that date');

    assert.equal(bkV2LocksFor('r1', farPastDeparture).length, 0,
      'the lock is excluded (released) for the past departure date specifically');
    assert.equal(bkV2LocksFor('r1', farFutureDeparture).length, 1,
      'the SAME lock is still active for a future departure date');
    assert.equal(bkV2LocksFor('r1', anotherFarFutureDeparture).length, 1,
      'and for yet another future date — the lock object itself was never globally expired by releasing one date');
  });

  test('a day-scope (single-date) lock with the same rolling-release fields releases only its own one date — sanity check that the per-date mechanism is date-specific, not lock-specific', () => {
    const dayLock = {
      id: 'd1', routeId: 'r1', status: 'active', date: '2000-01-10', qty: 5,
      releaseDaysBefore: 3, releaseTime: '18:00',
    };
    const { bkV2LocksFor } = runInSandbox(extractFunctions(RELEASE_CLUSTER), { SB_SEAT_LOCKS: [dayLock] }, ['bkV2LocksFor']);
    assert.equal(bkV2LocksFor('r1', '2000-01-10').length, 0, 'released for its one and only date');
  });
});

describe('seat locks — bkV2LockExpireSweep: month/bulk locks expire only when the RANGE ends, never from a stale `expiry` field (companion half of the rolling-release invariant)', () => {
  test('a bulk-scope lock with a stale (long-past) `expiry` field is left ACTIVE by the sweep as long as its date RANGE has not ended', () => {
    const bulkLock = {
      id: 'm1', routeId: 'r1', status: 'active', scope: 'bulk',
      dateFrom: '2026-01-01', dateTo: '2099-12-31', qty: 5,
      expiry: '2000-01-01', // stale/irrelevant for a bulk-scope lock
    };
    const code = extractFunctions(['bkV2LockSpansDays', 'bkV2LockRange', 'bkV2LockExpireSweep']);
    const { bkV2LockExpireSweep } = runInSandbox(
      code, { SB_SEAT_LOCKS: [bulkLock], sbSeatLocksPersist: () => {} }, ['bkV2LockExpireSweep']
    );
    bkV2LockExpireSweep();
    assert.equal(bulkLock.status, 'active',
      'a stale `expiry` field must NOT expire a bulk/month-scope lock — only its range end (`dateTo`) does');
  });

  test('a bulk-scope lock DOES expire once the whole month RANGE has ended (dateTo in the past), independent of `expiry`', () => {
    const bulkLock = {
      id: 'm2', routeId: 'r1', status: 'active', scope: 'bulk',
      dateFrom: '1999-01-01', dateTo: '1999-01-31', qty: 5,
    };
    const code = extractFunctions(['bkV2LockSpansDays', 'bkV2LockRange', 'bkV2LockExpireSweep']);
    const { bkV2LockExpireSweep } = runInSandbox(
      code, { SB_SEAT_LOCKS: [bulkLock], sbSeatLocksPersist: () => {} }, ['bkV2LockExpireSweep']
    );
    bkV2LockExpireSweep();
    assert.equal(bulkLock.status, 'expired', 'range end (dateTo) has passed → the sweep expires it');
  });

  test('a day-scope lock, by contrast, DOES honor its `expiry` field directly — proving the two scopes use genuinely different rules, not just different data', () => {
    const dayLock = { id: 'd1', routeId: 'r1', status: 'active', date: '2026-01-01', qty: 5, expiry: '2000-01-01' };
    const code = extractFunctions(['bkV2LockSpansDays', 'bkV2LockRange', 'bkV2LockExpireSweep']);
    const { bkV2LockExpireSweep } = runInSandbox(
      code, { SB_SEAT_LOCKS: [dayLock], sbSeatLocksPersist: () => {} }, ['bkV2LockExpireSweep']
    );
    bkV2LockExpireSweep();
    assert.equal(dayLock.status, 'expired', 'day-scope locks DO expire off a stale `expiry` field');
  });
});
