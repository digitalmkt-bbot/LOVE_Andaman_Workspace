// t_walk_dayops · browser walk-through of the Day Operations screens (vans, check-in, Travel Summary)
// against a REAL operation-backend (in-process store, seeded). Modelled on t_ops.mjs.
//   node test/ui/t_walk_dayops.mjs
// Every check reads BOTH sides: the screen's state and what the server holds (asked directly).
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;

const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = '';
const opsPort = await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 90000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m){ clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
backend.on('exit', (c, sig) => console.log('BACKEND EXIT', c, sig, backendLog.slice(-1500)));
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
// api(): ask the server directly. Returns the JSON body; .status is attached through apiRaw for refusals.
const apiRaw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await apiRaw(p, init)).body;
const send = (m, p, b) => apiRaw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], bodies = [];
const routeFn = async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push(req.method() + ' ' + u.pathname + ' ' + r.status);
  if (req.method() !== "GET") bodies.push({ k: req.method() + " " + u.pathname, status: r.status, req: req.postData() || "", body: buf.toString() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 260));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
};
await ctx.route(PROD, routeFn);
const page = await ctx.newPage();
const errors = [], dialogs = [];
let dialogAnswer = true;
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); if (d.type() === 'prompt') d.accept('Tester'); else if (dialogAnswer) d.accept(); else d.dismiss(); });

const results = [];   // item -> PASS/FAIL list
const fails = [];
let curItem = '0';
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 500))); results.push({ item: curItem, name, pass: !!cond }); if (!cond) fails.push(curItem + ' ' + name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const callsSince = (n) => calls.slice(n);

const DAY = '2026-11-10', DAY2 = '2026-11-11', DAY3 = '2026-11-12';
const bangkokToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const TODAY = bangkokToday();

// ── seed through the API ──
for (const d of [DAY, DAY2, DAY3, TODAY]) await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: d, capacity: 40 });
const mkVan = async (name, cap, extra = {}) => (await send('POST', '/operations/vans', { name, capacity: cap, ...extra })).body;
const vanA = await mkVan('Van Alpha', 9), vanB = await mkVan('Van Bravo', 12);
for (const d of [DAY, DAY2, DAY3, TODAY]) for (const v of [vanA, vanB]) await send('PUT', `/operations/van-days/${d}/${v.id}`, { route_ids: ['r5'] });
const mkBk = async (id, lead, date, pax, extra = {}) => send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: 'r5', date, pax: { ad_fr: pax }, zone: 'PK' }], ...extra });
const bk = {};
for (const [k, lead, date, pax] of [['b1', 'WALK ONE', DAY, 2], ['b2', 'WALK TWO', DAY, 3], ['b3', 'WALK THREE', DAY, 1], ['b4', 'WALK FOUR', DAY, 2], ['t1', 'WALK TODAY', TODAY, 2], ['t2', 'WALK TODAY2', TODAY, 1]]) {
  const r = await mkBk('zz-' + k, lead, date, pax);
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body)); process.exit(2); }
  bk[k] = { id: r.body.id, trip: r.body.trips[0].id, version: r.body.version };
}
const mkGroup = async (date, members, van_id) => (await send('POST', '/operations/van-groups', { service_date: date, route_id: 'r5', zone: 'PK', members: members.map((m) => ({ trip_id: bk[m].trip })), van_id })).body;
const gA = await mkGroup(DAY, ['b1', 'b2'], vanA.id), gB = await mkGroup(DAY, ['b3'], vanB.id), gT = await mkGroup(TODAY, ['t1', 't2'], vanA.id);

// DAY2: fresh bookings for the van-group walk (no groups yet) + one with an alternate pickup (a split part of its own)
const bk2 = {};
for (const [k, lead, pax, extra] of [['c1', 'WALK C ONE', 2, {}], ['c2', 'WALK C TWO', 2, {}], ['c3', 'WALK C THREE', 3, {}], ['c4', 'WALK C FOUR', 1, {}],
  ['c5', 'WALK C FIVE', 3, { alt_pickups: [{ who: 'Mr Alt', ad: 1, chd: 0, inf: 0, foc: 0, zone: 'PK', place: 'Kata Palm Resort', area: 'Kata', drop_same: true }] }]]) {
  const r = await mkBk('zz-' + k, lead, DAY2, pax, extra);
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body)); process.exit(2); }
  bk2[k] = { id: r.body.id, trip: r.body.trips[0].id, parts: r.body.trips[0].operations.van_parts };
}
console.log('c5 parts', JSON.stringify(bk2.c5.parts));
const agR = await send('POST', '/v1/agents', { name: 'Cot Agent', market_id: 'ru', pay_type: 'cot', vat_mode: 'none', rate_type_id: 'rt001', company: { legal_name: 'Cot Agent Co', address: '1 Test Rd' } });
if (agR.status !== 201) { console.log('agent failed', agR.status, JSON.stringify(agR.body)); process.exit(2); }
const cotAgent = agR.body.id;
const bk3 = {};
for (const [k, lead, pax, cot] of [['e1', 'WALK E ONE', 2, 3000], ['e2', 'WALK E TWO', 1, 1500], ['e3', 'WALK E THREE', 2, 0]]) {
  const r = await mkBk('zz-' + k, lead, DAY3, pax, { agentId: cotAgent, ...(cot ? { cash_on_tour_amount: cot, cash_on_tour_currency: 'THB' } : {}) });
  bk3[k] = { id: r.body.id, trip: r.body.trips && r.body.trips[0].id, version: r.body.version };
}
const vck = async (d) => api('/v1/van-checkin?date=' + d);

// ── boot the app ──
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1000);
const openVanCk = async (date) => {
  await ev((d) => { _vanCkDate = d; const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el); renderVanCheckin(); }, date);
  await waitFor(() => document.querySelector('#vancheckin-host .vck-arr'), null, 15000);
  await idle(); await settle(800);
};
await openVanCk(DAY);
const lastBody = (re) => { const b = bodies.filter((x) => re.test(x.k)).pop(); return b ? { status: b.status, req: b.req, json: (() => { try { return JSON.parse(b.body); } catch (_) { return null; } })() } : null; };
const sel = (id) => ev((i) => { const s = [...document.querySelectorAll('#vancheckin-host .vck-sel')].find((x) => (x.getAttribute('onchange') || '').includes("'" + i + "'")); return s ? s.value : null; }, id);
const chip = (gk) => ev((k) => { const b = document.querySelector('#vancheckin-host button.vck-arr[onclick*="' + k + '"]'); return b ? { cls: b.className, text: b.innerText.replace(/\s+/g, ' ') } : null; }, gk);
const statusOf = async (d, bookingId) => ((await vck(d)).rows.find((r) => r.booking_id === bookingId) || {}).status;

const ONLY = process.env.ONLY || "";
const want = (n) => !ONLY || ONLY.split(",").includes(n);
if (want("1") || want("2")) {
// ════════════ 1. driver arrived toggle ════════════
curItem = '1'; console.log('\n[1] driver arrived toggle (Van Check-in)');
await openVanCk(DAY);
await ev(() => { window.__flow = 0; const o = window.vckArrFlow; window.vckArrFlow = function () { window.__flow++; return o && o.apply(this, arguments); }; });
ok('before: rows wait on screen and server, chip is the tick box', (await sel('zz-b1')) === '' && (await statusOf(DAY, bk.b1.id)) === 'wait' && /ติ๊กเมื่อคนขับ/.test((await chip('veh01~r5')).text), await chip('veh01~r5'));
await page.locator('button.vck-arr[onclick*="veh01~r5"]').click();
await idle(); await settle(1500);
let put = lastBody(/^PUT \/operations\/van-arrivals\//), vs = await vck(DAY);
ok('PUT /operations/van-arrivals answered moved_to_standby 2', put && put.status === 200 && put.json && put.json.moved_to_standby === 2 && put.json.arrived_by, put);
ok('server: van veh01 arrived, its 2 rows standby, the other van untouched', vs.vans.find((v) => v.van_id === 'veh01').arrived && vs.rows.filter((r) => r.van_id === 'veh01').every((r) => r.status === 'standby') && vs.rows.find((r) => r.van_id === 'veh02').status === 'wait', vs);
const s1 = [await sel('zz-b1'), await sel('zz-b2'), await sel('zz-b3')];
ok('screen: the 2 rows show Standby after the re-read, Van Bravo row still waits', s1.join() === 'standby,standby,', s1);
const c1 = await chip('veh01~r5');
ok('screen: chip now says the driver is on standby with the server time and 2 open', c1 && /คนขับสแตนบายแล้ว/.test(c1.text) && c1.text.includes(put.json.arrived_hm) && /ค้าง 2 ราย/.test(c1.text), c1);
ok('browser rule vckArrFlow was NOT run in ops mode', (await ev(() => window.__flow)) === 0);
ok('no blob copy kept (vck_arrive empty)', await ev(() => { try { return !(laBlob() || {}).vck_arrive; } catch (_) { return true; } }));
// un-toggle
const dlg0 = dialogs.length;
await page.locator('button.vck-arr[onclick*="veh01~r5"]').click();
await idle(); await settle(1500);
vs = await vck(DAY);
ok('un-toggle: confirm asked (legacy text), DELETE answered 204', dialogs.length === dlg0 + 1 && /ยกเลิกการบันทึก/.test(dialogs[dlg0]) && lastBody(/^DELETE \/operations\/van-arrivals\//).status === 204, { d: dialogs.slice(dlg0), l: lastBody(/^DELETE \/operations\/van-arrivals\//) });
ok('server: arrival gone, rows back to wait', vs.vans.find((v) => v.van_id === 'veh01').arrived === null && vs.rows.filter((r) => r.van_id === 'veh01').every((r) => r.status === 'wait'), vs);
const s1b = [await sel('zz-b1'), await sel('zz-b2')];
ok('screen: rows back to Wait, chip is the tick box again', s1b.join() === ',' && /ติ๊กเมื่อคนขับ/.test((await chip('veh01~r5')).text) && (await ev(() => window.__flow)) === 0, { s1b, c: await chip('veh01~r5') });
// a row the staff already ticked in is left alone by the mark
const ckPut = await send('PUT', `/operations/trip-ops/${bk.b2.trip}/checkins/van/0`, { expected: 3, actual_pax: 3, checked_in_at: new Date().toISOString(), checked_in_by: 'Tester', events: [] });
await page.locator('button.vck-arr[onclick*="veh01~r5"]').click();
await idle(); await settle(1500);
put = lastBody(/^PUT \/operations\/van-arrivals\//); vs = await vck(DAY);
ok('a ticked-in row is not moved: moved_to_standby 1, server b2 stays checkin', put.json.moved_to_standby === 1 && (await statusOf(DAY, bk.b2.id)) === 'checkin', { put: put.json, st: await statusOf(DAY, bk.b2.id) });
await page.locator('button.vck-arr[onclick*="veh01~r5"]').click();
await idle(); await settle(1000);
await send('DELETE', `/operations/trip-ops/${bk.b2.trip}/checkins/van/0`);

// ════════════ 2. arrivals read on the day · wait rule from the server ════════════
curItem = '2'; console.log('\n[2] arrivals read from the server (another session) and the wait rule');
// another session marks Van Bravo on DAY: straight to the server, the open screen knows nothing yet
const other = await send('PUT', `/operations/van-arrivals/${DAY}/veh02/r5`);
ok('other session marked veh02 on the server', other.status === 200 && other.body.moved_to_standby === 1, other);
ok('screen has not heard of it yet', /ติ๊กเมื่อคนขับ/.test((await chip('veh02~r5')).text), await chip('veh02~r5'));
await settle(5300);                         // the day's load is cached 5 s
await ev(() => renderVanCheckin());
await waitFor(() => /คนขับสแตนบายแล้ว|รับครบแล้ว/.test((document.querySelector('#vancheckin-host button.vck-arr[onclick*="veh02~r5"]') || {}).innerText || ''), null, 8000);
await idle(); await settle(800);
const c2 = await chip('veh02~r5');
const arr2 = await ev((k) => vckArrGet(k.d, k.gk), { d: DAY, gk: 'veh02~r5' });
ok('re-render on the day reads the mark: chip on, time and login are the server\'s', c2 && /คนขับสแตนบายแล้ว/.test(c2.text) && arr2 && arr2.at === other.body.arrived_hm && arr2.by === other.body.arrived_by, { c2, arr2, srv: other.body });
const rowsNow = await sel('zz-b3');
if (want("2")) await settle(22000);                          // one change-feed poll (20 s)
const rowsPoll = await sel('zz-b3');
await openVanCk(DAY); await settle(1500);
const rowsReopen = await sel('zz-b3');
console.log('  note  rows of the other session mark: right after the chip=' + JSON.stringify(rowsNow) + ' · after a change-feed poll=' + JSON.stringify(rowsPoll) + ' · after re-opening the screen=' + JSON.stringify(rowsReopen) + ' · server=' + (await statusOf(DAY, bk.b3.id)));
ok('after re-opening the screen the row the other session moved shows Standby', rowsReopen === 'standby', { rowsNow, rowsPoll, rowsReopen });
ok('a past day shows no waited minutes: vckArrWait null, server waited_minutes null', (await ev(() => vckArrWait('2026-11-10', 'veh02~r5'))) === null && other.body.waited_minutes === null);
// today's day: wait counted by the server
const tArr = await send('PUT', `/operations/van-arrivals/${TODAY}/veh01/r5`);
await openVanCk(TODAY); await settle(1200);
const srvToday = (await api('/operations/van-arrivals?date=' + TODAY));
const scr = await ev((d) => ({ wait: vckArrWait(d, 'veh01~r5'), rule: window.VCK_WAIT_RULE }), TODAY);
const cT = await chip('veh01~r5');
ok('today: the wait on screen is the server\'s waited_minutes (' + srvToday.arrivals[0].waited_minutes + ') and the chip shows "รอ N น."', scr.wait === srvToday.arrivals[0].waited_minutes && /รอ \d+ น\./.test(cT.text) && !/late/.test(cT.cls), { scr, srv: srvToday, cT });
ok('VCK_WAIT_RULE is the server\'s wait_rule_minutes', srvToday.wait_rule_minutes === scr.rule, { scr, srv: srvToday.wait_rule_minutes });
// the clock moves on 20 minutes in this browser: the count carries on from the server\'s reading and the warning shows
await ev(() => { const n = Date.now; window.__realNow = n; Date.now = () => n.call(Date) + 20 * 60000; });
const cLhtml = await ev((d) => vckArrChip(d, 'veh01~r5', 'Van Alpha', [{ ck: {} }]), TODAY);
const cL = { cls: /class="([^"]*)"/.exec(cLhtml)[1], text: cLhtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/s+/g, ' ') };
ok('20 minutes later the count is 20+ and the chip is the "ครบ 15 นาที" warning (late)', (await ev((d) => vckArrWait(d, 'veh01~r5'), TODAY)) >= 20 && /late/.test(cL.cls) && /ครบ 15 นาที/.test(cL.text), cL);
await ev(() => { Date.now = window.__realNow; });
await send('DELETE', `/operations/van-arrivals/${TODAY}/veh01/r5`);
await send('DELETE', `/operations/van-arrivals/${DAY}/veh02/r5`);
}
// ════════════ 3. van groups ════════════
let n3 = 0, G = [];
const showBytrip = async (date) => {
  await ev((d) => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; _bkV2.vanAssignMode = true; _bkV2.detailId = null; _bkV2.newBooking = null; _bkV2.filterRoute = null; const el = document.querySelector('.nav-item[data-view="booking"]'); if (el) nav(el); bookingV2Render(); }, date);
  await waitFor((d) => SB_BOOKINGS.filter((b) => b.trips.some((t) => t.date === d)).length >= 4, date, 15000);
  await idle(); await settle(1200);
};
if (want('3')) {
curItem = '3'; console.log('\n[3] van groups (By-trip · Van mode)');
const grpsOf = async (date) => (await api(`/operations/van-groups?service_date=${date}&route_id=r5`)).groups;
const scr = (id, date) => ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); if (!b) return null; const o = bkOpsRead(b, a.date) || {}; return { grp: +o.vanGroup || 0, van: o.vanId || '', ret: o.vanReturnId || '', seq: +o.vanSeq || 0, fin: o.pickupTimeFinal || '' }; }, { id, date });
const tick = async (id) => { await page.locator(`#view-booking span[onclick*="bookingV2VanSelToggle('${id}')"]`).first().click(); await settle(300); };
const toasts = () => ev(() => [...document.querySelectorAll('[class*="toast"], .la-toast, .ops-toast')].map((t) => t.innerText.replace(/\s+/g, ' ').slice(0, 160)));
await showBytrip(DAY2);
// A · group c1 + c2 from the ticked rows
await tick('zz-c1'); await tick('zz-c2');
n3 = calls.length;
await page.locator('#view-booking button[onclick*="bookingV2VanGroupSelected"][onclick*="\'new\'"]').click();
await idle(); await settle(1000);
G = await grpsOf(DAY2);
ok('tick c1+c2 → "จับเป็นกรุ๊ปใหม่" → POST van-groups → server group 1 holds both, in tick order', G.length === 1 && G[0].number === 1 && G[0].members.map((m) => m.booking_id).join() === [bk2.c1.id, bk2.c2.id].join() && callsSince(n3).some((c) => c.startsWith('POST /operations/van-groups ')), { G: G.map((g) => g.members.length), calls: callsSince(n3).filter((c) => !c.startsWith('GET')) });
let sc1 = await scr('zz-c1', DAY2), sc2 = await scr('zz-c2', DAY2);
ok('screen: both rows now in group 1', sc1.grp === 1 && sc2.grp === 1 && sc2.seq === 2, { sc1, sc2 });
await tick('zz-c3');
await page.locator('#view-booking button[onclick*="bookingV2VanGroupSelected"][onclick*="\'new\'"]').click();
await idle(); await settle(1000);
G = await grpsOf(DAY2);
ok('c3 alone → group 2; c4 stays unassigned', G.length === 2 && G[1].number === 2 && (await scr('zz-c3', DAY2)).grp === 2 && (await scr('zz-c4', DAY2)).grp === 0, G.map((g) => g.number));
// B · vans from the group header selects
const vanSel = (g) => page.locator(`#view-booking select[onchange*="bookingV2VanGroupSetVan('${DAY2}','r5','PK','${g}'"]`);
n3 = calls.length;
await vanSel(1).selectOption(vanA.id); await idle(); await settle(900);
await vanSel(2).selectOption(vanB.id); await idle(); await settle(900);
G = await grpsOf(DAY2);
ok('group selects → PATCH van-groups: group 1 on Van Alpha, group 2 on Van Bravo (server)', G[0].van_id === vanA.id && G[1].van_id === vanB.id && callsSince(n3).filter((c) => c.startsWith('PATCH /operations/van-groups/')).length === 2, { v: G.map((g) => g.van_id), c: callsSince(n3).filter((c) => !c.startsWith('GET')) });
ok('screen: rows carry the van; select shows it', (await scr('zz-c1', DAY2)).van === vanA.id && (await scr('zz-c3', DAY2)).van === vanB.id && (await vanSel(1).inputValue()) === vanA.id, [await scr('zz-c1', DAY2), await vanSel(1).inputValue()]);
// C · return van on the group
const retSel = (g) => page.locator(`#view-booking select[onchange*="bookingV2VanGroupSetReturn('${DAY2}','r5','PK','${g}'"]`);
await retSel(1).selectOption(vanB.id); await idle(); await settle(900);
G = await grpsOf(DAY2);
ok('return van of group 1 → PATCH return_van_id (server)', G[0].return_van_id === vanB.id, G[0].return_van_id);
ok('return van of group 1: the header select still shows the server value after the redraw', (await retSel(1).inputValue()) === vanB.id, { select: await retSel(1).inputValue(), srv: G[0].return_van_id });
ok('return van of group 1: the rows carry it (ops.vanReturnId)', (await scr('zz-c1', DAY2)).ret === vanB.id, await scr('zz-c1', DAY2));
await retSel(1).selectOption(''); await idle(); await settle(700);
ok('return van cleared ("กลับคันเดิม") → null on the server', (await grpsOf(DAY2))[0].return_van_id === null);
// D · pickup time of the group
n3 = calls.length;
await page.locator(`#view-booking input[oninput*="bookingV2VanGroupSetTime('${DAY2}','r5','PK','1'"]`).fill('07:15');
await idle(); await settle(900);
G = await grpsOf(DAY2);
const bkSrv = await api('/v1/bookings/' + bk2.c1.id);
ok('group pickup time 07:15 → PATCH (server group + every member final pickup)', G[0].pickup_time === '07:15' && bkSrv.trips[0].operations.pickup_time_final === '07:15' && (await scr('zz-c2', DAY2)).fin === '07:15', { g: G[0].pickup_time, fin: bkSrv.trips[0].operations.pickup_time_final, s: await scr('zz-c2', DAY2) });
// E · order of the groups (drag order) 
const key = `${DAY2}::r5::PK`;
n3 = calls.length;
await ev((k) => bookingV2GrpMove(k, 2, 1), key);
await idle(); await settle(900);
G = await grpsOf(DAY2);
const domOrder = await ev(() => [...document.querySelectorAll('#view-booking tr[data-grp]')].map((t) => +t.getAttribute('data-grp')));
ok('move group 2 above group 1 → PUT van-groups/order (server display_order 2→1, 1→2)', callsSince(n3).some((c) => c.startsWith('PUT /operations/van-groups/order')) && G.find((g) => g.number === 2).display_order === 1 && G.find((g) => g.number === 1).display_order === 2 && G[0].number === 2, { g: G.map((g) => [g.number, g.display_order]), calls: callsSince(n3).filter((c) => !c.startsWith('GET')) });
ok('screen: group 2 is drawn first', domOrder[0] === 2 && (await ev((k) => bookingV2GrpOrderGet(...k.split('::')), key)).join() === '2,1', domOrder);
await ev((k) => bookingV2GrpOrderSet(...k.split('::'), []), key);
await idle(); await settle(700);
ok('reset order → clear:true, display_order back to null', (await grpsOf(DAY2)).every((g) => g.display_order === null), (await grpsOf(DAY2)).map((g) => g.display_order));
// F · pickup order inside the group: tick c2, Save → c2 first
await showBytrip(DAY2);
await tick('zz-c2');
n3 = calls.length;
await page.locator(`#view-booking button[onclick*="bookingV2VanGroupSave('${DAY2}')"]`).first().click();
await idle(); await settle(1000);
G = await grpsOf(DAY2);
const g1 = G.find((g) => g.number === 1);
ok('tick c2 + Save → PUT group order: c2 is now first (sequence 1), c1 second', g1.members[0].booking_id === bk2.c2.id && g1.members[0].sequence === 1 && g1.members[1].sequence === 2, g1.members.map((m) => [m.booking_id.slice(-4), m.sequence]));
ok('screen row sequence follows the server', (await scr('zz-c2', DAY2)).seq === 1 && (await scr('zz-c1', DAY2)).seq === 2, [await scr('zz-c2', DAY2), await scr('zz-c1', DAY2)]);
await page.locator(`#view-booking button[onclick*="bookingV2VanGroupClearSeq('${DAY2}','r5','PK','1')"]`).click();
await idle(); await settle(900);
ok('"ล้างลำดับ" → PUT order clear:true: sequences back to null on the server', (await grpsOf(DAY2)).find((g) => g.number === 1).members.every((m) => m.sequence === null || m.sequence === undefined), (await grpsOf(DAY2)).find((g) => g.number === 1).members.map((m) => m.sequence));
// G · one booking's own return van (the small select in the row)
n3 = calls.length;
await page.locator(`#view-booking select[onchange*="bookingV2AssignVanReturn('zz-c3'"]`).selectOption(vanA.id);
await idle(); await settle(900);
const c3Srv = await api('/v1/bookings/' + bk2.c3.id);
ok('row return van on c3 -> PATCH trip-ops van_parts: server part return_van_id = Van Alpha', c3Srv.trips[0].operations.van_parts[0].return_van_id === vanA.id && (await scr('zz-c3', DAY2)).ret === vanA.id, { srv: c3Srv.trips[0].operations.van_parts[0].return_van_id, scr: await scr('zz-c3', DAY2), calls: callsSince(n3).filter((c) => !c.startsWith('GET')) });
// H · clear route (vans leave, groups stay)
n3 = calls.length;
const dlg3 = dialogs.length;
await page.locator(`#view-booking button[onclick*="bookingV2VanClearRoute('${DAY2}','r5')"]`).first().click();
await idle(); await settle(1000);
G = await grpsOf(DAY2);
ok('"ล้าง" (clear route) -> confirm shown -> POST van-groups/clear -> every group lost its van, groups kept', /Clear van assignments/.test(dialogs[dlg3] || '') && callsSince(n3).some((c) => c.startsWith('POST /operations/van-groups/clear')) && G.length === 2 && G.every((g) => g.van_id === null), { d: dialogs.slice(dlg3), v: G.map((g) => g.van_id) });
ok('screen: group headers say "ยังไม่เลือกรถ", rows carry no van', (await ev(() => document.body.innerText.includes('ยังไม่เลือกรถ'))) && (await scr('zz-c1', DAY2)).van === '', await scr('zz-c1', DAY2));
// I · auto-assign (the server picks the vans). Called by name: see whether a button draws it.
const btn = await ev(() => !!document.querySelector('#view-booking [onclick*="bookingV2VanAutoAssign"]'));
n3 = calls.length;
await ev((d) => bookingV2VanAutoAssign(d, 'r5'), DAY2);
await idle(); await settle(1000);
G = await grpsOf(DAY2);
ok('auto-assign (called by name, button on screen: ' + btn + ') -> POST van-days/auto-assign: both groups got a van from the server, screen shows them', callsSince(n3).some((c) => c.startsWith('POST /operations/van-days/' + DAY2 + '/auto-assign')) && G.every((g) => g.van_id) && (await scr('zz-c1', DAY2)).van === G.find((g) => g.number === 1).van_id, { v: G.map((g) => g.van_id), c: callsSince(n3).filter((c) => !c.startsWith('GET')) });
// J · disband group 2
n3 = calls.length;
await page.locator(`#view-booking button[onclick*="bookingV2VanGroupDisband('${DAY2}','r5','PK','2')"]`).click();
await idle(); await settle(1000);
G = await grpsOf(DAY2);
ok('"ยกเลิกกรุ๊ป" group 2 -> DELETE van-groups/{id}: server keeps group 1 only; c3 back to unassigned on screen', callsSince(n3).some((c) => c.startsWith('DELETE /operations/van-groups/')) && G.length === 1 && (await scr('zz-c3', DAY2)).grp === 0, { n: G.length, c3: await scr('zz-c3', DAY2) });
// K · van stops (a guide riding along): save, edit, check-in on Van Check-in, delete
const stopsOf = async (d) => (await api(`/operations/van-stops?service_date=${d}`)).stops;
const g1id = (await grpsOf(DAY2)).find((g) => g.number === 1);
n3 = calls.length;
await ev((a) => vsOpen(a.d, 'r5', { vanId: a.v, vanGroup: 1 }), { d: DAY2, v: g1id.van_id });
await page.fill('#vs-label', 'Guide Nok'); await page.fill('#vs-pax', '1'); await page.fill('#vs-time', '06:20'); await page.fill('#vs-place', 'Office');
await page.click('#vanstop-modal button[onclick="vsSubmit()"]');
await idle(); await settle(1200);
let ST = await stopsOf(DAY2);
let stopScr = await ev(() => Object.keys(VAN_STOPS).map((k) => ({ k, label: VAN_STOPS[k].label, id: VAN_STOPS[k].opsId || VAN_STOPS[k].id, grp: VAN_STOPS[k].vanGroup, van: VAN_STOPS[k].vanId })));
ok('new stop -> POST van-stops: server holds it on group 1 (label, place, time, 1 seat), modal closed', callsSince(n3).some((c) => c.startsWith('POST /operations/van-stops')) && ST.length === 1 && ST[0].label === 'Guide Nok' && ST[0].place === 'Office' && ST[0].time === '06:20' && ST[0].pax === 1 && ST[0].group_id === g1id.id && !(await ev(() => document.getElementById('vanstop-modal').classList.contains('open') || document.getElementById('vanstop-modal').classList.contains('show'))), { ST, calls: callsSince(n3).filter((c) => !c.startsWith('GET')), dialogs: dialogs.slice(-2) });
ok('screen: VAN_STOPS holds the stop with the server id', stopScr.length === 1 && stopScr[0].label === 'Guide Nok', stopScr);
ok('group seats count the guide: pax = customers + 1 (server)', (await grpsOf(DAY2)).find((g) => g.number === 1).stop_seats === 1, (await grpsOf(DAY2)).find((g) => g.number === 1));
// edit
n3 = calls.length;
await ev((k) => vsEditOpen(k), stopScr[0].k);
await page.fill('#vs-label', 'Guide Nok 2'); await page.fill('#vs-time', '06:25');
await page.click('#vanstop-modal button[onclick="vsSubmit()"]');
await idle(); await settle(1200);
ST = await stopsOf(DAY2);
ok('edit stop -> PATCH van-stops/{id}: server label + time changed', callsSince(n3).some((c) => c.startsWith('PATCH /operations/van-stops/')) && ST.length === 1 && ST[0].label === 'Guide Nok 2' && ST[0].time === '06:25', { ST, c: callsSince(n3).filter((c) => !c.startsWith('GET')) });
// check-in from the Van Check-in screen
await openVanCk(DAY2); await settle(800);
n3 = calls.length;
const stopBtn = page.locator('#vancheckin-host button.vsckb', { hasText: 'ขึ้นรถแล้ว' }).first();
const hadBtn = await stopBtn.count();
if (hadBtn) { await stopBtn.click(); await idle(); await settle(1000); }
ST = await stopsOf(DAY2);
ok('Van Check-in: stop "ขึ้นรถแล้ว" -> PUT van-stops/{id}/check-in: server checked_in set (by the login, 1 seat), row shows done', hadBtn > 0 && callsSince(n3).some((c) => c.startsWith('PUT /operations/van-stops/') && /check-in/.test(c)) && ST[0].checked_in && ST[0].checked_in.seats === 1 && (await ev(() => /vsdone/.test(document.querySelector('#vancheckin-host').innerHTML))), { hadBtn, ci: ST[0].checked_in, c: callsSince(n3).filter((c) => !c.startsWith('GET')) });
n3 = calls.length;
const undoBtn = page.locator('#vancheckin-host button.vsckb', { hasText: 'ยกเลิก' }).first();
if (await undoBtn.count()) { await undoBtn.click(); await idle(); await settle(1000); }
ST = await stopsOf(DAY2);
ok('un-check -> DELETE van-stops/{id}/check-in: server checked_in null', callsSince(n3).some((c) => c.startsWith('DELETE /operations/van-stops/') && /check-in/.test(c)) && ST[0].checked_in === null, { ci: ST[0].checked_in, c: callsSince(n3).filter((c) => !c.startsWith('GET')) });
// delete
n3 = calls.length;
await ev((k) => vsEditOpen(k), stopScr[0].k);
await page.click('#vs-del'); await idle(); await settle(1000);
ST = await stopsOf(DAY2);
ok('delete stop -> confirm -> DELETE van-stops/{id}: gone on the server and from VAN_STOPS', callsSince(n3).some((c) => c.startsWith('DELETE /operations/van-stops/')) && ST.length === 0 && (await ev(() => Object.keys(VAN_STOPS).length)) === 0, { ST, vs: await ev(() => Object.keys(VAN_STOPS)) });
// L · split pickup time (the alternate-pickup part of c5 has a pickup of its own)
await showBytrip(DAY2); await settle(800);
const spIn = page.locator(`#view-booking input[oninput*="bookingV2SetSplitPickTime('zz-c5',1"]`);
const spN = await spIn.count();
n3 = calls.length;
if (spN) { await spIn.first().fill('08:10'); await idle(); await settle(1200); }
const c5Srv = await api('/v1/bookings/' + bk2.c5.id);
const part1 = c5Srv.trips[0].operations.van_parts.find((p) => p.idx === 1);
const spScr = await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-c5'); const o = bkOpsRead(b, '2026-11-11') || {}; return (o.vanSplits || []).map((s) => ({ own: bkSplitOwnPick(s), t: s.pickTime })); });
ok('split time 08:10 -> PATCH trip-ops van_parts[1].pick_time: server part 1 holds 08:10, main part untouched', spN > 0 && callsSince(n3).some((c) => c.startsWith('PATCH /operations/trip-ops/')) && part1 && part1.alt && part1.alt.pick_time === '08:10', { spN, part1, c: callsSince(n3).filter((c) => !c.startsWith('GET')) });
ok('screen: the split part keeps 08:10 and the input shows it after the redraw', spScr[1] && spScr[1].t === '08:10' && (await spIn.first().inputValue()) === '08:10', { spScr, v: spN ? await spIn.first().inputValue() : null });

}
if (want('4')) {
// ════════════ 4. ckStrandClear · moved to another day / cancelled but still in a van ════════════
curItem = '4'; console.log('\n[4] ckStrandClear both paths');
// path 1 · b1 (in van group 1 on DAY) is rescheduled to DAY3 through the app's own reschedule command
await openVanCk(DAY); await settle(500);
await ev((a) => { document.body.insertAdjacentHTML('beforeend',
  '<div id="zz-r"><input id="bkr-from" value="' + a.from + '"><input id="bkr-newdate" value="' + a.to + '"><input id="bkr-reason" value="walk"><input type="radio" name="bkr-charge" value="none" checked><input type="radio" name="bkr-collect" value="invoice" checked></div>');
  bookingV2RescheduleConfirm(a.id); document.getElementById('zz-r').remove(); }, { id: 'zz-b1', from: DAY, to: DAY3 });
await settle(1500); await idle();
const b1srv = await api('/v1/bookings/' + bk.b1.id);
const strandJobs = await api('/operations/van-jobs?date=' + DAY);
ok('reschedule b1 DAY -> DAY3 done on the server', b1srv.trips[0].service_date === DAY3, b1srv.trips[0].service_date);
ok('server: the moved-away trip is held as a strand on DAY (van-jobs struck list)', strandJobs.struck >= 1, strandJobs.struck);
console.log('  note  struck: ' + strandJobs.struck);
await openVanCk(DAY); await settle(1200);
const mvRows = await ev(() => ({ btns: [...document.querySelectorAll('#vancheckin-host .ck-sclr, #vancheckin-host [onclick*="ckStrandClear"]')].length, store: Object.keys(ckStrandStore()), text: /เลื่อนไป/.test(document.querySelector('#vancheckin-host').innerText) }));
ok('Van Check-in on DAY shows the moved-away row of b1 with a clear button (the server still holds the strand)', mvRows.btns > 0, { mvRows });
// another machine (fresh storage) opens the same day: does it see the moved-away row?
{
  const ctx2 = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  await ctx2.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
  await ctx2.route(PROD, routeFn);
  const p2 = await ctx2.newPage();
  p2.on('dialog', (d) => d.accept());
  await p2.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
  await p2.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
  await p2.evaluate((d) => { _vanCkDate = d; const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el); renderVanCheckin(); }, DAY);
  await p2.waitForTimeout(3500);
  const other2 = await p2.evaluate(() => ({ btns: document.querySelectorAll('#vancheckin-host [onclick*="ckStrandClear"]').length, text: /เลื่อนไป/.test(document.querySelector('#vancheckin-host').innerText) }));
  await p2.evaluate((d) => { _vanJobsDate = d; const el = document.querySelector('.nav-item[data-view="vanjobs"]'); if (el) nav(el); renderVanJobs(); }, DAY);
  await p2.waitForTimeout(3500);
  const other3 = await p2.evaluate(() => ({ btns: document.querySelectorAll('#vanjobs-host [onclick*="ckStrandClear"]').length }));
  ok('a second machine (fresh browser storage) also sees the moved-away row of b1 with its clear button on Van Check-in', other2.btns > 0, { vanCheckin: other2, vanJobsButtons: other3.btns, server: 'holds the strand' });
  await ctx2.close();
}
const dlgS = dialogs.length; n3 = calls.length;
await page.locator('#vancheckin-host [onclick*="ckStrandClear"]').first().click();
await idle(); await settle(1200);
const delCall = callsSince(n3).filter((c) => !c.startsWith('GET'));
const jobsAfter = await api('/operations/van-jobs?date=' + DAY);
ok('clear button (moved day): legacy confirm text -> DELETE /operations/van-strands/{booking}/{date} -> row gone on screen', /ล้างรายการค้างของ WALK ONE/.test(dialogs[dlgS] || '') && /ใบนี้ถูกเลื่อนวันไปแล้ว/.test(dialogs[dlgS] || '') && delCall.length === 1 && /^DELETE \/operations\/van-strands\/.+\/2026-11-10 200/.test(delCall[0]) && (await ev(() => document.querySelectorAll('#vancheckin-host [onclick*="ckStrandClear"]').length)) === 0, { d: dialogs.slice(dlgS), delCall });
ok('server: the strand is gone from that day\'s van jobs (struck list empty) and b1 still sits on DAY3', jobsAfter.struck === 0 && (await api('/v1/bookings/' + bk.b1.id)).trips[0].service_date === DAY3, { struck: jobsAfter.struck });
const again = await send('DELETE', `/operations/van-strands/${bk.b1.id}/${DAY}`);
ok('server: a second DELETE of the same strand is 404 (nothing left)', again.status === 404, again);
// path 2 · b3 (alone in group, DAY) is cancelled but stays in its van
await openVanCk(DAY); await settle(500);
await ev((id) => { document.body.insertAdjacentHTML('beforeend',
  '<div id="zz-c"><select id="bkc-cat"><option value="customer_cancel" selected>c</option></select><input id="bkc-reason" value="walk cancel"><input type="radio" name="bkc-charge" value="none" checked></div>');
  bookingV2CancelConfirm(id); document.getElementById('zz-c').remove(); }, 'zz-b3');
await settle(1500); await idle();
const b3srv = await api('/v1/bookings/' + bk.b3.id);
const partsBefore = b3srv.trips[0].operations.van_parts;
ok('b3 cancelled on the server, its van part still in group 2', b3srv.status === 'cancelled' && partsBefore[0].group && partsBefore[0].group.number === 2, { s: b3srv.status, p: partsBefore });
await openVanCk(DAY); await settle(1000);
const sx = await ev(() => ({ btns: [...document.querySelectorAll('#vancheckin-host [onclick*="ckStrandClear"]')].map((b) => b.getAttribute('onclick')) }));
ok('Van Check-in shows the cancelled-but-arranged row with the clear button', sx.btns.some((o) => o.includes('zz-b3')), sx);
const dlgC = dialogs.length; n3 = calls.length;
await page.locator('#vancheckin-host [onclick*="ckStrandClear(\'zz-b3\'"]').first().click();
await idle(); await settle(1500);
const patchCalls = callsSince(n3).filter((c) => !c.startsWith('GET'));
const b3after = await api('/v1/bookings/' + bk.b3.id);
const confirmTxt = dialogs[dlgC] || '';
ok('cancelled path: confirm says only the van arrangement is cleared (booking and cancel history untouched)', /ล้างการจัดรถ\/เรือของ WALK THREE/.test(confirmTxt) && /ตัวใบจองและประวัติการยกเลิกไม่ถูกแตะ/.test(confirmTxt), confirmTxt);
console.log('  note  confirm text: ' + JSON.stringify(confirmTxt));
ok('cancelled path: PATCH trip-ops {van_parts:null} -> server part has no group, booking still cancelled', patchCalls.some((c) => /^PATCH \/operations\/trip-ops\/.+ 200/.test(c)) && b3after.status === 'cancelled' && !b3after.trips[0].operations.van_parts[0].group, { patchCalls, parts: b3after.trips[0].operations.van_parts, st: b3after.status });
ok('cancelled path: the row left the Van Check-in screen', (await ev(() => document.querySelectorAll('#vancheckin-host [onclick*="ckStrandClear(\'zz-b3\'"]').length)) === 0, null);
// the confirm text names only van parts, but the confirm also says "boat": record what the server actually kept
console.log('  note  server kept boat/final pickup/check-in of b3: ' + JSON.stringify({ boat: b3after.trips[0].operations.boat_id, fin: b3after.trips[0].operations.pickup_time_final }));
// vehLog · the van history list comes from the server
await send('PATCH', `/operations/vans/${vanA.id}`, { driver: 'Somchai Walk' });
await ev(() => { const el = document.querySelector('.nav-item[data-view="vehicles"]'); if (el) nav(el); });
await settle(1500); await idle();
await ev((id) => { if (_vehSel === id) _vehSel = null; vehSelect(id); }, vanA.id);
await waitFor((id) => { const v = SB_VEHICLES.find((x) => x.id === id); return v && Array.isArray(v.log) && v.log.some((l) => /Somchai Walk/.test(l.text)); }, vanA.id, 8000);
await settle(800);
const logSrv = (await api(`/operations/vans/${vanA.id}/log`)).log;
const logScr = await ev((id) => SB_VEHICLES.find((x) => x.id === id).log.map((l) => l.text), vanA.id);
const logDom = await ev(() => document.querySelector('#vehicles-host').innerText);
ok('van history on screen = the server log (same lines, oldest first on screen), the new driver line included', logSrv.length >= 2 && JSON.stringify(logScr) === JSON.stringify(logSrv.map((l) => l.text).reverse()) && logScr.some((t) => /Somchai Walk/.test(t)), { logSrv: logSrv.map((l) => l.text), logScr });
ok('the history list is drawn in the Transfer Fleet panel', /Somchai Walk/.test(logDom), logDom.slice(0, 200));
await ev((id) => vehLog(id, 'edit', 'LOCAL ONLY LINE'), vanA.id);
ok('vehLog pushes nothing locally in ops mode', !(await ev((id) => SB_VEHICLES.find((x) => x.id === id).log.some((l) => /LOCAL ONLY/.test(l.text)), vanA.id)));
}
// ════════════ 5. Pier check-in ════════════
curItem = '5'; console.log('\n[5] Pier check-in: payments, fees, no-slip, cot unset, check-in undo');
const openPier = async (date) => {
  await ev((d) => { _pckDate = d; const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); renderPierCheckin(); }, date);
  await waitFor(() => !!document.querySelector('#piercheckin-host'), null, 10000);
  await idle(); await settle(1500);
};
const pierRow = (lead) => ev((l) => { const rows = [...document.querySelectorAll('#piercheckin-host tr')].filter((tr) => tr.innerText.includes(l)); const r = rows[rows.length - 1]; return r ? r.innerText.replace(/\s+/g, ' ') : null; }, lead);
const moneyOf = (id, d) => ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); const M = pckMoney(b, a.d); return { paid: pckPaidSum(b, a.d), fees: pckFeeSum(b, a.d), noSlip: pckNoSlip(b, a.d), cotUnset: pckCotUnset(M), due: M.due, gross: M.gross, term: M.term }; }, { id, d });
await openPier(DAY3);
await ev(() => laOpsPierMoney.loadDay(_pckDate, true)); await settle(600);
let mE1 = await moneyOf('zz-e1', DAY3), srvE1 = await api(`/v1/bookings/${bk3.e1.id}/pier-money?date=${DAY3}`);
ok('before paying: screen due 3000 = server due 3000, term cot', mE1.due === 3000 && srvE1.due === 3000 && mE1.term === 'cot' && srvE1.term === 'cot', { mE1, srv: { due: srvE1.due, term: srvE1.term } });
ok('pckCotUnset true for the cot booking, false for a bank-transfer one', mE1.cotUnset === true && (await moneyOf('zz-c1', DAY2)).cotUnset === false, { e1: mE1.cotUnset });
ok('row without cot amount (e3, term cot, nothing owed) says "COT · ยังไม่ระบุยอด"', /ยังไม่ระบุยอด/.test((await pierRow('WALK E THREE')) || ''), await pierRow('WALK E THREE'));
// pay through the real modal: cash 1000 + transfer 1000 (no slip) + card 1000 at 5%
n3 = calls.length;
await ev(() => pckPayOpen('zz-e1'));
await settle(600);
await page.fill('[data-pck="amt0"]', '1000');
await ev(() => pckLineAdd()); await settle(300);
await page.click('button[onclick="pckLineSetM(1,\'transfer\')"]');
await page.fill('[data-pck="amt1"]', '1000');
await ev(() => pckLineAdd()); await settle(300);
await page.click('button[onclick="pckLineSetM(2,\'card\')"]');
await page.fill('[data-pck="amt2"]', '1000');
await page.click('button[onclick="pckLineSet(2,\'feePct\',5)"]');
await settle(300);
await page.click('button[onclick="pckPaySave()"]');
await idle(); await settle(1500);
mE1 = await moneyOf('zz-e1', DAY3); srvE1 = await api(`/v1/bookings/${bk3.e1.id}/pier-money?date=${DAY3}`);
const payCalls = callsSince(n3).filter((c) => !c.startsWith('GET'));
ok('3 lines -> POST pier-payments: server paid 3000, fees 50 (5% of the card line), no_slip 2, due 0', payCalls.some((c) => c.startsWith('POST') && /pier-payments/.test(c)) && srvE1.paid === 3000 && srvE1.fees === 50 && srvE1.no_slip === 2 && srvE1.due === 0, { srv: { paid: srvE1.paid, fees: srvE1.fees, no_slip: srvE1.no_slip, due: srvE1.due }, payCalls });
ok('screen: pckPaidSum 3000, pckFeeSum 50, pckNoSlip 2 (the server\'s numbers) and due 0', mE1.paid === 3000 && mE1.fees === 50 && mE1.noSlip === 2 && mE1.due === 0, mE1);
const rowTxt = (await pierRow('WALK E ONE')) || '';
ok('row text: "เก็บครบ ฿3,000", split in 3 methods, "รอสลิป 2"', /เก็บครบ ฿3,000/.test(rowTxt) && /แบ่งจ่าย 3 วิธี/.test(rowTxt) && /รอสลิป 2/.test(rowTxt), rowTxt.slice(0, 400));
// the sums are the day's live payments from the server: a payment made by another session shows after a re-read
await send('POST', `/v1/bookings/${bk3.e2.id}/pier-payments`, { service_date: DAY3, version: (await api('/v1/bookings/' + bk3.e2.id)).version, lines: [{ method: 'transfer', amount: 400 }] });
await ev(() => laOpsPierMoney.loadDay(_pckDate, true)); await settle(600);
const mE2 = await moneyOf('zz-e2', DAY3);
ok('another session paid 400 by transfer on e2: after the re-read pckPaidSum 400, pckNoSlip 1, due 1100', mE2.paid === 400 && mE2.noSlip === 1 && mE2.due === 1100, mE2);
// check-in event and its undo ("รับกลับ" is what the Pier Check-in screen draws; ckEventUndo has no button)
const pierCk = async (bid, trip) => ((await api('/v1/bookings/' + bid)).trips.find((t) => t.id === trip).operations.checkins.pier);
const rowHtml = (lead) => ev((l) => { const rows = [...document.querySelectorAll('#piercheckin-host tr')].filter((tr) => tr.innerText.includes(l)); const r = rows[rows.length - 1]; return r ? r.outerHTML : null; }, lead);
const e1Before = await rowHtml('WALK E ONE');
await ev(() => ckToggle('zz-e1', _pckDate, 'pier')); await idle(); await settle(1500);
const e1After = await rowHtml('WALK E ONE');
const e1Ck = await pierCk(bk3.e1.id, bk3.e1.trip);
ok('check-in tick: server holds checked_in_at and the row is redrawn from the server answer (no other action needed)', !!(e1Ck[0] && e1Ck[0].checked_in_at) && e1Before !== e1After, { ck: e1Ck[0] && e1Ck[0].checked_in_at, redrawn: e1Before !== e1After });
n3 = calls.length;
await ev(() => { window.__rp = 0; window.__rpAt = []; const o = window.renderPierCheckin; window.renderPierCheckin = function () { window.__rp++; window.__rpAt.push(Date.now()); return o.apply(this, arguments); }; });
await ev(() => ckEventOpen('zz-e3', _pckDate, 'pier', 'no_show'));
await settle(500);
await ev(() => ckEvPick('no_contact'));
await page.click('button[onclick*="_ckEvBumpK(\'ad\',1)"]'); await page.click('button[onclick*="_ckEvBumpK(\'ad\',1)"]');
await page.fill('#ck-reason-note', 'called 3 times');
await page.click('button[onclick="ckEvSave()"]');
await idle(); await settle(1200);
let ck3 = await pierCk(bk3.e3.id, bk3.e3.trip);
ok('no-show saved: the row is drawn again after the server answer (2 draws: at the click, then at the answer) and shows "ไม่มาทั้งใบ" + the รับกลับ button without any other action', (await ev(() => window.__rp)) >= 2 && /ไม่มาทั้งใบ/.test(await pierRow('WALK E THREE')) && (await page.locator('#piercheckin-host button.pck-undo[onclick*="zz-e3"]').count()) > 0, { renders: await ev(() => window.__rp), row: (await pierRow('WALK E THREE')).slice(-120) });
const ev0 = ck3[0] && ck3[0].events;
ok('no-show event -> PUT trip-ops checkins/pier/0: server holds 1 event, reason no_contact, 2 pax, actual_pax 0', ck3.length === 1 && ev0.length === 1 && ev0[0].type === 'no_show' && ev0[0].reason_code === 'no_contact' && ev0[0].pax === 2 && ck3[0].actual_pax === 0 && !ev0[0].undone, ck3);
ok('screen: ckRead shows the event live and the booked/actual counts', await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-e3'); const c = ckRead(b, _pckDate, 'pier'); return c.events.length === 1 && !c.events[0].undone && c.actualPax === 0; }));
// "รับกลับ" button on the row
n3 = calls.length;
const undoBtn = page.locator('#piercheckin-host button.pck-undo[onclick*="zz-e3"]').first();
const nUndo = await undoBtn.count();
await ev(() => ckToggle('zz-e3', _pckDate, 'pier')); await idle(); await settle(1500);
await ev(() => renderPierCheckin()); await settle(1000);
if (nUndo) { await undoBtn.click(); await settle(500); await page.click('button[onclick="ckBackSave()"]'); await idle(); await settle(1200); }
ck3 = await pierCk(bk3.e3.id, bk3.e3.trip);
ok('"รับกลับ" -> PUT checkins/pier/0: the event is kept and marked undone (found), people given back (actual_pax 2, no_show 0)', nUndo > 0 && ck3[0].events.length === 1 && ck3[0].events[0].undone && ck3[0].events[0].undone.why === 'found' && ck3[0].actual_pax === 2 && ck3[0].no_show === 0, { nUndo, ck: ck3[0] });
ok('screen: same event kept with undone, counts back to 2', await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-e3'); const c = ckRead(b, _pckDate, 'pier'); return c.events.length === 1 && !!c.events[0].undone && c.actualPax === 2; }));
ok('a shorter events list is refused by the server (events_append_only), which is why undo must mark, not remove', (await send('PUT', `/operations/trip-ops/${bk3.e3.trip}/checkins/pier/0`, { expected: 2, actual_pax: 2, events: [] })).status === 409, null);
// ckEventUndo (the older "pop the last event" path): no button calls it on this screen; run by name
await ev(() => ckEventOpen('zz-e3', _pckDate, 'pier', 'no_show'));
await settle(400); await ev(() => ckEvPick('late')); await page.click('button[onclick*="_ckEvBumpK(\'ad\',1)"]'); await page.click('button[onclick*="_ckEvBumpK(\'ad\',1)"]'); await page.click('button[onclick="ckEvSave()"]'); await idle(); await settle(1000);
const callsUndo = ev(() => ckEventUndo('zz-e3', _pckDate, 'pier'));
await callsUndo; await idle(); await settle(1200);
ck3 = await pierCk(bk3.e3.id, bk3.e3.trip);
ok('ckEventUndo called by name: last live event marked undone (mistake), none removed (server keeps 2 events)', ck3[0].events.length === 2 && ck3[0].events[1].undone && ck3[0].events[1].undone.why === 'mistake' && ck3[0].actual_pax === 2, ck3[0]);
ok('ckEventUndo has no button on the screen (UI callers: ' + (await ev(() => document.documentElement.innerHTML.includes('ckEventUndo'))) + ')', !(await ev(() => document.documentElement.innerHTML.includes('ckEventUndo(')))); 

// ════════════ 6. Travel Summary ════════════
curItem = '6'; console.log('\n[6] Travel Summary: trip amount, cash-on-tour decision -> booking page');
await ev((d) => { _tsDate = d; const el = document.querySelector('.nav-item[data-view="travelsum"]'); if (el) nav(el); renderTravelSum(); }, DAY3);
await waitFor(() => !!document.querySelector('[data-ops-ts-view]'), null, 20000);
await idle(); await settle(2000);
const after0 = (await api('/v1/after-trip?date=' + DAY3)).rows;
const aE1 = after0.find((r) => r.booking_id === bk3.e1.id);
console.log('  note  after-trip e1: ' + JSON.stringify({ trip_amount: aE1.trip_amount, cot: aE1.cot && aE1.cot.amount, dec: aE1.cot && aE1.cot.decision }));
// a clean load of the day (a write empties the caches), then the amount checks straight away
await ev((d) => { laOps.wrote('walk'); _tsDate = d; renderTravelSum(); }, DAY3);
await waitFor(() => !!document.querySelector('[data-ops-ts-view]') && !document.body.innerText.includes('Loading Travel Summary'), null, 20000);
await idle();
// the booking in the browser (booking page copy)
const tsAmt = await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-e1'); if (!b) return { err: 'booking not loaded', n: SB_BOOKINGS.length }; const t = b.trips.find((x) => x.date === _tsDate); return { id: b.id, opsId: b.opsId, amt: tsTripAmount(b, t), sub: t.subtotal, total: b.total, cot: b.cashOnTour }; });
ok('tsTripAmount on the booking page = the server\'s trip_amount (' + aE1.trip_amount + ')', tsAmt.amt === aE1.trip_amount, { tsAmt, srv: aE1.trip_amount });
// prove it is the server's number and not the browser formula: wreck what the formula reads, the answer must not move
const wrecked = await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-e1'); const t = b.trips.find((x) => x.date === _tsDate); const s0 = [t.subtotal, b.total]; const pb = b.priceBreakdown ? b.priceBreakdown.total : null; t.subtotal = 1; b.total = 1; if (b.priceBreakdown) b.priceBreakdown.total = 1; const r = tsTripAmount(b, t); t.subtotal = s0[0]; b.total = s0[1]; if (b.priceBreakdown) b.priceBreakdown.total = pb; return r; });
ok('tsTripAmount keeps the server\'s number although the booking\'s own subtotal/total in the browser say 1', wrecked === aE1.trip_amount, { wrecked, srv: aE1.trip_amount });
await ev(() => laOps.wrote('remote:booking'));
const wreckedFn = () => ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-e1'); const t = b.trips.find((x) => x.date === _tsDate); const s0 = [t.subtotal, b.total]; const pb = b.priceBreakdown ? b.priceBreakdown.total : null; t.subtotal = 1; b.total = 1; if (b.priceBreakdown) b.priceBreakdown.total = 1; const r = tsTripAmount(b, t); t.subtotal = s0[0]; b.total = s0[1]; if (b.priceBreakdown) b.priceBreakdown.total = pb; return r; });
const wreckedAfterWrite = await wreckedFn();
console.log('  note  after a remote change (any write) the number is the browser formula again until the Travel Summary of that day is opened: ' + wreckedAfterWrite + ' (server ' + aE1.trip_amount + ')');
const tsRow = await ev((id) => { const b = document.querySelector('[data-ops-ts-view]'); return b ? b.innerText.replace(/\s+/g, ' ').slice(0, 20) : null; }, bk3.e1.id);
// COT decision from the Travel Summary buttons: full deduct
n3 = calls.length;
await ev(() => laOps.wrote('remote:booking'));     // somebody else saved a booking: the change feed empties the caches while this screen stays open
const fullBtn = page.locator(`button[onclick*="cotPick('${bk3.e1.id}','full')"]`).first();
const hasBtn = await fullBtn.count();
if (hasBtn) { await fullBtn.click(); await idle(); await settle(2000); }
const aE1b = ((await api('/v1/after-trip?date=' + DAY3)).rows).find((r) => r.booking_id === bk3.e1.id);
ok('COT "หักทั้งก้อน" -> PUT cot-decisions/{date}: server decision full, deduct 3000, by the login', hasBtn > 0 && callsSince(n3).some((c) => /^PUT \/v1\/bookings\/.+\/cot-decisions\/2026-11-12 200/.test(c)) && aE1b.cot.decision && aE1b.cot.decision.mode === 'full' && aE1b.cot.decision.deduct === 3000, { hasBtn, dec: aE1b.cot.decision, c: callsSince(n3).filter((c) => !c.startsWith('GET')) });
const picked = await ev((id) => { const bt = document.querySelector('button[data-ops-ts-cotmode="full"][onclick*="' + id + '"]'); return bt ? bt.className : null; }, bk3.e1.id);
ok('screen: the "หักทั้งก้อน" button of that row is the picked one', /pick/.test(picked || ''), picked);
const cotOf = await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-e1'); const c = bookingV2CotOf(b); return { amt: c.amt, use: c.use, deduct: c.deduct, mode: c.mode, settled: !!c.settled }; });
ok('booking page: bookingV2CotOf(booking) shows the decision made on the Travel Summary (deduct 3000, mode full)', cotOf.settled && cotOf.deduct === 3000 && cotOf.mode === 'full', cotOf);

// ════════════ 7. total_locked message · 409 cancelled on a cancelled booking's edits ════════════
curItem = '7'; console.log('\n[7] pier office item total locked · cancelled booking edits');
const itemsSrv0 = (await api('/v1/pier-office?pier=tublamu')).items;
const itemId = itemsSrv0[0].id, total0 = itemsSrv0[0].total;
console.log('  note  item ' + itemId + ' total ' + total0);
await ev(() => { window._poPier = 'tublamu'; const el = document.querySelector('.nav-item[data-view="pieroffice"]'); if (el) nav(el); });
await settle(2500); await idle();
await ev(() => { _poPier = 'tublamu'; renderPierOffice(); });
await settle(2500); await idle();
const hasItem = await waitFor((id) => (window.PIER_ITEMS || []).some((i) => i.id === id), itemId, 15000);
ok('the item made on the server is on the Pier Office screen (PIER_ITEMS)', hasItem, await ev(() => (window.PIER_ITEMS || []).map((i) => i.id)));
await ev(() => poItemsOpen());
await settle(600);
const inputThere = await page.locator('#poitt_' + itemId).count();
ok('before any move the starting stock is an editable box', inputThere === 1, inputThere);
// another machine receives stock: the item now has a move on the server, this browser has not heard
const rec = await send('POST', '/v1/pier-office/tublamu/stock/receive', { date: DAY3, source: 'buy', lines: [{ item_id: itemId, qty: 5 }] });
ok('other machine received 5 (server move recorded)', rec.status === 201, rec);
await page.fill('#poitt_' + itemId, '20');
n3 = calls.length; const rl = refusals.length;
await page.click('button[onclick="poItemsSave()"]');
await idle(); await settle(1500);
const patchRef = refusals.slice(rl).filter((r) => /pier-office\/items/.test(r));
const itemSrv = ((await api('/v1/pier-office?pier=tublamu')).items || []).find((i) => i.id === itemId);
const toastTxt = await ev(() => document.body.innerText);
ok('save -> PATCH pier-office/items/{id} answered 409 total_locked', patchRef.length === 1 && /409/.test(patchRef[0]) && /total_locked/.test(patchRef[0]), patchRef);
ok('server total unchanged (' + total0 + ')', itemSrv && itemSrv.total === total0, itemSrv);
const srvMsg = (() => { try { return JSON.parse(patchRef[0].replace(/^[^{]*/, '')).message; } catch (_) { return null; } })();
console.log('  note  server message: ' + JSON.stringify(srvMsg));
ok('the refusal message is shown to the user (toast carries the server\'s words)', srvMsg && toastTxt.includes(srvMsg.slice(0, 40)), { srvMsg, toast: toastTxt.slice(-300) });
ok('screen: PIER_ITEMS total put back to ' + total0, (await ev((id) => (PIER_ITEMS.find((i) => i.id === id) || {}).total, itemId)) === total0, await ev((id) => (PIER_ITEMS.find((i) => i.id === id) || {}).total, itemId));
// cancelled booking: pickup time and pier note refused with 409 cancelled, the server's message shown
await ev((d) => bookingV2OpsEnsureDay(d), DAY2); await settle(2000);
await ev((id) => { document.body.insertAdjacentHTML('beforeend',
  '<div id="zz-c"><select id="bkc-cat"><option value="customer_cancel" selected>c</option></select><input id="bkc-reason" value="walk cancel"><input type="radio" name="bkc-charge" value="none" checked></div>');
  bookingV2CancelConfirm(id); document.getElementById('zz-c').remove(); }, 'zz-c4');
await settle(1500); await idle();
const c4srv = await api('/v1/bookings/' + bk2.c4.id);
ok('c4 cancelled on the server', c4srv.status === 'cancelled', c4srv.status);
// the By-trip row of a cancelled booking: is there a pickup box?
await showBytrip(DAY2).catch(() => {}); 
const pickIn = page.locator(`#view-booking input[oninput*="bookingV2SetPickupFinal('zz-c4'"]`);
const nPick = await pickIn.count();
let rl7 = refusals.length;
if (nPick) { await pickIn.first().fill('07:05'); await idle(); await settle(1200); } else { await ev((d) => bookingV2SetPickupFinal('zz-c4', '07:05', d), DAY2); await idle(); await settle(1200); }
let ref7 = refusals.slice(rl7).filter((r) => /trip-ops/.test(r));
let msg7 = (() => { try { return JSON.parse(ref7[0].replace(/^[^{]*/, '')).message; } catch (_) { return null; } })();
let txt7 = await ev(() => document.body.innerText);
ok('pickup time on a cancelled booking (' + (nPick ? 'typed in the By-trip row' : 'no box on the row, called by name') + ') -> PATCH trip-ops 409 cancelled, server message shown', ref7.length === 1 && /409/.test(ref7[0]) && /cancelled/.test(ref7[0]) && msg7 && txt7.includes(msg7.slice(0, 30)), { ref7, msg7 });
const c4trip = (await api('/v1/bookings/' + bk2.c4.id)).trips[0].operations;
ok('server: no pickup time stored; screen row keeps no time either', c4trip.pickup_time_final === null && !(await ev((d) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-c4'); return (bkOpsRead(b, d) || {}).pickupTimeFinal; }, DAY2)), { c4trip: c4trip.pickup_time_final });
rl7 = refusals.length;
await ev((d) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-c4'); pckNoteSet(b, d, 'late guest'); }, DAY2);
await idle(); await settle(1200);
ref7 = refusals.slice(rl7).filter((r) => /trip-ops/.test(r));
msg7 = (() => { try { return JSON.parse(ref7[0].replace(/^[^{]*/, '')).message; } catch (_) { return null; } })();
txt7 = await ev(() => document.body.innerText);
ok('pier note on a cancelled booking -> PATCH trip-ops 409 cancelled, server message shown ("Pier note not saved")', ref7.length === 1 && /409/.test(ref7[0]) && msg7 && txt7.includes(msg7.slice(0, 30)) && /Pier note not saved/.test(txt7), { ref7, msg7 });
const c4note = (await api('/v1/bookings/' + bk2.c4.id)).trips[0].operations.pier_note;
ok('server: no pier note stored; no history line "โน้ตหน้างาน" added on the screen', c4note === null && !(await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-c4'); return (b.history || []).some((h) => /โน้ตหน้างาน/.test(h.text || h.note || JSON.stringify(h))); })), { c4note });
console.log('  note  message: ' + JSON.stringify(msg7));
process.exit(fails.length ? 1 : 0);
