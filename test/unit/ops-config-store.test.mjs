import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* vm tests for ops/61-ops-config-store.js · laOps is stubbed, nothing here reaches a network. */
const source = fs.readFileSync(process.env.CONFIG_STORE_FILE || 'allotment_v2/js/ops/61-ops-config-store.js', 'utf8');

function harness({ enabled = true, agent = false, server = {}, failGet = false } = {}) {
  const calls = [], local = [], errors = [], wrote = [], writeListeners = [];
  let chain = Promise.resolve();
  const store = {
    '/v1/reports/daily/settings': { van_cost: 1200, van_quota: 6, target_per_pax: 130, ...(server.dr || {}) },
  };
  const ctx = {
    console, Promise, setTimeout, clearTimeout, Date,
    document: { querySelector: () => null },
    ctRead(k) { local.push(['read', k]); return { legacy: true }; },
    ctWrite(k, v) { local.push(['write', k, v]); },
  };
  ctx.window = ctx;
  if (agent) ctx.LA_ME = { agentId: 'ag_1' };
  ctx.laOps = {
    enabled: () => enabled, state: { loaded: false }, busy: () => false,
    clone: v => (v == null ? v : JSON.parse(JSON.stringify(v))),
    fail: (t, e) => errors.push([t, e.message, e.code]),
    onWrite: fn => writeListeners.push(fn), wrote: k => { wrote.push(k); writeListeners.forEach(f => f(k)); },
    get: async p => { calls.push(['GET', p]); if (failGet) throw Object.assign(new Error('down'), { status: 500 }); return JSON.parse(JSON.stringify(store[p])); },
    queue(fn) { const p = chain.then(fn); chain = p.catch(() => {}); return p; },
    call: async (m, p, body) => {
      calls.push([m, p, body]);
      if (ctx.__deny) { const d = ctx.__deny; ctx.__deny = null; throw Object.assign(new Error(d.message), d); }
      if (p === '/v1/reports/daily/settings') { Object.assign(store[p], body); return JSON.parse(JSON.stringify(store[p])); }
      throw new Error('unexpected ' + m + ' ' + p);
    },
  };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  return { ctx, calls, local, errors, wrote, store, deny: d => { ctx.__deny = d; } };
}
const tick = () => new Promise(r => setTimeout(r, 5));

test('dr_cfg: read comes from GET /v1/reports/daily/settings in the legacy shape, not from the blob', async () => {
  const h = harness({ server: { dr: { van_cost: 900, target_per_pax: 150 } } });
  await tick();
  assert.deepEqual(h.calls[0], ['GET', '/v1/reports/daily/settings']);
  const c = h.ctx.ctRead('dr_cfg');
  assert.equal(JSON.stringify(c), JSON.stringify({ vanCost: 900, vanQuota: 6, targetPerPax: 150 }));
  c.vanCost = 1; assert.equal(h.ctx.ctRead('dr_cfg').vanCost, 900, 'reads are copies');
  assert.equal(h.local.length, 0, 'the blob is never touched');
});

test('dr_cfg: ctWrite sends only the changed field to PUT /v1/reports/daily/settings', async () => {
  const h = harness(); await tick();
  await h.ctx.ctWrite('dr_cfg', { vanCost: 1000, vanQuota: 6, targetPerPax: 130 });
  const puts = h.calls.filter(c => c[0] === 'PUT');
  assert.equal(puts.length, 1); assert.equal(JSON.stringify(puts[0][2]), JSON.stringify({ van_cost: 1000 }));
  assert.equal(h.ctx.ctRead('dr_cfg').vanCost, 1000);
  assert.equal(h.local.length, 0);
});

test('dr_cfg: a refused write puts the old value back and shows the server message', async () => {
  const h = harness(); await tick();
  h.deny({ message: 'van_cost must be a number', status: 400 });
  await h.ctx.ctWrite('dr_cfg', { vanCost: 5, vanQuota: 6, targetPerPax: 130 });
  assert.equal(h.ctx.ctRead('dr_cfg').vanCost, 1200);
  assert.equal(h.errors[0][1], 'van_cost must be a number');
});

test('dr_cfg: a settings change announced by the money-report adapter is read again', async () => {
  const h = harness(); await tick();
  h.store['/v1/reports/daily/settings'].van_quota = 9;
  h.ctx.laOps.wrote('daily-report-settings'); await tick();
  assert.equal(h.ctx.ctRead('dr_cfg').vanQuota, 9);
});

test('dr_cfg: other blob keys and agent / legacy sessions pass straight through', async () => {
  const h = harness(); await tick();
  assert.equal(h.ctx.ctRead('something_else').legacy, true);
  h.ctx.ctWrite('something_else', 1); assert.equal(h.local.length, 2);
  const off = harness({ enabled: false }); await tick();
  assert.equal(off.calls.length, 0); off.ctx.ctRead('dr_cfg'); off.ctx.ctWrite('dr_cfg', {});
  assert.equal(off.local.length, 2);
  const ag = harness({ agent: true }); await tick();
  assert.equal(ag.calls.length, 0); ag.ctx.ctRead('dr_cfg'); assert.equal(ag.local.length, 1);
});

test('dr_cfg: a failed first load is reported once and the reader falls back to null (legacy defaults)', async () => {
  const h = harness({ failGet: true }); await tick();
  assert.equal(h.errors.length, 1);
  assert.equal(h.ctx.ctRead('dr_cfg'), null);
  assert.equal(h.calls.filter(c => c[0] === 'GET').length, 1, 'no retry storm inside the retry window');
});
