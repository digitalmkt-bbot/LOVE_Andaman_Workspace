// UI parity · legacy (lk-inbox server.js) and the new frontend (main + operation-backend) side by side
//
//   node test/uiparity/run.mjs [--views=a,b] [--max-toggles=25] [--no-dialogs] [--out=dir]
//
// Opens every sidebar page in BOTH apps with the same data, then every toggle on it (tabs, chips, pills,
// segment buttons, selects, checkboxes) and the "open/show" buttons that open a dialog, and records what each
// side shows: the visible text, the row/card counts, the buttons, the console errors and the failed API calls.
// It writes legacy.json, new.json, compare.json and report.md into the output folder.
//
// What it starts (it never touches anything but localhost):
//   legacy  LEGACY_DIR/server.js (a checkout of origin/lk-inbox) on LEGACY_DB  · default the local copy legacy_ui
//   backend OPS_BACKEND_DIR/src/server.ts (operation-backend) on OPS_DB         · default the local copy operations_ui
//   new     this checkout's allotment_v2/ served static; its calls to the production backend URL are routed
//           to the local backend (same as t_ops.mjs)
// Both databases are COPIES of the parity pipeline's `legacy` and `operations` (CREATE DATABASE … TEMPLATE …),
// each with one extra login `uiparity` / password `uiparity` (see README.md here). Any URL that is not localhost
// is refused before anything starts.
import { serve } from '../ui/_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : (process.argv.includes('--' + k) ? true : d); };
const LEGACY_DIR = process.env.LEGACY_DIR || 'D:/projects/wt-uip-legacy';
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const LEGACY_DB = process.env.LEGACY_DB || 'postgres://postgres:postgres@localhost:55433/legacy_ui';
const OPS_DB = process.env.OPS_DB || 'postgres://postgres:postgres@localhost:55433/operations_ui';
const USER = process.env.UIP_USER || 'uiparity', PASS = process.env.UIP_PASS || 'uiparity';
const LEGACY_PORT = +(process.env.LEGACY_PORT || 3911), OPS_PORT = +(process.env.OPS_PORT || 3912);
const MAX_TOGGLES = +arg('max-toggles', 15), MAX_DIALOGS = +arg('max-dialogs', 5), DIALOGS = !arg('no-dialogs', false);
const ONLY = arg('views', '') ? String(arg('views')).split(',') : null;
const OUT = path.resolve(arg('out', path.join(HERE, 'out', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19))));
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;

for (const [k, v] of Object.entries({ LEGACY_DB, OPS_DB })) {
  const h = new URL(v).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(h)) throw new Error(`${k} must be a local database, got ${h}`);
}
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => { console.log(...a); fs.appendFileSync(path.join(OUT, 'run.log'), a.join(' ') + '\n'); };

// ── processes ──
const kids = [];
function start(name, cmd, args, cwd, env, ready, timeout = 120000) {
  // a clean env: nothing from this shell can point a child at a remote database or service
  const base = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'ComSpec', 'PATHEXT']) if (process.env[k]) base[k] = process.env[k];
  const p = spawn(cmd, args, { cwd, env: { ...base, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  kids.push(p);
  let buf = '';
  const file = fs.createWriteStream(path.join(OUT, name + '.log'));
  return new Promise((ok, bad) => {
    const t = setTimeout(() => bad(new Error(name + ' did not start:\n' + buf.slice(-2000))), timeout);
    const on = (b) => { buf += b; file.write(b); if (ready.test(buf)) { clearTimeout(t); ok(p); } };
    p.stdout.on('data', on); p.stderr.on('data', on);
    p.on('exit', (c) => { clearTimeout(t); bad(new Error(`${name} exited ${c}:\n` + buf.slice(-2000))); });
  });
}
const cleanup = () => { for (const k of kids) try { k.kill(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

log(`UI parity · out ${OUT}`);
await start('legacy-server', process.execPath, ['server.js'], LEGACY_DIR, { PORT: String(LEGACY_PORT), DATABASE_URL: LEGACY_DB, SESSION_SECRET: 'uiparity-local', DATA_BACKEND: 'relational' }, /LOVE Andaman on/);
await start('ops-backend', process.execPath, ['--import', 'tsx', 'src/server.ts'], OPS_DIR, { PORT: String(OPS_PORT), HOST: '127.0.0.1', DATABASE_URL: OPS_DB, AUTH_JWT_SECRET: 'uiparity-local', LOG_LEVEL: 'info', NODE_ENV: 'development' }, /Server listening|listening at/i);
const LEG = `http://localhost:${LEGACY_PORT}`, OPS = `http://127.0.0.1:${OPS_PORT}`;
const login = await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) })).json();
if (!login.access_token) throw new Error('operation-backend login failed: ' + JSON.stringify(login));
const TOKEN = login.access_token;

const { srv, port } = await serve();
kids.push({ kill: () => srv.close() });
const browser = await chromium.launch({ channel: 'chrome' });
kids.push({ kill: () => browser.close() });

// ── one side = one page + its own buffers ──
async function side(name) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const S = { name, ctx, errors: [], failed: [], writes: [], dialogs: [], pending: 0 };
  if (name === 'new') {
    await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, TOKEN);
    await ctx.route(PROD, async (route) => {
      const req = route.request(), u = new URL(req.url()), hd = req.headers(), fwd = {};
      for (const k of ['authorization', 'content-type', 'if-match', 'x-van-reason']) if (hd[k]) fwd[k] = hd[k];
      try {
        const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
        const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
        if (r.status >= 400) S.failed.push(`${req.method()} ${u.pathname} → ${r.status} ${buf.toString().slice(0, 160)}`);
        if (req.method() !== 'GET') S.writes.push(`${req.method()} ${u.pathname} ${r.status}`);
        await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
      } catch (e) { S.failed.push(`${req.method()} ${u.pathname} → network ${e.message}`); await route.abort(); }
    });
  } else {
    const r = await ctx.request.post(LEG + '/api/login', { data: { username: USER, password: PASS } });
    if (r.status() !== 200) throw new Error('legacy login failed: ' + r.status() + ' ' + (await r.text()));
  }
  const page = await ctx.newPage();
  S.page = page;
  const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|favicon/;
  page.on('pageerror', (e) => S.errors.push('pageerror: ' + String(e.message || e).slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) S.errors.push('console: ' + m.text().slice(0, 240)); });
  page.on('dialog', (d) => { S.dialogs.push(d.type() + ': ' + d.message().slice(0, 200)); d.dismiss().catch(() => {}); });
  // requests in flight · long-lived streams (the change feed, SSE, long polls) never finish and are not counted
  const LONG = /stream|events|\/changes|sse|poll|watch|la-config\.js/i;
  const inflight = new Set();
  Object.defineProperty(S, 'pending', { get: () => inflight.size, set: () => {} });
  page.on('request', (r) => { if (r.resourceType() !== 'eventsource' && !LONG.test(r.url())) inflight.add(r); });
  const done = (r) => { inflight.delete(r); };
  page.on('requestfinished', done);
  page.on('requestfailed', (r) => { done(r); const u = r.url(); if (!/\/assets\/|favicon|fonts\./.test(u)) S.failed.push(`${r.method()} ${u.replace(/^https?:\/\/[^/]+/, '')} → failed ${r.failure()?.errorText || ''}`); });
  page.on('response', (r) => {
    const u = r.url();
    if (name === 'legacy' && u.startsWith(LEG) && r.status() >= 400 && !/\/assets\/|favicon/.test(u)) S.failed.push(`${r.request().method()} ${u.slice(LEG.length)} → ${r.status()}`);
    if (name === 'legacy' && u.startsWith(LEG + '/api/') && r.request().method() !== 'GET') S.writes.push(`${r.request().method()} ${u.slice(LEG.length)} ${r.status()}`);
  });
  S.reset = () => { S.errors.length = 0; S.failed.length = 0; S.writes.length = 0; S.dialogs.length = 0; };
  return S;
}

async function quiet(S, max = 8000) {           // wait until the page has had no request in flight for 350 ms
  const t0 = Date.now(); let still = 0;
  while (Date.now() - t0 < max) {
    await S.page.waitForTimeout(120);
    if (S.pending === 0) { still += 120; if (still >= 360) return; } else still = 0;
  }
}

async function bootPair(n) {
  const legacy = await side('legacy'), neu = await side('new');
  log(`pair ${n}: booting legacy …`);
  await legacy.page.goto(LEG + '/allotment_v2/allotment_v2.html', { timeout: 180000 });
  await legacy.page.waitForFunction(() => typeof window.nav === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0 && !document.getElementById('la-bootfail'), null, { timeout: 180000 });
  log(`pair ${n}: booting new …`);
  await neu.page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { timeout: 180000 });
  await neu.page.waitForFunction(() => window.laOps && window.laOps.state && window.laOps.state.loaded, null, { timeout: 300000 });
  await Promise.all([quiet(legacy, 20000), quiet(neu, 30000)]);
  return { legacy, neu };
}
const WORKERS = +arg('workers', 2);
const pairs = [];
for (let n = 0; n < WORKERS; n++) pairs.push(await bootPair(n + 1));
const { legacy, neu } = pairs[0];
const boot = {
  legacy: { errors: [...legacy.errors], failed: [...legacy.failed] },
  new: { errors: [...neu.errors], failed: [...neu.failed], opsFailed: await neu.page.evaluate(() => (window.laOps.state.failed || []).map(String)) },
};
// counts both sides hold in memory after boot · the same data should give the same numbers
const COUNTS = () => {
  const n = (x) => Array.isArray(x) ? x.length : (x && typeof x === 'object' ? Object.keys(x).length : null);
  const g = (k) => { try { return n(eval(k)); } catch (_) { return null; } };
  return Object.fromEntries(['SB_BOOKINGS', 'SB_AGENTS', 'SB_RATE_TYPES', 'SB_SEAT_LOCKS', 'ROUTES', 'BOATS', 'TRIPS', 'SB_SALES', 'SB_CONTRACTS', 'SB_MARKETS', 'SB_STAFF', 'SB_EXTRAS', 'VEHICLES', 'SB_ADDON_TYPES'].map((k) => [k, g(k)]));
};
boot.legacy.counts = await legacy.page.evaluate(COUNTS);
boot.new.counts = await neu.page.evaluate(COUNTS);
log('boot counts legacy', JSON.stringify(boot.legacy.counts));
log('boot counts new   ', JSON.stringify(boot.new.counts));

// ── in-page probes (run inside each page) ──
const PROBE = {
  // the sidebar: section → items
  sidebar: () => {
    const out = []; let sec = '(top)';
    document.querySelectorAll('.sidebar .nav-section, .sidebar .nav-item[data-view]').forEach((el) => {
      if (el.classList.contains('nav-section')) { sec = el.textContent.replace(/[⌄▾▸›]/g, '').trim(); return; }
      out.push({ section: sec, view: el.dataset.view, citytour: el.dataset.citytour === '1', pogrp: el.dataset.pogrp || '', label: el.textContent.replace(/\s+/g, ' ').trim(), adminOnly: el.dataset.adminonly === '1' });
    });
    return out;
  },
  topbar: () => [...document.querySelectorAll('.topbar button, .topbar [onclick], .topbar a')].filter((e) => e.offsetParent).map((e) => (e.textContent || e.title || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  nav: (it) => {
    const sel = '.nav-item[data-view="' + it.view + '"]' + (it.citytour ? '[data-citytour="1"]' : ':not([data-citytour="1"])');
    const el = document.querySelector(sel);
    try { document.querySelectorAll('.la-modal-bg, .modal.open').forEach(() => {}); } catch (_) {}
    if (!el) return false;
    nav(el); return true;
  },
  // what the open page shows · also lists its toggles and dialog openers
  snap: (opt) => {
    const vis = (e) => { if (!e || !e.getClientRects().length) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
    const root = document.querySelector('.view.active') || document.querySelector('main') || document.body;
    const norm = (s) => String(s || '').replace(/\d{1,2}:\d{2}:\d{2}/g, 'HH:MM:SS').replace(/[ \t\u00a0]+/g, ' ').trim();
    const lines = norm(root.innerText).split('\n').map((l) => l.trim()).filter(Boolean);
    const WRITE = /save|delete|del[A-Z(]|remove|rm[A-Z(]|cancel|confirm|commit|submit|reset|import|export|print|download|logout|approve|reject|void|send|push|sync|apply|bulk|lock|unlock|assign|upload|archive|restore|create|add[A-Z(]|new[A-Z(]|copy|dup|clone|move|swap|merge|split|close[A-Z]*Day|pay|refund|charge|post[A-Z(]|mark|set[A-Z][a-z]*Status|toggleEdit|edit[A-Z(]/;
    const TOG_CLASS = /(^|[-_ ])(tab|tabs|seg|chip|pill|toggle|filter|mode|btn-group|switch|utab|dchip)([-_ ]|$)|tab-btn|seg-|-seg|chip|pill/i;
    const ACTIVE = /(^|[-_ ])(active|on|sel|selected|cur|current)([-_ ]|$)/;
    const label = (e) => norm(e.innerText || e.value || e.title || e.getAttribute('aria-label') || '').slice(0, 60);
    const fn = (e) => { const o = e.getAttribute('onclick') || e.getAttribute('onchange') || ''; const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(o); return m ? m[1] : ''; };
    const clickables = [...root.querySelectorAll('[onclick]')].filter(vis);
    const toggles = [], dialogs = [];
    for (const e of clickables) {
      const on = e.getAttribute('onclick') || '', cls = String(e.className || ''), f = fn(e), txt = label(e);
      if (!txt && !f) continue;
      const parent = e.parentElement, sib = parent ? [...parent.children].filter((c) => c.hasAttribute('onclick')) : [];
      const grouped = sib.length >= 2 && sib.some((c) => ACTIVE.test(String(c.className || '')) || c.getAttribute('aria-selected') === 'true');
      const isTog = (TOG_CLASS.test(cls) || e.getAttribute('role') === 'tab' || grouped) && !WRITE.test(f) && txt.length <= 40;
      const isDlg = !isTog && /^(open|show|view|la?[A-Z]?[a-z]*Open|[a-z]+(Open|Show|Modal|Dialog|Detail|Popup|Sheet|Drawer|Panel))/.test(f) && !WRITE.test(f) && !/Edit|Form/.test(f);
      if (txt.includes('\n')) continue;               // a multi-line card is a list item, not a toggle
      const key = (txt.replace(/[0-9]+/g, '#') || '∅') + '|' + f;
      if (isTog) toggles.push({ key, text: txt, fn: f, on: on.slice(0, 120), active: ACTIVE.test(cls) });
      else if (isDlg) dialogs.push({ key, text: txt, fn: f, on: on.slice(0, 120) });
    }
    const selects = [...root.querySelectorAll('select')].filter(vis).map((s) => ({ key: (s.id || s.name || fn(s) || 'select') + '', id: s.id, fn: fn(s), value: s.value, options: [...s.options].map((o) => ({ v: o.value, t: norm(o.text).slice(0, 50) })) }));
    const checks = [...root.querySelectorAll('input[type=checkbox], input[type=radio]')].filter(vis).map((c) => ({ key: (c.id || c.name || fn(c) || norm(c.closest('label')?.innerText || '').slice(0, 40) || 'check'), checked: c.checked })).slice(0, 15);
    const buttons = [...new Set([...root.querySelectorAll('button, [onclick], a[href]')].filter(vis).map(label).filter((t) => t && t.length <= 40))];
    // an open dialog: a fixed layer above the page that covers a real part of the screen
    const layers = [...document.querySelectorAll('body *')].filter((e) => {
      const s = getComputedStyle(e); if (s.position !== 'fixed' || !vis(e)) return false;
      if (e.closest('.sidebar, .topbar, #la-userbadge, .la-toast, #toast')) return false;
      const r = e.getBoundingClientRect(); return r.width * r.height > innerWidth * innerHeight * 0.08 && (+s.zIndex || 0) >= 50;
    });
    const modal = layers.length ? norm(layers[layers.length - 1].innerText).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 120) : null;
    return {
      title: norm((root.querySelector('h1,h2,.page-title,.view-title') || {}).innerText || '').slice(0, 80),
      lines: lines.slice(0, opt && opt.maxLines || 600), lineCount: lines.length,
      rows: root.querySelectorAll('tbody tr, tr').length, cards: root.querySelectorAll('[class*="card"]').length,
      inputs: root.querySelectorAll('input, select, textarea').length,
      empty: lines.length === 0, buttons, toggles: toggles.slice(0, 80), dialogs: dialogs.slice(0, 40), selects: selects.slice(0, 8), checks, modal,
    };
  },
  // click the n-th clickable whose key matches · key = "text|fn"
  clickKey: (key) => {
    const root = document.querySelector('.view.active') || document.body;
    const norm = (s) => String(s || '').replace(/\d{1,2}:\d{2}:\d{2}/g, 'HH:MM:SS').replace(/[ \t\u00a0]+/g, ' ').trim();
    const fn = (e) => { const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(e.getAttribute('onclick') || ''); return m ? m[1] : ''; };
    const k = (e) => ((norm(e.innerText || e.value || e.title || e.getAttribute('aria-label') || '').slice(0, 60)).replace(/[0-9]+/g, '#') || '∅') + '|' + fn(e);
    const el = [...root.querySelectorAll('[onclick]')].find((e) => e.getClientRects().length && k(e) === key);
    if (!el) return false;
    el.click(); return true;
  },
  select: ({ key, value }) => {
    const root = document.querySelector('.view.active') || document.body;
    const fn = (e) => { const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(e.getAttribute('onchange') || ''); return m ? m[1] : ''; };
    const s = [...root.querySelectorAll('select')].find((x) => x.getClientRects().length && ((x.id || x.name || fn(x) || 'select') === key));
    if (!s) return false;
    if (![...s.options].some((o) => o.value === value)) return 'no-option';
    s.value = value; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); return true;
  },
  check: (key) => {
    const root = document.querySelector('.view.active') || document.body;
    const norm = (s) => String(s || '').replace(/[ \t\u00a0]+/g, ' ').trim();
    const fn = (e) => { const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(e.getAttribute('onclick') || e.getAttribute('onchange') || ''); return m ? m[1] : ''; };
    const c = [...root.querySelectorAll('input[type=checkbox], input[type=radio]')].find((x) => x.getClientRects().length && ((x.id || x.name || fn(x) || norm(x.closest('label')?.innerText || '').slice(0, 40) || 'check') === key));
    if (!c) return false;
    c.click(); return true;
  },
  closeModal: () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const btn = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed').flatMap((l) => [...l.querySelectorAll('button, [onclick]')])
      .find((b) => /^(×|✕|✖|x|close|ปิด|cancel|ยกเลิก)$/i.test((b.innerText || b.title || '').trim()));
    if (btn) btn.click();
    return !!btn;
  },
};

const pick = (s) => s && ({ title: s.title, lines: s.lines, lineCount: s.lineCount, rows: s.rows, cards: s.cards, inputs: s.inputs, buttons: s.buttons, modal: s.modal });
async function snapBoth(P, state) {
  const { legacy, neu } = P;
  const [a, b] = await Promise.all([legacy, neu].map(async (S) => {
    try { return await S.page.evaluate(PROBE.snap, { maxLines: 600 }); } catch (e) { return { error: String(e.message || e).slice(0, 200) }; }
  }));
  const pack = (S, s) => ({ ...pick(s), loadMs: S.loadMs || 0, error: s.error, errors: [...S.errors], failed: [...S.failed], writes: [...S.writes], dialogs: [...S.dialogs] });
  return { ...state, legacy: pack(legacy, a), new: pack(neu, b), _a: a, _b: b };
}
async function onBoth(P, fn, arg, wait = 300) {
  const { legacy, neu } = P;
  legacy.reset(); neu.reset();
  const r = await Promise.all([legacy, neu].map((S) => S.page.evaluate(fn, arg).catch((e) => 'error: ' + String(e.message || e).slice(0, 160))));
  await Promise.all([legacy, neu].map(async (S) => {
    await S.page.waitForTimeout(wait); await quiet(S, QUIET_MS);
    // a screen that loads its data on open shows "Loading …" first · wait for the real screen (up to LOAD_MS)
    const t = Date.now();
    const ok = await S.page.waitForFunction(STILL_LOADING, null, { timeout: LOAD_MS, polling: 250 }).then(() => true, () => false);
    S.loadMs = Date.now() - t;
    if (!ok) S.errors.push(`still loading after ${LOAD_MS / 1000}s`);
    else if (S.loadMs > 300) await quiet(S, QUIET_MS);
  }));
  return r;
}
const LOAD_MS = +arg('load-ms', 60000), QUIET_MS = +arg('quiet-ms', 5000);
function STILL_LOADING() {
  const root = document.querySelector('.view.active') || document.body;
  return !/(^|\n)[^\n]{0,30}(Loading|กำลังโหลด|กำลังดึง)[^\n]{0,90}(…|\.\.\.)/i.test(root.innerText || '');
}

// ── walk ──
const sidebarL = await legacy.page.evaluate(PROBE.sidebar), sidebarN = await neu.page.evaluate(PROBE.sidebar);
const topbar = { legacy: await legacy.page.evaluate(PROBE.topbar), new: await neu.page.evaluate(PROBE.topbar) };
const items = sidebarL.filter((it) => !ONLY || ONLY.includes(it.view));
const states = [];
const inventory = [];
const t0 = Date.now();
async function walkPage(P, i, it) {
  const tag = it.view + (it.citytour ? '#citytour' : '');
  const inNew = sidebarN.some((x) => x.view === it.view && x.citytour === it.citytour);
  const r = await onBoth(P, PROBE.nav, it, 700);
  const base = await snapBoth(P, { page: tag, section: it.section, label: it.label, toggle: '(page open)', kind: 'page', navOk: { legacy: r[0], new: r[1] }, inNewSidebar: inNew });
  states.push(base);
  const a = base._a || {}, b = base._b || {};
  const inv = { ...it, page: tag, inNewSidebar: inNew, toggles: (a.toggles || []).map((t) => t.key), selects: (a.selects || []).map((s) => s.key + ' [' + s.options.length + ' options]'), checks: (a.checks || []).map((c) => c.key), dialogs: (a.dialogs || []).map((d) => d.key),
    newOnly: { toggles: (b.toggles || []).map((t) => t.key).filter((k) => !(a.toggles || []).some((t) => t.key === k)), dialogs: (b.dialogs || []).map((d) => d.key).filter((k) => !(a.dialogs || []).some((t) => t.key === k)) } };
  inventory.push(inv);
  log(`[${i + 1}/${items.length}] ${tag} · ${(a.toggles || []).length} toggles · ${(a.selects || []).length} selects · ${(a.checks || []).length} checks · ${(a.dialogs || []).length} dialogs · ${Math.round((Date.now() - t0) / 1000)}s`);

  // toggles: each from the page's opening state
  for (const t of (a.toggles || []).slice(0, MAX_TOGGLES)) {
    await onBoth(P, PROBE.nav, it, 300);
    const rr = await onBoth(P, PROBE.clickKey, t.key);
    states.push(await snapBoth(P, { page: tag, section: it.section, label: it.label, toggle: t.text || t.fn, key: t.key, kind: 'toggle', found: { legacy: rr[0], new: rr[1] } }));
  }
  for (const s of (a.selects || []).slice(0, 4)) {
    for (const o of s.options.filter((o) => o.v !== s.value).slice(0, 2)) {
      await onBoth(P, PROBE.nav, it, 300);
      const rr = await onBoth(P, PROBE.select, { key: s.key, value: o.v });
      states.push(await snapBoth(P, { page: tag, section: it.section, label: it.label, toggle: `select ${s.key} = ${o.t}`, key: s.key + '=' + o.v, kind: 'select', found: { legacy: rr[0], new: rr[1] } }));
    }
  }
  for (const c of (a.checks || []).slice(0, 5)) {
    await onBoth(P, PROBE.nav, it, 300);
    const rr = await onBoth(P, PROBE.check, c.key);
    states.push(await snapBoth(P, { page: tag, section: it.section, label: it.label, toggle: `${c.checked ? 'uncheck' : 'check'} ${c.key}`, key: 'check:' + c.key, kind: 'check', found: { legacy: rr[0], new: rr[1] } }));
  }
  if (DIALOGS) for (const d of (a.dialogs || []).slice(0, MAX_DIALOGS)) {
    await onBoth(P, PROBE.nav, it, 300);
    const rr = await onBoth(P, PROBE.clickKey, d.key, 600);
    states.push(await snapBoth(P, { page: tag, section: it.section, label: it.label, toggle: 'dialog: ' + (d.text || d.fn), key: d.key, kind: 'dialog', found: { legacy: rr[0], new: rr[1] } }));
    await onBoth(P, PROBE.closeModal, null, 250);
  }
}

let next = 0;
await Promise.all(pairs.map(async (P) => { while (next < items.length) { const i = next++; try { await walkPage(P, i, items[i]); } catch (e) { log(`! ${items[i].view}: ${String(e.message || e).slice(0, 200)}`); } } }));
const order = (pg) => items.findIndex((it) => it.view + (it.citytour ? '#citytour' : '') === pg);
states.sort((x, y) => order(x.page) - order(y.page));
inventory.sort((x, y) => order(x.page) - order(y.page));

// ── compare ──
const set = (xs) => new Set(xs || []);
const NUM = /-?\d[\d,]*(\.\d+)?/g;
function compare(s) {
  const L = s.legacy, N = s.new;
  const lines = { a: set(L.lines), b: set(N.lines) };
  const missing = [...lines.a].filter((x) => !lines.b.has(x)), extra = [...lines.b].filter((x) => !lines.a.has(x));
  const union = new Set([...lines.a, ...lines.b]).size || 1;
  const sim = (union - missing.length - extra.length) / union;
  const shape = (x) => x.replace(NUM, '#');
  const sa = set(missing.map(shape)), sb = set(extra.map(shape));
  // layout = the lines with every number replaced by # · "same layout, other numbers" is a data difference
  const shA = set((L.lines || []).map(shape)), shB = set((N.lines || []).map(shape));
  const layMissing = [...shA].filter((x) => !shB.has(x)), layExtra = [...shB].filter((x) => !shA.has(x));
  const layUnion = new Set([...shA, ...shB]).size || 1;
  const laySim = (layUnion - layMissing.length - layExtra.length) / layUnion;
  const numbersOnly = missing.length > 0 && [...sa].every((x) => sb.has(x));     // same lines, other numbers
  const bShape = (xs) => new Set((xs || []).map(shape));
  const nb = bShape(N.buttons), lb = bShape(L.buttons);
  const btnMissing = (L.buttons || []).filter((x) => !nb.has(shape(x))), btnExtra = (N.buttons || []).filter((x) => !lb.has(shape(x)));
  const newErr = (N.errors || []).filter((e) => !(L.errors || []).includes(e));
  const failed404 = (N.failed || []).filter((f) => /→ 404/.test(f)), failedOther = (N.failed || []).filter((f) => !/→ 404/.test(f));
  const notFound = s.found && s.found.legacy === true && s.found.new !== true;
  const modalDiff = s.kind === 'dialog' && (!!L.modal) !== (!!N.modal);
  let verdict = 'same';
  const why = [];
  if (s.kind === 'page' && !s.inNewSidebar) { verdict = 'differs'; why.push('page not in new sidebar'); }
  if (notFound) { verdict = 'differs'; why.push('toggle not found in new'); }
  if (modalDiff) { verdict = 'differs'; why.push(L.modal ? 'dialog opens in legacy only' : 'dialog opens in new only'); }
  if (laySim < 0.97) { verdict = 'differs'; why.push(`layout ${Math.round(laySim * 100)}% same (${layMissing.length} legacy lines missing, ${layExtra.length} new-only)`); }
  if (L.rows !== N.rows) { verdict = 'differs'; why.push(`rows ${L.rows}→${N.rows}`); }
  if (verdict === 'same' && sim < 0.999) { verdict = 'numbers'; why.push(`same layout, numbers differ on ${missing.length} lines`); }
  if (btnMissing.length) { verdict = 'differs'; why.push(btnMissing.length + ' buttons missing'); }
  if (newErr.length) { verdict = 'differs'; why.push(newErr.length + ' new-only JS errors'); }
  if ((N.failed || []).length) { verdict = 'differs'; why.push((N.failed || []).length + ' failed API calls'); }
  // where the fix belongs (a first guess · report.md says so)
  let cls = '';
  if (verdict !== 'same') {
    if (failed404.length) cls = 'backend: missing endpoint';
    else if (failedOther.length) cls = 'backend: endpoint refuses/errors';
    else if (newErr.length) cls = 'frontend: JS error';
    else if (s.kind === 'page' && !s.inNewSidebar) cls = 'frontend: page missing (sync lag?)';
    else if (layExtra.some((x) => /undefined|NaN|null|\[object|Invalid Date/.test(x))) cls = 'backend: missing field (undefined on screen)';
    else if (notFound || btnMissing.length) cls = 'frontend: control missing (sync lag or wiring)';
    else if (verdict === 'numbers') cls = 'data: numbers differ (backend computation or import)';
    else cls = 'review: layout differs';
  }
  return { page: s.page, section: s.section, label: s.label, toggle: s.toggle, kind: s.kind, verdict, cls, why: why.join(' · '), sim: +sim.toFixed(3), laySim: +laySim.toFixed(3), layMissing: layMissing.slice(0, 25), layExtra: layExtra.slice(0, 25),
    rows: [L.rows, N.rows], loadMs: [L.loadMs || 0, N.loadMs || 0], lineCount: [L.lineCount, N.lineCount], missing: missing.slice(0, 25), extra: extra.slice(0, 25), btnMissing: btnMissing.slice(0, 20), btnExtra: btnExtra.slice(0, 20),
    newErrors: newErr.slice(0, 8), legacyErrors: (L.errors || []).slice(0, 5), failed: (N.failed || []).slice(0, 10), legacyFailed: (L.failed || []).slice(0, 5),
    writes: { legacy: L.writes, new: N.writes }, dialogs: { legacy: L.dialogs, new: N.dialogs }, modal: [!!L.modal, !!N.modal] };
}
const cmp = states.map(compare);
const strip = (s) => { const { _a, _b, ...rest } = s; return rest; };
fs.writeFileSync(path.join(OUT, 'states.json'), JSON.stringify({ boot, topbar, sidebar: { legacy: sidebarL, new: sidebarN }, states: states.map(strip) }, null, 1));
fs.writeFileSync(path.join(OUT, 'compare.json'), JSON.stringify(cmp, null, 1));
fs.writeFileSync(path.join(OUT, 'inventory.json'), JSON.stringify({ sidebar: sidebarL, topbar: topbar.legacy, pages: inventory }, null, 1));

// ── report.md (report.mjs, so several runs can be merged later) ──
const { buildReport } = await import('./report.mjs');
fs.writeFileSync(path.join(OUT, 'report.md'), buildReport([OUT]).md);
const diff = cmp.filter((c) => c.verdict !== 'same');
log(`done · ${states.length} states · ${diff.length} differ · ${Math.round((Date.now() - t0) / 60000)} min · ${OUT}`);
cleanup();
process.exit(0);
