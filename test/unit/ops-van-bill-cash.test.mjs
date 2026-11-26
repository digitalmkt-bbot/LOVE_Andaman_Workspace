// UI parity L3 (2026-11-26, operation-backend fix/parity-fleet-van-1126d) · 45-ops-van-bills.js: the owner sheet's column O "จ่ายสด"
// (legacy §pcVanPay vbPayCell) is drawn from the server's row `cash`: a button for an unpaid row with a bill, "✓ จ่ายแล้ว" when the
// petty-cash line matches, "⚠ ... ต่าง" when it does not, "·" for a row with no bill. The adapter's closure needs a legacy page, so the
// real helper lines are cut out of the file and run (as ops-server-value-van-bill-car-cost.test.mjs does).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/45-ops-van-bills.js', 'utf8').replace(/\r\n/g, '\n');
const line = (re) => { const m = SRC.match(re); assert.ok(m, 'adapter line not found: ' + re); return m[0]; };
const block = (name) => { const i = SRC.indexOf('  function ' + name + '('); assert.ok(i >= 0, name); const j = SRC.indexOf('\n  }\n', i); return SRC.slice(i, j + 4); };
const ctx = vm.createContext({ VB_PIER_SH: { panwa: 'ภูเก็ต', tublamu: 'ทับละมุ' } });
vm.runInContext([line(/function n\(v\)\{[^\n]*\}/), line(/function text\(v\)\{[^\n]*\}/), line(/function esc\(v\)\{[^\n]*\}/), line(/function N\(v\)\{[^\n]*\}/),
  line(/function pierS\(p\)\{[^\n]*\}/), line(/function cashOf\(x\)\{[^\n]*\}/), block('payCell'), 'this.payCell = payCell; this.cashOf = cashOf;'].join('\n'), ctx);

const line1 = (amount, total, vans) => ({ row_id: 'pc1', pier: 'tublamu', date: '2026-10-27', amount, total, vans, by: 'AC.Tublamu' });
test('column O: pay button, paid, differs, nothing to pay', () => {
  assert.match(ctx.payCell('k1', 1750, ctx.cashOf({ bill: 1750 })), /vbp-btn[^>]*>💵 จ่ายสด 1,750<\/button>|&#128181; จ่ายสด 1,750/);
  assert.equal(ctx.payCell('k1', 0, ctx.cashOf({ bill: 0 })), '<span class="vbx-mut">·</span>');
  const paid = ctx.payCell('k1', 2800, { lines: [line1(2800, 5700, 2)], paid: 2800, diff: 0, state: 'paid' });
  assert.match(paid, /vbp-chip ok/); assert.match(paid, /จ่ายแล้ว ฿2,800/); assert.match(paid, /ทับละมุ 27\/10 · รวมใบ 2 คัน ฿5,700/);
  const off = ctx.payCell('k1', 2800, { lines: [line1(5600, 5600, 1)], paid: 5600, diff: -2800, state: 'differs' });
  assert.match(off, /vbp-chip warn/); assert.match(off, /จ่ายสด ฿5,600 · ต่าง 2,800/);
});
