// Scenario 4 · seats: create a day seat lock for the office, then release part of it
// Legacy flow (08-app.js): Booking › Seat Locks tab (bkV2SwitchTab('locks')) › "+ ล็อกที่นั่ง" (bkV2OpenLockModal) › the form
// (bkV2LockSetField route/date/qty/holderType/reason) › "สร้างล็อก" (bkV2LockCreateSubmit → bkV2CreateLock; seats short:
// the "ที่นั่งว่างไม่พอ" sheet first, bkV2LkPendAskGo) ›
// the lock's "ปล่อย" button (bkV2LockReleaseConfirm) › the release sheet, 1 seat (bkV2ReleaseModalSet) ›
// "Release n" (bkV2ReleaseModalCommit → bkV2ReleaseLock).
import { RUN } from './_booking.mjs';
const REASON = 'UIP-SC4 office hold ' + RUN;
export default {
  name: 'seat-lock',
  title: 'create a seat lock, then release part of it',
  async prepare({ legacy, addDays, today }) {
    const date = addDays(today, 14);
    // the busiest sea route on that day (a route that surely runs then)
    const [r] = await legacy(`SELECT t.routeid AS route FROM operation_schemas.sb_bookings__trips t JOIN operation_schemas.sb_bookings b ON b.id = t.sb_bookings_id
      WHERE t.date = $1 AND b.status NOT IN ('cancelled','cancelled_weather','rejected') GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`, [date]);
    return { date, route: r.route, qty: 6 };
  },
  steps: (v) => [
    { nav: 'booking' },
    { label: 'Seat Locks tab', clickSel: `[onclick*="SwitchTab('locks'"]` },
    { label: '+ ล็อกที่นั่ง (open the lock form)', clickFn: 'bkV2OpenLockModal' },
    { label: 'route', choose: `select[onchange*="LockSetField('routeId'"]`, value: v.route },
    { label: 'date', fill: `input[type=date][onchange*="LockSetField('date'"]`, value: v.date },
    { label: 'seats', fill: `input[oninput*="LockSetField('qty'"]`, value: v.qty },
    // the holder: legacy's form starts on Agent (_bkV2LockForm), which asks "Type the agent that holds the lock"; this lock is the office's
    { label: 'holder: Office hold', choose: `select[onchange*="LockSetField('holderType'"]`, value: 'office' },
    { label: 'reason', fill: `input[oninput*="LockSetField('reason'"]`, value: REASON },
    { label: 'สร้างล็อก (create)', clickFn: 'bkV2LockCreateSubmit' },
    // §lkPend · seats short: legacy asks first ("ที่นั่งว่างไม่พอ", bkV2LkPendAskModal); lock what is free, the rest Pending. Not shown: nothing to do
    { label: 'seats short? lock what is free (bkV2LkPendAskGo split)', clickIf: '[data-lkpend="split"]' },
    { label: 'ปล่อย (release) on the new lock', clickFn: 'bkV2LockReleaseConfirm', near: REASON },
    // the sheet's number box (bkV2ReleaseModalSet(this.value)): release 1 seat (its Release button is off at 0)
    { label: 'release 1 seat (the number box)', fill: 'input[onchange*="ReleaseModalSet(this.value)"]', value: 1 },
    { label: 'Release (commit)', clickFn: 'bkV2ReleaseModalCommit' },
  ],
  async data({ legacy, ops, vars }) {
    const L = await legacy(`SELECT l.id, l.routeid AS route, l.date, l.holdertype AS holder, l.qty, l.status, l.reason,
        (SELECT json_agg(json_build_object('type', g.type, 'qty', g.qty) ORDER BY g.idx) FROM operation_schemas.sb_seat_locks__log g WHERE g.sb_seat_locks_id = l.id) AS log
      FROM operation_schemas.sb_seat_locks l WHERE l.reason = $1`, [REASON]);
    const N = await ops(`SELECT l.id, l.route_id AS route, l.service_date::text AS date, l.holder_type AS holder, l.pax AS qty, l.status, l.reason,
        (SELECT json_agg(json_build_object('type', e.type, 'qty', e.qty) ORDER BY e.at, e.id) FROM seat_lock_events e WHERE e.lock_id = l.id) AS log
      FROM seat_locks l WHERE l.reason = $1`, [REASON]);
    const rec = (x) => ({ route: x.route, date: x.date, holder: x.holder, qty: Number(x.qty), status: x.status, reason: x.reason, log: (x.log || []).map((g) => ({ type: g.type, qty: Number(g.qty) })) });
    void vars;
    return { legacy: L.map(rec), new: N.map(rec) };
  },
};
