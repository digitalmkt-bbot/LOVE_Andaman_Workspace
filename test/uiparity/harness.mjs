// UI parity · the shared harness behind run.mjs (check 1, screens) and scenarios.mjs (check 4, actions)
//
// It boots legacy (LEGACY_DIR/server.js on a local copy of legacy's DB), operation-backend (OPS_DIR on a local copy
// of ours) and this checkout's allotment_v2/ served static, and drives one Chromium page per side. Nothing here
// talks to anything but localhost: a database URL that is not local is refused before anything starts, and the
// servers get a clean environment (PATH-like variables only).
import { serve } from '../ui/_harness.mjs';
import { chromium } from 'playwright';
import { countUpDone, maskLines, tiePairs } from './noise.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;

export function assertLocal(urls) {
  for (const [k, v] of Object.entries(urls)) {
    const h = new URL(v).hostname;
    if (!['localhost', '127.0.0.1', '::1'].includes(h)) throw new Error(`${k} must be a local database, got ${h}`);
  }
}

// H = one harness: its servers, its browser and its output folder
export async function startHarness(o) {
  assertLocal({ LEGACY_DB: o.legacyDb, OPS_DB: o.opsDb });
  fs.mkdirSync(o.out, { recursive: true });
  const H = { ...o, kids: [], LOAD_MS: o.loadMs || 60000, QUIET_MS: o.quietMs || 5000 };
  H.log = o.log || ((...a) => { console.log(...a); fs.appendFileSync(path.join(o.out, 'run.log'), a.join(' ') + '\n'); });
  H.cleanup = () => { for (const k of H.kids.splice(0)) try { k.kill(); } catch (_) {} };
  const start = (name, cmd, args, cwd, env, ready, timeout = 120000) => {
    const base = {};
    for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'ComSpec', 'PATHEXT']) if (process.env[k]) base[k] = process.env[k];
    const p = spawn(cmd, args, { cwd, env: { ...base, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    H.kids.push(p);
    let buf = '';
    const file = fs.createWriteStream(path.join(o.out, name + '.log'));
    return new Promise((ok, bad) => {
      const t = setTimeout(() => bad(new Error(name + ' did not start:\n' + buf.slice(-2000))), timeout);
      const on = (b) => { buf += b; file.write(b); if (ready.test(buf)) { clearTimeout(t); ok(p); } };
      p.stdout.on('data', on); p.stderr.on('data', on);
      p.on('exit', (c) => { clearTimeout(t); if (!H.closing) bad(new Error(`${name} exited ${c}:\n` + buf.slice(-2000))); });
    });
  };
  await start('legacy-server', process.execPath, ['server.js'], o.legacyDir, { PORT: String(o.legacyPort), DATABASE_URL: o.legacyDb, SESSION_SECRET: 'uiparity-local', DATA_BACKEND: 'relational' }, /LOVE Andaman on/);
  await start('ops-backend', process.execPath, ['--import', 'tsx', 'src/server.ts'], o.opsDir, { PORT: String(o.opsPort), HOST: '127.0.0.1', DATABASE_URL: o.opsDb, AUTH_JWT_SECRET: 'uiparity-local', LOG_LEVEL: 'info', NODE_ENV: 'development' }, /Server listening|listening at/i);
  H.LEG = `http://localhost:${o.legacyPort}`; H.OPS = `http://127.0.0.1:${o.opsPort}`;
  const login = await (await fetch(H.OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: o.user, password: o.pass }) })).json();
  if (!login.access_token) throw new Error('operation-backend login failed: ' + JSON.stringify(login));
  H.TOKEN = login.access_token;
  const { srv, port } = await serve();
  H.port = port;
  H.kids.push({ kill: () => srv.close() });
  H.browser = await chromium.launch({ channel: 'chrome' });
  H.kids.push({ kill: () => H.browser.close() });
  const prev = H.cleanup;
  H.cleanup = () => { H.closing = true; prev(); };
  return H;
}

// the fixed clock both sides' browsers run on · legacy takes "today" from the browser's clock in UTC
// (04-data-core.js fmt = toISOString), so before 07:00 Bangkok it shows yesterday. Then both browsers start at
// 10:00 Bangkok of today's Bangkok date and run on from there. The servers keep the real clock: same Bangkok date.
export function clockStart(fixed) {
  if (fixed) return new Date(fixed);
  const bkk = new Date(Date.now() + 7 * 3600e3);
  return bkk.getUTCHours() < 7 ? new Date(bkk.toISOString().slice(0, 10) + 'T10:00:00+07:00') : null;
}

// ── one side = one page + its own buffers ──
export async function side(H, name, { clock } = {}) {
  const ctx = await H.browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const t = clockStart(clock);
  if (t) await ctx.clock.install({ time: t });
  // answers: a queue for native alert/confirm/prompt · empty = dismiss (check 1 never accepts one)
  const S = { name, ctx, errors: [], failed: [], writes: [], dialogs: [], answers: [], pending: 0 };
  if (name === 'new') {
    await ctx.addInitScript((tk) => { try { sessionStorage.setItem('la_ops_token', tk); } catch (_) {} }, H.TOKEN);
    await ctx.route(PROD, async (route) => {
      const req = route.request(), u = new URL(req.url()), hd = req.headers(), fwd = {};
      for (const k of ['authorization', 'content-type', 'if-match', 'x-van-reason']) if (hd[k]) fwd[k] = hd[k];
      try {
        const r = await fetch(H.OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
        const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
        if (r.status >= 400) S.failed.push(`${req.method()} ${u.pathname} → ${r.status} ${buf.toString().slice(0, 160)}`);
        if (req.method() !== 'GET') S.writes.push(`${req.method()} ${u.pathname} ${r.status}`);
        await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
      } catch (e) { S.failed.push(`${req.method()} ${u.pathname} → network ${e.message}`); await route.abort(); }
    });
  } else {
    const r = await ctx.request.post(H.LEG + '/api/login', { data: { username: H.user, password: H.pass } });
    if (r.status() !== 200) throw new Error('legacy login failed: ' + r.status() + ' ' + (await r.text()));
  }
  const page = await ctx.newPage();
  S.page = page;
  const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|favicon/;
  page.on('pageerror', (e) => S.errors.push('pageerror: ' + String(e.message || e).slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) S.errors.push('console: ' + m.text().slice(0, 240)); });
  page.on('dialog', (d) => {
    S.dialogs.push(d.type() + ': ' + d.message().slice(0, 300));
    const a = S.answers.shift();
    if (a && a.accept) d.accept(a.text).catch(() => {}); else d.dismiss().catch(() => {});
  });
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
    if (name === 'legacy' && u.startsWith(H.LEG) && r.status() >= 400 && !/\/assets\/|favicon/.test(u)) S.failed.push(`${r.request().method()} ${u.slice(H.LEG.length)} → ${r.status()}`);
    if (name === 'legacy' && u.startsWith(H.LEG + '/api/') && r.request().method() !== 'GET') S.writes.push(`${r.request().method()} ${u.slice(H.LEG.length)} ${r.status()}`);
  });
  S.reset = () => { S.errors.length = 0; S.failed.length = 0; S.writes.length = 0; S.dialogs.length = 0; };
  return S;
}

export async function quiet(S, max = 8000) {           // wait until the page has had no request in flight for 350 ms
  const t0 = Date.now(); let still = 0;
  while (Date.now() - t0 < max) {
    await S.page.waitForTimeout(120);
    if (S.pending === 0) { still += 120; if (still >= 360) return; } else still = 0;
  }
}

// Legacy's global functions wrapped so a run knows which of them ran (check 5, coverage). A Proxy keeps
// everything else about the function (its properties, `new`, toString); a function declared at the top of a
// classic script is a property of window, so every later call by name goes through the wrapper.
export async function recordCalls(S, names) {
  return S.page.evaluate((ns) => {
    const seen = window.__uipCalls = window.__uipCalls || new Set();
    let n = 0;
    for (const k of ns) {
      const f = window[k];
      if (typeof f !== 'function' || f.__uipWrapped) continue;
      try {
        const p = new Proxy(f, { apply(t, th, a) { seen.add(k); return Reflect.apply(t, th, a); }, get(t, prop, r) { return prop === '__uipWrapped' ? true : Reflect.get(t, prop, r); } });
        window[k] = p;
        if (window[k] === p) n++;
      } catch (_) {}
    }
    return n;
  }, names);
}
export const takeCalls = (S) => S.page.evaluate(() => { const s = window.__uipCalls; if (!s) return []; const a = [...s]; s.clear(); return a; }).catch(() => []);

export async function bootPair(H, n, opt = {}) {
  const legacy = await side(H, 'legacy', opt), neu = await side(H, 'new', opt);
  H.log(`pair ${n}: booting legacy …`);
  await legacy.page.goto(H.LEG + '/allotment_v2/allotment_v2.html', { timeout: 180000 });
  await legacy.page.waitForFunction(() => typeof window.nav === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0 && !document.getElementById('la-bootfail'), null, { timeout: 180000 });
  H.log(`pair ${n}: booting new …`);
  await neu.page.goto(`http://127.0.0.1:${H.port}/allotment_v2.html`, { timeout: 180000 });
  await neu.page.waitForFunction(() => window.laOps && window.laOps.state && window.laOps.state.loaded, null, { timeout: 300000 });
  // a boot that lost calls (the shared local DB out of connections, say) boots again, up to 3 times
  for (let i = 0; i < 3; i++) {
    const failed = await neu.page.evaluate(() => (window.laOps.state.failed || []).map(String));
    if (!failed.length) break;
    H.log(`pair ${n}: new side boot lost ${failed.length} calls (${failed.slice(0, 3).join('; ').slice(0, 200)}) · reloading`);
    neu.reset();
    await neu.page.reload({ timeout: 180000 });
    await neu.page.waitForFunction(() => window.laOps && window.laOps.state && window.laOps.state.loaded, null, { timeout: 300000 });
  }
  await Promise.all([quiet(legacy, 20000), quiet(neu, 30000)]);
  if (opt.recordNames) legacy.wrapped = await recordCalls(legacy, opt.recordNames);
  return { legacy, neu };
}

// ── in-page probes (run inside each page) ──
export const PROBE = {
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
    if (!el) return false;
    nav(el); return true;
  },
  // what the open page shows · also lists its toggles, dialog openers and list rows
  //   opt.scope = 'modal': controls are taken from the open dialog (a detail panel) when there is one
  snap: (opt) => {
    const vis = (e) => { if (!e || !e.getClientRects().length) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
    const root = document.querySelector('.view.active') || document.querySelector('main') || document.body;
    const norm = (s) => String(s || '').replace(/\d{1,2}:\d{2}:\d{2}/g, 'HH:MM:SS').replace(/[ \t ]+/g, ' ').trim();
    const lines = norm(root.innerText).split('\n').map((l) => l.trim()).filter(Boolean);
    const WRITE = /save|delete|del[A-Z(]|remove|rm[A-Z(]|cancel|confirm|commit|submit|reset|import|export|print|download|logout|approve|reject|void|send|push|sync|apply|bulk|lock|unlock|assign|upload|archive|restore|create|add[A-Z(]|new[A-Z(]|copy|dup|clone|move|swap|merge|split|close[A-Z]*Day|pay|refund|charge|post[A-Z(]|mark|set[A-Z][a-z]*Status|toggleEdit|edit[A-Z(]/;
    const TOG_CLASS = /(^|[-_ ])(tab|tabs|seg|chip|pill|toggle|filter|mode|btn-group|switch|utab|dchip)([-_ ]|$)|tab-btn|seg-|-seg|chip|pill/i;
    const ACTIVE = /(^|[-_ ])(active|on|sel|selected|cur|current)([-_ ]|$)/;
    const label = (e) => norm(e.innerText || e.value || e.title || e.getAttribute('aria-label') || '').slice(0, 60);
    const fn = (e) => { const o = e.getAttribute('onclick') || e.getAttribute('onchange') || ''; const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(o); return m ? m[1].replace(/^bookingV2/, 'bkV2') : ''; /* the new frontend renamed bkV2* to bookingV2*: one name for both */ };
    // an open dialog: a fixed layer above the page that covers a real part of the screen
    const layers = [...document.querySelectorAll('body *')].filter((e) => {
      const s = getComputedStyle(e); if (s.position !== 'fixed' || !vis(e)) return false;
      if (e.closest('.sidebar, .topbar, #la-userbadge, .la-toast, #toast')) return false;
      const r = e.getBoundingClientRect(); return r.width * r.height > innerWidth * innerHeight * 0.08 && (+s.zIndex || 0) >= 50;
    });
    const top = layers.length ? layers[layers.length - 1] : null;
    const ctl = opt && opt.scope === 'modal' && top ? top : root;
    const clickables = [...ctl.querySelectorAll('[onclick]')].filter(vis);
    const toggles = [], dialogs = [], listRows = [];
    for (const e of clickables) {
      const on = e.getAttribute('onclick') || '', cls = String(e.className || ''), f = fn(e), txt = label(e);
      if (!txt && !f) continue;
      const parent = e.parentElement, sib = parent ? [...parent.children].filter((c) => c.hasAttribute('onclick')) : [];
      const grouped = sib.length >= 2 && sib.some((c) => ACTIVE.test(String(c.className || '')) || c.getAttribute('aria-selected') === 'true');
      const isTog = (TOG_CLASS.test(cls) || e.getAttribute('role') === 'tab' || grouped) && !WRITE.test(f) && txt.length <= 40;
      const isDlg = !isTog && /^(open|show|view|la?[A-Z]?[a-z]*Open|[a-z]+(Open|Show|Modal|Dialog|Detail|Popup|Sheet|Drawer|Panel))/.test(f) && !WRITE.test(f) && !/Edit|Form/.test(f);
      // a list row: a table row or a multi-line card that opens something · the first of each handler is opened
      if ((e.tagName === 'TR' || txt.includes('\n')) && f && !WRITE.test(f)) { if (!listRows.some((r) => r.fn === f)) listRows.push({ key: 'row|' + f, fn: f, text: txt.split('\n')[0].slice(0, 60) }); continue; }
      if (txt.includes('\n')) continue;               // a multi-line card is a list item, not a toggle
      const key = (txt.replace(/[0-9]+/g, '#') || '∅') + '|' + f;
      if (isTog) toggles.push({ key, text: txt, fn: f, on: on.slice(0, 120), active: ACTIVE.test(cls) });
      else if (isDlg) dialogs.push({ key, text: txt, fn: f, on: on.slice(0, 120) });
    }
    const selects = [...ctl.querySelectorAll('select')].filter(vis).map((s) => ({ key: (s.id || s.name || fn(s) || 'select') + '', id: s.id, fn: fn(s), value: s.value, options: [...s.options].map((o) => ({ v: o.value, t: norm(o.text).slice(0, 50) })) }));
    const checks = [...ctl.querySelectorAll('input[type=checkbox], input[type=radio]')].filter(vis).map((c) => ({ key: (c.id || c.name || fn(c) || norm(c.closest('label')?.innerText || '').slice(0, 40) || 'check'), fn: fn(c), checked: c.checked }));
    const buttons = [...new Set([...root.querySelectorAll('button, [onclick], a[href]')].filter(vis).map(label).filter((t) => t && t.length <= 40))];
    const modal = top ? norm(top.innerText).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 120) : null;
    // every dialog element on screen, by id (check 5 counts the dialogs a run has seen)
    const DLG_ID = /(modal|dialog|dlg|overlay|sheet|drawer)/i;
    const openIds = [...document.querySelectorAll('[id]')].filter((e) => DLG_ID.test(e.id) && vis(e)).map((e) => e.id).slice(0, 40);
    return {
      title: norm((root.querySelector('h1,h2,.page-title,.view-title') || {}).innerText || '').slice(0, 80),
      lines: lines.slice(0, opt && opt.maxLines || 600), lineCount: lines.length,
      rows: [...root.querySelectorAll('tr')].filter(vis).length, // visible rows only: a hidden table another page left filled is not on the screen
      inputs: root.querySelectorAll('input, select, textarea').length,
      empty: lines.length === 0, buttons, toggles, dialogs, listRows, selects, checks, modal, openIds,
      toast: [...document.querySelectorAll('.la-toast, #toast, .toast, [class*="toast"]')].filter(vis).map((e) => norm(e.innerText)).filter(Boolean).slice(0, 5),
    };
  },
  // click the first visible clickable whose key matches · key = "text|fn" or "row|fn" · the page first, then the
  // open dialogs (a control inside a detail panel)
  clickKey: (key) => {
    const root = document.querySelector('.view.active') || document.body;
    const norm = (s) => String(s || '').replace(/\d{1,2}:\d{2}:\d{2}/g, 'HH:MM:SS').replace(/[ \t ]+/g, ' ').trim();
    const fn = (e) => { const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(e.getAttribute('onclick') || ''); return m ? m[1].replace(/^bookingV2/, 'bkV2') : ''; /* the new frontend renamed bkV2* to bookingV2*: one name for both */ };
    const k = (e) => ((norm(e.innerText || e.value || e.title || e.getAttribute('aria-label') || '').slice(0, 60)).replace(/[0-9]+/g, '#') || '∅') + '|' + fn(e);
    const row = key.startsWith('row|') ? key.slice(4) : null;
    const match = (e) => e.getClientRects().length && (row ? fn(e) === row && (e.tagName === 'TR' || (e.innerText || '').includes('\n')) : k(e) === key);
    const layers = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length).reverse();
    for (const scope of [root, ...layers]) {
      const el = [...scope.querySelectorAll('[onclick]')].find(match);
      if (el) { el.click(); return true; }
    }
    return false;
  },
  select: ({ key, value }) => {
    const root = document.querySelector('.view.active') || document.body;
    const fn = (e) => { const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(e.getAttribute('onchange') || ''); return m ? m[1].replace(/^bookingV2/, 'bkV2') : ''; /* the new frontend renamed bkV2* to bookingV2*: one name for both */ };
    const s = [...root.querySelectorAll('select'), ...document.querySelectorAll('select')].find((x) => x.getClientRects().length && ((x.id || x.name || fn(x) || 'select') === key));
    if (!s) return false;
    if (![...s.options].some((o) => o.value === value)) return 'no-option';
    s.value = value; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); return true;
  },
  check: (key) => {
    const root = document.querySelector('.view.active') || document.body;
    const norm = (s) => String(s || '').replace(/[ \t ]+/g, ' ').trim();
    const fn = (e) => { const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(e.getAttribute('onclick') || e.getAttribute('onchange') || ''); return m ? m[1].replace(/^bookingV2/, 'bkV2') : ''; /* the new frontend renamed bkV2* to bookingV2*: one name for both */ };
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

const pick = (s) => s && ({ title: s.title, lines: s.lines, lineCount: s.lineCount, rows: s.rows, cards: s.cards, inputs: s.inputs, buttons: s.buttons, modal: s.modal, openIds: s.openIds, toast: s.toast });
export async function snapBoth(P, state, opt = {}) {
  const { legacy, neu } = P;
  const [a, b] = await Promise.all([legacy, neu].map(async (S) => {
    try { return await S.page.evaluate(PROBE.snap, { maxLines: 600, ...opt }); } catch (e) { return { error: String(e.message || e).slice(0, 200) }; }
  }));
  const calls = await takeCalls(legacy);
  const pack = (S, s) => ({ ...pick(s), loadMs: S.loadMs || 0, error: s.error, errors: [...S.errors], failed: [...S.failed], writes: [...S.writes], dialogs: [...S.dialogs] });
  return { ...state, legacy: { ...pack(legacy, a), calls }, new: pack(neu, b), _a: a, _b: b };
}
function STILL_LOADING() {
  const root = document.querySelector('.view.active') || document.body;
  // noise.mjs rule 4 (actionboard page open): the ops placeholder counts as loading whatever its label says
  if (root.querySelector('.la-ops-loading, [data-ops-loading="1"]')) return false;
  return !/(^|\n)[^\n]{0,30}(Loading|กำลังโหลด|กำลังดึง)[^\n]{0,90}(…|\.\.\.)/i.test(root.innerText || '');
}
export async function settle(H, S, wait = 300) {
  await S.page.waitForTimeout(wait); await quiet(S, H.QUIET_MS);
  // a screen that loads its data on open shows "Loading …" first · wait for the real screen (up to LOAD_MS)
  const t = Date.now();
  const ok = await S.page.waitForFunction(STILL_LOADING, null, { timeout: H.LOAD_MS, polling: 250 }).then(() => true, () => false);
  S.loadMs = Date.now() - t;
  if (!ok) S.errors.push(`still loading after ${H.LOAD_MS / 1000}s`);
  else if (S.loadMs > 300) await quiet(S, H.QUIET_MS);
  // noise.mjs rule 3 (sales-board): a count-up animation is read once it shows its final numbers (5 s at most; past that
  // the numbers are read as they are and any difference shows)
  await S.page.waitForFunction(countUpDone, null, { timeout: 5000, polling: 150 }).catch(() => {});
}
// a page that draws in steps (legacy's booking page renders 15,000 bookings after the nav returns): wait until the open view
// stops changing · its text length and its control count the same on 3 looks 400 ms apart, at most maxMs (run.mjs, after each page nav)
export async function stable(S, maxMs = 20000) {
  const look = () => S.page.evaluate(() => { const r = document.querySelector('.view.active') || document.body; return (r.innerText || '').length + ':' + r.querySelectorAll('[onclick],[onchange]').length; }).catch(() => 'x');
  const t0 = Date.now(); let last = await look(), same = 0;
  while (Date.now() - t0 < maxMs && same < 2) { await S.page.waitForTimeout(400); const now = await look(); same = now === last ? same + 1 : 0; last = now; }
  return Date.now() - t0;
}
export async function onBoth(H, P, fn, arg, wait = 300, { reset = true } = {}) {
  const { legacy, neu } = P;
  if (reset) { legacy.reset(); neu.reset(); }
  const r = await Promise.all([legacy, neu].map((S) => S.page.evaluate(fn, arg).catch((e) => 'error: ' + String(e.message || e).slice(0, 160))));
  await Promise.all([legacy, neu].map((S) => settle(H, S, wait)));
  return r;
}

// ── compare one state of both sides ──
const set = (xs) => new Set(xs || []);
const NUM = /-?\d[\d,]*(\.\d+)?/g;
// a booking code's random suffix (legacy bkV2GenerateBookingCode BK-YYMMNNNN-XXXX; the server copies it) is a value, like a number, never layout
const CODE = /\bBK-?(\d{8,})-[0-9A-Z]{4}\b/g;
export function compare(s) {
  const L0 = s.legacy, N0 = s.new;
  // noise.mjs rule 1: the PR/PO "updated at HH:MM · by <user>" stamp is compared with its time and user masked
  const L = { ...L0, lines: maskLines(L0.lines) }, N = { ...N0, lines: maskLines(N0.lines) };
  const lines = { a: set(L.lines), b: set(N.lines) };
  let missing = [...lines.a].filter((x) => !lines.b.has(x)), extra = [...lines.b].filter((x) => !lines.a.has(x));
  // noise.mjs rule 2: rows tied on the same numbers in another order are paired (reported in tiePairs), not differences
  const ties = tiePairs(missing, extra);
  const tm = new Set(ties.map((t) => t[0])), te = new Set(ties.map((t) => t[1]));
  missing = missing.filter((x) => !tm.has(x)); extra = extra.filter((x) => !te.has(x));
  const union = (new Set([...lines.a, ...lines.b]).size - ties.length) || 1;
  const sim = (union - missing.length - extra.length) / union;
  const shape = (x) => x.replace(CODE, 'BK-$1-XXXX').replace(NUM, '#');
  const sa = set(missing.map(shape)), sb = set(extra.map(shape));
  // layout = the lines with every number replaced by # · "same layout, other numbers" is a data difference
  const shA = set((L.lines || []).filter((x) => !tm.has(x)).map(shape)), shB = set((N.lines || []).filter((x) => !te.has(x)).map(shape));
  const layMissing = [...shA].filter((x) => !shB.has(x)), layExtra = [...shB].filter((x) => !shA.has(x));
  const layUnion = new Set([...shA, ...shB]).size || 1;
  const laySim = (layUnion - layMissing.length - layExtra.length) / layUnion;
  const numbersOnly = missing.length > 0 && [...sa].every((x) => sb.has(x));     // same lines, other numbers
  void numbersOnly;
  const bShape = (xs) => new Set((xs || []).map(shape));
  const nb = bShape(N.buttons), lb = bShape(L.buttons);
  const btnMissing = (L.buttons || []).filter((x) => !nb.has(shape(x))), btnExtra = (N.buttons || []).filter((x) => !lb.has(shape(x)));
  const newErr = (N.errors || []).filter((e) => !(L.errors || []).includes(e));
  const failed404 = (N.failed || []).filter((f) => /→ 404/.test(f)), failedOther = (N.failed || []).filter((f) => !/→ 404/.test(f));
  const notFound = s.found && s.found.legacy === true && s.found.new !== true;
  const modalDiff = (s.kind === 'dialog' || s.kind === 'row') && (!!L.modal) !== (!!N.modal);
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
  return { page: s.page, section: s.section, label: s.label, toggle: s.toggle, kind: s.kind, key: s.key, verdict, cls, why: why.join(' · '), sim: +sim.toFixed(3), laySim: +laySim.toFixed(3), layMissing: layMissing.slice(0, 25), layExtra: layExtra.slice(0, 25),
    tiePairs: ties.slice(0, 10), rows: [L.rows, N.rows], loadMs: [L.loadMs || 0, N.loadMs || 0], lineCount: [L.lineCount, N.lineCount], missing: missing.slice(0, 25), extra: extra.slice(0, 25), btnMissing: btnMissing.slice(0, 20), btnExtra: btnExtra.slice(0, 20),
    newErrors: newErr.slice(0, 8), legacyErrors: (L.errors || []).slice(0, 5), failed: (N.failed || []).slice(0, 10), legacyFailed: (L.failed || []).slice(0, 5),
    writes: { legacy: L.writes, new: N.writes }, dialogs: { legacy: L.dialogs, new: N.dialogs }, modal: [!!L.modal, !!N.modal] };
}
