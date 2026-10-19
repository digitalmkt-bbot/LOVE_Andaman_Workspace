// Van bill (45-ops-van-bills.js): carCost is private to the adapter's closure, and the whole file needs a legacy page (_vb, vbPeriod ...),
// so the real two source lines (n, carCost) are cut out of the file and run. The server's car_cost wins over the browser's bill - ex + cut.
//   node --test test/unit/ops-server-value-van-bill-car-cost.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/45-ops-van-bills.js', 'utf8');
const pick = (re) => { const m = SRC.match(re); assert.ok(m, 'adapter line not found: ' + re); return m[0]; };
const ctx = vm.createContext({});
vm.runInContext(pick(/function n\(v\)\{[^\n]*\}/) + '\n' + pick(/function carCost\(x\)\{[^\n]*\}/) + '\nthis.carCost = carCost;', ctx);

test('car_cost from the server is drawn even when bill - ex + cut disagrees', () => {
  assert.equal(ctx.carCost({ car_cost: 4200, bill: 9999, ex: 1, cut: 1 }), 4200);
  assert.equal(ctx.carCost({ car_cost: 0, bill: 500, ex: 0, cut: 0 }), 0);
});

test('an answer without car_cost falls back to bill - ex + cut', () => {
  assert.equal(ctx.carCost({ bill: 5000, ex: 800, cut: 100 }), 4300);
});
