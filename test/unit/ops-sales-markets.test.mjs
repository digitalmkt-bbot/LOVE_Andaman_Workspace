import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/27-ops-sales-board.js', 'utf8');

// Minimal stand-in for 00-ops-core.js plus the legacy globals the wrappers read.
function runtime({ enabled = true, respond }) {
  const calls = [];
  const failures = [];
  const wrote = [];
  const alerts = [];
  const legacy = [];
  const window = {
    laOps: {
      enabled: () => enabled,
      call: (method, path, body) => {
        calls.push({ method, path, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)) });
        return respond(method, path, body);
      },
      get: (path) => { calls.push({ method: 'GET', path }); return respond('GET', path); },
      post: (path, body) => window.laOps.call('POST', path, body === undefined ? {} : body),
      patch: (path, body) => window.laOps.call('PATCH', path, body),
      del: (path) => window.laOps.call('DELETE', path),
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (kind) => wrote.push(kind),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
      clone: (x) => (x == null ? x : JSON.parse(JSON.stringify(x))),
    },
    alert: (m) => alerts.push(m),
    confirm: () => true,
    renderTeamMkt: () => legacy.push('renderTeamMkt'),
    tmCloseModal: () => legacy.push('tmCloseModal'),
  };
  const ctx = {
    window,
    console, Promise, JSON, Object, Array, String, Number, Math, Date, encodeURIComponent,
    SB_MARKETS: [
      { id: 'ru', name: 'Russia', color: '#111', subs: ['Moscow'], sort: 1 },
      { id: 'de', name: 'Germany', color: '#222', subs: [], sort: 2 },
    ],
    SB_SALES: [
      { id: 's1', code: 'NK', name: 'Nok', fullName: 'Nok K', active: true, signature: 'data:image/png;base64,AAAA' },
    ],
    SB_AGENTS: [{ id: 'a1', sales: 's1' }],
    _tmModalType: null, _tmModalEditId: null, _tmModalDraft: null,
  };
  // Legacy originals: must run in legacy mode, and must not run in ops mode.
  const origs = ['tmSaveModal', 'tmDeleteMarket', 'tmDeleteSales', 'tmApplyMarketOrder', 'sbMarketsPersist', 'sbSalesPersist'];
  origs.forEach((n) => { window[n] = (...args) => { legacy.push(n); return 'legacy:' + n + ':' + args.length; }; });
  window.agSubMarketRemember = (id, sub) => { // legacy: adds to the local list, true when new
    const m = ctx.SB_MARKETS.find((x) => x.id === id);
    if (!m || !sub || m.subs.some((x) => x.toLowerCase() === sub.toLowerCase())) return false;
    m.subs.push(sub); legacy.push('agSubMarketRemember'); return true;
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, ctx, calls, failures, wrote, alerts, legacy };
}

test('market and salesperson mappers match the verified server bodies', () => {
  const rt = runtime({ respond: async () => ({}) });
  const c = rt.window.__laOpsSalesMarketsCompat;
  assert.deepEqual(JSON.parse(JSON.stringify(c.marketBody({ id: 'x', name: ' Thai ', color: '', subs: [' A ', ''] }))), {
    name: 'Thai', color: null, subs: ['A'],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.salesBody({ id: 's9', code: 'ab', name: 'Ann', fullName: 'Ann L', designation: 'Sales Executive', email: '', tel: '0812', color: '#abc', active: true }))), {
    code: 'ab', name: 'Ann', full_name: 'Ann L', designation: 'Sales Executive', email: null, tel: '0812', color: '#abc', active: true,
  }, 'no id is sent: the server makes it');
  const m = c.marketFromServer({ id: 'ru', name: 'Russia', color: '#111', subs: ['Moscow'], sort: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(m)), { id: 'ru', name: 'Russia', subs: ['Moscow'], color: '#111', sort: 1 });
});

test('ops mode: creating a market POSTs {id,name,color,subs}, changes nothing before the answer, then appends the server row', async () => {
  let release;
  const rt = runtime({ respond: () => new Promise((r) => { release = () => r({ id: 'ota', name: 'OTA', color: '#999', subs: ['Agoda'], sort: 3 }); }) });
  rt.ctx._tmModalType = 'market';
  rt.ctx._tmModalEditId = null;
  rt.ctx._tmModalDraft = { id: 'ota', name: 'OTA', color: '#999', subs: ['Agoda'] };
  const pending = rt.window.tmSaveModal();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(rt.calls, [{ method: 'POST', path: '/v1/markets', body: { id: 'ota', name: 'OTA', color: '#999', subs: ['Agoda'] } }]);
  assert.equal(rt.ctx.SB_MARKETS.length, 2, 'no local change before the server answers');
  release();
  await pending;
  assert.equal(rt.ctx.SB_MARKETS.length, 3);
  assert.equal(rt.ctx.SB_MARKETS[2].id, 'ota');
  assert.deepEqual(rt.legacy, ['tmCloseModal', 'renderTeamMkt']);
  assert.deepEqual(rt.wrote, ['sales-market-create']);
});

test('ops mode: a refused market save leaves the list and the open modal alone', async () => {
  const rt = runtime({ respond: async () => { const e = new Error('Market ID "ru" is taken'); e.status = 409; throw e; } });
  rt.ctx._tmModalType = 'market';
  rt.ctx._tmModalEditId = null;
  rt.ctx._tmModalDraft = { id: 'ru', name: 'Dup', subs: [] };
  await rt.window.tmSaveModal();
  assert.equal(rt.ctx.SB_MARKETS.length, 2);
  assert.equal(rt.ctx.SB_MARKETS[0].name, 'Russia');
  assert.deepEqual(rt.legacy, [], 'modal is not closed on failure');
  assert.equal(rt.failures[0].message, 'Market ID "ru" is taken');
});

test('ops mode: editing a market PATCHes name/color/subs, never the id', async () => {
  const rt = runtime({ respond: async () => ({ id: 'de', name: 'Deutschland', color: '#222', subs: ['Berlin'], sort: 2 }) });
  rt.ctx._tmModalType = 'market';
  rt.ctx._tmModalEditId = 'de';
  rt.ctx._tmModalDraft = { id: 'de', name: 'Deutschland', color: '#222', subs: ['Berlin'] };
  await rt.window.tmSaveModal();
  assert.deepEqual(rt.calls, [{ method: 'PATCH', path: '/v1/markets/de', body: { name: 'Deutschland', color: '#222', subs: ['Berlin'] } }]);
  assert.equal(rt.ctx.SB_MARKETS[1].name, 'Deutschland');
});

test('ops mode: reorder PUTs {ids} and takes the server list order', async () => {
  const rt = runtime({ respond: async () => ({ markets: [{ id: 'de', name: 'Germany', subs: [], sort: 1 }, { id: 'ru', name: 'Russia', subs: ['Moscow'], sort: 2 }] }) });
  await rt.window.tmApplyMarketOrder(['de', 'ru']);
  assert.deepEqual(rt.calls, [{ method: 'PUT', path: '/v1/markets/order', body: { ids: ['de', 'ru'] } }]);
  assert.deepEqual(rt.ctx.SB_MARKETS.map((m) => m.id), ['de', 'ru']);
});

test('ops mode: deleting a market asks first, then DELETEs and drops the row only after the answer', async () => {
  const rt = runtime({ respond: async () => null });
  await rt.window.tmDeleteMarket('ru');
  assert.deepEqual(rt.calls, [{ method: 'DELETE', path: '/v1/markets/ru', body: undefined }]);
  assert.deepEqual(rt.ctx.SB_MARKETS.map((m) => m.id), ['de']);
  assert.deepEqual(rt.wrote, ['sales-market-delete']);
});

test('ops mode: creating a salesperson POSTs without an id; the signature is kept when the server omits it on update', async () => {
  const rt = runtime({ respond: async (method) => (method === 'POST'
    ? { id: 's7', code: 'AB', name: 'Ann', full_name: null, designation: 'Sales Executive', email: null, tel: null, color: null, active: true, has_signature: false }
    : { id: 's1', code: 'NK', name: 'Nok', full_name: 'Nok K', designation: null, email: null, tel: null, color: null, active: true, has_signature: true }) });
  rt.ctx._tmModalType = 'sales';
  rt.ctx._tmModalEditId = null;
  rt.ctx._tmModalDraft = { id: 's9', code: 'ab', name: 'Ann', fullName: '', designation: 'Sales Executive', email: '', tel: '', color: '#abc', active: true, signature: '' };
  await rt.window.tmSaveModal();
  assert.equal(rt.calls[0].method, 'POST');
  assert.equal(rt.calls[0].path, '/v1/sales');
  assert.equal('id' in rt.calls[0].body, false);
  assert.equal(rt.calls[0].body.code, 'ab');

  rt.calls.length = 0;
  rt.ctx._tmModalType = 'sales';
  rt.ctx._tmModalEditId = 's1';
  rt.ctx._tmModalDraft = { id: 's1', code: 'NK', name: 'Nok', fullName: 'Nok K', designation: 'Sales Executive', active: true };
  await rt.window.tmSaveModal();
  assert.equal(rt.calls[0].method, 'PATCH');
  assert.equal(rt.calls[0].path, '/v1/sales/s1');
  assert.equal(rt.ctx.SB_SALES[0].signature, 'data:image/png;base64,AAAA', 'signature held locally survives an update that does not return it');
});

test('ops mode: deleting a salesperson unassigns agents only after the server answers', async () => {
  let release;
  const rt = runtime({ respond: () => new Promise((r) => { release = () => r(null); }) });
  const pending = rt.window.tmDeleteSales('s1');
  await new Promise((r) => setImmediate(r));
  assert.equal(rt.ctx.SB_AGENTS[0].sales, 's1', 'agent untouched while the request is in flight');
  release();
  await pending;
  assert.equal(rt.ctx.SB_AGENTS[0].sales, null);
  assert.equal(rt.ctx.SB_SALES.length, 0);
  assert.deepEqual(rt.calls, [{ method: 'DELETE', path: '/v1/sales/s1', body: undefined }]);
});

test('ops mode: legacy blob writers for markets and sales are no-ops', () => {
  const rt = runtime({ respond: async () => { throw new Error('no call expected'); } });
  assert.equal(rt.window.sbMarketsPersist(), undefined);
  assert.equal(rt.window.sbSalesPersist(), undefined);
  assert.deepEqual(rt.legacy, []);
});

test('legacy mode: every wrapper delegates to the original and makes no API request', async () => {
  const rt = runtime({ enabled: false, respond: async () => { throw new Error('must not be called'); } });
  assert.equal(rt.window.tmSaveModal(), 'legacy:tmSaveModal:0');
  assert.equal(rt.window.tmDeleteMarket('ru'), 'legacy:tmDeleteMarket:1');
  assert.equal(rt.window.tmDeleteSales('s1'), 'legacy:tmDeleteSales:1');
  assert.equal(rt.window.tmApplyMarketOrder(['de', 'ru']), 'legacy:tmApplyMarketOrder:1');
  assert.equal(rt.window.sbMarketsPersist(), 'legacy:sbMarketsPersist:0');
  assert.equal(rt.window.sbSalesPersist(), 'legacy:sbSalesPersist:0');
  assert.deepEqual(rt.calls, []);
});

test('agent form new sub-market: one targeted PATCH of that market subs; a known one writes nothing', async () => {
  const rt = runtime({ respond: async (m, path, body) => ({ id: 'ru', name: 'Russia', color: '#111', subs: body.subs, sort: 1 }) });
  assert.equal(rt.window.agSubMarketRemember('ru', 'Moscow'), false, 'already known: legacy says no');
  assert.equal(rt.window.agSubMarketRemember('ru', 'Sochi'), true);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(rt.calls, [{ method: 'PATCH', path: '/v1/markets/ru', body: { subs: ['Moscow', 'Sochi'] } }]);
  assert.deepEqual(rt.ctx.SB_MARKETS[0].subs, ['Moscow', 'Sochi']);
  assert.deepEqual(rt.wrote, ['sales-market-subs']);
});

test('agent form new sub-market: a refusal takes the sub back out and toasts; a 403 is silent', async () => {
  const bad = runtime({ respond: async () => { throw Object.assign(new Error('nope'), { statusCode: 400 }); } });
  bad.window.agSubMarketRemember('ru', 'Sochi');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(bad.ctx.SB_MARKETS[0].subs, ['Moscow']);
  assert.deepEqual(bad.failures, [{ title: 'Could not save sub-market', message: 'nope' }]);
  const denied = runtime({ respond: async () => { throw Object.assign(new Error('forbidden'), { statusCode: 403 }); } });
  denied.window.agSubMarketRemember('ru', 'Sochi');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(denied.ctx.SB_MARKETS[0].subs, ['Moscow']);
  assert.deepEqual(denied.failures, []);
});

test('legacy mode: agSubMarketRemember runs the original and writes nothing', () => {
  const rt = runtime({ enabled: false, respond: async () => ({}) });
  assert.equal(rt.window.agSubMarketRemember('ru', 'Sochi'), true);
  assert.deepEqual(rt.calls, []);
});
