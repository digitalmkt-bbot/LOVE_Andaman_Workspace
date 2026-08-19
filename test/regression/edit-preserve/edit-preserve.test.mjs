// LAM-25 (S2-01): Regression suite for bkV2CommitBooking's edit-preserve block.
//
// CLAUDE.md §6 "Booking / edit": editing a booking rebuilds a fresh `newBk` inside
// `bkV2CommitBooking` — anything not explicitly carried over in the `if(editing){...}` block is
// silently destroyed on save. `ops` alone (boat/van assignment) was wiped this way in production
// on 2026-06-14.
//
// This suite is entirely data-driven from ONE list, `CARRY_OVER_FIELDS` in `./fields.mjs` — it
// does not hand-write per-field tests. Each entry supplies the exact marker text of its
// carry-over line(s) as they appear in allotment_v2.html today; the loop below extracts that
// text straight out of the real file, runs it in an isolated `vm` sandbox against small
// `editing`/`newBk` fixtures, and asserts the real behavior. Deleting or rewording a carry-over
// line in allotment_v2.html makes `extractLine`/`extractBetween` throw for exactly that field,
// so exactly that field's tests go red — see docs/development/tasks/LAM-25.md "Verification" for
// the actual delete → red → restore → green proof (done against a throwaway copy of the file, via
// EDIT_PRESERVE_HTML_PATH — this suite never writes to the tracked allotment_v2.html).
//
// Overlap with LAM-77 (tests/legacy/edit-preserve.test.mjs on origin/main, not on this branch):
// see the header comment in ./fields.mjs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CARRY_OVER_FIELDS } from './fields.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

function runField(field, editing, newBk) {
  const code = field.getCode(); // throws if the field's line(s) are gone from allotment_v2.html
  const wrapped = `function apply(editing, newBk) { ${code}\n return newBk; }`;
  const { apply } = runInSandbox(wrapped, {}, ['apply']);
  const out = apply(editing, newBk);
  // Round-trip through JSON so the assertion sees plain data, matching how the real value
  // eventually gets JSON-persisted — and so a vm-realm object identity quirk can't hide a bug.
  return JSON.parse(JSON.stringify(out));
}

describe('edit-preserve — one test per carry-over field (data-driven from fields.mjs)', () => {
  for (const field of CARRY_OVER_FIELDS) {
    test(`${field.key} carries over from the booking being edited onto the rebuilt newBk`, () => {
      const editing = structuredClone(field.present.editing);
      const newBk = structuredClone(field.present.newBk);
      const out = runField(field, editing, newBk);
      field.present.assert(out, editing);
    });

    test(`${field.key} is not fabricated on newBk when absent/undecided on the booking being edited`, () => {
      const editing = structuredClone(field.absent.editing);
      const newBk = structuredClone(field.absent.newBk);
      const out = runField(field, editing, newBk);
      field.absent.assert(out, editing);
    });
  }
});

describe('edit-preserve — field-list coverage', () => {
  test('CARRY_OVER_FIELDS names every field the LAM-25 ticket lists', () => {
    const required = [
      'history', 'weatherResolve', 'rebook', 'invoiceId', 'paymentStatus', 'ops', 'b2cOverride',
      'upgrades', 'feeItems', 'reschedule', 'partialCancels', 'cancellation', 'cancelCategory',
      'approval (resolved)', 'focApproval (decided)',
    ];
    const have = CARRY_OVER_FIELDS.map((f) => f.key);
    for (const key of required) {
      assert.ok(have.includes(key), `CARRY_OVER_FIELDS is missing an entry for "${key}"`);
    }
    assert.equal(have.length, required.length, 'CARRY_OVER_FIELDS has an unexpected extra/missing entry vs. the ticket list');
  });
});
