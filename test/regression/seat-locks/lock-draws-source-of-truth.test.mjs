// LAM-26 (S2-02): invariant — `trips[].lockDraws` on the bookings themselves is the
// SOURCE OF TRUTH for who is actually still using a given seat lock, NOT the lock's
// own running `used` counter. allotment_v2.html:41875 (bkV2LockClaims) states this
// directly in its comment:
//   "ใบจองที่ 'ยังอ้างถึง' ล็อกนี้อยู่จริง ณ ตอนนี้ · แหล่งความจริงคือ trips[].lockDraws
//    บนใบจอง ไม่ใช่ตัวนับ used ที่เชื่อไม่ได้"
//   ("bookings that still actually reference this lock right now — the source of
//    truth is trips[].lockDraws on the booking, NOT the unreliable `used` counter.")
// bkV2LockAudit then exists specifically to detect DRIFT between the two: `used`
// (the counter) vs the live sum of lockDraws across non-cancelled bookings.
//
// Not covered by LAM-77 at all — tests/legacy/seat-locks.test.mjs only exercises the
// bkV2LockPoolHold/bkV2LockedTotal arithmetic cluster and the anti-overbook guard; it
// never touches bkV2LockClaims/bkV2LockAudit/bkV2LockCoverage. This file is new
// coverage, not a delta on an existing test.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunctions } from './lib/source.mjs';
import { runInSandbox, plain } from './lib/sandbox.mjs';

const CLAIMS_CLUSTER = ['bkV2LockClaims', 'bkV2LockChildren', 'bkV2LockAudit'];

function sandbox(SB_BOOKINGS) {
  return runInSandbox(extractFunctions(CLAIMS_CLUSTER), { SB_BOOKINGS }, CLAIMS_CLUSTER);
}

describe('seat locks — trips[].lockDraws is the source of truth, not the lock\'s `used` counter', () => {
  test('bkV2LockClaims reads exclusively from bookings\' trips[].lockDraws — it ignores the lock\'s own `used` field entirely', () => {
    const SB_BOOKINGS = [
      { id: 'bkA', status: 'confirmed', leadPax: 'A', trips: [{ date: '2026-09-01', lockDraws: [{ lockId: 'l1', qty: 4 }] }] },
      { id: 'bkB', status: 'confirmed', leadPax: 'B', trips: [{ date: '2026-09-02', lockDraws: [{ lockId: 'l1', qty: 2 }] }] },
    ];
    const { bkV2LockClaims } = sandbox(SB_BOOKINGS);
    const claims = plain(bkV2LockClaims('l1'));
    // No `used` field was ever passed to bkV2LockClaims (it doesn't even take a lock
    // object — only a lockId) — the claims are entirely derived from the bookings.
    assert.equal(claims.length, 2);
    assert.deepEqual(claims.map(c => c.qty).sort(), [2, 4]);
  });

  test('a claim from a CANCELLED booking is still returned (kept for display) but flagged `dead:true`, and is excluded from the "live" sum used for drift detection', () => {
    const SB_BOOKINGS = [
      { id: 'bkLive', status: 'confirmed', leadPax: 'Live', trips: [{ date: '2026-09-01', lockDraws: [{ lockId: 'l1', qty: 3 }] }] },
      { id: 'bkDead', status: 'cancelled', leadPax: 'Dead', trips: [{ date: '2026-09-01', lockDraws: [{ lockId: 'l1', qty: 7 }] }] },
    ];
    const { bkV2LockClaims, bkV2LockAudit } = sandbox(SB_BOOKINGS);
    const claims = bkV2LockClaims('l1');
    assert.equal(claims.length, 2, 'both claims are returned, including the dead one — kept for display');
    const dead = claims.find(c => c.id === 'bkDead');
    const live = claims.find(c => c.id === 'bkLive');
    assert.equal(dead.dead, true);
    assert.equal(live.dead, false);

    // bkV2LockAudit: a lock whose stale `used` counter says 10 but whose only LIVE
    // claim is 3 must report live=3 (not 10, and not 10-7=3 by coincidence of counter
    // math — it must come from summing live claims, which this asserts by using a
    // counter value that does NOT equal the live sum in any simple arithmetic way).
    const l = { id: 'l1', used: 999 }; // deliberately absurd/stale counter
    const audit = bkV2LockAudit(l);
    assert.equal(audit.live, 3, 'live must be the sum of non-dead claims only, independent of the stale `used` counter');
    assert.equal(audit.dead, 7, 'dead is the sum of cancelled-booking claims, tracked separately');
    assert.equal(audit.used, 999, 'the reported `used` counter is echoed as-is (it is the thing being audited, not trusted)');
    assert.equal(audit.diff, 999 - 3, 'diff = counter minus live claims — this is what surfaces a mismatched/stale counter');
  });

  test('a `rejected` or `cancelled_weather` booking\'s lockDraws are ALSO excluded from the live sum (the full 3-status dead set, not just "cancelled")', () => {
    const SB_BOOKINGS = [
      { id: 'bkRejected', status: 'rejected', leadPax: 'R', trips: [{ date: '2026-09-01', lockDraws: [{ lockId: 'l1', qty: 5 }] }] },
      { id: 'bkWeather', status: 'cancelled_weather', leadPax: 'W', trips: [{ date: '2026-09-01', lockDraws: [{ lockId: 'l1', qty: 5 }] }] },
    ];
    const { bkV2LockAudit } = sandbox(SB_BOOKINGS);
    const audit = bkV2LockAudit({ id: 'l1', used: 0 });
    assert.equal(audit.live, 0, 'neither rejected nor cancelled_weather bookings contribute to the live claim sum');
    assert.equal(audit.dead, 10, 'both land in dead (5 + 5)');
  });

  test('claims for a lock with NO referencing bookings at all is an empty live set — even if the counter says otherwise, this is the ground truth bkV2LockAudit is built to expose', () => {
    const { bkV2LockAudit } = sandbox([]);
    const audit = bkV2LockAudit({ id: 'ghost', used: 50 });
    assert.equal(audit.live, 0);
    assert.equal(audit.diff, 50, 'a 50-seat drift is exactly the scenario this function exists to surface');
  });
});
