import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* vm tests for ops/61-ops-config-store.js · laOps is stubbed, nothing here reaches a network. */
const source = fs.readFileSync(process.env.CONFIG_STORE_FILE || 'allotment_v2/js/ops/61-ops-config-store.js', 'utf8');

function harness({ pre = '', enabled = true, agent = false, server = {}, failGet = false } = {}) {
  const calls = [], local = [], errors = [], wrote = [], writeListeners = [];
  let chain = Promise.resolve();
  const store = {
    '/v1/reports/daily/settings': { van_cost: 1200, van_quota: 6, target_per_pax: 130, ...(server.dr || {}) },
  };
  const cfg = {
    inv_cfg: { key: 'inv_cfg', value: { seller: { name: 'SRV default' } }, saved: false, version: null },
    dr_mail: { key: 'dr_mail', value: { to: '', cc: '', note: 'n', inc: { ov: 1 } }, saved: false, version: null },
    pmap_agpanel: { key: 'pmap_agpanel', value: 1, saved: false, version: null },
    pmap_zonebg: { key: 'pmap_zonebg', value: 1, saved: true, version: 3 },
    guides: { key: 'guides', value: [{ id: 'g1', name: 'A' }], saved: true, version: 2 },
    ...(server.cfg || {}),
  };
  store['/v1/config'] = { entries: Object.values(cfg) };
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
    get: async p => {
      calls.push(['GET', p]); if (failGet) throw Object.assign(new Error('down'), { status: 500 });
      const m = /^\/v1\/config\/(\w+)$/.exec(p); if (m) return JSON.parse(JSON.stringify(cfg[m[1]]));
      if (p === '/v1/config') store[p] = { entries: Object.values(cfg) };
      return JSON.parse(JSON.stringify(store[p]));
    },
    queue(fn) { const p = chain.then(fn); chain = p.catch(() => {}); return p; },
    call: async (m, p, body) => {
      calls.push([m, p, body]);
      if (ctx.__deny) { const d = ctx.__deny; ctx.__deny = null; throw Object.assign(new Error(d.message), d); }
      const mm = /^\/v1\/config\/(\w+)$/.exec(p);
      if (mm) {
        const row = cfg[mm[1]];
        if (body.version != null && body.version !== row.version) throw Object.assign(new Error('stale'), { status: 409, code: 'stale_version' });
        cfg[mm[1]] = { ...row, value: body.value, saved: true, version: (row.version || 0) + 1 };
        return JSON.parse(JSON.stringify(cfg[mm[1]]));
      }
      if (p === '/v1/reports/daily/settings') { Object.assign(store[p], body); return JSON.parse(JSON.stringify(store[p])); }
      throw new Error('unexpected ' + m + ' ' + p);
    },
  };
  vm.createContext(ctx); if (pre) vm.runInContext(pre, ctx); vm.runInContext(source, ctx);
  return { ctx, calls, local, errors, wrote, store, cfg, deny: d => { ctx.__deny = d; } };
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
  assert.equal(h.errors.length, 2, 'one per source: the daily settings and the config store');
  assert.equal(h.ctx.ctRead('dr_cfg'), null);
  assert.equal(h.calls.filter(c => c[1] === '/v1/reports/daily/settings').length, 1, 'no retry storm inside the retry window');
});

/* ── config store ── */
const puts = (h, k) => h.calls.filter(c => c[0] === 'PUT' && c[1] === '/v1/config/' + k);
const J = v => JSON.stringify(v);

test('config: one GET /v1/config fills every key; values are the servers, not re-merged client-side', async () => {
  const h = harness(); await tick();
  assert.equal(h.calls.filter(c => c[1] === '/v1/config').length, 1);
  assert.equal(J(h.ctx.ctRead('inv_cfg')), J({ seller: { name: 'SRV default' } }), 'no client-side default merge');
  assert.equal(h.ctx.ctRead('pmap_zonebg'), 1);
  assert.equal(h.ctx.ctRead('guides')[0].id, 'g1');
  assert.equal(h.local.length, 0, 'none of these keys reads the blob');
  const g = h.ctx.ctRead('guides'); g.push({ id: 'x' }); assert.equal(h.ctx.ctRead('guides').length, 1, 'reads are copies');
});

test('config: ctWrite shows at once, saves after a pause with the version it read, keeps typing as one save', async () => {
  const h = harness(); await tick();
  const g = h.ctx.ctRead('guides');
  g[0].name = 'B'; h.ctx.ctWrite('guides', g);
  g[0].name = 'Bo'; h.ctx.ctWrite('guides', g);
  assert.equal(h.ctx.ctRead('guides')[0].name, 'Bo', 'optimistic');
  assert.equal(puts(h, 'guides').length, 0, 'not yet: still typing');
  await h.ctx.laOps.configStore.flush('guides');
  assert.equal(puts(h, 'guides').length, 1);
  assert.equal(puts(h, 'guides')[0][2].version, 2);
  assert.equal(puts(h, 'guides')[0][2].value[0].name, 'Bo');
  g[0].name = 'Boo'; h.ctx.ctWrite('guides', g); await h.ctx.laOps.configStore.flush('guides');
  assert.equal(puts(h, 'guides')[1][2].version, 3, 'the next save carries the version the last answer gave');
});

test('config: a never-saved key (version null) is saved without a version', async () => {
  const h = harness(); await tick();
  await h.ctx.ctWrite('pmap_agpanel', 0);
  const p = puts(h, 'pmap_agpanel'); assert.equal(p.length, 1, 'a toggle saves at once');
  assert.equal('version' in p[0][2], false); assert.equal(p[0][2].value, 0);
  assert.equal(h.ctx.ctRead('pmap_agpanel'), 0);
});

test('config: a refused save puts the last saved value back and shows the server message', async () => {
  const h = harness(); await tick();
  h.deny({ message: 'guides[0].role must be one of guide', status: 400, code: 'bad_request' });
  const g = h.ctx.ctRead('guides'); g[0].name = 'Zed'; h.ctx.ctWrite('guides', g);
  await h.ctx.laOps.configStore.flush('guides');
  assert.equal(h.ctx.ctRead('guides')[0].name, 'A');
  assert.equal(h.errors[0][1], 'guides[0].role must be one of guide');
  assert.equal(h.errors[0][0], 'Guide register not saved');
});

test('config: 409 stale_version reloads the key and tells the user', async () => {
  const h = harness(); await tick();
  h.cfg.guides = { ...h.cfg.guides, value: [{ id: 'g1', name: 'Theirs' }], version: 5 };   // someone else saved
  const g = h.ctx.ctRead('guides'); g[0].name = 'Mine'; h.ctx.ctWrite('guides', g);
  await h.ctx.laOps.configStore.flush('guides');
  assert.equal(h.errors[0][2], 'stale_version');
  assert.match(h.errors[0][0], /not saved/);
  assert.equal(h.calls.filter(c => c[0] === 'GET' && c[1] === '/v1/config/guides').length, 1);
  assert.equal(h.ctx.ctRead('guides')[0].name, 'Theirs');
  assert.equal(h.ctx.laOps.configStore.ents.guides.version, 5);
});

test('config: an edit made while a save is in flight is saved after it, not lost', async () => {
  const h = harness(); await tick();
  const g = h.ctx.ctRead('guides'); g[0].name = 'One'; h.ctx.ctWrite('guides', g);
  const first = h.ctx.laOps.configStore.flush('guides');
  g[0].name = 'Two'; h.ctx.ctWrite('guides', g);
  await first; await h.ctx.laOps.configStore.flush('guides');
  assert.equal(h.ctx.ctRead('guides')[0].name, 'Two');
  assert.equal(h.cfg.guides.value[0].name, 'Two');
});

test('config: agent logins and legacy mode never touch the server for these keys', async () => {
  const ag = harness({ agent: true }); await tick();
  assert.equal(ag.calls.length, 0); ag.ctx.ctRead('guides'); ag.ctx.ctWrite('guides', []); assert.equal(ag.local.length, 2);
  const off = harness({ enabled: false }); await tick();
  assert.equal(off.calls.length, 0); off.ctx.ctRead('inv_cfg'); assert.equal(off.local.length, 1);
});

test('config: a write before the first answer is refused with a message, nothing is sent', async () => {
  const h = harness({ failGet: true }); await tick();
  h.ctx.ctWrite('dr_mail', { to: 'a@b' });
  assert.equal(puts(h, 'dr_mail').length, 0);
  assert.match(h.errors.at(-1)[0], /not saved/);
});

test('config: the pickup map toggles that cached their first read are dropped when the saved values arrive', async () => {
  const h = harness({ pre: 'let _pmapZoneBg = true; let _pmapAgOpen = true;', server: { cfg: { pmap_zonebg: { key: 'pmap_zonebg', value: 0, saved: true, version: 1 } } } });
  await tick();
  assert.equal(vm.runInContext('_pmapZoneBg', h.ctx), null);
  assert.equal(vm.runInContext('_pmapAgOpen', h.ctx), null);
  assert.equal(h.ctx.ctRead('pmap_zonebg'), 0);
});
