import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/27-ops-sales-board.js', 'utf8');

const BOARD = {
  month: '2026-10', previous_month: '2026-09', total_pax: 30,
  sales: [
    { sales_id: 's2', name: 'Bee', pax: 20, foc: 2, target: 15, streak: 3, rank: 1, previous_rank: 2 },
    { sales_id: 's1', name: 'Nok', pax: 10, foc: 0, target: null, streak: 0, rank: 2, previous_rank: 1 },
  ],
  agents: [
    { agent_id: 'a1', sales_id: 's1', pax: 10, previous_pax: 4, foc: 0, followed: true, feedback_collected: false },
    { agent_id: 'a2', sales_id: 's2', pax: 20, previous_pax: 0, foc: 2, followed: false, feedback_collected: true },
  ],
};

function runtime({ enabled = true, respond }) {
  const calls = [], failures = [], wrote = [], legacy = [];
  const writeListeners = [];
  const el = { innerHTML: '' };
  const window = {
    laOps: {
      enabled: () => enabled,
      call: (method, path, body) => { calls.push({ method, path, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)) }); return respond(method, path, body); },
      get: (path) => window.laOps.call('GET', path),
      post: (p, b) => window.laOps.call('POST', p, b), patch: (p, b) => window.laOps.call('PATCH', p, b), del: (p) => window.laOps.call('DELETE', p),
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (k) => wrote.push(k),
      onWrite: (fn) => writeListeners.push(fn),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
    },
  };
  const ctx = {
    window, console, Promise, JSON, Object, Array, String, Number, Math, Date, parseInt, encodeURIComponent,
    document: { getElementById: () => el },
    SB_MARKETS: [], SB_SALES: [], SB_AGENTS: [],
    _sbMonth: '2026-10', _sbSig: 'x',
  };
  ['tmSaveModal', 'tmDeleteMarket', 'tmDeleteSales', 'tmApplyMarketOrder', 'sbMarketsPersist', 'sbSalesPersist',
    'salesPaxAgg', 'salesTargetFor', 'salesStreak', 'salesIsFollowed', 'salesSetTarget', 'salesToggleFollow', 'renderSalesBoard']
    .forEach((n) => { window[n] = () => { legacy.push(n); return 'legacy:' + n; }; });
  vm.runInNewContext(SOURCE, ctx);
  return { window, ctx, calls, failures, wrote, legacy, el, writeListeners };
}
const ok = (method, path) => (path.startsWith('/v1/sales-board') ? Promise.resolve(JSON.parse(JSON.stringify(BOARD))) : Promise.resolve({}));

test('legacy mode runs the original board functions untouched', () => {
  const rt = runtime({ enabled: false, respond: ok });
  assert.equal(rt.window.salesPaxAgg('2026-10'), 'legacy:salesPaxAgg');
  assert.equal(rt.window.salesSetTarget('s1', '2026-10', 5), 'legacy:salesSetTarget');
  assert.equal(rt.window.salesToggleFollow('s1', '2026-10', 'a1'), 'legacy:salesToggleFollow');
  assert.equal(rt.calls.length, 0);
});

test('ops mode: first render shows loading, fetches /v1/sales-board, then renders the original with server data', async () => {
  const rt = runtime({ respond: ok });
  const p = rt.window.renderSalesBoard();
  assert.match(rt.el.innerHTML, /Loading/);
  assert.equal(rt.ctx._sbSig, null);
  await p;
  assert.deepEqual(rt.calls, [{ method: 'GET', path: '/v1/sales-board?month=2026-10', body: undefined }]);
  assert.deepEqual(rt.legacy, ['renderSalesBoard']);
  const agg = rt.window.salesPaxAgg('2026-10');
  assert.equal(agg.bySales.s2, 20);
  assert.equal(agg.focBySales.s2, 2);
  assert.equal(agg.byAgent.a1, 10);
  assert.equal(agg.focByAgent.a2, 2);
  assert.equal(rt.window.salesTargetFor('s2', '2026-10'), 15);
  assert.equal(rt.window.salesTargetFor('s1', '2026-10'), 0);
  assert.equal(rt.window.salesStreak('s2', '2026-10'), 3);
  assert.equal(rt.window.salesIsFollowed('s1', '2026-10', 'a1'), true);
  assert.equal(rt.window.salesIsFollowed('s2', '2026-10', 'a2', 'foc'), true);
  assert.equal(rt.window.salesIsFollowed('s2', '2026-10', 'a2'), false);
});

test('previous month comes from the same board: agent previous_pax and a rank-preserving order', async () => {
  const rt = runtime({ respond: ok });
  await rt.window.renderSalesBoard();
  const prev = rt.window.salesPaxAgg('2026-09');
  assert.equal(prev.byAgent.a1, 4);
  assert.ok(prev.bySales.s1 > prev.bySales.s2, 's1 was rank 1 last month');
});

test('second render paints from cache without refetching', async () => {
  const rt = runtime({ respond: ok });
  await rt.window.renderSalesBoard();
  await rt.window.renderSalesBoard();
  assert.equal(rt.calls.length, 1);
  assert.deepEqual(rt.legacy, ['renderSalesBoard', 'renderSalesBoard']);
});

test('setting a target PUTs {pax}, then reloads the board; 0 clears', async () => {
  const rt = runtime({ respond: ok });
  await rt.window.renderSalesBoard();
  rt.calls.length = 0;
  await rt.window.salesSetTarget('s1', '2026-10', '25');
  assert.deepEqual(rt.calls.map((c) => [c.method, c.path, c.body]), [
    ['PUT', '/v1/sales/s1/targets/2026-10', { pax: 25 }],
    ['GET', '/v1/sales-board?month=2026-10', undefined],
  ]);
  assert.deepEqual(rt.wrote, ['sales-target']);
  await rt.window.salesSetTarget('s1', '2026-10', '');
  assert.deepEqual(rt.calls[2].body, { pax: 0 });
});

test('a refused target shows the server message and changes nothing', async () => {
  const rt = runtime({ respond: (m, p) => (m === 'PUT' ? Promise.reject(new Error('A salesperson cannot set targets')) : ok(m, p)) });
  await rt.window.renderSalesBoard();
  const before = rt.window.salesTargetFor('s2', '2026-10');
  await rt.window.salesSetTarget('s2', '2026-10', 99);
  assert.equal(rt.failures[0].message, 'A salesperson cannot set targets');
  assert.equal(rt.window.salesTargetFor('s2', '2026-10'), before);
});

test('follow-up sends an explicit state (not a toggle) and updates the flag after the answer', async () => {
  const rt = runtime({ respond: ok });
  await rt.window.renderSalesBoard();
  rt.calls.length = 0;
  await rt.window.salesToggleFollow('s1', '2026-10', 'a1');
  await rt.window.salesToggleFollow('s2', '2026-10', 'a2', 'foc');
  await rt.window.salesToggleFollow('s2', '2026-10', 'a2');
  assert.deepEqual(rt.calls.map((c) => [c.method, c.path, c.body]), [
    ['PUT', '/v1/sales/s1/followups', { month: '2026-10', agent_id: 'a1', kind: 'agent', marked: false }],
    ['PUT', '/v1/sales/s2/followups', { month: '2026-10', agent_id: 'a2', kind: 'foc', marked: false }],
    ['PUT', '/v1/sales/s2/followups', { month: '2026-10', agent_id: 'a2', kind: 'agent', marked: true }],
  ]);
  assert.equal(rt.window.salesIsFollowed('s1', '2026-10', 'a1'), false);
  assert.equal(rt.window.salesIsFollowed('s2', '2026-10', 'a2', 'foc'), false);
  assert.equal(rt.window.salesIsFollowed('s2', '2026-10', 'a2'), true);
});

test('a refused follow-up leaves the flag as it was', async () => {
  const rt = runtime({ respond: (m, p) => (m === 'PUT' ? Promise.reject(new Error('Agent a1 is not that salesperson')) : ok(m, p)) });
  await rt.window.renderSalesBoard();
  await rt.window.salesToggleFollow('s1', '2026-10', 'a1');
  assert.equal(rt.failures.length, 1);
  assert.equal(rt.window.salesIsFollowed('s1', '2026-10', 'a1'), true);
});

test('a non-sales write marks the cache stale so the next render refetches', async () => {
  const rt = runtime({ respond: ok });
  await rt.window.renderSalesBoard();
  rt.writeListeners.forEach((fn) => fn('booking-update'));
  await rt.window.renderSalesBoard();
  await new Promise((r) => setImmediate(r));
  assert.equal(rt.calls.length, 2);
});
