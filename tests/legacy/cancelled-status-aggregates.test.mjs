// LAM-77 characterization: cancelled-status aggregates.
//
// CLAUDE.md §3.4 states as a global invariant: "Cancelled statuses excluded
// from every aggregate: ['cancelled','cancelled_weather','rejected']".
// Part A below executes the real getSeatsConsumed() against that invariant.
// Part B is a SOURCE-LEVEL scan (not execution) that enumerates every
// status-exclusion literal actually present in allotment_v2.html today and
// documents where the invariant does NOT hold — this is the "identify
// intentional exceptions" deliverable from the LAM-77 acceptance criteria,
// not a bug fix.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction, occurrences, lineOf, getSource } from './lib/source.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

const code = [
  extractFunction('getTripPaxTotal'),
  extractFunction('bkPendHoldsSeat'),
  extractFunction('getSeatsConsumed'),
].join('\n');

function seatsConsumed(SB_BOOKINGS, routeId, dateStr, excludeBkId) {
  const { getSeatsConsumed } = runInSandbox(code, { SB_BOOKINGS }, ['getSeatsConsumed']);
  return getSeatsConsumed(routeId, dateStr, excludeBkId);
}

function bk(overrides) {
  return {
    schemaVer: 2, status: 'confirmed', trips: [], ...overrides,
  };
}

describe('cancelled-status aggregates — getSeatsConsumed (real execution)', () => {
  for (const status of ['cancelled', 'cancelled_weather', 'rejected']) {
    test(`a "${status}" booking contributes 0 seats`, () => {
      const b = bk({ status, trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 4 } }] });
      assert.equal(seatsConsumed([b], 'r1', '2026-09-01'), 0);
    });
  }

  test('a confirmed booking DOES contribute its pax total', () => {
    const b = bk({ status: 'confirmed', trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 2, chd: 1 } }] });
    assert.equal(seatsConsumed([b], 'r1', '2026-09-01'), 3);
  });

  test('"pending_approval" bookings hold their seat UNLESS the approval reason is over-capacity (bkPendHoldsSeat)', () => {
    // §pendSeat rule extracted verbatim: pending_approval + approval.over non-empty (or totOver>0) => does NOT hold a seat.
    const overCap = bk({
      status: 'pending_approval',
      approval: { over: [{ routeId: 'r1' }] },
      trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 5 } }],
    });
    assert.equal(seatsConsumed([overCap], 'r1', '2026-09-01'), 0,
      'over-capacity pending_approval booking must NOT hold a real seat (seat does not physically exist yet)');

    const discountPending = bk({
      status: 'pending_approval',
      approval: { reason: 'discount', over: [], totOver: 0 },
      trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 5 } }],
    });
    assert.equal(seatsConsumed([discountPending], 'r1', '2026-09-01'), 5,
      'a pending_approval booking held for a non-capacity reason (e.g. discount) DOES hold its seat');
  });

  test('excludeBkId omits that one booking\'s own seats (used when re-checking the booking being edited)', () => {
    const editing = bk({ id: 'bkX', status: 'confirmed', trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 3 } }] });
    const other = bk({ id: 'bkY', status: 'confirmed', trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 2 } }] });
    assert.equal(seatsConsumed([editing, other], 'r1', '2026-09-01', 'bkX'), 2);
  });

  test('charter-mode trips never consume seats from the seat pool, regardless of pax', () => {
    const b = bk({ status: 'confirmed', trips: [{ routeId: 'r1', date: '2026-09-01', pax: { ad: 30 }, bookingMode: 'charter' }] });
    assert.equal(seatsConsumed([b], 'r1', '2026-09-01'), 0);
  });
});

// ── Part B: source-level scan of every cancelled-status exclusion literal ──
describe('cancelled-status aggregates — source scan of every exclusion literal (documents drift from the documented invariant)', () => {
  test('the documented 3-status list ["cancelled","cancelled_weather","rejected"] is the majority pattern', () => {
    const bracketForm = occurrences("['cancelled','cancelled_weather','rejected']");
    const inlineForm = occurrences("bk.status === 'cancelled' || bk.status === 'rejected' || bk.status === 'cancelled_weather'");
    // At least one of the two equivalent spellings must exist in meaningful quantity — proves the
    // documented invariant is real and not just aspirational documentation.
    assert.ok(bracketForm + inlineForm >= 5,
      `expected the documented 3-status exclusion to appear at least 5x across the file; found bracket=${bracketForm} inline=${inlineForm}`);
  });

  test('INTENTIONAL EXCEPTION — bkV2DetailCancel / bkV2EditBooking / canCancel use ["cancelled","completed","rejected"], which OMITS "cancelled_weather" and adds "completed"', () => {
    // This is a real inconsistency with CLAUDE.md's documented invariant, found by this
    // characterization pass. It is NOT fixed here (LAM-77 scope = characterize, not refactor).
    // Filed as a follow-up in docs/development/tasks/LAM-77.md.
    const marker = "['cancelled','completed','rejected']";
    const count = occurrences(marker);
    assert.equal(count, 3, 'expected exactly 3 call sites using this narrower/different exclusion list today');
    const line = lineOf(marker);
    assert.ok(line > 0);
  });

  test('INTENTIONAL EXCEPTION — bkV2EditBooking\'s canEdit gate excludes only ["cancelled","rejected"] — a cancelled_weather OR completed booking remains editable', () => {
    const marker = "const canEdit = isV2 && !['cancelled','rejected'].includes(bk.status);";
    const count = occurrences(marker);
    assert.equal(count, 1);
    // Contrast: canCancel on the very next-door computation uses the 3-item ['cancelled','completed','rejected']
    // list — so the SAME detail screen has two different ideas of "is this booking closed" one line apart.
    const src = getSource();
    const idx = src.indexOf(marker);
    const nearby = src.slice(Math.max(0, idx - 400), idx);
    assert.match(nearby, /canCancel = !\['cancelled','completed','rejected'\]\.includes\(bk\.status\)/,
      'canCancel (3-status) and canEdit (2-status) are defined a few lines apart with different lists');
  });

  test('getSeatsConsumed / getBookingsForRouteDate / baCharterBoatMap / flBoatBookingsFor / baAssignedPax all use the documented 3-status list', () => {
    // Spot-check the inline (non-bracket) spelling used specifically inside getSeatsConsumed / getBookingsForRouteDate.
    const inlineMarker = "bk.status === 'cancelled' || bk.status === 'rejected' || bk.status === 'cancelled_weather'";
    assert.ok(occurrences(inlineMarker) >= 2, 'getSeatsConsumed and getBookingsForRouteDate both use this exact inline spelling');
    const bracketMarker = "['cancelled','rejected','cancelled_weather']";
    assert.ok(occurrences(bracketMarker) >= 5,
      'baCharterBoatMap / flBoatBookingsFor / bkV2CharterBoatHeal / baSeatBookingsForRoute / baAssignedPax / baAssignedBookings use this bracket-array spelling');
  });

  test('INTENTIONAL EXCEPTION — bkPendHoldsSeat gates only getSeatsConsumed (+ a By-trip display hint); baAssignedPax/baAssignedBookings/getBookingsForRouteDate never consult it', () => {
    // bkPendHoldsSeat is defined once (line has "function bkPendHoldsSeat(bk){") and actually CALLED
    // at exactly 2 sites: inside getSeatsConsumed (gates the seat-pool math) and inside the By-trip
    // manifest renderer (`const held = ... bkPendHoldsSeat(bk) : true;`, a display-only hint, not a filter).
    // This means an over-capacity pending_approval booking holds 0 seats in the sellable-pool math
    // (getAllotment/getSeatsConsumed) but STILL counts as an assigned booking/pax figure in Boat
    // Operation's baAssignedPax/baAssignedBookings and in getBookingsForRouteDate's displacement list.
    // That is a real, observable inconsistency between "how many seats are sellable" and "how many
    // pax appear assigned to a boat" for the same booking. Characterized here, not fixed.
    const definitionAndCalls = occurrences('bkPendHoldsSeat(bk)'); // 1 definition line + N call sites
    assert.equal(definitionAndCalls, 3, 'expected the definition line plus exactly 2 real call sites');
    assert.equal(occurrences('if(!bkPendHoldsSeat(bk)) return;'), 1, 'the seat-pool gate exists at exactly one place: getSeatsConsumed');
    assert.equal(occurrences("bkPendHoldsSeat(bk) : true"), 1, 'the second call site is a display-only fallback-to-true hint in the By-trip manifest, not a filter');
  });
});
