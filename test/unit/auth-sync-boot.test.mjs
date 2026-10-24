// 01-auth-sync.js boot for a staff login, as the deployed page runs it: every script deferred (tools/build-assets.mjs),
// so <body> exists and readyState is 'interactive' while the file runs, and DOMContentLoaded comes after.
// Regression (parity/tasks/roles.mjs, 2026-10-24): onReady() ran laApplyPerms() at once, LA_AREAS was still undefined,
// the file threw for every non-admin and laAllowed / laCanEditArea / laCanAct / laLimited were never defined.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/01-auth-sync.js', 'utf8');

// An element that takes any call: the badge/toast/sidebar code builds and styles nodes we do not inspect.
function el(extra = {}) {
  const base = { style: {}, dataset: {}, children: [], innerHTML: '', textContent: '', className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild: (c) => c, insertBefore: (c) => c, removeChild: () => {}, remove() {}, setAttribute() {}, getAttribute: () => null,
    addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    getClientRects: () => [1], getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }), focus() {}, click() {}, ...extra };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : typeof k === 'symbol' ? undefined : (t[k] = () => el())) });
}

function boot(me) {
  const dcl = [], alerts = [], navCalls = [];
  const navItems = ['calendar', 'agents', 'booking', 'accounting'].map(v => el({ dataset: { view: v } }));
  // the file patches Storage.prototype (localStorage write guard), so the stores are real Storage instances
  class Storage {
    constructor() { this._m = new Map(); }
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; } setItem(k, v) { this._m.set(k, String(v)); } removeItem(k) { this._m.delete(k); }
    key(i) { return [...this._m.keys()][i] ?? null; } get length() { return this._m.size; } clear() { this._m.clear(); }
  }
  const store = () => new Storage();
  const session = store(); session.setItem('la_ops_token', 'tok');
  const document = {
    readyState: 'interactive', body: el(), head: el(), documentElement: el(),
    addEventListener: (t, fn) => { if (t === 'DOMContentLoaded') dcl.push(fn); },
    removeEventListener() {}, createElement: () => el(), createTextNode: () => el(), getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: s => (s === '.nav-item[data-view]' ? navItems : []),
  };
  class XHR {
    open(m, url) { this.url = url; } setRequestHeader() {} send() {
      if (this.url.includes('/v1/me')) { this.status = 200; this.responseText = JSON.stringify(me); } else { this.status = 404; this.responseText = ''; }
    }
  }
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, Date, Math, JSON, Promise, Object, Array, String, Number, RegExp, Error, Map, Set,
    document, Storage, sessionStorage: session, localStorage: store(), XMLHttpRequest: XHR,
    fetch: () => new Promise(() => {}), setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    location: { hostname: 'localhost', href: 'http://localhost/allotment_v2/allotment_v2.html', search: '', hash: '', pathname: '/allotment_v2/allotment_v2.html', reload() {} },
    navigator: { userAgent: 'node' }, alert: m => alerts.push(String(m)), confirm: () => true, prompt: () => null,
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    LA_CONFIG: { opsBackend: 'http://api.test' },
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);                    // the file itself must not throw
  // 04-data-core.js defines nav() later, still before DOMContentLoaded
  ctx.nav = el2 => { navCalls.push(el2.dataset.view); };
  for (const fn of dcl) fn();
  return { ctx, alerts, navCalls, navItems };
}

const STAFF = { id: 7, username: 'zzsales', name: 'Sales', role: 'staff', can_edit: true, can_edit_any: true,
  edit_areas: ['sales'], actions: [], view_perms: ['calendar', 'agents', '*explicit'] };

test('a staff login boots with the permission gates defined, deferred as deployed', () => {
  const { ctx } = boot(STAFF);
  for (const n of ['laAllowed', 'laCanEdit', 'laCanEditArea', 'laCanAct', 'laPermViewList', 'laLimited']) assert.equal(typeof ctx[n], 'function', n);
  assert.equal(ctx.laAllowed('agents'), true);
  assert.equal(ctx.laAllowed('booking'), false);
  assert.equal(ctx.laCanEditArea('sales'), true);
  assert.equal(ctx.laCanEditArea('operations'), false);
  assert.equal(ctx.laCanAct('act-capunlock'), false);
});

test('a staff login sees only its menus, and nav() refuses the others', () => {
  const { ctx, alerts, navCalls, navItems } = boot(STAFF);
  const shown = navItems.filter(i => i.style.display !== 'none').map(i => i.dataset.view);
  assert.deepEqual(shown, ['calendar', 'agents']);
  ctx.nav(navItems.find(i => i.dataset.view === 'booking'));
  assert.equal(alerts.length, 1, 'refused with the no-rights alert');
  ctx.nav(navItems.find(i => i.dataset.view === 'agents'));
  assert.deepEqual(navCalls, ['agents']);
});

test('an admin keeps every menu', () => {
  const { ctx, navItems } = boot({ ...STAFF, role: 'admin', view_perms: null, edit_areas: null });
  assert.equal(ctx.laAllowed('booking'), true);
  assert.deepEqual(navItems.filter(i => i.style.display === 'none').map(i => i.dataset.view), []);
});
