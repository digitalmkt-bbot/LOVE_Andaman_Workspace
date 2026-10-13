// The Dashboard's booking feeds (booking/bookingV2LoadFromOpsBackend.js): a few bounded
// requests instead of paging every booking created in the last 30 days.
//   node --test test/unit/ops-dashboard-feeds.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/booking/bookingV2LoadFromOpsBackend.js', 'utf8');

/* handler(path) → {status, body}. Every request path is recorded in `calls`. */
function load(handler) {
  const calls = [], writeHooks = [];
  const ctx = {
    console: { log() {}, warn() {} }, Promise, Date, Object, Array, Math, encodeURIComponent, String, Number,
    SB_BOOKINGS: [],
    bookingV2FromOpsBooking: (b) => ({ id: b.id, opsId: b.id }),
  };
  ctx.window = ctx;
  ctx.LA_LEGACY_UNAVAILABLE = true;
  ctx.laOps = { onWrite: (fn) => writeHooks.push(fn) };
  ctx.laOpsFetch = (path) => {
    calls.push(path);
    const { status = 200, body = {} } = handler(path) || {};
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, calls, write: (kind) => writeHooks.forEach((fn) => fn(kind)) };
}
const query = (path) => Object.fromEntries(new URL('http://x' + path).searchParams);
const counts = { days: [{ date: '2026-10-11', bookings: 4, pax: 9 }, { date: '2026-10-12', bookings: 2, pax: 5 }], total_bookings: 6, total_pax: 14 };

test('the Dashboard asks for one newest page, the selected day, and 60 days of counts', async () => {
  const { ctx, calls } = load((path) => {
    if (path.startsWith('/v1/bookings/daily-counts')) return { body: counts };
    const q = query(path);
    // Both feeds offer another page; only the selected day follows it.
    if (q.created_from === '2020-03-10' && !q.cursor) return { body: { bookings: [{ id: 'b1' }], next_cursor: 'c2' } };
    return { body: { bookings: [{ id: q.cursor ? 'b3' : 'b2' }], ...(q.created_from !== '2020-03-10' && !q.cursor ? { next_cursor: 'more' } : {}) } };
  });
  const done = await ctx.bookingV2OpsEnsureDashboard('2020-03-10');
  assert.ok(done, 'resolves truthy when every feed loaded');
  const recent = calls.filter((p) => p.startsWith('/v1/bookings/recent')).map(query);
  const newest = recent.filter((q) => q.created_from !== '2020-03-10');
  assert.equal(newest.length, 1, 'the newest feed stops after its first page');
  assert.equal(newest[0].limit, '200');
  assert.deepEqual(recent.filter((q) => q.created_from === '2020-03-10').map((q) => [q.created_to, q.cursor || null]),
    [['2020-03-10', null], ['2020-03-10', 'c2']], 'the selected day is read whole');
  const daily = calls.filter((p) => p.startsWith('/v1/bookings/daily-counts')).map(query);
  assert.deepEqual(daily, [{ from: '2020-01-11', to: '2020-03-10' }], '60 days ending on the selected day');
  assert.equal(ctx.bookingV2OpsEnsureDashboard('2020-03-10'), null, 'cached: no second round');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.bookingV2OpsDashboardCounts('2020-03-10')['2026-10-12'])), { bk: 2, pax: 5 });
});

test('failed daily counts are not cached and resolve null, a booking write drops the counts', async () => {
  let fail = true;
  const { ctx, calls, write } = load((path) => {
    if (path.startsWith('/v1/bookings/daily-counts')) return fail ? { status: 500 } : { body: counts };
    return { body: { bookings: [] } };
  });
  ctx.bookingV2OpsAttachWriteInvalidation();
  assert.equal(await ctx.bookingV2OpsEnsureDailyCounts('2026-10-11', '2026-10-12'), null);
  assert.equal(ctx.bookingV2OpsDailyCounts('2026-10-11', '2026-10-12'), null);
  fail = false;
  assert.ok(await ctx.bookingV2OpsEnsureDailyCounts('2026-10-11', '2026-10-12'), 'retried after a failure');
  assert.ok(ctx.bookingV2OpsDailyCounts('2026-10-11', '2026-10-12'));
  write('remote:van');
  assert.ok(ctx.bookingV2OpsDailyCounts('2026-10-11', '2026-10-12'), 'a van change keeps them');
  write('booking');
  assert.equal(ctx.bookingV2OpsDailyCounts('2026-10-11', '2026-10-12'), null, 'a booking write drops them');
  assert.equal(calls.filter((p) => p.startsWith('/v1/bookings/daily-counts')).length, 2);
});
