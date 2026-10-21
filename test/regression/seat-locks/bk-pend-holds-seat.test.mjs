// LAM-26 (S2-02): invariant — an OVER-CAPACITY `pending_approval` booking holds NO
// real seat in the sellable pool (the seat doesn't physically exist until a
// manager approves it and a boat is added); a `pending_approval` booking held for
// any OTHER reason (e.g. a discount awaiting sign-off) DOES hold its seat.
// allotment_v2.html:12040 (bkPendHoldsSeat) is the single gate this decision runs
// through, consulted by getSeatsConsumed (the seat-pool math).
//
// Relationship to LAM-77 (tests/legacy/cancelled-status-aggregates.test.mjs,
// origin/main only): that suite already exercises this exact rule, but only
// end-to-end through getSeatsConsumed with two representative bookings (one
// over-cap, one discount-pending). This file adds the delta this ticket asks
// for: bkPendHoldsSeat tested in ISOLATION at its own boundary values — the
// `totOver` threshold (0 vs any positive number, including a fractional/negative
// stray value), an `over` array that is present-but-empty vs present-with-one-
// entry, and every non-"pending_approval" status short-circuiting to `true`
// regardless of what `approval` contains. A regression that flips a `>` to `>=`,
// or a `||` to `&&`, in this one-function gate would slip past LAM-77's two
// example bookings but is exactly what these boundary cases are built to catch.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction } from './lib/source.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

const { bkPendHoldsSeat } = runInSandbox(extractFunction('bkPendHoldsSeat'), {}, ['bkPendHoldsSeat']);

describe('seat locks — bkPendHoldsSeat (:12040) gate, boundary values in isolation', () => {
  test('any non-"pending_approval" status holds its seat (true), regardless of what `approval` says', () => {
    for (const status of ['confirmed', 'cancelled', 'rejected', 'cancelled_weather', undefined, '']) {
      assert.equal(
        bkPendHoldsSeat({ status, approval: { over: [{ routeId: 'r1' }], totOver: 99 } }),
        true,
        `status=${JSON.stringify(status)} must short-circuit to true even with an over-cap approval payload`
      );
    }
  });

  test('a falsy booking (null/undefined) holds its seat (true) — a defensive default, not a real "yes"', () => {
    assert.equal(bkPendHoldsSeat(null), true);
    assert.equal(bkPendHoldsSeat(undefined), true);
  });

  test('pending_approval with NO `approval` object at all → holds its seat (defaults to not-over-cap)', () => {
    assert.equal(bkPendHoldsSeat({ status: 'pending_approval' }), true);
  });

  test('pending_approval with `totOver` exactly 0 → still holds its seat (0 is not "over")', () => {
    assert.equal(bkPendHoldsSeat({ status: 'pending_approval', approval: { over: [], totOver: 0 } }), true);
  });

  test('pending_approval with `totOver` a small positive number (boundary: 0 → 1) → does NOT hold its seat', () => {
    assert.equal(bkPendHoldsSeat({ status: 'pending_approval', approval: { over: [], totOver: 1 } }), false);
  });

  test('pending_approval with `over` an empty array but a positive `totOver` → does NOT hold (either signal alone is enough — it is an OR)', () => {
    assert.equal(bkPendHoldsSeat({ status: 'pending_approval', approval: { over: [], totOver: 5 } }), false);
  });

  test('pending_approval with a non-empty `over` array but `totOver` 0/absent → does NOT hold (the other half of the OR)', () => {
    assert.equal(bkPendHoldsSeat({ status: 'pending_approval', approval: { over: [{ routeId: 'r1' }] } }), false);
  });

  test('pending_approval held for a non-capacity reason (e.g. discount sign-off) with both signals clean → DOES hold its seat', () => {
    assert.equal(
      bkPendHoldsSeat({ status: 'pending_approval', approval: { reason: 'discount', over: [], totOver: 0 } }),
      true
    );
  });

  test('a negative `totOver` (should not occur, but the gate is a raw `>0` check) does not itself flip the result to false', () => {
    assert.equal(bkPendHoldsSeat({ status: 'pending_approval', approval: { over: [], totOver: -3 } }), true);
  });
});
