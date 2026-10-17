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
curItem = '3'; console.log('\n[3] van groups (By-trip · Van mode)');
const showBytrip = async (date) => {
  await ev((d) => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; _bkV2.vanAssignMode = true; _bkV2.detailId = null; _bkV2.newBooking = null; _bkV2.filterRoute = null; const el = document.querySelector('.nav-item[data-view="booking"]'); if (el) nav(el); bookingV2Render(); }, date);
  await waitFor((d) => SB_BOOKINGS.filter((b) => b.trips.some((t) => t.date === d)).length >= 4, date, 15000);
  await idle(); await settle(1200);
};
const grpsOf = async (date) => (await api(`/operations/van-groups?service_date=${date}&route_id=r5`)).groups;
const scr = (id, date) => ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); if (!b) return null; const o = bkOpsRead(b, a.date) || {}; return { grp: +o.vanGroup || 0, van: o.vanId || '', ret: o.vanReturnId || '', seq: +o.vanSeq || 0, fin: o.pickupTimeFinal || '' }; }, { id, date });
const tick = async (id) => { await page.locator(`#view-booking span[onclick*="bookingV2VanSelToggle('${id}')"]`).first().click(); await settle(300); };
const toasts = () => ev(() => [...document.querySelectorAll('[class*="toast"], .la-toast, .ops-toast')].map((t) => t.innerText.replace(/\s+/g, ' ').slice(0, 160)));
await showBytrip(DAY2);
// A · group c1 + c2 from the ticked rows
await tick('zz-c1'); await tick('zz-c2');
let n3 = calls.length;
await page.locator('#view-booking button[onclick*="bookingV2VanGroupSelected"][onclick*="\'new\'"]').click();
await idle(); await settle(1000);
let G = await grpsOf(DAY2);
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
process.exit(0);
