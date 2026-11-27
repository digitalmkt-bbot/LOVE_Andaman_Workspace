// UI parity · legacy (lk-inbox server.js) and the new frontend (main + operation-backend) side by side
//
//   node test/uiparity/run.mjs [--views=a,b] [--max-toggles=N] [--max-dialogs=N] [--max-rows=N] [--no-dialogs] [--no-rows] [--out=dir]
//
// Opens every sidebar page in BOTH apps with the same data, then every toggle on it (tabs, chips, pills,
// segment buttons, selects, checkboxes), the "open/show" buttons that open a dialog, and the first row of each
// list on the page (a table row or a card that opens a detail panel), then the toggles inside that detail. It
// records what each side shows: the visible text, the row/card counts, the buttons, the console errors and the
// failed API calls. There is no limit per page unless --max-* says so (quick runs).
//
// It also records which of legacy's handler functions ran and which dialog elements were on screen
// (coverage.mjs reads that: check 5).
//
// What it starts (it never touches anything but localhost):
//   legacy  LEGACY_DIR/server.js (a checkout of origin/lk-inbox) on LEGACY_DB  · default the local copy legacy_ui
//   backend OPS_BACKEND_DIR/src/server.ts (operation-backend) on OPS_DB         · default the local copy operations_ui
//   new     this checkout's allotment_v2/ served static; its calls to the production backend URL are routed
//           to the local backend (same as t_ops.mjs)
// Both databases are COPIES of the parity pipeline's `legacy` and `operations` (CREATE DATABASE … TEMPLATE …),
// each with one extra login `uiparity` / password `uiparity` (see README.md here). Any URL that is not localhost
// is refused before anything starts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHarness, bootPair, PROBE, snapBoth, onBoth, compare } from './harness.mjs';
import { legacyItems } from './coverage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : (process.argv.includes('--' + k) ? true : d); };
const LEGACY_DIR = process.env.LEGACY_DIR || 'D:/projects/wt-uip-legacy';
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const LEGACY_DB = process.env.LEGACY_DB || 'postgres://postgres:postgres@localhost:55433/legacy_ui';
const OPS_DB = process.env.OPS_DB || 'postgres://postgres:postgres@localhost:55433/operations_ui';
const lim = (k) => { const v = arg(k, ''); return v === '' || v === true ? Infinity : +v; };
const MAX_TOGGLES = lim('max-toggles'), MAX_DIALOGS = lim('max-dialogs'), MAX_ROWS = lim('max-rows'), MAX_SELECTS = lim('max-selects'), MAX_CHECKS = lim('max-checks');
const DIALOGS = !arg('no-dialogs', false), ROWS = !arg('no-rows', false);
const ONLY = arg('views', '') ? String(arg('views')).split(',') : null;
const OUT = path.resolve(arg('out', path.join(HERE, 'out', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19))));

const H = await startHarness({
  out: OUT, legacyDir: LEGACY_DIR, opsDir: OPS_DIR, legacyDb: LEGACY_DB, opsDb: OPS_DB,
  legacyPort: +(process.env.LEGACY_PORT || 3911), opsPort: +(process.env.OPS_PORT || 3912),
  user: process.env.UIP_USER || 'uiparity', pass: process.env.UIP_PASS || 'uiparity',
  loadMs: +arg('load-ms', 60000), quietMs: +arg('quiet-ms', 5000),
});
const log = H.log;
process.on('exit', H.cleanup);
process.on('SIGINT', () => { H.cleanup(); process.exit(1); });
log(`UI parity · out ${OUT} · limits toggles ${MAX_TOGGLES} dialogs ${DIALOGS ? MAX_DIALOGS : 0} rows ${ROWS ? MAX_ROWS : 0}`);

// legacy's handler functions, wrapped in the legacy page so the run knows which ran (coverage)
const recordNames = legacyItems(LEGACY_DIR).items.filter((i) => i.type === 'handler').map((i) => i.name);
const WORKERS = +arg('workers', 2);
const pairs = [];
for (let n = 0; n < WORKERS; n++) pairs.push(await bootPair(H, n + 1, { recordNames }));
const { legacy, neu } = pairs[0];
log(`legacy handlers wrapped for coverage: ${legacy.wrapped} of ${recordNames.length}`);
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
  const st = (o) => ({ page: tag, section: it.section, label: it.label, ...o });
  const r = await onBoth(H, P, PROBE.nav, it, 700);
  const base = await snapBoth(P, st({ toggle: '(page open)', kind: 'page', navOk: { legacy: r[0], new: r[1] }, inNewSidebar: inNew }));
  states.push(base);
  const a = base._a || {}, b = base._b || {};
  const inv = { ...it, page: tag, inNewSidebar: inNew, toggles: (a.toggles || []).map((t) => t.key), selects: (a.selects || []).map((s) => s.key + ' [' + s.options.length + ' options]'), checks: (a.checks || []).map((c) => c.key), dialogs: (a.dialogs || []).map((d) => d.key), rows: (a.listRows || []).map((x) => x.key), detail: {},
    newOnly: { toggles: (b.toggles || []).map((t) => t.key).filter((k) => !(a.toggles || []).some((t) => t.key === k)), dialogs: (b.dialogs || []).map((d) => d.key).filter((k) => !(a.dialogs || []).some((t) => t.key === k)) } };
  inventory.push(inv);
  log(`[${i + 1}/${items.length}] ${tag} · ${(a.toggles || []).length} toggles · ${(a.selects || []).length} selects · ${(a.checks || []).length} checks · ${(a.dialogs || []).length} dialogs · ${(a.listRows || []).length} lists · ${Math.round((Date.now() - t0) / 1000)}s`);

  // toggles: each from the page's opening state
  for (const t of (a.toggles || []).slice(0, MAX_TOGGLES)) {
    await onBoth(H, P, PROBE.nav, it, 300);
    const rr = await onBoth(H, P, PROBE.clickKey, t.key);
    states.push(await snapBoth(P, st({ toggle: t.text || t.fn, key: t.key, fn: t.fn, kind: 'toggle', found: { legacy: rr[0], new: rr[1] } })));
  }
  for (const s of (a.selects || []).slice(0, MAX_SELECTS)) {
    for (const o of s.options.filter((o) => o.v !== s.value).slice(0, 2)) {
      await onBoth(H, P, PROBE.nav, it, 300);
      const rr = await onBoth(H, P, PROBE.select, { key: s.key, value: o.v });
      states.push(await snapBoth(P, st({ toggle: `select ${s.key} = ${o.t}`, key: s.key + '=' + o.v, fn: s.fn, kind: 'select', found: { legacy: rr[0], new: rr[1] } })));
    }
  }
  for (const c of (a.checks || []).slice(0, MAX_CHECKS)) {
    await onBoth(H, P, PROBE.nav, it, 300);
    const rr = await onBoth(H, P, PROBE.check, c.key);
    states.push(await snapBoth(P, st({ toggle: `${c.checked ? 'uncheck' : 'check'} ${c.key}`, key: 'check:' + c.key, fn: c.fn, kind: 'check', found: { legacy: rr[0], new: rr[1] } })));
  }
  if (DIALOGS) for (const d of (a.dialogs || []).slice(0, MAX_DIALOGS)) {
    await onBoth(H, P, PROBE.nav, it, 300);
    const rr = await onBoth(H, P, PROBE.clickKey, d.key, 600);
    states.push(await snapBoth(P, st({ toggle: 'dialog: ' + (d.text || d.fn), key: d.key, fn: d.fn, kind: 'dialog', found: { legacy: rr[0], new: rr[1] } })));
    await onBoth(H, P, PROBE.closeModal, null, 250);
  }
  // the first row of each list: its detail panel, then every toggle inside that detail
  if (ROWS) for (const row of (a.listRows || []).slice(0, MAX_ROWS)) {
    await onBoth(H, P, PROBE.nav, it, 300);
    const rr = await onBoth(H, P, PROBE.clickKey, row.key, 600);
    const det = await snapBoth(P, st({ toggle: 'row: ' + row.fn, key: row.key, fn: row.fn, kind: 'row', found: { legacy: rr[0], new: rr[1] } }), { scope: 'modal' });
    states.push(det);
    const pageKeys = new Set((a.toggles || []).map((t) => t.key));
    const sub = ((det._a || {}).toggles || []).filter((t) => !pageKeys.has(t.key)).slice(0, MAX_TOGGLES);
    inv.detail[row.key] = sub.map((t) => t.key);
    await onBoth(H, P, PROBE.closeModal, null, 250);
    for (const t of sub) {
      await onBoth(H, P, PROBE.nav, it, 300);
      await onBoth(H, P, PROBE.clickKey, row.key, 600);
      const r2 = await onBoth(H, P, PROBE.clickKey, t.key);
      states.push(await snapBoth(P, st({ toggle: `row: ${row.fn} › ${t.text || t.fn}`, key: row.key + '›' + t.key, fn: t.fn, kind: 'detail', found: { legacy: r2[0], new: r2[1] } }), { scope: 'modal' }));
      await onBoth(H, P, PROBE.closeModal, null, 250);
    }
  }
}

let next = 0;
await Promise.all(pairs.map(async (P) => { while (next < items.length) { const i = next++; try { await walkPage(P, i, items[i]); } catch (e) { log(`! ${items[i].view}: ${String(e.message || e).slice(0, 200)}`); } } }));
const order = (pg) => items.findIndex((it) => it.view + (it.citytour ? '#citytour' : '') === pg);
states.sort((x, y) => order(x.page) - order(y.page));
inventory.sort((x, y) => order(x.page) - order(y.page));

// ── compare ──
const cmp = states.map(compare);
const strip = (s) => { const { _a, _b, ...rest } = s; return rest; };
// coverage evidence: which legacy handlers ran and which dialog elements were on screen, and in which state first
const seen = { calls: {}, dialogIds: {}, pages: {} };
for (const s of states) {
  const where = s.page + ' · ' + s.toggle;
  for (const c of s.legacy.calls || []) seen.calls[c] = seen.calls[c] || where;
  for (const d of s.legacy.openIds || []) seen.dialogIds[d] = seen.dialogIds[d] || where;
  if (s.kind === 'page' && s.navOk && s.navOk.legacy === true) seen.pages[s.page] = true;
}
fs.writeFileSync(path.join(OUT, 'states.json'), JSON.stringify({ boot, topbar, sidebar: { legacy: sidebarL, new: sidebarN }, states: states.map(strip) }, null, 1));
fs.writeFileSync(path.join(OUT, 'compare.json'), JSON.stringify(cmp, null, 1));
fs.writeFileSync(path.join(OUT, 'inventory.json'), JSON.stringify({ sidebar: sidebarL, topbar: topbar.legacy, pages: inventory }, null, 1));
fs.writeFileSync(path.join(OUT, 'seen.json'), JSON.stringify(seen, null, 1));

// ── report.md (report.mjs, so several runs can be merged later) ──
const { buildReport } = await import('./report.mjs');
fs.writeFileSync(path.join(OUT, 'report.md'), buildReport([OUT]).md);
const diff = cmp.filter((c) => c.verdict !== 'same');
log(`done · ${states.length} states · ${diff.length} differ · ${Object.keys(seen.calls).length} legacy handlers ran · ${Math.round((Date.now() - t0) / 60000)} min · ${OUT}`);
H.cleanup();
process.exit(0);
