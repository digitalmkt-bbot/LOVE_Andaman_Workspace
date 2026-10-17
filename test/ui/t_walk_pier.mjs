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
const book = async (date, boat, route, pax, zone = 'PK', add_ons = undefined) => {
  const b = await seed('POST', '/v1/bookings', { external_id: `b2c_walk_${Date.now().toString(36)}_${nb++}`, total: 3000, trips: [{ route_id: route, date, pax, zone }], add_ons });
  const v = (await api(`/v1/bookings/${b.id}`)).version;
  await seed('PATCH', `/operations/trip-ops/${b.trips[0].id}`, { boat_id: boat, version: v });
  return b;
};
const bk1 = await book(D, 'b6', 'r5', { ad_fr: 2, chd_fr: 1 });
const bk2 = await book(D, 'b6', 'r5', { ad_th: 2, chd_th: 1 });
const bk3 = await book(D, 'b7', 'r4', { ad_fr: 3 });
const bk4 = await book(D2, 'b6', 'r5', { ad_fr: 2 }, 'PK', [{ type: 'longtail-join', label: 'Longtail join', join_adults: 2, join_children: 0 }]);

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

// ═══ 2 · petty cash sheets ═══
section('2', async () => {
  console.log('\n[2] petty cash · boats and dates, park pull state, refunds, day numbers');
  const P = (p) => `/v1/pier-cash/${PIER}${p}`;
  await seed('PATCH', P(`/days/${D}/park/b6`), { ad_fr: 2, chd_fr: 1, amount: 600, dock: 0 });
  const out1 = await seed('POST', P(`/days/${D}/rows`), { kind: 'out', amount: 500, description: 'ค่าน้ำมันเรือ' });
  await seed('POST', P(`/days/${D}/claims`), { name: 'walk claim', row_ids: [out1.row.id] });
  await seed('POST', P(`/days/${D}/rows`), { kind: 'in', amount: 500, description: 'รับเงินคืน ตั้งเบิก walk' });
  await seed('POST', P(`/days/${D}/rows`), { kind: 'in', amount: 70, description: 'รับเงินจากลูกค้า' });
  await openView('pop-' + PIER, D);
  await page.locator(`button[onclick="pcPickDay('${D}')"]`).click(); await settle(1500);
  const day = await api(P(`/days/${D}`));
  const monthPark = await api(P('/months/2026-10/park'));
  const srvBoats = (monthPark.days.find((d) => d.date === D).boats || []).filter((b) => b.route_id).map((b) => b.boat_id);
  const srvDates = [...new Set(monthPark.days.filter((d) => (d.boats || []).some((b) => b.route_id)).map((d) => d.date))].sort();
  const s = await ev((a) => ({
    boats: pcBoats(a.D, a.P).map((b) => b.bid), dates: pcDates(a.P, '2026-10'),
    st: pcPkPullState(a.P, a.D), pcDate: _pcDate,
    refunds: pcRowsArr().filter((r) => r.pier === a.P && r.date === a.D && r.kind === 'in').map((r) => [r.txt, pcIsRefund(r), r.srvRefund]),
  }), { D, P: PIER });
  ok('pcBoats = the server sheet\'s boats of the day (route order)', JSON.stringify(s.boats) === JSON.stringify(srvBoats) && srvBoats.length === 2, { screen: s.boats, server: srvBoats });
  ok('pcDates = the days the server sheet lists', JSON.stringify(s.dates) === JSON.stringify(srvDates) && srvDates.includes(D), { screen: s.dates, server: srvDates });
  const pp = day.park_pull;
  ok('pcPkPullState before the pull = server park_pull (1 boat waiting, 600, boats in the server order)', s.st.waiting === 600 && s.st.nWait === 1 && s.st.nPulled === 0 && pp.waiting === 600 && JSON.stringify(s.st.lines.map((l) => l.B.bid)) === JSON.stringify(pp.boats.map((b) => b.boat_id)), { screen: s.st, server: pp });
  const refund = s.refunds.find((r) => /รับเงินคืน/.test(r[0])), plain = s.refunds.find((r) => /ลูกค้า/.test(r[0]));
  const srvRows = day.rows.filter((r) => r.kind === 'in');
  ok('pcIsRefund: the "รับเงินคืน" line is a refund and the customer line is not, as the server says', refund && refund[1] === true && refund[2] === true && plain && plain[1] === false && srvRows.find((r) => /รับเงินคืน/.test(r.description)).refund && !srvRows.find((r) => /ลูกค้า/.test(r.description)).refund, { screen: s.refunds, server: srvRows.map((r) => [r.description, r.refund && 'match']) });
  // pull through the real button
  await page.locator('button[onclick^="pcPull("]').first().click(); await idle(); await settle(1200);
  const day2 = await api(P(`/days/${D}`));
  const pulled = day2.rows.filter((r) => r.boat_id === 'b6' && r.source === 'park');
  const s2 = await ev((a) => ({ st: pcPkPullState(a.P, a.D), src: pcRowsArr().filter((r) => r.pier === a.P && r.date === a.D && /ค่าอุทยาน/.test(r.txt)).map((r) => [r.txt, r.src, r.bid]) }), { D, P: PIER });
  ok('the pull made one park line for b6 on the server', pulled.length === 1 && +pulled[0].amount === 600, day2.rows.map((r) => [r.description, r.source, r.boat_id]));
  ok('pcPkPullState after the pull = server (nothing waiting, 1 pulled)', s2.st.waiting === 0 && s2.st.nPulled === 1 && day2.park_pull.pulled_boats === 1, { screen: s2.st, server: day2.park_pull });
  ok('the pulled line reaches the legacy row as a park line (src pk, boat b6)', s2.src.length === 1 && s2.src[0][1] === 'pk' && s2.src[0][2] === 'b6', s2.src);
  // numbers of the day on screen: park (pc2StatPK) and longtail (pc2StatLT)
  const boatsDay = await api(`/v1/pier-office/${PIER}/days/${D}/boats`);
  const tot = Object.fromEntries(boatsDay.boats.map((b) => [b.boat_id, b.booked.nationality.tot]));
  const pk = await ev((a) => pc2StatPK(a.P, a.D), { D, P: PIER });
  const missSrv = ['b6', 'b7'].filter((b) => tot[b] > 0 && !(+((day2.rows.find((r) => r.boat_id === b && r.source === 'park') || {}).amount) > 0)).length;
  ok('pc2StatPK numbers: heads and boats missing a fee come from the server', pk.pax === tot.b6 + tot.b7 && pk.n === 2 && pk.miss === missSrv && pk.missNames.length === missSrv, { screen: pk, server: tot });
  await page.locator(`button[onclick="pcPickDay('${D2}')"]`).click(); await settle(1500);
  const boatsD2 = await api(`/v1/pier-office/${PIER}/days/${D2}/boats`);
  const bk = boatsD2.boats.find((b) => b.boat_id === 'b6').booked;
  const lt = await ev((a) => pc2StatLT(a.P, a.D), { D: D2, P: PIER });
  ok('pc2StatLT: 1 boat needs a longtail entry (server join_heads) and it is missing', bk.join_heads === 2 && lt.need === 1 && lt.miss === 1 && lt.missNames.length === 1, { screen: lt, join: bk.join_heads });
  await ev((a) => pcSetLT(a.D, 'b6', 'amt', 800), { D: D2 }); await idle(); await settle(800);
  const lt2 = await ev((a) => pc2StatLT(a.P, a.D), { D: D2, P: PIER });
  const cell = (await api(P('/months/2026-10/longtail'))).days.find((d) => d.date === D2).boats.find((b) => b.boat_id === 'b6').cell;
  ok('after keying the longtail amount the missing count drops to 0 and the server holds it', lt2.miss === 0 && cell && +cell.amount === 800, { screen: lt2, cell });
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
