// LAM-26 (S2-02): invariant — a child (sub-group) seat lock must never double-count
// against the sellable pool. Only the parent/standalone lock's held-remaining is
// summed into bkV2LockedTotal; a child's own bkV2LockPoolHold is always 0
// (allotment_v2.html:41783 — "Contribution to the sellable-pool reduction · counted
// at the parent/standalone level ONLY (children live inside the parent → 0)").
//
// Relationship to LAM-77 (tests/legacy/seat-locks.test.mjs, origin/main only):
// that suite already covers ONE parent + ONE child (bkV2LockPoolHold(child) === 0,
// and bkV2LockHeldRemaining(parent) subtracting the child's usage). This file adds
// the delta this ticket asks for: an invariant that holds under a more adversarial
// shape — MULTIPLE children under one parent, and a standalone (non-parent,
// non-child) lock on the same route/date competing for the same pool — so a
// regression that started summing children directly into bkV2LockedTotal (instead
// of relying on bkV2LockHeldRemaining folding child usage into the PARENT's number)
// would be caught even though a single-child case might still pass by coincidence.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunctions } from './lib/source.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

const CLUSTER = [
  'bkV2LockSpansDays', 'bkV2LockRange', 'bkV2LockDowOk', 'bkV2LockUsedOn',
  'bkV2LockReleaseCutoff', 'bkV2LockReleasedForDate', 'bkV2LocksFor',
  'bkV2LockChildren', 'bkV2LockAllocated', 'bkV2LockUnalloc', 'bkV2LockUsedTotal',
  'bkV2LockHeldRemaining', 'bkV2LockUnallocDrawable', 'bkV2LockDrawable',
  'bkV2LockPoolHold', 'bkV2LockedTotal',
];
const clusterSrc = extractFunctions(CLUSTER);

function lockSandbox(SB_SEAT_LOCKS) {
  return runInSandbox(clusterSrc, { SB_SEAT_LOCKS }, CLUSTER);
}

describe('seat locks — child-lock pool-hold invariant holds under multiple children (delta beyond LAM-77)', () => {
  test('two children under one parent: EACH child contributes exactly 0 to bkV2LockedTotal; only the parent number (net of all children\'s usage) is summed', () => {
    const parent = { id: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 20, used: 0 };
    const childA = { id: 'cA', parentId: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 5, used: 2 };
    const childB = { id: 'cB', parentId: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 5, used: 1 };
    const { bkV2LockPoolHold, bkV2LockedTotal } = lockSandbox([parent, childA, childB]);

    assert.equal(bkV2LockPoolHold(childA, '2026-09-01'), 0, 'child A must not double-count');
    assert.equal(bkV2LockPoolHold(childB, '2026-09-01'), 0, 'child B must not double-count');
    // 20 (parent qty) - 0 (parent's own used) - 2 (child A used) - 1 (child B used) = 17.
    // If a regression summed children directly (5-2 + 5-1 = 7) alongside the parent's
    // own 20, this would read something other than 17 — this assertion is what catches that.
    assert.equal(bkV2LockedTotal('r1', '2026-09-01'), 17,
      'pool total must equal parent qty minus (parent used + every child\'s used), counted once');
  });

  test('a standalone lock alongside a parent/children group on the same route+date: only the parent (net) and the standalone add up — no child is double-counted into the mix', () => {
    const parent = { id: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 10, used: 0 };
    const child = { id: 'c1', parentId: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 4, used: 4 }; // fully used
    const standalone = { id: 's1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 3, used: 1 };
    const { bkV2LockedTotal } = lockSandbox([parent, child, standalone]);
    // parent: 10 - 0 - 4 = 6 ; standalone: 3 - 1 = 2 ; total = 8
    assert.equal(bkV2LockedTotal('r1', '2026-09-01'), 8);
  });

  test('a child lock that is itself over-used (used > its own qty) still contributes 0 directly — only the parent\'s net (which can even go negative-clamped-to-0) reflects it', () => {
    const parent = { id: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 5, used: 0 };
    const overUsedChild = { id: 'c1', parentId: 'p1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 3, used: 8 };
    const { bkV2LockPoolHold, bkV2LockedTotal } = lockSandbox([parent, overUsedChild]);
    assert.equal(bkV2LockPoolHold(overUsedChild, '2026-09-01'), 0);
    // parent qty(5) - parent used(0) - child used(8) = -3, clamped to 0 by bkV2LockHeldRemaining's Math.max(0, ...).
    assert.equal(bkV2LockedTotal('r1', '2026-09-01'), 0);
  });

  test('a lock with no parentId (standalone) is unaffected by the child rule — its own held-remaining counts in full', () => {
    const standalone = { id: 's1', routeId: 'r1', date: '2026-09-01', status: 'active', qty: 10, used: 3 };
    const { bkV2LockPoolHold } = lockSandbox([standalone]);
    assert.equal(bkV2LockPoolHold(standalone, '2026-09-01'), 7);
  });
});
