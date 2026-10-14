// §drTrend · Daily Report 14-day trend by market, from the server's per-day by_market and daily-counts.
//   node --test test/unit/ops-daily-trend.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const REPORTS = fs.readFileSync('allotment_v2/js/ops/33-ops-money-reports.js', 'utf8');
const TREND = fs.readFileSync('allotment_v2/js/ops/58-ops-daily-trend.js', 'utf8');
const DATE = '2026-10-14';

function dayPayload(date) {
  const day = Number(date.slice(8));
  const by = [
    { id: 'm1', name: 'Direct', color: '#111111', pax: day },
    { id: 'm2', name: 'Asia', color: null, pax: 2 },
    ...['m3', 'm4', 'm5', 'm6', 'm7'].map((id, i) => ({ id, name: id, color: null, pax: 1 + i })),
  ];
  return { date, bookings: 1, pax: { total: by.reduce((s, m) => s + m.pax, 0) }, by_market: by, by_route: [], by_agent: [], van_cost: {} };
}
function load(extra = {}) {
  const trend = { innerHTML: '' }, host = { innerHTML: '' };
  const reads = [];
  const ctx = {
    console: { log() {}, warn() {} }, Promise, Date, Object, Array, Math, String, Number, JSON, encodeURIComponent, parseFloat, setTimeout,
    document: { getElementById: (id) => (id === 'dr-trend-host' ? trend : id === 'dailyreport-host' ? host : null) },
    _drDate: DATE, _drTrendMode: 'travel',
    renderTravelSum() {}, renderAccounting() {}, acctDashboardHtml() { return ''; }, acctStatementOpen() {}, renderDailyReport() {}, drCfgSet() {},
    ...extra,
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => true,
    get: (path, q) => {
      reads.push([path, q]);
      if (path === '/v1/reports/daily') return Promise.resolve(dayPayload(q.date));
      if (path === '/v1/reports/daily/settings') return Promise.resolve({});
      if (path === '/v1/bookings/daily-counts') return Promise.resolve({ days: [{ date: q.from, bookings: 2, pax: 7 }, { date: q.to, bookings: 3, pax: 11 }], total_bookings: 5, total_pax: 18 });
      return Promise.reject(new Error('unexpected GET ' + path));
    },
    call: () => Promise.reject(new Error('no')), queue: (fn) => fn(), onWrite() {}, wrote() {}, fail() {}, loadingHtml: () => 'loading', today: () => DATE,
  };
  vm.createContext(ctx);
  vm.runInContext(REPORTS, ctx);
  vm.runInContext(TREND, ctx);
  return { ctx, trend, host, reads };
}
const settle = () => new Promise((r) => setTimeout(r, 30));

test('the Daily Report leaves a trend slot and the trend fills it after the render', async () => {
  const { ctx, trend, host } = load();
  await ctx.window.renderDailyReport();
  assert.match(host.innerHTML, /id="dr-trend-host"/);
  await settle();
  assert.match(trend.innerHTML, /14 days by market/);
});

test('travel-date mode reads the server day report for 14 days, 2 back to 11 ahead', async () => {
  const { ctx, trend, reads } = load();
  await ctx.window.renderDailyReport(); await settle();
  const dates = [...new Set(reads.filter(([p]) => p === '/v1/reports/daily').map(([, q]) => q.date))].sort();
  assert.equal(dates.length, 14);
  assert.equal(dates[0], '2026-10-12');
  assert.equal(dates[13], '2026-10-25');
  assert.equal((trend.innerHTML.match(/data-ops-dr-day=/g) || []).length, 14);
});

test('markets beyond the top five fold into Other, and the selected day is marked', async () => {
  const { ctx, trend } = load();
  await ctx.window.renderDailyReport(); await settle();
  assert.match(trend.innerHTML, />Other</);
  assert.match(trend.innerHTML, /Direct/);
  assert.ok(!/>m3</.test(trend.innerHTML), 'the smallest market is inside Other');
  assert.match(trend.innerHTML, /outline:1px solid #1683C7/);
});

test('booking-date mode uses daily-counts totals and says it is not split by market', async () => {
  const { ctx, trend, reads } = load({ _drTrendMode: 'booked' });
  await ctx.window.renderDailyReport(); await settle();
  const counts = reads.filter(([p]) => p === '/v1/bookings/daily-counts');
  assert.equal(counts.length, 1);
  assert.equal(counts[0][1].to, DATE);
  assert.equal(counts[0][1].from, '2026-10-01');
  assert.match(trend.innerHTML, /All markets/);
  assert.match(trend.innerHTML, /data-ops-dr-bookednote/);
  assert.match(trend.innerHTML, /Total 18 pax/);
});

test('a failed read shows an error in the slot and a toast, not a stale chart', async () => {
  const { ctx, trend } = load();
  const fails = []; ctx.laOps.fail = (t) => fails.push(t);
  const get = ctx.laOps.get;
  ctx.laOps.get = (p, q) => (p === '/v1/reports/daily' && q.date === '2026-10-20' ? Promise.reject(new Error('boom')) : get(p, q));
  await ctx.window.renderDailyReport(); await settle();
  assert.match(trend.innerHTML, /data-ops-dr-trend-error/);
  assert.equal(fails.length, 1);
});
