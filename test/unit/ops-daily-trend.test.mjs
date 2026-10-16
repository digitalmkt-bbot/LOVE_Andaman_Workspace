// §drTrend · Daily Report 14-day series, from the server's per-day by_market and daily-counts,
//   in the legacy drTrend shape (59-ops-daily-report.js draws it with the legacy drChart).
//   node --test test/unit/ops-daily-trend.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const TREND = fs.readFileSync('allotment_v2/js/ops/58-ops-daily-trend.js', 'utf8');
const DATE = '2026-10-14';
const PALETTE = ['#2563eb', '#14b8a6', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#64748b', '#0ea5e9', '#f43f5e', '#84cc16'];

function dayPayload(date) {
  const day = Number(date.slice(8));
  const by = [
    { id: 'm1', name: 'Direct', color: '#111111', pax: day },
    { id: 'm2', name: 'Asia', color: null, pax: 2 },
    ...['m3', 'm4', 'm5', 'm6', 'm7'].map((id, i) => ({ id, name: id, color: null, pax: 1 + i })),
  ];
  return { date, bookings: 1, pax: { total: by.reduce((s, m) => s + m.pax, 0) }, by_market: by };
}
function load() {
  const reads = [];
  const ctx = { console: { log() {}, warn() {} }, Promise, Date, Object, Array, Math, String, Number, JSON, setTimeout, DR_PALETTE: PALETTE };
  ctx.window = ctx;
  ctx.laOps = {
    get: (path, q) => {
      reads.push([path, q]);
      if (path === '/v1/reports/daily') return Promise.resolve(dayPayload(q.date));
      if (path === '/v1/bookings/daily-counts') return Promise.resolve({ days: [{ date: q.from, bookings: 2, pax: 7 }, { date: q.to, bookings: 3, pax: 11 }] });
      return Promise.reject(new Error('unexpected GET ' + path));
    },
    onWrite() {},
  };
  vm.createContext(ctx);
  vm.runInContext(TREND, ctx);
  return { T: ctx.laOps.dailyTrend, reads };
}

test('travel date reads the server day report for 14 days, 2 back to 11 ahead', async () => {
  const { T, reads } = load();
  const S = await T.travelSeries(DATE);
  const dates = reads.map(([, q]) => q.date).sort();
  assert.equal(dates.length, 14);
  assert.equal(dates[0], '2026-10-12');
  assert.equal(dates[13], '2026-10-25');
  assert.equal(S.pts.length, 14);
  assert.ok(S.pts.find((p) => p.date === DATE).today);
  assert.equal(S.pts[0].lb, '12 ต.ค.', 'legacy label: month on the first point');
  assert.equal(S.pts[1].lb, '13');
});

test('markets past five fold into the legacy "อื่น ๆ", coloured by the legacy palette in total order', async () => {
  const { T } = load();
  const S = await T.travelSeries(DATE);
  assert.equal(S.keys.length, 6);
  assert.equal(S.keys[5], '_etc');
  assert.equal(S.mkt._etc.name, 'อื่น ๆ');
  assert.equal(S.mkt.m1.color, PALETTE[0], 'server market colour is not used, as legacy drPaint');
  assert.ok(!S.keys.includes('m3'), 'the smallest market is inside อื่น ๆ');
  const p = S.pts.find((x) => x.date === DATE);
  assert.equal(p.tot, Object.values(p.by).reduce((a, b) => a + b, 0));
});

test('booking date uses daily-counts, one series over the 14 sale days ending on the date', async () => {
  const { T, reads } = load();
  const S = await T.bookedSeries(DATE);
  const c = reads.filter(([p]) => p === '/v1/bookings/daily-counts');
  assert.equal(c.length, 1);
  assert.equal(c[0][1].from, '2026-10-01');
  assert.equal(c[0][1].to, DATE);
  assert.equal(S.pts.length, 14);
  assert.deepEqual([...S.keys], ['_all']);
  assert.equal(S.pts[13].tot, 11);
  assert.equal(S.pts[0].tot, 7);
  assert.equal(S.pts[5].tot, 0, 'a day the server has no row for is 0');
});

test('one day is read once and shared (the page reuses it for the day itself)', async () => {
  const { T, reads } = load();
  await T.travelSeries(DATE);
  const before = reads.length;
  const d = await T.day(DATE);
  assert.equal(d.date, DATE);
  assert.equal(reads.length, before);
});
