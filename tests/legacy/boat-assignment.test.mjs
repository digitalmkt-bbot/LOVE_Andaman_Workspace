// LAM-77 characterization: boat assignment.
//
// CLAUDE.md §6 "Vans / boats": "Charter boats are excluded from the seat
// pool." and "Capacity model ... Boat-assign tolerance = cap+2 (BA_CAP_TOL)."
//
// This suite executes the REAL bkV2AssignBoat() plus its small real
// dependency cluster (bkTripDates/bkIsFirstDay/bkOpsRead/bkOpsFor/bkOpsDate,
// baCharterBoatMap/baCharterBoatMapMemo/baCharterBoatIds) extracted verbatim
// from allotment_v2.html. baAssignedPax (a "split boat across N boats" edge
// case, see CLAUDE.md §boatSplit) is stubbed rather than extracted — it pulls
// in bkBoatPaxOnBoat and the whole boat-split model, which is out of this
// task's scope; that is a deliberate simplification, documented here and in
// docs/development/tasks/LAM-77.md, not a claim that it was characterized.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction, getSource } from './lib/source.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

const BA_CAP_TOL = (() => {
  const src = getSource();
  const marker = 'const BA_CAP_TOL = ';
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error('BA_CAP_TOL declaration not found');
  return Number(src.slice(idx + marker.length, src.indexOf(';', idx)));
})();

const clusterCode = [
  extractFunction('bkTripDates'),
  extractFunction('bkIsFirstDay'),
  extractFunction('bkOpsRead'),
  extractFunction('bkOpsFor'),
  extractFunction('bkOpsDate'),
  extractFunction('baCharterBoatMap'),
  extractFunction('baCharterBoatMapMemo'),
  extractFunction('baCharterBoatIds'),
  extractFunction('bkV2AssignBoat'),
].join('\n');

function makeSandbox({ SB_BOOKINGS, BOATS, baAssignedPaxImpl = () => 0, boatCapForImpl }) {
  const alerts = [];
  const confirms = [];
  const rendered = { acctPersistBookings: 0, renderBoatAssign: 0, bkV2Render: 0 };
  const globals = {
    SB_BOOKINGS,
    BOATS,
    BA_CAP_TOL,
    _baChMemo: null,
    alert: (msg) => { alerts.push(msg); },
    confirm: (msg) => { confirms.push(msg); return true; },
    baAssignedPax: baAssignedPaxImpl,
    boatCapFor: boatCapForImpl, // omit to fall back to bo.cap, per source: `(typeof boatCapFor==='function')?...`
    bkV2PaxAllTot: (pax) => {
      if (!pax) return 0;
      const k = (kind) => (pax[kind] || 0) + (pax[`${kind}_fr`] || 0) + (pax[`${kind}_th`] || 0);
      return k('ad') + k('chd') + k('inf') + k('foc');
    },
    acctPersistBookings: () => { rendered.acctPersistBookings++; },
    renderBoatAssign: () => { rendered.renderBoatAssign++; },
    _bkV2: null, // falsy => always falls through to renderBoatAssign(), matching a non-Booking-v2 caller
  };
  if (boatCapForImpl === undefined) delete globals.boatCapFor;
  const sandbox = runInSandbox(clusterCode, globals, ['bkV2AssignBoat']);
  return { ...sandbox, alerts, confirms, rendered, SB_BOOKINGS };
}

describe('boat assignment — charter boats are excluded from the seat-pool assign picker', () => {
  test('assigning a booking to a boat that is chartered on that date is BLOCKED with an alert; the booking is left unassigned', () => {
    const SB_BOOKINGS = [
      { id: 'charterBk', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', bookingMode: 'charter', charterBoatId: 'boatA' }] },
      { id: 'seatBk', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 2 } }] },
    ];
    const BOATS = [{ id: 'boatA', name: 'Andaman Ryder', cap: 20 }];
    const { bkV2AssignBoat, alerts, SB_BOOKINGS: after } = makeSandbox({ SB_BOOKINGS, BOATS });
    bkV2AssignBoat('seatBk', 'boatA', '2026-09-01');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /ถูกใช้เป็นเหมาลำ \(Charter\)/);
    const seatBk = after.find(b => b.id === 'seatBk');
    assert.equal((seatBk.ops || {}).boatId, undefined, 'the seat booking must not have been assigned to the chartered boat');
  });
});

describe('boat assignment — cap + BA_CAP_TOL tolerance', () => {
  test(`BA_CAP_TOL is currently ${BA_CAP_TOL} (read live from allotment_v2.html, not hardcoded here)`, () => {
    assert.equal(BA_CAP_TOL, 2);
  });

  test('assigning up to cap + BA_CAP_TOL pax succeeds (no alert, boatId is set)', () => {
    const SB_BOOKINGS = [{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 12 } }] }];
    const BOATS = [{ id: 'boatA', name: 'Boat A', cap: 10 }]; // cap=10, TOL=2 → max allowed 12
    const { bkV2AssignBoat, alerts, SB_BOOKINGS: after } = makeSandbox({
      SB_BOOKINGS, BOATS, baAssignedPaxImpl: () => 0,
    });
    bkV2AssignBoat('bk1', 'boatA', '2026-09-01');
    assert.equal(alerts.length, 0);
    assert.equal(after.find(b => b.id === 'bk1').ops.boatId, 'boatA');
  });

  test('assigning ONE pax over cap + BA_CAP_TOL is BLOCKED — the boundary is strictly ">"', () => {
    const SB_BOOKINGS = [{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 13 } }] }];
    const BOATS = [{ id: 'boatA', name: 'Boat A', cap: 10 }]; // max allowed 12; this booking alone needs 13
    const { bkV2AssignBoat, alerts, SB_BOOKINGS: after } = makeSandbox({
      SB_BOOKINGS, BOATS, baAssignedPaxImpl: () => 0,
    });
    bkV2AssignBoat('bk1', 'boatA', '2026-09-01');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /would have 13 pax on 2026-09-01 \(cap 10, max allowed 12\)/);
    assert.equal((after.find(b => b.id === 'bk1').ops || {}).boatId, undefined);
  });

  test('the cap check counts pax ALREADY on the boat that date from OTHER bookings (baAssignedPax), not just this booking', () => {
    const SB_BOOKINGS = [{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 3 } }] }];
    const BOATS = [{ id: 'boatA', name: 'Boat A', cap: 10 }]; // max allowed 12
    const { bkV2AssignBoat, alerts } = makeSandbox({
      SB_BOOKINGS, BOATS, baAssignedPaxImpl: () => 10, // 10 pax already on boatA from other bookings
    });
    // 10 (already there) + 3 (this booking) = 13 > 12 → blocked
    bkV2AssignBoat('bk1', 'boatA', '2026-09-01');
    assert.equal(alerts.length, 1);
  });

  test('re-assigning a booking that is ALREADY on this boat does not double-count its own pax against the cap', () => {
    const SB_BOOKINGS = [{
      id: 'bk1', status: 'confirmed', ops: { boatId: 'boatA' },
      trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 12 } }],
    }];
    const BOATS = [{ id: 'boatA', name: 'Boat A', cap: 10 }]; // max allowed 12
    const { bkV2AssignBoat, alerts } = makeSandbox({
      SB_BOOKINGS, BOATS,
      // baAssignedPax reports the total already on the boat, WHICH INCLUDES this booking's own 12 pax.
      baAssignedPaxImpl: () => 12,
    });
    // Re-clicking "assign to boatA" for a booking already there must not be blocked by counting its
    // own pax twice: already=12 (self, subtracted) → next = 12 - 12 + 12 = 12, exactly at the boundary.
    bkV2AssignBoat('bk1', 'boatA', '2026-09-01');
    assert.equal(alerts.length, 0, 'assigning a booking to the boat it is already on must not self-double-count');
  });

  test('a boat with cap 0 (or missing) skips the capacity check entirely — no alert regardless of pax', () => {
    const SB_BOOKINGS = [{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 999 } }] }];
    const BOATS = [{ id: 'boatA', name: 'Boat A', cap: 0 }];
    const { bkV2AssignBoat, alerts, SB_BOOKINGS: after } = makeSandbox({ SB_BOOKINGS, BOATS });
    bkV2AssignBoat('bk1', 'boatA', '2026-09-01');
    assert.equal(alerts.length, 0, 'the guard is `if(cap>0){...}` — a 0/unset cap is treated as "no cap enforced", not "zero capacity"');
    assert.equal(after.find(b => b.id === 'bk1').ops.boatId, 'boatA');
  });

  test('unassigning (boatId = null/"") always succeeds — the cap check only runs `if(boatId){...}`', () => {
    const SB_BOOKINGS = [{ id: 'bk1', status: 'confirmed', ops: { boatId: 'boatA' }, trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 999 } }] }];
    const BOATS = [{ id: 'boatA', name: 'Boat A', cap: 1 }];
    const { bkV2AssignBoat, alerts, SB_BOOKINGS: after } = makeSandbox({ SB_BOOKINGS, BOATS });
    bkV2AssignBoat('bk1', null, '2026-09-01');
    assert.equal(alerts.length, 0);
    assert.equal(after.find(b => b.id === 'bk1').ops.boatId, null);
  });

  test('a per-day cap override (boatCapFor) takes precedence over the boat\'s flat `cap` field', () => {
    const SB_BOOKINGS = [{ id: 'bk1', status: 'confirmed', trips: [{ date: '2026-09-01', routeId: 'r1', pax: { ad: 5 } }] }];
    const BOATS = [{ id: 'boatA', name: 'Boat A', cap: 10 }]; // flat cap would allow 5 easily
    const { bkV2AssignBoat, alerts } = makeSandbox({
      SB_BOOKINGS, BOATS,
      boatCapForImpl: () => 2, // today's override: only 2 (+2 tol = max 4) — 5 should now be blocked
    });
    bkV2AssignBoat('bk1', 'boatA', '2026-09-01');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /cap 2, max allowed 4/);
  });
});
