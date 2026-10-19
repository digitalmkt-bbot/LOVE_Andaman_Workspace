// §w9 · B2B agent / owner / market pages: the stacked monthly chart, "Routes sent" and the latest booking lines
// are the server's (GET /v1/reports/b2b/{agent|staff|market}/{id}: monthly[].by_family / by_agent, routes_sent, recent[]),
// and a tampered browser value is overridden. Runs the REAL adapter (91-ops-b2b-detail.js) against stubs of legacy's functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/91-ops-b2b-detail.js', 'utf8');
const APP = fs.readFileSync('allotment_v2/js/08-app.js', 'utf8');

function make(answer) {
  const seen = { monthly: null, key: null };
  const ctx = vm.createContext({ console, Promise, setTimeout });
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => true, b2bDash: { report: () => null, groupOfFilter: () => null, familiesOf: () => [] }, srv: { read: () => null },
    get: () => Promise.resolve(answer), onWrite: () => {}, activeView: () => '', busy: () => false, fail: (t, e) => { throw e; },
  };
  vm.runInContext(`
    var _b2d = { basis: 'bd', T: 10, mode: '' };
    var SB_AGENTS = [{ id: 'ag9', name: 'Nine' }];
    var B2D_FAM_ORDER = [];
    function b2dWin(){ return { cs: '2026-03-01', ce: '2026-03-31', ps: '2026-02-01', pe: '2026-02-28' }; }
    function b2dSum(){ return { rev: 0, pax: 0, bookings: 0 }; }
    function b2dAgents(){ return []; }
    function b2dBridge(){ return {}; }
    function b2dMonthlyHtml(L, keyFn){ return JSON.stringify(L.map(function(l){ return [l.bd, l.rev, keyFn(l)]; })); }
    function b2dRoutesSent(n){ return n; }
    function b2dRecentLines(lines){ return lines; }
    function pageOf(L, id){ return { chart: b2dMonthlyHtml(L, function(l){ return 'legacy-key'; }), routes: b2dRoutesSent(99), recent: b2dRecentLines([{ bd: 'x', td: 'y', fam: 'F', pax: 1, rev: 1 }]) }; }
    function b2dAgentDetail(L, w, agAll, id){ return pageOf(L, id); }
    function b2dStaffDetail(L, w, agAll, id){ return pageOf(L, id); }
    function b2dMarketDetail(L, w, agAll, id){ return pageOf(L, id); }
  `, ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, seen };
}
const page = async (c, fn, id) => {
  const w = { cs: '2026-03-01', ce: '2026-03-31', ps: '2026-02-01', pe: '2026-02-28' };
  c.ctx.window[fn]([], w, [], id);                  // the first draw starts the read
  await new Promise((r) => setTimeout(r, 5));
  return c.ctx.window[fn]([], w, [], id);           // the second draws from the answer
};

const AGENT = {
  found: true, kind: 'agent', id: 'ag1', figures: { revenue: 100, previous: 50, pax: 7, bookings: 3, class: 'growth', growth_pct: 100 },
  monthly: [{ month: '2026-02', revenue: 30, pax: 2, bookings: 1, by_family: { Alpha: 30 } }, { month: '2026-03', revenue: 70, pax: 5, bookings: 2, by_family: { Alpha: 40, Beta: 30 } }],
  by_family: [], routes_sent: 2,
  recent: [{ booking_date: '2026-03-05', travel_date: '2026-03-20', family: 'Alpha', pax: 4, revenue: 40 }],
};

test('agent page: the chart stacks the server\'s months by route, routes sent and recent lines are the server\'s', async () => {
  const p = await page(make(AGENT), 'b2dAgentDetail', 'ag1');
  assert.deepEqual(JSON.parse(p.chart), [['2026-02-01', 30, 'Alpha'], ['2026-03-01', 40, 'Alpha'], ['2026-03-01', 30, 'Beta']]);
  assert.equal(p.routes, 2, 'the browser\'s count (99) is replaced');
  assert.deepEqual(JSON.parse(JSON.stringify(p.recent)), [{ bd: '2026-03-05', td: '2026-03-20', fam: 'Alpha', pax: 4, rev: 40 }], 'the browser\'s line is replaced');
});

test('owner page: the chart stacks by agent, named from the server\'s agents, then the directory, then the id', async () => {
  const staff = { found: true, kind: 'staff', id: 'o1', figures: { revenue: 10, previous: 0, pax: 1, bookings: 1 },
    monthly: [{ month: '2026-03', revenue: 10, pax: 1, bookings: 1, by_agent: { ag1: 6, ag9: 3, agX: 1 } }], by_family: [], agents: [{ agent_id: 'ag1', name: 'Alpha' }] };
  const p = await page(make(staff), 'b2dStaffDetail', 'o1');
  assert.deepEqual(JSON.parse(p.chart), [['2026-03-01', 6, 'Alpha'], ['2026-03-01', 3, 'Nine'], ['2026-03-01', 1, 'agX']]);
  assert.equal(p.routes, 99, 'only the agent page has routes sent');
  assert.equal(p.recent[0].fam, 'F', 'only the agent page has recent lines');
});

test('an answer without the new fields keeps legacy\'s own drawing', async () => {
  const old = { ...AGENT, monthly: [{ month: '2026-03', revenue: 70, pax: 5, bookings: 2 }], routes_sent: undefined, recent: undefined };
  const p = await page(make(old), 'b2dAgentDetail', 'ag1');
  assert.deepEqual(JSON.parse(p.chart), [], 'legacy\'s chart ran over the (empty) lines');
  assert.equal(p.routes, 99);
  assert.equal(p.recent[0].fam, 'F');
});

test('08-app.js calls the seams the adapter wraps', () => {
  assert.match(APP, /b2dRoutesSent\(Object\.keys\(famsSent\)\.length\)/);
  assert.match(APP, /const recent=b2dRecentLines\(L\.filter/);
  assert.match(APP, /function b2dRoutesSent\(n\)\{ return n; \}/);
  assert.match(APP, /function b2dRecentLines\(lines\)\{ return lines; \}/);
});
