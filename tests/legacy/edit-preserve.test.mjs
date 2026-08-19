// LAM-77 characterization: edit-preserve fields.
//
// CLAUDE.md §6 "Booking / edit": editing a booking rebuilds a fresh `newBk`
// inside bkV2CommitBooking, so the `if(editing){...}` block must carry over
// ops (boat/van assignment!), upgrades, feeItems, reschedule, partialCancels,
// cancellation, cancelCategory — plus history/weatherResolve/rebook/invoiceId/
// paymentStatus. Miss one and that field is silently wiped on every edit.
//
// This suite extracts the REAL carry-over lines (three contiguous sub-blocks,
// see the markers below) straight from allotment_v2.html and executes them
// against fixture `editing` / freshly-rebuilt `newBk` objects, proving today's
// behavior field-by-field. A future change that drops one of these lines will
// make the matching test fail.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractBetween } from './lib/source.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

// Sub-block A: simple scalar/array carry-overs (history .. ops).
const blockA = extractBetween(
  'if(Array.isArray(editing.history)) newBk.history = editing.history;',
  'if(editing.ops) newBk.ops = editing.ops;'
);

// Sub-block B: "day-of records that live on the booking but aren't rebuilt from the form".
const blockB = extractBetween(
  'if(Array.isArray(editing.upgrades)) newBk.upgrades = editing.upgrades;',
  'if(editing.cancelCategory) newBk.cancelCategory = editing.cancelCategory;'
);

// Sub-block C: travel-date-changed → clear the OLD day's boat/van assignment (charter keeps its boat).
// The extracted text opens one `if(...){` that the source closes on the NEXT line (outside our end
// marker) — append the matching `}` ourselves so the block is syntactically complete on its own.
const blockC = extractBetween(
  "const _oldD=[...new Set((editing.trips||[]).map(t=>t.date).filter(Boolean))].sort().join(',');",
  "ล้างการจัดเรือ/รถของวันเดิม','Edited');"
) + '\n}';

function runBlock(blockSrc, editing, newBk, extraGlobals = {}) {
  const wrapped = `function apply(editing, newBk, bkV2AddHistory) { ${blockSrc} \n return newBk; }`;
  const { apply } = runInSandbox(wrapped, { ...extraGlobals }, ['apply']);
  const historyLog = [];
  const bkV2AddHistory = (bk, kind, msg) => { historyLog.push({ kind, msg }); };
  const out = apply(editing, newBk, bkV2AddHistory);
  return { out: JSON.parse(JSON.stringify(out)), historyLog };
}

describe('edit-preserve — sub-block A (history, weatherResolve, rebook, invoiceId, paymentStatus, ops)', () => {
  test('all five carry over from `editing` onto the freshly-rebuilt `newBk` when present', () => {
    const editing = {
      history: [{ kind: 'create' }],
      weatherResolve: { resolvedBy: 'RM' },
      rebook: { fromId: 'bk0' },
      invoiceId: 'inv_1',
      paymentStatus: 'paid',
      ops: { boatId: 'boat1', vanId: 'van1' },
    };
    const newBk = {}; // fresh rebuild — none of these fields exist yet
    const { out } = runBlock(blockA, editing, newBk);
    assert.deepEqual(out.history, editing.history);
    assert.deepEqual(out.weatherResolve, editing.weatherResolve);
    assert.deepEqual(out.rebook, editing.rebook);
    assert.equal(out.invoiceId, 'inv_1');
    assert.equal(out.paymentStatus, 'paid');
    assert.deepEqual(out.ops, editing.ops);
  });

  test('a field absent/falsy on `editing` is left alone on `newBk` (this block never explicitly clears anything)', () => {
    const editing = { history: [] }; // Array.isArray([]) is true → history IS copied even though it's empty
    const newBk = { invoiceId: 'kept-from-elsewhere' };
    const { out } = runBlock(blockA, editing, newBk);
    assert.deepEqual(out.history, []);
    assert.equal(out.invoiceId, 'kept-from-elsewhere', 'no invoiceId on editing => the if() guard never runs => newBk.invoiceId is untouched by this block');
    assert.equal('ops' in out, false, 'no ops on editing => newBk.ops is never created here');
  });
});

describe('edit-preserve — sub-block B (upgrades, feeItems, reschedule, partialCancels, cancellation, cancelCategory)', () => {
  test('all six day-of record fields carry over when present on `editing`', () => {
    const editing = {
      upgrades: [{ id: 'u1' }],
      feeItems: [{ amount: 500 }],
      reschedule: { from: '2026-09-01', to: '2026-09-05' },
      partialCancels: [{ pax: 1 }],
      cancellation: { charged: true },
      cancelCategory: 'weather',
    };
    const newBk = {};
    const { out } = runBlock(blockB, editing, newBk);
    assert.deepEqual(out.upgrades, editing.upgrades);
    assert.deepEqual(out.feeItems, editing.feeItems);
    assert.deepEqual(out.reschedule, editing.reschedule);
    assert.deepEqual(out.partialCancels, editing.partialCancels);
    assert.deepEqual(out.cancellation, editing.cancellation);
    assert.equal(out.cancelCategory, 'weather');
  });

  test('a booking being edited for the first time (no prior upgrades/fees/etc.) leaves newBk without these keys', () => {
    const editing = {};
    const newBk = {};
    const { out } = runBlock(blockB, editing, newBk);
    for (const k of ['upgrades', 'feeItems', 'reschedule', 'partialCancels', 'cancellation', 'cancelCategory']) {
      assert.equal(k in out, false, `${k} must not be created out of nothing`);
    }
  });
});

describe('edit-preserve — sub-block C (travel-date change clears the OLD day\'s boat/van, charter boat is exempt)', () => {
  test('a seat-mode booking whose date changed has its boat/van assignment cleared, and gets a history entry', () => {
    const editing = { trips: [{ date: '2026-09-01' }] };
    const newBk = {
      trips: [{ date: '2026-09-05' }],
      ops: { boatId: 'boat1', vanId: 'van1', vanReturnId: 'van2', returnSameVan: true, vanGroup: 3, vanSeq: 1, vanSplits: [{ x: 1 }], pickupTimeFinal: '08:00' },
    };
    const { out, historyLog } = runBlock(blockC, editing, newBk);
    assert.equal(out.ops.boatId, null, 'seat-mode boat assignment is cleared on a date change');
    assert.equal(out.ops.vanId, null);
    assert.equal(out.ops.vanReturnId, null);
    assert.equal(out.ops.returnSameVan, false);
    assert.equal(out.ops.vanGroup, 0);
    assert.equal(out.ops.vanSeq, 0);
    assert.deepEqual(out.ops.vanSplits, []);
    assert.equal(out.ops.pickupTimeFinal, '');
    assert.equal(historyLog.length, 1, 'a history entry documents the auto-clear');
  });

  test('a CHARTER booking keeps its boat across a date change — only the van/pickup fields are cleared', () => {
    const editing = { trips: [{ date: '2026-09-01' }] };
    const newBk = {
      trips: [{ date: '2026-09-05', bookingMode: 'charter' }],
      ops: { boatId: 'charterBoat1', vanId: 'van1' },
    };
    const { out } = runBlock(blockC, editing, newBk);
    assert.equal(out.ops.boatId, 'charterBoat1', 'charter boat assignment travels with the trip, unlike a seat-mode boat');
    assert.equal(out.ops.vanId, null);
  });

  test('same travel date (no change) leaves ops completely untouched', () => {
    const editing = { trips: [{ date: '2026-09-01' }] };
    const newBk = { trips: [{ date: '2026-09-01' }], ops: { boatId: 'boat1', vanId: 'van1' } };
    const { out, historyLog } = runBlock(blockC, editing, newBk);
    assert.deepEqual(out.ops, { boatId: 'boat1', vanId: 'van1' });
    assert.equal(historyLog.length, 0);
  });

  test('a booking with no ops block at all (never assigned) is not given one just because the date changed', () => {
    const editing = { trips: [{ date: '2026-09-01' }] };
    const newBk = { trips: [{ date: '2026-09-05' }] }; // no ops key
    const { out, historyLog } = runBlock(blockC, editing, newBk);
    assert.equal('ops' in out, false, 'the guard is `&& newBk.ops` — it requires an existing ops object to mutate');
    assert.equal(historyLog.length, 0);
  });
});
