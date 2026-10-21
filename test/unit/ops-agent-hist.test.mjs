// Agent Info > Recent Bookings tab (agTabHist): under ops mode the month x route table must
// be computed over the agent's full booking list from GET /v1/bookings?agent_id=, not over
// whatever date ranges happened to be loaded.
//   node --test test/unit/ops-agent-hist.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ADAPTER = fs.readFileSync('allotment_v2/js/ops/16-ops-agents.js', 'utf8');
const LOADER = fs.readFileSync('allotment_v2/js/booking/bookingV2LoadFromOpsBackend.js', 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

function adapter({ enabled = true, ensure } = {}) {
  const calls = [], renders = [], writes = [];
  const body = { innerHTML: '' };
  const tab = { getAttribute: () => "agSwitchTab('hist','AG1')" };
  const ctx = {
    console: { log() {}, warn: (m) => calls.push({ warn: m }) },
    Promise, Object, Array, String, Number, JSON, Error,
    agTabHist: (a) => { renders.push(a.id); return 'LEGACY:' + a.id; },
    sbGetAgent: (id) => ({ id }),
    document: {
      querySelector: () => tab,
      getElementById: (id) => (id === 'ag-tabbody' ? body : null),
    },
    bookingV2EnsureOpsRange: (o) => { calls.push({ ensure: JSON.parse(JSON.stringify(o)) }); return ensure(o); },
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => enabled,
    onWrite: (fn) => writes.push(fn),
  };
  vm.createContext(ctx);
  vm.runInContext(ADAPTER, ctx);
  return { ctx, calls, renders, body, writes };
}

test('tab open loads the agent with limit 500 and redraws the tab once', async () => {
  let release;
  const { ctx, calls, renders, body } = adapter({ ensure: () => new Promise((r) => { release = r; }) });
  assert.equal(ctx.agTabHist({ id: 'AG1' }), 'LEGACY:AG1');
  assert.deepEqual(calls.find((c) => c.ensure).ensure, { agentId: 'AG1', limit: 500, maxPages: 40, refresh: false, delta: true });
  ctx.agTabHist({ id: 'AG1' });                 // re-render while in flight: no second load
  assert.equal(calls.filter((c) => c.ensure).length, 1);
  release({ bookings: [] }); await tick();
  assert.equal(body.innerHTML, 'LEGACY:AG1');   // redrawn over the loaded rows
  assert.equal(renders.length, 3);
  ctx.agTabHist({ id: 'AG1' });                 // loaded: no further fetch
  assert.equal(calls.filter((c) => c.ensure).length, 1);
});

test('a failed load keeps the legacy render, warns, and does not loop', async () => {
  const { ctx, calls, body } = adapter({ ensure: () => Promise.resolve(null) });
  assert.equal(ctx.agTabHist({ id: 'AG1' }), 'LEGACY:AG1');
  await tick();
  assert.equal(body.innerHTML, '');             // no redraw over a failure, tab not blanked
  assert.ok(calls.some((c) => c.warn && /agent history/.test(c.warn)));
  ctx.agTabHist({ id: 'AG1' });
  assert.equal(calls.filter((c) => c.ensure).length, 1);
});

test('a laOps write drops the cache: next open reloads with refresh', async () => {
  const { ctx, calls, writes } = adapter({ ensure: () => Promise.resolve({ bookings: [] }) });
  ctx.agTabHist({ id: 'AG1' }); await tick();
  writes.forEach((f) => f('booking'));
  ctx.agTabHist({ id: 'AG1' });
  const ens = calls.filter((c) => c.ensure);
  assert.equal(ens.length, 2);
  assert.equal(ens[1].ensure.refresh, true);
});

test('legacy mode (ops off) never fetches', () => {
  const { ctx, calls } = adapter({ enabled: false, ensure: () => { throw new Error('no'); } });
  assert.equal(ctx.agTabHist({ id: 'AG1' }), 'LEGACY:AG1');
  assert.equal(calls.filter((c) => c.ensure).length, 0);
});

test('shared loader: agentId sends agent_id, needs no from/to, follows cursors, merges rows', async () => {
  const urls = [];
  const SB = [];
  const ctx = {
    console: { log() {}, warn() {} }, Promise, Object, Array, String, Date, encodeURIComponent,
    SB_BOOKINGS: SB,
    bookingV2FromOpsBooking: (b) => ({ id: b.id, agentId: b.agent_id }),
    laOpsFetch: (u) => {
      urls.push(u);
      const second = /cursor=c1/.test(u);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(second ? { bookings: [{ id: 'b2', agent_id: 'AG1' }] } : { bookings: [{ id: 'b1', agent_id: 'AG1' }], next_cursor: 'c1' }) });
    },
  };
  ctx.window = ctx; ctx.LA_LEGACY_UNAVAILABLE = true;
  vm.createContext(ctx);
  vm.runInContext(LOADER, ctx);
  assert.equal(ctx.bookingV2EnsureOpsRange({ limit: 500 }), null);            // no agent, no range: nothing
  const p = ctx.bookingV2EnsureOpsRange({ agentId: 'AG1', limit: 500 });
  assert.ok(p);
  await p;
  assert.equal(urls.length, 2);
  assert.match(urls[0], /^\/v1\/bookings\?agent_id=AG1&limit=1000$/);
  assert.match(urls[1], /cursor=c1/);
  assert.deepEqual(SB.map((b) => b.id), ['b1', 'b2']);
  assert.equal(ctx.bookingV2EnsureOpsRange({ agentId: 'AG1', limit: 500 }), null);   // cached
  assert.ok(ctx.bookingV2EnsureOpsRange({ agentId: 'AG1', limit: 500, refresh: true })); // refresh refetches
  await tick();
});
