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

// fleet facts for the job board: a boat licence on b6, an open repair job on b7
await seed('PATCH', '/v1/boats/b6', { documents: [{ name: 'ใบอนุญาตใช้เรือ', expires_on: '2027-03-09', renew_status: null }] });
await seed('POST', '/v1/fleet/jobs', { no: 'MJ-WALK-1', boat_id: 'b7', title: 'Walk repair', type: 'corrective' });

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

// ═══ 3 · park tickets: matrix columns and park sets ═══
section('3', async () => {
  console.log('\n[3] park tickets · Thai / foreign / FOC columns, park sets');
  await seed('POST', `/v1/pier-office/${PIER}/days/${D}/park-sets`, { boat_id: 'b6', counts: { adFR: 2, chFR: 1 } });
  await openView('pok-' + PIER, D); await settle(1500);
  const boatsDay = await api(`/v1/pier-office/${PIER}/days/${D}/boats`);
  const nat = Object.fromEntries(boatsDay.boats.map((b) => [b.boat_id, b.booked.nationality]));
  const names = { b6: 'Zeus', b7: 'Verona' };
  const cells = await ev((nm) => Object.fromEntries(Object.keys(nm).map((id) => {
    const tr = [...document.querySelectorAll('#pk-host-tublamu tr')].find((r) => r.textContent.includes(nm[id]) && r.querySelector('td.n'));
    return [id, tr ? [...tr.querySelectorAll('td.n')].slice(0, 4).map((c) => +c.textContent.trim() || 0) : null];
  })), names);
  const want = (n) => [n.ad_th + n.chd_th + n.inf_th, n.ad_fr + n.chd_fr + n.inf_fr, n.foc_th + n.foc_fr, n.tot];
  ok('Zeus row: Thai / foreign / FOC / total are the server heads (3, 3, 0, 6)', JSON.stringify(cells.b6) === JSON.stringify(want(nat.b6)) && want(nat.b6).join() === '3,3,0,6', { screen: cells.b6, server: want(nat.b6) });
  ok('Verona row: 0 / 3 / 0 / 3', JSON.stringify(cells.b7) === JSON.stringify(want(nat.b7)) && want(nat.b7).join() === '0,3,0,3', { screen: cells.b7, server: want(nat.b7) });
  // park sets (Ticket Management tab)
  const srv = (await api(`/v1/pier-office/${PIER}/days/${D}/park-sets`)).sets;
  await ev(() => pkSetFam('sets')); await settle(1000);
  const scr = await ev(() => ({ sets: pkSets(_poDate).map((x) => ({ id: x.id, name: x.name, bid: x.bid, cnt: x.cnt, n: (x.people || []).length, bought: !!x.bought })), btns: [].map.call(document.querySelectorAll('#pk-host-tublamu button'), (b) => (b.getAttribute('onclick') || '').slice(0, 44)).filter((t) => /pkSet(Bought|Open|Del)/.test(t)) }));
  ok('pkSets(D) shows the server set (name, boat, counts, 3 people)', srv.length === 1 && scr.sets.length === 1 && scr.sets[0].id === srv[0].id && scr.sets[0].name === srv[0].name && scr.sets[0].bid === 'b6' && JSON.stringify(scr.sets[0].cnt) === JSON.stringify(srv[0].counts) && scr.sets[0].n === 3, { screen: scr.sets, server: srv.map((s) => [s.id, s.name, s.counts, s.people.length]) });
  console.log('   set buttons:', JSON.stringify(scr.btns));
  await page.locator('button[onclick^="pkSetOpen("]').first().click(); await settle(800);
  console.log('   after open:', JSON.stringify(await ev(() => [].map.call(document.querySelectorAll('#pk-host-tublamu button'), (b) => (b.getAttribute('onclick') || '').slice(0, 30)).filter((t) => /pkSet/.test(t)))));
  await page.locator('button[onclick^="pkSetBought("]').first().click({ timeout: 5000 }); await idle(); await settle(1000);
  const after = (await api(`/v1/pier-office/${PIER}/days/${D}/park-sets`)).sets[0];
  const scr2 = await ev(() => pkSets(_poDate)[0] && !!pkSets(_poDate)[0].bought);
  ok('the Bought button locks the set on the server and on the screen', after.bought === true && after.bought_by === 'tester' && scr2 === true, { server: after.bought, by: after.bought_by, screen: scr2 });
});

// ═══ 4 · duty from the Office screen, unassigned heads, route codes, job kind, default pay table ═══
section('4', async () => {
  console.log('\n[4] poDutySave, poUnassigned, route codes, job kind, PA_PAY_DEF');
  await seed('POST', '/v1/bookings', { external_id: `b2c_walk_un_${Date.now().toString(36)}`, total: 3000, trips: [{ route_id: 'r5', date: D2, pax: { ad_fr: 4, chd_fr: 1 }, zone: 'PK' }] });
  await openView('po-' + PIER, D2);
  await page.selectOption('#po-who', staff.Somchai); await settle(300);
  const dayD2 = await api(`/v1/pier-office/${PIER}/days/${D2}/boats`);
  const scrUn = await ev((a) => poUnassigned(a.D, a.P), { D: D2, P: PIER });
  ok('poUnassigned = the server\'s unassigned heads (5)', dayD2.unassigned.pax === 5 && scrUn === 5, { screen: scrUn, server: dayD2.unassigned });
  // the duty dialog on the Office screen: the day's jobs are NOT loaded yet
  const loadedBefore = await ev((a) => Object.keys(laOps.pierJob.state.keys).filter((k) => k.startsWith(a.D)).length, { D: D2 });
  await ev(() => poDutyOpen('b6')); await page.waitForSelector('#podu_' + staff.Somchai, { timeout: 8000 });
  await page.check('#podu_' + staff.Somchai); await page.check('#podu_' + staff.Nok);
  await clickModal('บันทึก'); await flush(); await settle(500);
  const job = await api(`/v1/pier-office/${PIER}/days/${D2}/boats/b6/job`);
  const scrDuty = await ev((a) => (PIER_DUTY[a.D + '::b6'] || []).slice().sort(), { D: D2 });
  ok('poDutySave from the Office screen reaches the server (both staff on duty)', JSON.stringify((job.duty_staff_ids || []).slice().sort()) === JSON.stringify([staff.Somchai, staff.Nok].sort()) && JSON.stringify(scrDuty) === JSON.stringify([staff.Somchai, staff.Nok].sort()), { loadedBefore, server: job.duty_staff_ids, screen: scrDuty });
  // job kind for a sailing boat, a boat with no trip: the server's `kind`
  await openView('poj-' + PIER, D2); await settle(2500);
  const kinds = {};
  for (const b of ['b6', 'b7', 'b1']) kinds[b] = [await ev((a) => paJobKind(a.D, a.b), { D: D2, b }), (await api(`/v1/pier-office/${PIER}/days/${D2}/boats/${b}/job`)).kind];
  ok('paJobKind = the server job kind for each boat (b6, b7, and b1 which has no trip)', Object.values(kinds).every(([s, v]) => s === v) && kinds.b6[1] === 'boat', kinds);
  // route codes (attendance screen reads the roster)
  await openView('poa-' + PIER, D2); await settle(2500);
  const roster = await api(`/v1/pier-office/${PIER}/roster?from=2026-10-01&to=2026-10-31`);
  const rc = await ev(() => ({ r4: paRouteCode('r4'), r5: paRouteCode('r5'), r10: paRouteCode('r10'), by: ROUTES.map((r) => r.id).map((id) => [id, paRoutesByCode(paRouteCode(id)).map((x) => x.id)]) }));
  const srvCode = (id) => ((roster.route_codes || []).find((e) => e.routes.some((r) => r.id === id)) || {}).code;
  ok('paRouteCode = the roster route_codes of the server (r4, r5)', rc.r4 === srvCode('r4') && rc.r5 === srvCode('r5') && !!rc.r4 && !!rc.r5, { screen: rc, server: roster.route_codes });
  ok('paRoutesByCode(code) finds the routes holding that code', rc.by.every(([id, ids]) => ids.includes(id)), rc.by);
  // PA_PAY_DEF
  const rules = await api('/v1/pier-office/pay-rules');
  const def = await ev(() => JSON.parse(JSON.stringify(PA_PAY_DEF)));
  const srvDef = Object.fromEntries((rules.rules || []).map((r) => [r.code, { x: r.multiplier, d: r.per_day, f: r.flat }]));
  ok('PA_PAY_DEF equals the server default pay table (nothing saved: defaulted)', rules.defaulted === true && JSON.stringify(def) === JSON.stringify(srvDef), { screen: def, server: srvDef });
});

// ═══ 5 · pier job board ═══
section('5', async () => {
  console.log('\n[5] pier job board · pax, prep, boat state, pier of a boat, boat list, work code, documents, programme colour');
  await openView('poj-' + PIER, D); await settle(3000);
  const day = await api(`/v1/pier-office/${PIER}/days/${D}/boats`);
  const sb = (id) => day.boats.find((b) => b.boat_id === id);
  const fl = (id) => day.fleet.find((f) => f.boat_id === id);
  const s = await ev((a) => {
    const b6 = getBoat('b6'), b7 = getBoat('b7'), b1 = getBoat('b1'), b13 = getBoat('b13');
    return {
      pax: pjPax(a.D, 'b6', a.P), prep: pjPrep(a.D, 'b6', a.P),
      st6: pjBoatSt(a.D, b6, true), st7: pjBoatSt(a.D, b7, true), st1: pjBoatSt(a.D, b1, false),
      pier6: pjPierOf(b6, a.D), pier1: pjPierOf(b1, a.D), pier13: pjPierOf(b13, a.D),
      all: pjAllBoats(a.D, a.P).map((x) => x.boat.id),
      wc7: pjWcAuto(pjBoatSt(a.D, b7, true)), wc6: pjWcAuto(pjBoatSt(a.D, b6, true)), mt: typeof paMtCode === 'function' ? paMtCode() : null,
      doc: pjDocFind(b6, 'lic'), docNone: pjDocFind(b6, 'similan'), docB7: pjDocFind(b7, 'lic'),
    };
  }, { D, P: PIER });
  const pr = sb('b6').booked.prep;
  ok('pjPax = the server heads of the boat (ad, chd, inf, foc, bookings)', s.pax.ad === pr.pax.ad && s.pax.chd === pr.pax.chd && s.pax.inf === pr.pax.inf && s.pax.foc === pr.pax.foc && s.pax.n === pr.pax.bookings && pr.pax.total === 6, { screen: s.pax, server: pr.pax });
  // discriminator: blank the browser's own bookings; the board must still show the server's heads
  const tampered = await ev((a) => { const save = SB_BOOKINGS.map((b) => b.status); SB_BOOKINGS.forEach((b) => { b.status = 'cancelled'; }); const r = pjPax(a.D, 'b6', a.P); SB_BOOKINGS.forEach((b, i) => { b.status = save[i]; }); return r; }, { D, P: PIER });
  ok('pjPax does not read the browser bookings (all cancelled locally, still the server heads)', tampered.ad === pr.pax.ad && tampered.chd === pr.pax.chd, tampered);
  ok('pjPrep = the server prep (booked, arrived, no-show)', s.prep.booked === pr.booked && s.prep.arrived === pr.arrived && s.prep.noShow === pr.no_show, { screen: s.prep, server: pr });
  ok('pjBoatSt = the server fleet state for b6 (run), b7 (run, 1 open job), b1 (idle)', s.st6.k === fl('b6').state && s.st7.k === fl('b7').state && s.st1.k === fl('b1').state && s.st7.srvOpenJobs === 1 && fl('b7').open_jobs === 1, { screen: [s.st6.k, s.st7.k, s.st7.srvOpenJobs, s.st1.k], server: day.fleet.map((f) => [f.boat_id, f.state, f.open_jobs]) });
  ok('pjPierOf: b6 and b1 are at tublamu (the pier whose fleet lists them)', s.pier6 === PIER && s.pier1 === PIER, { b6: s.pier6, b1: s.pier1, b13: s.pier13 });
  ok('pjAllBoats lists the boats of the pier\'s fleet (b6, b7, b1)', ['b6', 'b7', 'b1'].every((id) => s.all.includes(id)), { screen: s.all, server: day.fleet.map((f) => f.boat_id) });
  ok('pjWcAuto: MT code for b7 (server counts 1 open repair job), none for b6', !!s.mt && s.wc7 === s.mt && s.wc6 === '', { wc7: s.wc7, wc6: s.wc6, mt: s.mt });
  const cert = (await api('/v1/fleet/certificates')).boats.find((b) => b.boat_id === 'b6').cells;
  ok('pjDocFind: b6 licence is the matrix cell of the server; a missing type is null', s.doc && s.doc.exp === cert.lic.expires_on && s.doc.name === cert.lic.name && s.docNone === null && s.docB7 === null, { screen: [s.doc, s.docNone, s.docB7], server: cert.lic });
  // programme colour: the swatch on the job page → PATCH /v1/routes/{id} {color}
  const pick = await ev(() => PJ_PAL.filter((c) => c.toLowerCase() !== String(getRoute('r5').color || '').toLowerCase())[2]);
  await ev((c) => { const sw = [...document.querySelectorAll('.pj-sw')].find((e) => /pjProgColor\('r5'/.test(e.getAttribute('onclick')) && e.getAttribute('onclick').includes(c)); if (!sw) throw new Error('no swatch ' + c); sw.click(); }, pick);
  await idle(); await settle(800);
  const rt = (await api('/v1/routes/r5'));
  const route = rt.route || rt;
  const scr = await ev(() => getRoute('r5').color);
  ok('programme colour saved on the server (PATCH /v1/routes/r5) and shown', String(route.color).toLowerCase() === pick.toLowerCase() && String(scr).toLowerCase() === pick.toLowerCase(), { picked: pick, server: route.color, screen: scr });
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
