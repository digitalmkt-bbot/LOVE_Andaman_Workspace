// t_walk_pier · browser walk-through of the wired PIER OFFICE / PIER CASH / PIER JOB / VAN BILLS screens
// against a real seeded operation-backend (in-process store). Drives the REAL UI and reads BOTH sides:
// the screen's state and what the server holds (asked directly through the API).
//
//   node test/ui/t_walk_pier.mjs        (OPS_BACKEND_DIR, default D:/projects/operation-backend)
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const ONLY = process.env.WALK_ONLY ? process.env.WALK_ONLY.split(',') : null;

const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = '';
const opsPort = await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 30000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const raw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  const txt = await r.text(); let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await raw(p, init)).body;
const seed = async (method, p, body) => {                     // a seeding call that must succeed
  const r = await raw(p, { method, body: body ? JSON.stringify(body) : undefined });
  if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
};

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' → ' + r.status + ' ' + buf.toString().slice(0, 220));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
let promptAnswer = 'Tester';
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 160)); d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept(); });
const popups = [];
ctx.on('page', (p) => { if (p !== page) popups.push(p); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got).slice(0, 500))); if (!cond) fails.push(name); return cond; };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const D = '2026-10-20', D2 = '2026-10-21';
const PIER = 'tublamu';

// ───────────────────────────── seed (through the backend API) ─────────────────────────────
const staff = {};
for (const [nick, name] of [['Somchai', 'Somchai Captain'], ['Nok', 'Nok Pier']]) {
  staff[nick] = (await seed('POST', '/v1/pier-office/staff', { pier: PIER, nick, name, role: 'captain' })).id;
}
const kinds = (await api('/v1/pier-office')).item_kinds;
const itemFin = (await seed('POST', '/v1/pier-office/items', { pier: PIER, kind_id: kinds[0].id, label: 'Fin M', total: 30 })).id;
for (const [b, r] of [['b6', 'r5'], ['b7', 'r4']]) for (const d of [D, D2]) await seed('POST', '/operations/deployments', { boat_id: b, route_id: r, service_date: d, capacity: 40, deploy_anyway: true });
let nb = 0;
const book = async (date, boat, route, pax, zone = 'PK') => {
  const b = await seed('POST', '/v1/bookings', { external_id: `b2c_walk_${Date.now().toString(36)}_${nb++}`, total: 3000, trips: [{ route_id: route, date, pax, zone }] });
  const v = (await api(`/v1/bookings/${b.id}`)).version;
  await seed('PATCH', `/operations/trip-ops/${b.trips[0].id}`, { boat_id: boat, version: v });
  return b;
};
const bk1 = await book(D, 'b6', 'r5', { ad_fr: 2, chd_fr: 1 });
const bk2 = await book(D, 'b6', 'r5', { ad_th: 2, chd_th: 1 });
const bk3 = await book(D, 'b7', 'r4', { ad_fr: 3 });

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1200);
const goView = (v) => ev((v) => nav({ dataset: { view: v }, classList: { add() {} } }), v);


const clickModal = async (text) => {
  await page.locator('#po-modal button', { hasText: text }).first().click(); await settle(500);
};
const stage = async (date) => { await ev((a) => { window._poPier = a.p; window._poDate = a.d; }, { p: PIER, d: date }); };
const openView = async (view, date = D) => { await stage(date); await goView(view); await settle(2500); };
const flush = async () => { await ev(() => window.laOps.pier.flush()); await idle(); await settle(300); };
const todo = [];
const section = (name, fn) => todo.push([name, fn]);

// ═══ 1 · recorded_staff_id on pier writes ═══
section('1', async () => {
  console.log('\n[1] recorded_staff_id on pier writes (ผู้บันทึก pick)');
  await openView('po-' + PIER);
  await page.selectOption('#po-who', staff.Somchai); await settle(300);
  const ls = await ev((p) => localStorage.getItem('po_who::' + p), PIER);
  ok('the pick is kept by the screen (po_who::tublamu)', ls === staff.Somchai, ls);
  await ev((id) => poRecvOpen(id), itemFin); await settle(300);
  await page.fill('#porv_' + itemFin, '5'); await page.fill('#porvn', 'walk receive');
  await clickModal('บันทึกรับเข้า'); await flush();
  let mv = (await api(`/v1/pier-office/${PIER}/moves`)).moves;
  const rec = mv.find((m) => m.type === 'receive' && m.item_id === itemFin);
  ok('stock receive stored recorded_staff_id', rec && rec.recorded_staff_id === staff.Somchai, rec);
  // equipment sheet (เบิก–คืน): save as draft, then confirm
  const fillSheet = async () => {
    await ev(() => poIssueOpen('b6')); await page.waitForSelector('#pois_0_fin', { timeout: 8000 });
    await page.fill('#pois_0_fin', '3'); await page.fill('#poiz_' + itemFin, '3');
  };
  await fillSheet();
  await clickModal('บันทึกร่าง'); await idle(); await settle(400);
  let sh = await api(`/v1/pier-office/${PIER}/days/${D}/sheets/b6`);
  ok('sheet draft stored recorded_staff_id', sh.status === 'draft' && sh.recorded_staff_id === staff.Somchai, { status: sh.status, who: sh.recorded_staff_id });
  await page.selectOption('#po-who', staff.Nok); await settle(300);
  await ev(() => poIssueOpen('b6')); await page.waitForSelector('#pois_0_fin', { timeout: 8000 });
  await clickModal('ยืนยัน'); await idle(); await settle(500);
  sh = await api(`/v1/pier-office/${PIER}/days/${D}/sheets/b6`);
  mv = (await api(`/v1/pier-office/${PIER}/moves`)).moves;
  const issued = mv.filter((m) => m.boat_id === 'b6' && m.type === 'issue');
  ok('sheet commit stored recorded_staff_id (the pick at commit time, Nok)', sh.status === 'committed' && sh.recorded_staff_id === staff.Nok, { status: sh.status, who: sh.recorded_staff_id });
  ok('the commit moves carry the same recorder', issued.length > 0 && issued.every((m) => m.recorded_staff_id === staff.Nok), issued.map((m) => m.recorded_staff_id));
  // the sheet's lines name SERVER booking ids (SB_BOOKINGS is a top-level `let`: window.SB_BOOKINGS is undefined)
  ok('sheet lines carry the booking ids of the server, not the screen ids', (sh.lines || []).length > 0 && (sh.lines || []).every((l) => [bk1.id, bk2.id].includes(l.booking_id)), (sh.lines || []).map((l) => l.booking_id));
  // boat close (ปิดยอด) with the pick changed to Somchai
  await page.selectOption('#po-who', staff.Somchai); await settle(300);
  await ev(() => poCloseOpen('b6')); await page.waitForSelector('#poret_' + itemFin, { timeout: 8000 });
  await page.fill('#poret_' + itemFin, '2'); await page.waitForSelector('#pom_lost_' + itemFin);
  await page.fill('#pom_lost_' + itemFin, '1'); await page.fill('#pofine_' + itemFin, '100');
  await clickModal('ปิดยอด'); await idle(); await settle(500);
  mv = (await api(`/v1/pier-office/${PIER}/moves`)).moves;
  const closeMoves = mv.filter((m) => m.boat_id === 'b6' && m.type !== 'issue');
  ok('boat close stored recorded_staff_id on every move it made', closeMoves.length >= 2 && closeMoves.every((m) => m.recorded_staff_id === staff.Somchai), mv.filter((m) => m.boat_id === 'b6').map((m) => [m.type, m.recorded_staff_id]));
  // fine payment (the pick is Nok now)
  await page.selectOption('#po-who', staff.Nok); await settle(300);
  const lost = mv.find((m) => m.type === 'lost' && m.fine_baht > 0);
  ok('the lost item has a 100 baht fine on the server', !!lost, mv.map((m) => [m.type, m.fine_baht]));
  promptAnswer = 'cash';
  await ev(() => poFineOpen()); await settle(500);
  await clickModal('รับเงินแล้ว'); await flush();
  mv = (await api(`/v1/pier-office/${PIER}/moves`)).moves;
  const paid = mv.find((m) => m.id === lost.id);
  ok('fine payment stored recorded_staff_id (Nok took the money)', paid && paid.fine && paid.fine.status === 'paid' && paid.fine.recorded_staff_id === staff.Nok, paid && paid.fine);
  await page.keyboard.press('Escape'); await ev(() => poModalClose()); await settle(300);
  // day close (ปิดวัน) with Somchai picked
  await page.selectOption('#po-who', staff.Somchai); await settle(300);
  await page.locator('button[onclick="poDayClose()"]').click(); await flush();
  const dayRow = await api(`/v1/pier-office/${PIER}/days/${D}/boats`);
  ok('day close stored recorded_staff_id', dayRow.closed && dayRow.closed.recorded_staff_id === staff.Somchai, dayRow.closed);
  const scr = await ev(() => !!poDayClosed(_poDate, _poPier));
  ok('the screen shows the day closed (ปิดวันแล้ว)', scr, scr);
});

// @@SECTIONS

for (const [name, fn] of todo) {
  if (ONLY && !ONLY.includes(name)) continue;
  try { await fn(); } catch (e) { ok('section ' + name + ' ran to the end', false, String(e.stack || e).slice(0, 700)); }
}
console.log('\nbrowser errors:', errors.length ? errors : 'none');
console.log('server refusals:', refusals.length ? refusals : 'none');
console.log('native dialogs:', dialogs);
console.log(fails.length ? '\nFAILED: ' + fails.join(' | ') : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
