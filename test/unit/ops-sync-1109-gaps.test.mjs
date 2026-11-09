// lk-inbox sync 2026-11-09 · §focType: the FOC reason's fixed type goes to the server (foc_type) and comes back to the form.
// (§pxGuideJob, the Trip P&L guide lines from the guide order, is the server's: 44-ops-costing-pl.js shows its rows' `why` as they come.)
//   node --test test/unit/ops-sync-1109-gaps.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/40-ops-bookings.js', 'utf8');
function load() {
  const ctx = { console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    SB_BOOKINGS: [] };
  ctx.window = ctx;
  ctx.laOps = new Proxy({ enabled: () => true }, { get: (t, k) => (k in t ? t[k] : () => null) });
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx.laOps.bookings;
}
const bk = (extra) => ({ id: 'B1', status: 'pending_foc', leadPax: 'A', passengers: [],
  trips: [{ routeId: 'r1', date: '2026-11-20', pickupTime: '', pax: { ad_fr: 2, foc_fr: 1 } }], ...extra });

test('§focType toServer: the type legacy\'s commit set goes as focType beside the readable reason', () => {
  const B = load();
  const sent = B.toServer(bk({ focType: 'guide', focApproval: { count: 1, type: 'guide', reason: 'ไกด์ / Tour Leader · Pum', status: 'pending' } }), true);
  assert.deepEqual([sent.focType, sent.focReason], ['guide', 'ไกด์ / Tour Leader · Pum']);
  assert.equal(B.toServer(bk({ focApproval: { type: 'fam', reason: 'Fam trip' } }), true).focType, 'fam', 'the approval\'s type when the booking has none of its own');
});

test('§focType toServer: no type on a new booking sends nothing; cleared on an edit sends null; a booking that never had it sends nothing', () => {
  const B = load();
  assert.equal('focType' in B.toServer(bk({ focType: '' }), true), false, 'create: nothing to clear');
  assert.equal(B.toServer(bk({ focType: '' }), false).focType, null, 'edit: FOC gone, the stored type is cleared');
  assert.equal('focType' in B.toServer(bk({}), false), false, 'an older booking: the server keeps what it has');
});

test('§focType fromServer: foc_type reads back as focType and focApproval.type, so the edit form splits the reason by the type, not by a guess', () => {
  const B = load();
  const ob = { id: 'ob_1', external_id: 'B1', version: 2, status: 'pending_foc', foc_reason: 'Inspection · new guide', foc_type: 'insp',
    trips: [], approvals: [{ kind: 'foc', status: 'pending', foc_count: 1, requested_at: '2026-11-09T01:00:00Z' }] };
  const got = B.fromServer(ob);
  assert.deepEqual([got.focType, got.focReason, got.focApproval.type, got.focApproval.reason], ['insp', 'Inspection · new guide', 'insp', 'Inspection · new guide']);
  const none = B.fromServer({ ...ob, foc_type: undefined });
  assert.deepEqual([none.focType, none.focApproval.type], ['', ''], 'none stored: legacy\'s focReasonSplit reads the label off the reason');
});
