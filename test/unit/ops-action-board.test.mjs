// Action Board (js/ops/52-ops-action-board.js): loads the board's windows from
// operation-backend — trips today → +13, bookings created this month and last
// month — before the legacy abRender sums SB_BOOKINGS.
//   node --test test/unit/ops-action-board.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/52-ops-action-board.js', 'utf8');

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function shift(ds, n) {
  const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d);
}

function load({ enabled = true, range, created, view = 'actionboard', stats, stub } = {}) {
  const host = { innerHTML: '', firstChild: null };
  const calls = [];
  const ctx = {
    console, Promise, Date, String, Error,
    TODAY_STR: '2026-10-14',
    document: { getElementById: (id) => (id === 'ab-wrap' ? host : null) },
    abRender() { calls.push({ render: true }); host.innerHTML = 'BOARD'; host.firstChild = {}; },
    bookingV2EnsureOpsRange(opt) { calls.push({ range: opt }); return range ? range(opt) : null; },
    _abAgentStats() { return stub ? stub() : { M: {}, cur: '2026-10', prev: '2026-09', dayN: 14, back3: ['2026-07', '2026-08', '2026-09'] }; },
    bookingV2OpsEnsureCreated(from, to) { calls.push({ created: [from, to] }); return created ? created(from, to) : null; },
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => enabled,
    today: () => '2026-10-14',
    ymd, shift,
    activeView: () => view,
    loadingHtml: (label) => 'SPIN:' + label,
    get: (path, q) => { calls.push({ get: [path, q] }); return stats ? stats(path, q) : Promise.resolve({ months: [] }); },
    onWrite: (fn) => { ctx.__onWrite = fn; },
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, host, calls };
}

test('loads trips today → +13 and the current + previous creation months, then draws once', async () => {
  const releases = [];
  const pend = () => new Promise((r) => releases.push(r));
  const { ctx, host, calls } = load({ range: pend, created: pend });
  const p = ctx.abRender();
  const range = calls.find((c) => c.range).range;
  assert.deepEqual([range.from, range.to], ['2026-10-14', '2026-10-27']);
  const createdRanges = calls.filter((c) => c.created).map((c) => c.created);
  assert.deepEqual(createdRanges, [['2026-10-01', '2026-10-14'], ['2026-09-01', '2026-09-30']]);
  assert.match(host.innerHTML, /^SPIN:/);
  assert.ok(!calls.some((c) => c.render));
  releases.forEach((r) => r({ bookings: [] }));
  await p;
  assert.equal(calls.filter((c) => c.render).length, 1);
  assert.equal(host.innerHTML, 'BOARD');
});

test('ranges and stats already in memory draw straight away', async () => {
  const { ctx, host, calls } = load();           // every ensure returns null = cached
  await ctx.abRender();                          // first draw primes the 60 s stats cache
  host.innerHTML = '';
  ctx.abRender();
  assert.equal(host.innerHTML, 'BOARD');
  assert.equal(calls.filter((c) => c.render).length, 2);
});

test('a failed load still draws (honest partial), with a warning', async () => {
  const { ctx, calls } = load({ range: () => Promise.resolve(null), created: () => Promise.resolve(null) });
  await ctx.abRender();
  assert.equal(calls.filter((c) => c.render).length, 1);
});

test('leaving the page mid-load hands the screen to the next view', async () => {
  let release;
  const { ctx, calls } = load({ range: () => new Promise((r) => { release = r; }), view: 'dashboard' });
  const p = ctx.abRender();
  release({ bookings: [] });
  await p;
  assert.ok(!calls.some((c) => c.render));
});

test('legacy mode calls the original untouched', () => {
  const { ctx, calls } = load({ enabled: false });
  ctx.abRender();
  assert.deepEqual(calls, [{ render: true }]);
});

const MONTHS = [
  { month: '2026-07', agents: [{ agent_id: 'A1', bookings: 3, cancelled: 0, pax: 30, revenue: 1, travel_pax: 0, last_created: '2026-07-30T10:00:00.000Z' }] },
  { month: '2026-08', agents: [] },
  { month: '2026-09', agents: [] },
  { month: '2026-10', agents: [
    { agent_id: 'A1', bookings: 1, cancelled: 0, pax: 4, revenue: 1, travel_pax: 0, last_created: '2026-10-03T18:30:00.000Z' },
    { agent_id: null, bookings: 1, cancelled: 0, pax: 9, revenue: 1, travel_pax: 0, last_created: null }] },
];

test('asks the server for 4 months of per-agent stats before drawing', async () => {
  const { ctx, calls } = load({ stats: () => Promise.resolve({ months: MONTHS }) });
  await ctx.abRender();
  assert.equal(JSON.stringify(calls.find((c) => c.get).get), JSON.stringify(['/v1/bookings/agent-month-stats', { months: 4 }]));
  assert.ok(calls.findIndex((c) => c.get) < calls.findIndex((c) => c.render));
});

test('server month pax and last-booked day override the loaded-window sums', async () => {
  const stub = () => ({ M: { A1: { byMon: { '2026-07': 2, '2026-08': 5 }, inCur: 1, lastIn: '2026-06-01' } },
    cur: '2026-10', prev: '2026-09', dayN: 14, back3: [] });
  const { ctx } = load({ stub, stats: () => Promise.resolve({ months: MONTHS }) });
  await ctx.abRender();
  const S = ctx._abAgentStats();
  assert.equal(S.M.A1.byMon['2026-07'], 30);
  assert.equal(S.M.A1.byMon['2026-08'], 0);          // inside the window, server has none
  assert.equal(S.M.A1.inCur, 4);
  assert.equal(S.M.A1.lastIn, '2026-10-04');          // 18:30Z is already the 4th in Bangkok
  assert.ok(!S.M['null'] && !S.M['']);                 // agentless rows are skipped
});

test('an agent the browser never loaded still gets a record', async () => {
  const { ctx } = load({ stats: () => Promise.resolve({ months: MONTHS }) });
  await ctx.abRender();
  const r = ctx._abAgentStats().M.A1;
  assert.equal(r.byMon['2026-07'], 30);
  assert.equal(r.bkCur, 0);
});

test('a failed stats call falls back to the loaded bookings', async () => {
  const { ctx, calls } = load({ stats: () => Promise.reject(new Error('boom')) });
  await ctx.abRender();
  assert.equal(calls.filter((c) => c.render).length, 1);
  assert.equal(JSON.stringify(ctx._abAgentStats().M), '{}');
});

test('stats are cached between redraws and dropped after a write', async () => {
  const { ctx, calls } = load({ stats: () => Promise.resolve({ months: MONTHS }) });
  await ctx.abRender(); await ctx.abRender();
  assert.equal(calls.filter((c) => c.get).length, 1);
  ctx.__onWrite();
  await ctx.abRender();
  assert.equal(calls.filter((c) => c.get).length, 2);
});

test('with ops off nothing is fetched and the legacy stats pass through', () => {
  const { ctx, calls } = load({ enabled: false, stub: () => ({ M: { A1: { byMon: { '2026-07': 2 } } }, cur: '2026-10' }) });
  ctx.abRender();
  assert.ok(!calls.some((c) => c.get));
  assert.equal(ctx._abAgentStats().M.A1.byMon['2026-07'], 2);
});
