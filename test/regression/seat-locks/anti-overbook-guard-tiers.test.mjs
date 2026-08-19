// LAM-26 (S2-02): invariant — the tiered anti-overbook guard inlined in
// bkV2CommitBooking (allotment_v2.html:76672, "── Anti-overbook guard (tiered) ──")
// has exactly three outcomes for a trip needing more seats than are currently
// sellable, and they must never blur into each other:
//   lockViolation   — need <= (seatsAvailable + lockedSeats)  → HARD BLOCK, no override
//   overCapApproval — physicalFree < need <= licenseAvailable → SOFT CONFIRM (saved "pending")
//   licenseBlock    — need > licenseAvailable                 → HARD BLOCK, no override
//
// Relationship to LAM-77 (tests/legacy/seat-locks.test.mjs, origin/main only):
// that suite already covers each tier firing in isolation (one trip triggering one
// tier), the edit-only-guards-the-increase carve-out, and the charter/no-allotment
// exemptions. This file adds the delta this ticket asks for — the split's exact
// BOUNDARY values (where "needs <= physicalFree" flips into "needs > physicalFree",
// and where "<= licFree" flips into "> licFree") and a MIXED-TIER case where two
// trips in the same booking hit two DIFFERENT tiers in one guard run, which
// LAM-77 does not test (its guard calls are all single-trip).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractBetween } from './lib/source.mjs';
import { runInSandbox, plain } from './lib/sandbox.mjs';

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
  const bkV2PaxAllTot = (pax) => (pax && pax.ad) || 0;
  const raw = runAntiOverbookGuard(d, _bkV2, SB_BOOKINGS, getAllotmentImpl, bkV2PaxAllTot, routes);
  return plain(raw);
}

describe('anti-overbook guard tiers (:76672) — exact boundary between HARD BLOCK (lockViolation) and the next tier', () => {
  test('need EXACTLY EQUAL to physicalFree (seatsAvailable + lockedSeats) is still inside the HARD BLOCK tier — the comparison is `<=`, not `<`', () => {
    // seatsAvailable=5, lockedSeats=3 → physicalFree=8. need=8 is the inclusive boundary.
    const al = { hasAllotment: true, seatsAvailable: 5, lockedSeats: 3, licenseAvailable: 20 };
    const res = runGuard({ trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 8 } }], getAllotmentImpl: () => al });
    assert.equal(res.lockViolation.length, 1, 'need===physicalFree must still hard-block (taking the last locked seat is not allowed)');
    assert.equal(res.overCapApproval.length, 0);
    assert.equal(res.licenseBlock.length, 0);
  });

  test('need ONE MORE than physicalFree crosses out of the hard-block tier into overCapApproval (soft confirm), given headroom under the license', () => {
    const al = { hasAllotment: true, seatsAvailable: 5, lockedSeats: 3, licenseAvailable: 20 };
    const res = runGuard({ trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 9 } }], getAllotmentImpl: () => al });
    assert.equal(res.lockViolation.length, 0, 'need=physicalFree+1 must NOT be lockViolation — the tiers are mutually exclusive by construction');
    assert.equal(res.overCapApproval.length, 1);
    assert.equal(res.overCapApproval[0].overBy, 1);
  });

  test('need EXACTLY EQUAL to the licensed (real) seats is still inside the SOFT overCapApproval tier — the `<=` boundary matches the lockViolation side', () => {
    const al = { hasAllotment: true, seatsAvailable: 0, lockedSeats: 0, licenseAvailable: 20 };
    const res = runGuard({ trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 20 } }], getAllotmentImpl: () => al });
    assert.equal(res.overCapApproval.length, 1, 'need===licFree must be a soft approval, not a hard block');
    assert.equal(res.licenseBlock.length, 0);
  });

  test('need ONE MORE than the licensed seats crosses into the second HARD BLOCK tier (licenseBlock) — no soft-confirm path exists past this point', () => {
    const al = { hasAllotment: true, seatsAvailable: 0, lockedSeats: 0, licenseAvailable: 20 };
    const res = runGuard({ trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 21 } }], getAllotmentImpl: () => al });
    assert.equal(res.overCapApproval.length, 0);
    assert.equal(res.licenseBlock.length, 1);
  });

  test('need not exceeding sellable seatsAvailable at all never enters the tiered logic — the outer gate (`need > al.seatsAvailable`) short-circuits before any tier can fire', () => {
    const al = { hasAllotment: true, seatsAvailable: 5, lockedSeats: 3, licenseAvailable: 20 };
    const res = runGuard({ trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 5 } }], getAllotmentImpl: () => al });
    assert.deepEqual(res, { lockViolation: [], overCapApproval: [], licenseBlock: [] });
  });
});

describe('anti-overbook guard tiers — a single booking with two trips can hit TWO DIFFERENT hard-block tiers in one guard run, and they do not interfere with each other', () => {
  test('trip 1 (route r1) hits lockViolation while trip 2 (route r2) hits licenseBlock, in the same guard pass — both are reported, independently, with no cross-contamination into overCapApproval', () => {
    const res = runGuard({
      trips: [
        { routeId: 'r1', date: '2026-09-01', pax: { ad: 4 } },
        { routeId: 'r2', date: '2026-09-01', pax: { ad: 5 } },
      ],
      getAllotmentImpl: (routeId) => {
        if (routeId === 'r1') return { hasAllotment: true, seatsAvailable: 1, lockedSeats: 5, licenseAvailable: 20 }; // physicalFree=6, need=4<=6 → lockViolation
        if (routeId === 'r2') return { hasAllotment: true, seatsAvailable: 0, lockedSeats: 0, licenseAvailable: 2 };  // physicalFree=0, need=5>0, licFree=2, 5>2 → licenseBlock
        return { hasAllotment: false };
      },
    });
    assert.equal(res.lockViolation.length, 1, 'r1 trip reported as lockViolation');
    assert.match(res.lockViolation[0], /^r1 /);
    assert.equal(res.licenseBlock.length, 1, 'r2 trip reported as licenseBlock');
    assert.match(res.licenseBlock[0], /^r2 /);
    assert.equal(res.overCapApproval.length, 0, 'neither trip should leak into the soft-confirm tier');
  });

  test('one trip triggers overCapApproval (soft) while a second, independent trip triggers lockViolation (hard) — the hard tier is reported even though a soft one also fired, so the caller can hard-block the whole booking', () => {
    const res = runGuard({
      trips: [
        { routeId: 'r1', date: '2026-09-01', pax: { ad: 9 } },  // overCapApproval per the boundary test above
        { routeId: 'r2', date: '2026-09-01', pax: { ad: 4 } },  // lockViolation
      ],
      getAllotmentImpl: (routeId) => {
        if (routeId === 'r1') return { hasAllotment: true, seatsAvailable: 5, lockedSeats: 3, licenseAvailable: 20 };
        if (routeId === 'r2') return { hasAllotment: true, seatsAvailable: 1, lockedSeats: 5, licenseAvailable: 20 };
        return { hasAllotment: false };
      },
    });
    assert.equal(res.overCapApproval.length, 1);
    assert.equal(res.lockViolation.length, 1);
    // The caller (bkV2CommitBooking, not reproduced here) checks lockViolation.length
    // FIRST and returns before ever looking at overCapApproval — so a hard tier firing
    // anywhere in the trip list must win over a soft tier firing elsewhere. This test
    // only asserts the guard reports both accurately; the precedence itself lives in
    // the caller's `if(lockViolation.length){ ...; return; }` check (verified by
    // reading allotment_v2.html directly — the guard function itself has no
    // precedence logic to test in isolation).
  });
});
