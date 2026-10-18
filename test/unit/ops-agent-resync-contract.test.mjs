// Agent page "Sync to bound rate" (agAlertSyncRate) -> POST /v1/agents/:id/resync-contract.
//   node --test test/unit/ops-agent-resync-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(process.env.AGENTS_SRC || 'allotment_v2/js/ops/16-ops-agents.js', 'utf8');
class LaOpsError extends Error { constructor(m, code, status) { super(m); this.code = code; this.status = status; } }

function runtime({ enabled = true, refuse = null, result } = {}) {
  const calls = [], failures = [], wrote = [], alerts = [], events = [], legacy = [], detail = [];
  const SB_AGENTS = [{ id: 'a1', name: 'One', rateTypeId: 'rt-1', contractVersion: 'old' }];
  const window = {
    laOps: {
      enabled: () => enabled, onWrite: () => {}, onChange: () => {},
      get: async (path) => {
        events.push('get:' + path);
        if (path.endsWith('/activity')) return { activity: [{ text: 'sync from agent page' }, { text: 'older' }] };
        return { id: 'a1', name: 'One', rate_type_id: 'rt-1', contract_version: 'fresh' };
      },
      call: async (method, path, body) => {
        calls.push(method + ' ' + path + ' ' + JSON.stringify(body));
        events.push('call:' + SB_AGENTS[0].contractVersion);
        if (refuse) throw refuse;
        return result || { changed: 2, unchanged: 1, contract_ids: ['c1', 'c2'], agent: { id: 'a1', name: 'One', rate_type_id: 'rt-1', contract_version: 'fresh' } };
      },
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (k) => wrote.push(k),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
    },
    laOpsContracts: { load: async () => { events.push('contracts-load'); return true; } },
    agAlertSyncRate: () => { legacy.push('legacy'); return 'legacy'; },
    agRenderDetail: () => {},
  };
  const noop = () => {};
  const ctx = {
    window, SB_AGENTS, console, Promise, Array, Object, Error, String, Number, JSON, Set, encodeURIComponent,
    agRenderList: noop, renderAgKPI: noop, confirm: () => true,
    alert: (m) => alerts.push(m), _agSelected: 'a1', _agView: 'list',
  };
  ctx.agRenderDetail = window.agRenderDetail;
  vm.runInNewContext(SOURCE, ctx);
  return { window, calls, failures, wrote, alerts, events, legacy, SB_AGENTS };
}

test('posts to resync-contract, reloads contracts and the agent, shows changed/unchanged counts', async () => {
  const rt = runtime();
  await rt.window.agAlertSyncRate('a1');
  assert.deepEqual(rt.calls, ['POST /v1/agents/a1/resync-contract {}']);
  assert.ok(rt.events.includes('contracts-load'), 'contracts view reloaded from the server');
  assert.ok(rt.events.some((e) => e === 'get:/v1/agents/a1/activity'), 'agent + activity re-read');
  assert.equal(rt.SB_AGENTS[0].contractVersion, 'fresh');
  assert.equal(rt.alerts.length, 1);
  assert.match(rt.alerts[0], /Synced 2 main contract\(s\).*1 already matched/);
  assert.ok(rt.wrote.includes('agents'));
  assert.deepEqual(rt.failures, []);
  assert.deepEqual(rt.legacy, [], 'the local-only legacy sync is not run');
});

test('nothing changed: says so, with the unchanged count', async () => {
  const rt = runtime({ result: { changed: 0, unchanged: 3, contract_ids: [], agent: { id: 'a1', name: 'One' } } });
  await rt.window.agAlertSyncRate('a1');
  assert.match(rt.alerts[0], /Nothing to sync\. 3 contract/);
});

test('409 no_rate_type: shows the server message, changes nothing locally, no reload', async () => {
  const msg = 'Agent One has no rate type to sync its contracts to: set one with PUT /v1/agents/{id}/rate-type';
  const rt = runtime({ refuse: new LaOpsError(msg, 'no_rate_type', 409) });
  await rt.window.agAlertSyncRate('a1');
  assert.deepEqual(rt.failures.map((f) => f.message), [msg]);
  assert.equal(rt.SB_AGENTS[0].contractVersion, 'old');
  assert.deepEqual(rt.alerts, []);
  assert.ok(!rt.events.includes('contracts-load'));
});

test('server first: the request goes out before any local change', async () => {
  const rt = runtime();
  await rt.window.agAlertSyncRate('a1');
  assert.equal(rt.events[0], 'call:old');
});

test('falls back to the legacy local sync when operation-backend is off', () => {
  const rt = runtime({ enabled: false });
  assert.equal(rt.window.agAlertSyncRate('a1'), 'legacy');
  assert.deepEqual(rt.calls, []);
});
