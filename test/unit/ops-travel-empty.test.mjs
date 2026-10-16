// §tsEmpty · the Travel Summary server snapshot says outright when operation-backend
// has no bookings for the day, instead of an all-zero grid that reads like a loading bug.
//   node --test test/unit/ops-travel-empty.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/33-ops-money-reports.js', 'utf8');

function load(payloadFor) {
  const host = { innerHTML: '' };
  const ctx = {
    console: { log() {}, warn() {} }, Promise, Date, Object, Array, Math, String, Number, JSON, encodeURIComponent, parseFloat, setTimeout,
    document: { getElementById: (id) => (id === 'travelsum-host' ? host : null) },
    _tsDate: '2026-10-14',
    renderTravelSum() { ctx.legacyCalled = true; },
    renderAccounting() {}, acctDashboardHtml() { return ''; }, acctStatementOpen() {}, renderDailyReport() {}, drCfgSet() {},
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => true,
    get: (path, q) => {
      if (path === '/v1/reports/travel-summary') return Promise.resolve(payloadFor(q));
      return Promise.reject(new Error('unexpected GET ' + path));
    },
    call: () => Promise.reject(new Error('no')), queue: (fn) => fn(),
    onWrite() {}, wrote() {}, fail() {}, loadingHtml: () => 'loading', today: () => '2026-10-14',
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, host };
}

const zero = (q) => ({
  date: q.date, bookings: 0, booked: 0, travelled: 0, no_show: 0, cxl: 0,
  money: {}, cot: {}, noshow: {}, collect_rows: [],
});
const busy = (q) => ({
  date: q.date, bookings: 38, booked: 80, travelled: 80, no_show: 0, cxl: 0,
  money: { to_collect: 6800 }, cot: { total: 6800 }, noshow: {},
  collect_rows: [{ booking_id: 'b1', voucher_ref: 'EXC32721', route_id: 'r10', target: 3400, paid: 0, due: 3400 }],
});

test('an empty server day is labelled as genuinely empty', async () => {
  const { ctx, host } = load(zero);
  await ctx.window.renderTravelSum();
  assert.match(host.innerHTML, /data-ops-ts-empty/, 'the empty-snapshot note renders');
  assert.match(host.innerHTML, /no bookings for 2026-10-14/);
});

test('a day with bookings renders the server numbers and no empty note', async () => {
  const { ctx, host } = load(busy);
  await ctx.window.renderTravelSum();
  assert.doesNotMatch(host.innerHTML, /data-ops-ts-empty/);
  assert.match(host.innerHTML, />38</, 'bookings card shows the server count');
  assert.match(host.innerHTML, /EXC32721/);
  assert.equal(ctx.legacyCalled, undefined, 'the legacy renderer is not used in ops mode');
});
