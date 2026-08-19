// LAM-25 (S2-01): THE single list the ticket asks for — one entry per field that
// `bkV2CommitBooking`'s edit-preserve block (allotment_v2.html, `if(editing){...}` around
// :76868-76956, doc: allotment_v2/docs/workflows/01-booking-lifecycle.md §3.2) must carry from
// the booking being edited (`editing`) onto the freshly-rebuilt `newBk`, or that data is silently
// destroyed on every save. edit-preserve.test.mjs generates its tests FROM this array — it does
// not hand-write a test per field. Add a field here and the suite gains its test automatically;
// remove or reword the matching line in allotment_v2.html and its test goes red (see
// docs/development/tasks/LAM-25.md "Verification" for the actual delete/run/restore/run proof).
//
// Overlap with LAM-77 (tests/legacy/edit-preserve.test.mjs, on origin/main, NOT on this branch):
// that suite characterizes the same source lines but groups 5-6 fields per `test()` (three
// sub-blocks) and does not cover b2cOverride, the resolved-approval carry, or the decided-
// focApproval carry at all. This file adds those three and re-expresses every field (including
// the ones LAM-77 already touches) as its own standalone test, generated from one list, per the
// LAM-25 ticket text ("One test per field, data-driven from a single list").
import assert from 'node:assert/strict';
import { extractLine, extractBetween } from './lib/source.mjs';

// ── Exact marker text, copied verbatim from allotment_v2.html (verified unique in the file) ──

const M_HISTORY = "if(Array.isArray(editing.history)) newBk.history = editing.history;";
const M_WEATHER_RESOLVE = "if(editing.weatherResolve) newBk.weatherResolve = editing.weatherResolve;";
const M_REBOOK = "if(editing.rebook) newBk.rebook = editing.rebook;";
const M_INVOICE_ID = "if(editing.invoiceId) newBk.invoiceId = editing.invoiceId;";
const M_PAYMENT_STATUS = "if(editing.paymentStatus) newBk.paymentStatus = editing.paymentStatus;";
const M_OPS = "if(editing.ops) newBk.ops = editing.ops;";
const M_B2C_OVERRIDE = "} else if(Array.isArray(editing.b2cOverride)){ newBk.b2cOverride = editing.b2cOverride; }";
const M_UPGRADES = "if(Array.isArray(editing.upgrades)) newBk.upgrades = editing.upgrades;";
const M_FEE_ITEMS = "if(Array.isArray(editing.feeItems)) newBk.feeItems = editing.feeItems;";
const M_RESCHEDULE = "if(editing.reschedule) newBk.reschedule = editing.reschedule;";
const M_PARTIAL_CANCELS = "if(Array.isArray(editing.partialCancels)) newBk.partialCancels = editing.partialCancels;";
const M_CANCELLATION = "if(editing.cancellation) newBk.cancellation = editing.cancellation;";
const M_CANCEL_CATEGORY = "if(editing.cancelCategory) newBk.cancelCategory = editing.cancelCategory;";

const M_APPROVAL_START = "} else if(editing && editing.approval && editing.approval.status!=='pending'){";
const M_APPROVAL_END = "newBk.approval = editing.approval;   // keep resolved approval record on later edits (audit)\n  }";

const M_FOC_START = "if(editing.focApproval && editing.focApproval.status && editing.focApproval.status !== 'pending' && newBk.focApproval){";
const M_FOC_END = "if(!newBk.confirmedAt) newBk.confirmedAt = editing.confirmedAt || new Date().toISOString();\n        }\n      }";

// ── Small code-shape helpers — each turns an extracted marker into a standalone, runnable
//    `apply(editing, newBk)` body. Kept here (not inlined per field) because two fields
//    (b2cOverride, approval) extract an `else if` branch whose leading `}` needs a matching
//    `if(false){` stub to become syntactically standalone; a real `bkV2IsB2CBk(editing)` /
//    `_approvalReq` check happens earlier in the real function and is out of scope for a single-
//    field carry-over check — that condition is stubbed to false/skipped on purpose. ──
const asStatement = (marker) => extractLine(marker);
// b2cOverride's whole else-if branch is itself a single self-contained line in the source
// (see M_B2C_OVERRIDE) — extractLine is enough; extractBetween needs two DIFFERENT markers to
// locate a start and a later end, which a single-line, single-occurrence marker can't satisfy.
const asElseIfLine = (marker) => 'if(false){' + extractLine(marker);
const asElseIfBlock = (startMarker, endMarker) => 'if(false){' + extractBetween(startMarker, endMarker);
const asIfBlock = (startMarker, endMarker) => extractBetween(startMarker, endMarker);

// ── THE single data-driven list ──
//
// Each entry:
//   key         - field name (also used in the generated test title)
//   sourceRef   - human note on where in allotment_v2.html this comes from, for the report
//   getCode()   - returns the real extracted source text to execute (throws if the line is gone)
//   present     - { editing, newBk, assert(out) } proving the field carries over when set
//   absent      - { editing, newBk, assert(out) } proving it is never fabricated out of nothing
export const CARRY_OVER_FIELDS = [
  {
    key: 'history',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block A',
    getCode: () => asStatement(M_HISTORY),
    present: {
      editing: { history: [{ kind: 'create', msg: 'Created booking', at: '2026-08-01T00:00:00.000Z' }] },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.history, editing.history),
    },
    absent: {
      editing: {},
      newBk: { history: 'kept-from-elsewhere' },
      assert: (out) => assert.equal(out.history, 'kept-from-elsewhere', 'no editing.history => the guard never fires => newBk.history is untouched by this line'),
    },
  },
  {
    key: 'weatherResolve',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block A',
    getCode: () => asStatement(M_WEATHER_RESOLVE),
    present: {
      editing: { weatherResolve: { resolvedBy: 'RM', resolvedAt: '2026-08-01', outcome: 'rebooked' } },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.weatherResolve, editing.weatherResolve),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('weatherResolve' in out, false, 'must not be fabricated when the booking was never weather-resolved'),
    },
  },
  {
    key: 'rebook',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block A',
    getCode: () => asStatement(M_REBOOK),
    present: {
      editing: { rebook: { fromBookingId: 'bk_100', reason: 'weather' } },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.rebook, editing.rebook),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('rebook' in out, false),
    },
  },
  {
    key: 'invoiceId',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block A',
    getCode: () => asStatement(M_INVOICE_ID),
    present: {
      editing: { invoiceId: 'inv_2026_0042' },
      newBk: {},
      assert: (out) => assert.equal(out.invoiceId, 'inv_2026_0042'),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('invoiceId' in out, false),
    },
  },
  {
    key: 'paymentStatus',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block A',
    getCode: () => asStatement(M_PAYMENT_STATUS),
    present: {
      editing: { paymentStatus: 'paid' },
      newBk: {},
      assert: (out) => assert.equal(out.paymentStatus, 'paid'),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('paymentStatus' in out, false),
    },
  },
  {
    key: 'ops',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block A — losing this once wiped every boat/van assignment (2026-06-14 data-loss bug)',
    getCode: () => asStatement(M_OPS),
    present: {
      editing: { ops: { boatId: 'boat_7', vanId: 'van_3', vanGroup: 2, vanSeq: 1 } },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.ops, editing.ops),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('ops' in out, false, 'a booking never assigned a boat/van must not get an ops object out of nowhere'),
    },
  },
  {
    key: 'b2cOverride',
    sourceRef: 'bkV2CommitBooking edit-preserve block, non-B2C else-if branch (the B2C merge/diff branch above it is separate B2C-only logic, out of scope for this single-field check)',
    getCode: () => asElseIfLine(M_B2C_OVERRIDE),
    present: {
      editing: { b2cOverride: ['pickupAreaId', 'hotelName'] },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.b2cOverride, editing.b2cOverride),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('b2cOverride' in out, false, 'a non-B2C booking with no override history must not get one fabricated'),
    },
  },
  {
    key: 'upgrades',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block B ("day-of records that live on the booking but aren\'t rebuilt from the form")',
    getCode: () => asStatement(M_UPGRADES),
    present: {
      editing: { upgrades: [{ id: 'u1', kind: 'seat-to-charter', amount: 1500 }] },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.upgrades, editing.upgrades),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('upgrades' in out, false),
    },
  },
  {
    key: 'feeItems',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block B',
    getCode: () => asStatement(M_FEE_ITEMS),
    present: {
      editing: { feeItems: [{ label: 'late change fee', amount: 300 }] },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.feeItems, editing.feeItems),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('feeItems' in out, false),
    },
  },
  {
    key: 'reschedule',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block B',
    getCode: () => asStatement(M_RESCHEDULE),
    present: {
      editing: { reschedule: { fromDate: '2026-09-01', toDate: '2026-09-05', reason: 'weather' } },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.reschedule, editing.reschedule),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('reschedule' in out, false),
    },
  },
  {
    key: 'partialCancels',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block B',
    getCode: () => asStatement(M_PARTIAL_CANCELS),
    present: {
      editing: { partialCancels: [{ pax: 1, refund: 500 }] },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.partialCancels, editing.partialCancels),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('partialCancels' in out, false),
    },
  },
  {
    key: 'cancellation',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block B',
    getCode: () => asStatement(M_CANCELLATION),
    present: {
      editing: { cancellation: { charged: true, amount: 2000, note: 'no-show' } },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.cancellation, editing.cancellation),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('cancellation' in out, false),
    },
  },
  {
    key: 'cancelCategory',
    sourceRef: 'bkV2CommitBooking edit-preserve block, sub-block B',
    getCode: () => asStatement(M_CANCEL_CATEGORY),
    present: {
      editing: { cancelCategory: 'weather' },
      newBk: {},
      assert: (out) => assert.equal(out.cancelCategory, 'weather'),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('cancelCategory' in out, false),
    },
  },
  {
    key: 'approval (resolved)',
    sourceRef: "bkV2CommitBooking edit-preserve block, resolved-approval carry (:~76852-76854) — 'keep resolved approval record on later edits (audit)'",
    getCode: () => asElseIfBlock(M_APPROVAL_START, M_APPROVAL_END),
    present: {
      editing: { approval: { status: 'approved', reason: 'over_capacity', approvedBy: 'Manager', approvedAt: '2026-08-01' } },
      newBk: {},
      assert: (out, editing) => assert.deepEqual(out.approval, editing.approval),
    },
    absent: {
      editing: {},
      newBk: {},
      assert: (out) => assert.equal('approval' in out, false, 'no prior approval record on the booking being edited => nothing to carry'),
    },
  },
  {
    key: 'focApproval (decided)',
    sourceRef: 'bkV2CommitBooking persist block (:~76948-76956) — keeps an already-approved/rejected FOC decision instead of resetting it to pending on re-submit, and un-downgrades status back to confirmed',
    getCode: () => asIfBlock(M_FOC_START, M_FOC_END),
    present: {
      editing: { focApproval: { status: 'approved', approvedAt: '2026-08-01T00:00:00.000Z', approvedBy: 'Manager', rejectReason: null } },
      newBk: {
        status: 'pending_foc',
        confirmedAt: null,
        focApproval: { count: 2, reason: 'staff', status: 'pending', requestedAt: '2026-08-05T00:00:00.000Z', requestedBy: 'RM' },
      },
      assert: (out, editing) => {
        assert.equal(out.focApproval.status, 'approved', 'the already-decided status overwrites the freshly-recomputed "pending"');
        assert.equal(out.focApproval.approvedAt, editing.focApproval.approvedAt);
        assert.equal(out.focApproval.approvedBy, editing.focApproval.approvedBy);
        assert.equal(out.focApproval.count, 2, 'the freshly-recomputed FOC count is NOT clobbered — only the decision fields are copied');
        assert.equal(out.status, 'confirmed', 're-submitting an already-FOC-approved booking must not downgrade it back to pending_foc');
        assert.ok(out.confirmedAt, 'confirmedAt gets stamped when the status un-downgrades and none was set yet');
      },
    },
    absent: {
      editing: {},
      newBk: { status: 'pending_foc', focApproval: { count: 2, reason: 'staff', status: 'pending' } },
      assert: (out) => {
        assert.deepEqual(out.focApproval, { count: 2, reason: 'staff', status: 'pending' }, 'no prior decision on editing.focApproval => the freshly-computed pending state is left alone');
        assert.equal(out.status, 'pending_foc', 'status is not touched when there is nothing decided to restore');
      },
    },
  },
];
