// C4 (§srvTotal): the boot loop in 08-app.js re-prices schemaVer!==2 bookings from the mock price
// tables. A booking cached from operation-backend (_fromOpsBackend) has no programId, so
// sbCalcBookingTotal returns 0 and wiped the server's total. It must keep the server total.
//   node --test test/unit/ops-v1-total.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const APP = fs.readFileSync(process.env.APP_FILE || 'allotment_v2/js/08-app.js', 'utf8');
const LINE = APP.split(/\r?\n/).find((l) => l.startsWith('SB_BOOKINGS.forEach(bk=>{ if(bk.schemaVer!==2'));

function run(list) {
  const ctx = { SB_BOOKINGS: list, sbCalcBookingTotal: (bk) => (bk.programId ? 100 : 0) };
  vm.createContext(ctx);
  vm.runInContext(LINE, ctx);
  return list;
}

test('boot re-pricing line exists', () => assert.ok(LINE));

test('server v1 booking keeps its stored total', () => {
  const [b] = run([{ id: 'x', schemaVer: 1, _fromOpsBackend: true, total: 4200 }]);
  assert.equal(b.total, 4200);
});

test('legacy v1 booking is still re-priced (legacy mode unchanged)', () => {
  const [b] = run([{ id: 'y', schemaVer: 1, programId: 'p1', total: 5 }]);
  assert.equal(b.total, 100);
});

test('v2 booking untouched', () => {
  const [b] = run([{ id: 'z', schemaVer: 2, total: 77 }]);
  assert.equal(b.total, 77);
});
