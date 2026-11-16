import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Sync 11-14 gaps, adapter side (lk-inbox 2eb83c8e..0fffe6a9).
// 1. §rnVan / §rnVan2: server only (operation-backend accepts zone RN; ops/35 already sends zoneBase as zone_base).
// 2. §routeCode: ctRead/ctWrite('route_codes') are the config store's (ops/61), and the ops programme form saves the code (ops/10).
// 3. §pslProd: ctRead/ctWrite('pos_products') are the config store's (ops/61).
// 4. §pslProd: the registry lists the POS months this adapter read, not laBlob()'s keys (ops/99-pos-sales pslRegData).
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 8; i++) await tick(); };
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

function configStore(entries) {
  const calls = [];
  const O = {
    enabled: () => true, state: { loaded: true }, busy: () => false, clone, wrote() {}, onWrite() {},
    fail: (t, e) => calls.push(['fail', t, e && e.message]),
    get: (p) => { calls.push(['GET', p]); return Promise.resolve(p === '/v1/config' ? { entries } : {}); },
    call: (m, p, b) => { calls.push([m, p, b]); return Promise.resolve({ key: p.split('/').pop(), value: b.value, version: (b.version || 0) + 1 }); },
    queue: (fn) => Promise.resolve().then(fn),
  };
  const legacyWrites = [];
  const window = {
    laOps: O, LA_ME: { username: 'po' },
    ctRead: (k) => { legacyWrites.push(['read', k]); return null; },
    ctWrite: (k, v) => { legacyWrites.push(['write', k, v]); },
  };
  window.window = window;
  const ctx = vm.createContext(Object.assign(window, { document: { querySelector: () => null, getElementById: () => null }, setTimeout, clearTimeout, console }));
  vm.runInContext(fs.readFileSync('allotment_v2/js/ops/61-ops-config-store.js', 'utf8'), ctx);
  return { window, calls, legacyWrites };
}

test('§routeCode / §pslProd: route_codes and pos_products read from GET /v1/config and save with PUT /v1/config/{key}, never the blob', async () => {
  const { window, calls, legacyWrites } = configStore([
    { key: 'route_codes', value: { r1: 'TRA' }, version: 3 },
    { key: 'pos_products', value: { 'beach shoe.toto': { cat: 'Beach Shoe' } }, version: 1 },
  ]);
  assert.equal(window.ctRead('route_codes'), null, 'before the answer: null, so laRouteCodeMap uses its own codes');
  await flush();
  assert.deepEqual(clone(window.ctRead('route_codes')), { r1: 'TRA' });
  assert.deepEqual(clone(window.ctRead('pos_products')), { 'beach shoe.toto': { cat: 'Beach Shoe' } });
  window.ctWrite('route_codes', { r1: 'TRA', r9: 'SLV' });
  window.ctWrite('pos_products', { 'beach shoe.toto': { cat: 'Beach Shoe', nm: 'TOTO' } });
  await flush();
  const puts = calls.filter((c) => c[0] === 'PUT');
  assert.deepEqual(clone(puts.map((c) => [c[1], c[2]])), [
    ['/v1/config/route_codes', { value: { r1: 'TRA', r9: 'SLV' }, version: 3 }],
    ['/v1/config/pos_products', { value: { 'beach shoe.toto': { cat: 'Beach Shoe', nm: 'TOTO' } }, version: 1 }],
  ]);
  assert.deepEqual(legacyWrites, [], 'nothing reached the legacy blob');
  assert.equal(calls.filter((c) => c[0] === 'fail').length, 0);
});

test('§routeCode: the ops programme form hands the typed code to laRouteCodeSave with the id the server gave a new route', () => {
  const src = fs.readFileSync('allotment_v2/js/ops/10-ops-catalogue.js', 'utf8');
  const start = src.indexOf("  calWrap('saveRoute', function(orig){"), end = src.indexOf("  calWrap('openRouteModal'");
  assert.ok(start > 0 && end > start);
  const body = src.slice(start, end);
  assert.match(body, /getElementById\('fm-route-code'\)/);
  assert.match(body, /savedId = r\.id/);
  assert.match(body, /window\.laRouteCodeSave\(savedId, codeVal\)/);
  assert.ok(body.indexOf('laRouteCodeSave') < body.indexOf("closeModal('route-modal')"), 'the code is saved before the form closes');
});

test('§pslProd: pslRegData reads every POS month of both piers once and sees those months as laBlob() keys', async () => {
  const gets = [];
  const O = {
    enabled: () => true, fail() {}, wrote() {}, queue: (fn) => Promise.resolve().then(fn), deployments: null,
    get: (p, q) => { gets.push([p, clone(q)]); return Promise.resolve({ days: q.pier === 'panwa' ? [{ pier: 'panwa', date: '2026-10-02', file_name: 'a.xls', items: [{ n: 'Hat', q: 1, net: 100 }] }] : [{ pier: 'tublamu', date: '2026-11-03', items: [] }] }); },
  };
  let seenKeys = null;
  const window = {
    laOps: O, LA_ME: {}, _psl: { pier: 'panwa', tab: 'reg' },
    laBlob: () => ({ unrelated: 1 }),
    ctRead: () => null, ctWrite() {}, renderPosSales() {}, pslAnData() {},
    pslRegData: () => { seenKeys = Object.keys(window.laBlob()).sort(); return []; },
  };
  window.window = window;
  const ctx = vm.createContext(Object.assign(window, { document: { querySelector: () => null }, setTimeout, console }));
  vm.runInContext(fs.readFileSync('allotment_v2/js/ops/99-ops-pos-sales.js', 'utf8'), ctx);
  window.pslRegData();
  await flush();
  assert.deepEqual(gets.map((g) => g[1].pier).sort(), ['panwa', 'tublamu'], 'one read of every month per pier');
  window.pslRegData();
  await flush();
  assert.equal(gets.length, 2, 'not read again');
  assert.deepEqual(seenKeys, ['pos_sales_202610', 'pos_sales_202611']);
  assert.deepEqual(Object.keys(window.laBlob()), ['unrelated'], 'laBlob is put back');
});
