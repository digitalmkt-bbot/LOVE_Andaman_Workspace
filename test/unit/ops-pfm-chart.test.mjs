// Daily PFM chart (js/ops/31-ops-pfm.js, pfmChartBuckets): every bucket missing from the cache is read in ONE call,
// GET /v1/pfm/totals?ranges=from..to,… (it was one GET /v1/pfm per bucket), the answer replaces the browser's sums,
// and a changed answer redraws the page once.
//   node --test test/unit/ops-pfm-chart.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/31-ops-pfm.js', 'utf8');
const BUCKETS = [['2026-10-01', '2026-10-31'], ['2026-11-01', '2026-11-30']];

function load(answer) {
  const calls = [];
  const window = {};
  window.laOps = {
    enabled: () => true,
    get: (path, q) => { calls.push({ path, q }); return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer); },
    onWrite: () => {}, onChange: () => {}, busy: () => false, today: () => '2026-11-25',
  };
  window.pfmChartBuckets = () => BUCKETS.map(([from, to]) => ({ from, to, tot: 1, paid: 1, unpaid: 0 }));
  window.renderDailyPFM = () => calls.push({ render: true });
  vm.runInNewContext(SOURCE, { window, document: { getElementById: (id) => (id === 'dailypfm-host' ? {} : null) }, console: { warn() {} }, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent });
  window.renderDailyPFM = () => calls.push({ render: true });   // count the redraws (the adapter's own wrap would load the list)
  return { window, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('one GET /v1/pfm/totals for every bucket, then the server\'s figures and one redraw', async () => {
  const answer = { ranges: [
    { from: '2026-10-01', to: '2026-10-31', totals: { total: 3_000_000, paid: 2_500_000, unpaid: 500_000 } },
    { from: '2026-11-01', to: '2026-11-30', totals: { total: 4_851_600, paid: 3_539_340, unpaid: 1_312_260 } },
  ] };
  const { window, calls } = load(answer);
  const first = window.pfmChartBuckets('2026-11-25', 'month');
  assert.deepEqual(first.map((b) => b.tot), [1, 1], 'the browser\'s sums show until the answer is in');
  const reads = calls.filter((c) => c.path);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].path, '/v1/pfm/totals');
  assert.equal(reads[0].q.ranges, '2026-10-01..2026-10-31,2026-11-01..2026-11-30');
  await tick();
  assert.equal(calls.filter((c) => c.render).length, 1, 'a changed answer redraws once');
  const again = window.pfmChartBuckets('2026-11-25', 'month');
  assert.deepEqual(again.map((b) => [b.tot, b.paid, b.unpaid]), [[3_000_000, 2_500_000, 500_000], [4_851_600, 3_539_340, 1_312_260]]);
  assert.equal(calls.filter((c) => c.path).length, 1, 'cached for 30 s: no second read');
});

test('a failed read keeps the browser\'s sums and does not redraw', async () => {
  const { window, calls } = load(new Error('down'));
  window.pfmChartBuckets('2026-11-25', 'month');
  await tick();
  assert.equal(calls.filter((c) => c.render).length, 0);
  assert.deepEqual(window.pfmChartBuckets('2026-11-25', 'month').map((b) => b.tot), [1, 1]);
});
