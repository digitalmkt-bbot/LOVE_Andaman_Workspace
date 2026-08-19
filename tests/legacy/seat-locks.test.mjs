// LAM-77 characterization: Seat locks.
//
// Extracts the real seat-lock arithmetic cluster (bkV2LockSpansDays ..
// bkV2LockedTotal, allotment_v2.html ~L41151-41279) plus the tiered
// anti-overbook guard inlined in bkV2CommitBooking (~L72863-72894) and runs
// them for real against fixture SB_SEAT_LOCKS / getAllotment data. These
// assert what the code DOES today, not what it should do.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractBetween } from './lib/source.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

const lockClusterSrc = extractBetween(
  "function bkV2LockSpansDays(l){ return !!l && (l.scope==='bulk' || l.scope==='month'); }",
  "function bkV2LockedTotal(routeId, date){ return bkV2LocksFor(routeId,date).reduce((s,l)=>s+bkV2LockPoolHold(l,date),0); }"
);

function lockSandbox(SB_SEAT_LOCKS) {
  return runInSandbox(lockClusterSrc, { SB_SEAT_LOCKS }, [
    'bkV2LockSpansDays', 'bkV2LockRange', 'bkV2LockDowOk', 'bkV2LockUsedOn',
    'bkV2LockRemaining', 'bkV2LocksFor', 'bkV2LocksForAgent', 'bkV2LockChildren',
    'bkV2LockAllocated', 'bkV2LockUnalloc', 'bkV2LockUsedTotal', 'bkV2LockHeldRemaining',
    'bkV2LockPoolHold', 'bkV2LockedTotal', 'bkV2LockReleaseCutoff', 'bkV2LockReleasedForDate',
  ]);
}

describe('seat locks — pool-hold arithmetic (bkV2LockPoolHold / bkV2LockedTotal)', () => {
  test('a standalone active lock holds (qty - used) seats against the sellable pool', () => {
    const locks = [
      { id: 'l1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 10, used: 3 },
    ];
    const { bkV2LockedTotal } = lockSandbox(locks);
    assert.equal(bkV2LockedTotal('r1', '2026-09-01'), 7);
  });

  test('a child (sub-group) lock contributes 0 to the pool hold — only its parent counts', () => {
    // Documented invariant (CLAUDE.md §Seat locks): "Parent/sub-group locks: bkV2LockPoolHold
    // counts the hold at parent/standalone level only (child -> 0) to avoid double-counting."
    const parent = { id: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 10, used: 0 };
    const child = { id: 'c1', parentId: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 4, used: 2 };
    const { bkV2LockPoolHold, bkV2LockHeldRemaining } = lockSandbox([parent, child]);
    assert.equal(bkV2LockPoolHold(child, '2026-09-01'), 0, 'child lock must not double-count against the pool');
    // The parent's held-remaining still subtracts the CHILD's usage too (bkV2LockUsedTotal sums parent + all children).
    assert.equal(bkV2LockHeldRemaining(parent, '2026-09-01'), 8, 'parent qty(10) - own used(0) - child used(2)');
  });

  test('an active month-scope (bulk) lock reserves seats on every date within its range, respecting dow filter', () => {
    const monthLock = {
      id: 'm1', routeId: 'r1', status: 'active', scope: 'bulk',
      dateFrom: '2026-09-01', dateTo: '2026-09-30', qty: 5, usedBy: {}, dow: [1, 3, 5], // Mon/Wed/Fri only
    };
    const { bkV2LocksFor, bkV2LockedTotal } = lockSandbox([monthLock]);
    // 2026-09-01 is a Tuesday (dow=2) — not in the allowed [1,3,5] set → lock does not apply that day.
    assert.equal(bkV2LocksFor('r1', '2026-09-01').length, 0, 'Tue 2026-09-01 is outside the dow whitelist');
    assert.equal(bkV2LockedTotal('r1', '2026-09-01'), 0);
    // 2026-09-02 is a Wednesday → in range and in the dow whitelist.
    assert.equal(bkV2LocksFor('r1', '2026-09-02').length, 1);
    assert.equal(bkV2LockedTotal('r1', '2026-09-02'), 5);
    // 2026-10-01 is outside the date range entirely.
    assert.equal(bkV2LocksFor('r1', '2026-10-01').length, 0);
  });

  test('per-date rolling release cutoff frees a specific trip date once "now" passes it, without expiring the lock globally', () => {
    const lock = {
      id: 'l1', routeId: 'r1', status: 'active', date: '2026-01-01', qty: 5,
      releaseDaysBefore: 3, releaseTime: '18:00',
    };
    const sb = lockSandbox([lock]);
    // Trip date far in the future relative to "now" (test run time) — cutoff has not passed → still locks.
    const farFuture = '2099-01-10';
    assert.equal(sb.bkV2LockReleasedForDate({ ...lock, date: farFuture }, farFuture), false);
    // Trip date far in the past — cutoff has definitely passed → released.
    const farPast = '2000-01-10';
    assert.equal(sb.bkV2LockReleasedForDate({ ...lock, date: farPast }, farPast), true);
    assert.equal(
      sb.bkV2LocksFor('r1', farPast).length, 0,
      'bkV2LocksFor must exclude a lock whose rolling release cutoff has passed for this trip date'
    );
  });

  test('an inactive (non-"active" status) lock never contributes, regardless of qty/used', () => {
    const locks = [{ id: 'l1', routeId: 'r1', date: '2026-09-01', status: 'released', qty: 10, used: 0 }];
    const { bkV2LockedTotal } = lockSandbox(locks);
    assert.equal(bkV2LockedTotal('r1', '2026-09-01'), 0);
  });
});

// ── Anti-overbook guard (bkV2CommitBooking, tiered) ──────────────────────────
// Extracted verbatim as an inline block (not a standalone function) — see the
// "Anti-overbook guard (tiered)" comment in allotment_v2.html directly above it.
const guardSrc = extractBetween(
  'const lockViolation = [], overCapApproval = [], licenseBlock = [];',
  'if(lockViolation.length){',
  { includeEnd: false }
);

function runGuard({ trips, editingId = null, origBk = null, getAllotmentImpl, routes = [] }) {
  const wrapped = `
    function runAntiOverbookGuard(d, _bkV2, SB_BOOKINGS, getAllotment, bkV2PaxAllTot, ROUTES) {
      ${guardSrc}
      return { lockViolation, overCapApproval, licenseBlock };
    }
  `;
  const { runAntiOverbookGuard } = runInSandbox(wrapped, {}, ['runAntiOverbookGuard']);
  const d = { trips };
  const _bkV2 = { editingId };
  const SB_BOOKINGS = origBk ? [origBk] : [];
  const bkV2PaxAllTot = (pax) => {
    if (!pax) return 0;
    const k = (kind) => (pax[kind] || 0) + (pax[`${kind}_fr`] || 0) + (pax[`${kind}_th`] || 0);
    return k('ad') + k('chd') + k('inf') + k('foc');
  };
  const raw = runAntiOverbookGuard(d, _bkV2, SB_BOOKINGS, getAllotmentImpl, bkV2PaxAllTot, routes);
  // The result's arrays/objects were constructed inside the vm's separate Realm, so
  // assert.deepStrictEqual (which checks prototype identity) would spuriously fail
  // even on structurally-identical output. Round-trip through JSON to compare plain data.
  return JSON.parse(JSON.stringify(raw));
}

describe('seat locks — anti-overbook guard tiers (new booking / edit)', () => {
  test('needing more seats than sellable, but within (sellable + locked) → HARD BLOCK (lockViolation), not a soft approval', () => {
    // al.seatsAvailable=2, al.lockedSeats=3 → physicalFree=5. need=4 <= physicalFree(5) → lockViolation tier.
    const al = { hasAllotment: true, seatsAvailable: 2, lockedSeats: 3, licenseAvailable: 10 };
    const res = runGuard({
      trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 4 } }],
      getAllotmentImpl: () => al,
    });
    assert.equal(res.lockViolation.length, 1);
    assert.equal(res.overCapApproval.length, 0);
    assert.equal(res.licenseBlock.length, 0);
    assert.match(res.lockViolation[0], /needs 4 seats but only 2 sellable/);
  });

  test('needing more than physically free but within the licensed seats → soft MANAGER APPROVAL tier, not a hard block', () => {
    // seatsAvailable=0, lockedSeats=0 → physicalFree=0. need=3 > physicalFree(0) → next tier.
    // licenseAvailable=5 → need(3) <= licFree(5) → overCapApproval.
    const al = { hasAllotment: true, seatsAvailable: 0, lockedSeats: 0, licenseAvailable: 5 };
    const res = runGuard({
      trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 3 } }],
      getAllotmentImpl: () => al,
    });
    assert.equal(res.lockViolation.length, 0);
    assert.equal(res.licenseBlock.length, 0);
    assert.equal(res.overCapApproval.length, 1);
    assert.equal(res.overCapApproval[0].overBy, 3);
  });

  test('needing more than the licensed (real, registered) seats → HARD BLOCK (licenseBlock), no approval path exists', () => {
    const al = { hasAllotment: true, seatsAvailable: 0, lockedSeats: 0, licenseAvailable: 2 };
    const res = runGuard({
      trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 3 } }],
      getAllotmentImpl: () => al,
    });
    assert.equal(res.overCapApproval.length, 0);
    assert.equal(res.licenseBlock.length, 1);
  });

  test('editing an existing booking only guards the INCREASE — a trip whose need did not grow passes even on a full day', () => {
    const al = { hasAllotment: true, seatsAvailable: 0, lockedSeats: 0, licenseAvailable: 0 };
    const origBk = { id: 'bk1', trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 2 }, bookingMode: 'seat' }] };
    const res = runGuard({
      trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 2 } }], // unchanged pax count
      editingId: 'bk1',
      origBk,
      getAllotmentImpl: () => al,
    });
    assert.deepEqual(res, { lockViolation: [], overCapApproval: [], licenseBlock: [] },
      'no tier should fire when the edited trip does not need more seats than it already held');
  });

  test('charter-mode trips are exempt from every tier of this guard', () => {
    const res = runGuard({
      trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 99 }, bookingMode: 'charter' }],
      getAllotmentImpl: () => { throw new Error('getAllotment must not be called for a charter trip'); },
    });
    assert.deepEqual(res, { lockViolation: [], overCapApproval: [], licenseBlock: [] });
  });

  test('a route/date with no allotment (no boat assigned at all) is silently skipped, not blocked', () => {
    const res = runGuard({
      trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 99 } }],
      getAllotmentImpl: () => ({ hasAllotment: false }),
    });
    assert.deepEqual(res, { lockViolation: [], overCapApproval: [], licenseBlock: [] },
      'this is a deliberate exception documented at the call site: "if(!al || !al.hasAllotment) return;"');
  });
});
