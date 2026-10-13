import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const SOURCE = fs.readFileSync('allotment_v2/js/ops/49-ops-capacity-overrides.js', 'utf8');
const D = '2026-10-20';

const day = (o = {}) => ({ boat_id: 'boatA', service_date: D, capacity: 34, normal: 30, ceiling: 36, overridden: true, reason: 'extra chairs', set_by: 'tata', set_at: '2026-10-13T01:00:00Z', ...o });

function runtime({ enabled = true, handlers = {}, inputs = { 'bcap-val': '34', 'bcap-reason': ' extra chairs ' } } = {}) {
  const requests = [], toasts = [], legacy = [], alerts = [], closed = { n: 0 }, after = { n: 0 };
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Number, String, Math, Date, parseInt, isNaN, setTimeout, clearTimeout,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    BOAT_CAP_OVR: {}, TRIPS: { [D]: { boatA: { route: 'r1' } } },
    alert: (m) => alerts.push(m),
    confirm: () => true,
    laSaveToast: (o) => toasts.push(o),
    boatCapModalClose: () => { closed.n++; },
    boatCapSet: (...a) => { legacy.push(['boatCapSet', a]); },
    _bcapSave: (...a) => { legacy.push(['_bcapSave', a]); },
    _bcapClear: (...a) => { legacy.push(['_bcapClear', a]); },
    document: { getElementById: (id) => (id in inputs ? { value: inputs[id] } : null), activeElement: null, querySelector: () => null },
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body });
    const h = handlers[opts.method + ' ' + path.split('?')[0]];
    if (h === undefined) throw new Error('unexpected request ' + opts.method + ' ' + path);
    const r = typeof h === 'function' ? await h(body) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);
  ctx.laOps.deployments = { load: async () => 'dep' };
  vm.runInContext(SOURCE, ctx);
  ctx.window._bcapAfter = () => { after.n++; };
  return { ctx, requests, toasts, legacy, alerts, closed, after, C: ctx.BOAT_CAP_OVR };
}
const P = '/v1/boats/boatA/capacity-overrides';
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };

test('save PUTs capacity + trimmed reason, then caches the server day and closes the modal', async () => {
  const rt = runtime({ handlers: { ['PUT ' + P + '/' + D]: { body: day() } } });
  rt.ctx._bcapSave('boatA', D);
  await settle();
  assert.deepEqual(rt.requests, [{ method: 'PUT', path: P + '/' + D, body: { capacity: 34, reason: 'extra chairs' } }]);
  assert.deepEqual(JSON.parse(JSON.stringify(rt.C[D + '::boatA'])), { cap: 34, reason: 'extra chairs', by: 'tata', at: '2026-10-13T01:00:00Z', srv: 1 });
  assert.equal(rt.closed.n, 1);
  assert.equal(rt.after.n, 1);
  assert.equal(rt.legacy.length, 0);
});

test('a refusal keeps the modal open, changes nothing, and shows the server message', async () => {
  const rt = runtime({ handlers: { ['PUT ' + P + '/' + D]: { status: 403, body: { message: 'Not allowed: raising a boat', code: 'forbidden' } } } });
  rt.ctx._bcapSave('boatA', D);
  await settle();
  assert.deepEqual(Object.keys(rt.C), []);
  assert.equal(rt.closed.n, 0);
  assert.equal(rt.after.n, 0);
  assert.equal(rt.toasts.at(-1).kind, 'error');
  assert.match(rt.toasts.at(-1).sub, /Not allowed/);
});

test('saving the normal number comes back not overridden and drops the cache entry', async () => {
  const rt = runtime({ inputs: { 'bcap-val': '30', 'bcap-reason': '' }, handlers: { ['PUT ' + P + '/' + D]: { body: day({ capacity: 30, overridden: false, reason: null }) } } });
  rt.C[D + '::boatA'] = { cap: 34, srv: 1 };
  rt.ctx._bcapSave('boatA', D);
  await settle();
  assert.deepEqual(rt.requests[0].body, { capacity: 30 }, 'no reason key when empty');
  assert.equal(D + '::boatA' in rt.C, false);
});

test('clear DELETEs; a 404 counts as cleared', async () => {
  const rt = runtime({ handlers: { ['DELETE ' + P + '/' + D]: { status: 404, body: { message: 'none', code: 'not_found' } } } });
  rt.C[D + '::boatA'] = { cap: 34, srv: 1 };
  rt.ctx._bcapClear('boatA', D);
  await settle();
  assert.equal(D + '::boatA' in rt.C, false);
  assert.equal(rt.closed.n, 1);
});

test('boatCapSet(null) clears on the server; boatCapSet(cap) writes', async () => {
  const rt = runtime({ handlers: { ['DELETE ' + P + '/' + D]: { status: 204 }, ['PUT ' + P + '/' + D]: { body: day({ capacity: 32 }) } } });
  assert.equal(await rt.ctx.boatCapSet('boatA', D, 32, 'why'), true);
  assert.equal(rt.C[D + '::boatA'].cap, 32);
  assert.equal(await rt.ctx.boatCapSet('boatA', D, null), true);
  assert.equal(D + '::boatA' in rt.C, false);
});

test('deployments.load also loads the overrides of the deployed boats; stale server entries go', async () => {
  const rt = runtime({ handlers: { ['GET ' + P]: { body: { overrides: [day(), day({ service_date: '2026-10-21', overridden: false })] } } } });
  rt.C['2026-10-01::boatB'] = { cap: 5, srv: 1 };
  rt.C['2026-10-02::boatB'] = { cap: 6, reason: 'operation-backend' };
  assert.equal(await rt.ctx.laOps.deployments.load(), 'dep');
  assert.deepEqual(Object.keys(rt.C).sort(), ['2026-10-02::boatB', D + '::boatA']);
  assert.match(rt.requests[0].path, /from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
});

test('legacy mode (ops off) calls the original functions untouched', () => {
  const rt = runtime({ enabled: false });
  rt.ctx._bcapSave('boatA', D); rt.ctx.boatCapSet('boatA', D, 3, 'x'); rt.ctx._bcapClear('boatA', D);
  assert.deepEqual(rt.legacy.map((l) => l[0]), ['_bcapSave', 'boatCapSet', '_bcapClear']);
  assert.equal(rt.requests.length, 0);
});
