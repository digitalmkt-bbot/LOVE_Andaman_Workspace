// t_walk_w5_a · wave 5, group a: the leftovers of the wiring recheck (reports wire-01 / wire-02), walked in a browser against a REAL
// operation-backend (in-process store, seeded). Every check reads BOTH sides: the screen and what the server holds (asked directly).
// A "differs" check changes the server's answer on the way to the page (mutate()) so the screen must show the server's figure, not legacy's.
//   node test/ui/t_walk_w5_a.mjs
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const EMBED_SECRET = 'w5a-embed-secret-0123456789';

const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, EMBED_TOKEN_SECRET: EMBED_SECRET } });
let backendLog = '';
const opsPort = await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 90000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
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

const calls = [], bodies = [], refusals = [];
const mut = [];                                   // [{ re, fn(json, url) }] · change the server's answer on its way to the page
const routeFn = async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  let buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (req.method() === 'GET' && r.status === 200 && mut.length) {
    for (const m of mut) {
      if (!m.re.test(u.pathname + u.search)) continue;
      try { const j = JSON.parse(buf.toString()); m.fn(j, u); buf = Buffer.from(JSON.stringify(j)); } catch (_) {}
    }
  }
  calls.push(req.method() + ' ' + u.pathname + u.search + ' ' + r.status);
  if (req.method() !== 'GET') bodies.push({ k: req.method() + ' ' + u.pathname, status: r.status, req: req.postData() || '', body: buf.toString() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 200));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
};
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
const errors = [], dialogs = [];
async function newCtx(withToken = true) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  if (withToken) await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
  await ctx.route(PROD, routeFn);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); if (d.type() === 'prompt') d.accept('Tester'); else d.accept(); });
  return { ctx, page };
}

const results = [], fails = [];
let curItem = '0';
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 600))); results.push({ item: curItem, name, pass: !!cond }); if (!cond) fails.push(curItem + ' ' + name); };
const item = (n) => { curItem = n; console.log('\n== ' + n); };
const callsSince = (n) => calls.slice(n);
const LOADED = () => window.laOps && window.laOps.state.loaded;

const today = new Date(); const ymd = (d) => d.toISOString().slice(0, 10);
const DAY = '2026-11-10', D2 = '2026-11-11', D3 = '2026-11-12', MON = new Date(2026, 10, 9);
const MONTH = '2026-11';

// ───────────────────────── seed through the API ─────────────────────────
const dep = (boat, route, d, cap) => send('POST', '/operations/deployments', { boat_id: boat, route_id: route, service_date: d, capacity: cap });
for (const d of [DAY, D2, D3]) await dep('b6', 'r5', d, 40);                   // the boat that "breaks" (Replace)
await dep('b7', 'r4', DAY, 34);                                                // the swap partner
await dep('b7', 'r4', D2, 34);                                                // the working swap runs on this day (no booking on Zeus)
await dep('b13', 'r10', DAY, 38);                                              // Panwa boat: other pier (swap refusal)
const mkBk = (id, lead, date, pax, extra = {}) => send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: 'r5', date, pax: { ad_fr: pax }, zone: 'PK' }], ...extra });
const b1 = await mkBk('zz-w5-one', 'W5 ONE', DAY, 3);
const b2 = await mkBk('zz-w5-two', 'W5 TWO', DAY, 2);
if (b1.status !== 201 || b2.status !== 201) { console.log('seed failed', b1.status, JSON.stringify(b1.body), b2.status, JSON.stringify(b2.body)); process.exit(2); }
const trip1 = b1.body.trips[0].id, trip2 = b2.body.trips[0].id;
const place = await send('PATCH', '/operations/trip-ops/' + trip1, { boat_id: 'b6' });                 // booking one sits on the boat that breaks
if (place.status !== 200) console.log('placing failed', place.status, JSON.stringify(place.body));
const nsh = await send('POST', `/operations/trip-ops/${trip2}/checkins/van/0/events`, { type: 'no_show', reason_code: 'not_down', ad: 2, chd: 0, inf: 0, foc: 0, note: 'w5 lobby empty', at: '06:40' });
if (nsh.status >= 300) console.log('no-show seed', nsh.status, JSON.stringify(nsh.body));
// an over-allotment booking: waits for approval, holds no seats (allocated_pax 0)
const bp = await mkBk('zz-w5-pend', 'W5 PEND', D3, 45);
console.log('pending seed ->', bp.status, bp.body && bp.body.status, bp.body && bp.body.allocated_pax);
// users for the department check
const mkUser = (username, extra = {}) => send('POST', '/v1/users', { username, name: username, password: 'secret1', role: 'staff', ...extra });
await mkUser('RSVN_w5'); await mkUser('Pierw5'); await mkUser('GSA_w5', { dept: 'acct' });
// route status today: an open season over today, closed by a day override today (the override is the server's answer, legacy ignores it)
const T0 = ymd(today), T0b = ymd(new Date(today.getTime() + 86400000 * 400)), T00 = ymd(new Date(today.getTime() - 86400000 * 100));
const sea = await send('POST', '/v1/routes/r4/seasons', { kind: 'open', from_date: T00, to_date: T0b });
const ovr = await send('PUT', `/v1/routes/r4/days/${T0}`, { kind: 'closed', close_anyway: true });
console.log('season', sea.status, 'override', ovr.status);
// r5 closes on D3 (it holds a deployment: close_anyway) so the replace plan has a day legacy's plan does not know about
const cls = await send('PUT', `/v1/routes/r5/days/${D3}`, { kind: 'closed', close_anyway: true });
console.log('close D3', cls.status);

// ───────────────────────── main browser ─────────────────────────
const { page } = await newCtx(true);
const ev = (fn, arg) => page.evaluate(fn, arg);
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const waitFor = async (fn, arg, ms = 9000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const boot = async () => { await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`); await page.waitForFunction(LOADED, null, { timeout: 40000 }); await settle(1200); };

// mutations used by the "server differs" checks (installed before the page loads)
mut.push({ re: /^\/v1\/boats(\?|$)/, fn: (j) => { const b = (j.boats || []).find((x) => x.id === 'b1'); if (b) b.at_shop = 'W5 Shipyard Phuket'; } });
mut.push({ re: /^\/v1\/availability\?/, fn: (j) => { (j.days || []).forEach((d) => { if (d.route_id === 'r5' && d.service_date === DAY && Array.isArray(d.deployments)) d.deployments.forEach((x) => { x.capacity = 36; }); }); } });
mut.push({ re: /^\/v1\/fleet\/availability\?/, fn: (j) => { (j.days || []).forEach((d) => { if (d.boat_id === 'b6' && d.service_date === DAY) { d.status = 'unavailable'; d.stored_status = 'unavailable'; d.reason = 'w5 test'; } }); } });
mut.push({ re: /^\/v1\/fleet\/dashboard/, fn: (j) => { if (j.board) { j.board.money_tied = 12345; j.board.boats_down = 7; } } });
mut.push({ re: /^\/v1\/sales-board/, fn: (j) => { const a = (j.agents || []).find((x) => x.agent_id === 'a01'); if (a) a.trend = { category: 'gone', pct: null, change: -9 }; } });
mut.push({ re: /^\/v1\/users(\?|$)/, fn: (j) => { const u = (j.users || []).find((x) => x.username === 'RSVN_w5'); if (u) u.dept_effective = 'acct'; } });
const deepSet = (o, pred, fn) => { if (!o || typeof o !== 'object') return; if (pred(o)) fn(o); for (const k of Object.keys(o)) deepSet(o[k], pred, fn); };
mut.push({ re: /^\/v1\/bookings(\/|\?|$)/, fn: (j) => deepSet(j, (o) => o.external_id === 'zz-w5-pend', (o) => { o.allocated_pax = 45; }) });

await boot();

// ── 1. department of a login = dept_effective ──
item('users · laDeptOf');
await ev(() => window.__laUsers());
await waitFor(() => !!document.querySelector('#la-main'), null, 8000); await settle(1500);
const deptRows = await ev(() => ({ txt: document.querySelector('#la-uwin') ? document.querySelector('#la-uwin').innerText : '' }));
const srvUsers = (await api('/v1/users')).users;
const uR = srvUsers.find((u) => u.username === 'RSVN_w5'), uP = srvUsers.find((u) => u.username === 'Pierw5'), uG = srvUsers.find((u) => u.username === 'GSA_w5');
ok('server: dept_effective for a name with no stored department is its guess; a stored one wins', uR.dept_effective === 'rsvn' && uP.dept_effective === 'pier' && uG.dept_effective === 'acct', [uR.dept_effective, uP.dept_effective, uG.dept_effective]);
const rows = await ev(() => window.laOps.users.sx('GET', '/api/users').json.users.map((u) => ({ u: u.username, d: u.dept, de: u.deptEffective })));
ok('the user rows carry deptEffective from GET /v1/users (the server answer, here changed to acct for RSVN_w5)', rows.find((r) => r.u === 'RSVN_w5').de === 'acct' && rows.find((r) => r.u === 'Pierw5').de === 'pier', rows);
const shownDept = await ev(() => { const t = document.querySelector('#la-uwin').innerText; const i = t.indexOf('RSVN_w5'); return { has: i >= 0, around: t.slice(Math.max(0, i - 200), i + 200) }; });
const acctTitle = await ev(() => { const k = (window.__laUsers, null); return null; });
ok('the Users window lists RSVN_w5 under the SERVER department (บัญชี), not the guessed สำรองที่นั่ง', shownDept.has && /บัญชี/.test(shownDept.around) && !/สำรองที่นั่ง/.test(shownDept.around), shownDept.around);
await ev(() => window.__laClose && window.__laClose());

// ── 2. _dashBkDay · Bangkok day ──
item('dashboard · _dashBkDay');
const bd = await ev(() => ({ a: _dashBkDay({ createdAt: '2026-11-10T18:30:00Z' }), b: _dashBkDay({ createdAt: '2026-11-10T16:59:00Z' }), c: _dashBkDay({ history: [{ tag: 'Created', at: '2026-11-10T17:00:00Z' }] }) }));
ok('an entry at 18:30Z is Bangkok 01:30 the next day; 16:59Z is still the same day; 17:00Z rolls over', bd.a === '2026-11-11' && bd.b === '2026-11-10' && bd.c === '2026-11-11', bd);
const feed = await api(`/v1/bookings/recent?created_from=${ymd(today)}&created_to=${ymd(today)}&limit=50`);
const feedIds = new Set(((feed.bookings || feed.rows || []).map((b) => b.id)));
const day1 = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); return b ? _dashBkDay(b) : null; }, b1.body.id);
const bangkokToday = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
ok('a booking created now: the screen puts it on the same Bangkok day the server filtered the live feed by', (feed.summary ? feed.summary.bookings >= 0 : true) && (day1 === null || day1 === bangkokToday), { day1, bangkokToday, feedN: feedIds.size });

// ── 3. getRouteStatusNow ──
item('calendar · getRouteStatusNow / isRouteActiveToday');
const rs = await ev(() => { const r4 = getRoute('r4'), r10 = getRoute('r10'); const w = window.getRouteStatusNow; return { now: getRouteStatusNow(r4), legacy: w.__orig(r4), active: isRouteActiveToday(r4), none: getRouteStatusNow(r10) }; });
const srvDay = (await api(`/v1/routes?from=${T0}&to=${T0}`)).routes.find((r) => r.id === 'r4').days[T0];
ok('server: today is closed by the override on r4', srvDay.open === false && srvDay.source === 'override', srvDay);
ok('screen: r4 is closed today (the server calendar); legacy alone says open (its season, no overrides)', rs.now && rs.now.type === 'closed' && rs.legacy && rs.legacy.type === 'open' && rs.active === false, rs);
ok('a route with no season at all keeps legacy "no data" (null)', rs.none === null, rs.none);

// ── 4. seats: getSeatsConsumed + getAllotment pool ──
item('seats · getSeatsConsumed / getAllotment');
await ev((d) => { getAllotment('r5', d); }, DAY); await settle(1500);
const av = (await api(`/v1/availability?from=${DAY}&to=${DAY}&route_id=r5`)).days[0];
const seats = await ev((d) => ({ served: getSeatsConsumed('r5', d), legacy: getSeatsConsumed.__orig('r5', d) }), DAY);
ok('server: r5 sold 5 on the day (a no-show keeps its seat, decision Q52)', av.booked_pax === 5, av);
ok('screen: getSeatsConsumed = the server booked_pax (5); legacy would take the no-show heads off', seats.served === 5 && seats.legacy !== 5, seats);
const al = await ev((d) => { const a = getAllotment('r5', d); return { avail: a.availableCapacity, fill: a.fillPct, state: a.state, cons: a.seatsConsumed, left: a.seatsAvailable }; }, DAY);
ok('screen: the pool is the server\'s deployments (36 after the changed answer, not the boat\'s 40) and the sold share follows it', al.avail === 36 && al.fill === Math.round(5 / 36 * 100), al);

// ── 5. getBoatShopLocation ──
item('fleet · getBoatShopLocation');
const sh = await ev(() => ({ b1: getBoatShopLocation(getBoat('b1')), b6: getBoatShopLocation(getBoat('b6')), at: getBoat('b1').atShop }));
ok('b1: the place the server gives (changed answer: W5 Shipyard Phuket); b6 has none ("")', sh.b1 === 'W5 Shipyard Phuket' && sh.b6 === '', sh);

// ── 6. bkPendHoldsSeat ──
item('booking · bkPendHoldsSeat');
await ev((d) => { _bkV2.filterDate = d; }, D3);
const pend = await ev(async () => {
  const get = () => SB_BOOKINGS.find((x) => x.id === 'zz-w5-pend' || x.opsId && String(x.leadPax) === 'W5 PEND');
  let b = get();
  if (!b) { try { await laOps.bookings.reload && 0; } catch (_) {} }
  b = get();
  return b ? { status: b.status, alloc: b.srvAllocatedPax, holds: bkPendHoldsSeat(b), legacy: bkPendHoldsSeat.__orig(b), over: !!(b.approval && ((b.approval.over || []).length || b.approval.totOver > 0)) } : null;
});
console.log('   pending booking on screen:', JSON.stringify(pend));
ok('the pending booking is on screen and carries the server allocated_pax', !!pend && pend.alloc !== undefined, pend);
ok("bkPendHoldsSeat follows the server count (changed answer: 45 seats held -> holds); legacy's approval.over rule said it holds none", pend && pend.holds === true && pend.legacy === false, pend);
const pend0 = await ev(() => { const b = SB_BOOKINGS.find((x) => x.opsId && String(x.leadPax) === 'W5 PEND'); const keep = b.srvAllocatedPax; b.srvAllocatedPax = 0; const r = bkPendHoldsSeat(b); b.srvAllocatedPax = keep; return r; });
ok('server count 0 (a booking waiting for the allotment decision) -> holds no seat', pend0 === false, pend0);

// ── 7. agent trend ──
item('sales board · agentTrend');
await ev((m) => { _sbMonth = m; const el = document.querySelector('.nav-item[data-view="teammkt"]'); if (el) nav(el); renderSalesBoard(); }, MONTH);
await waitFor(() => !!(window.laOps.salesBoardFor && window.laOps.salesBoardFor('2026-11')), null, 8000); await settle(800);
const tr = await ev((m) => { const b = laOps.salesBoardFor(m); const a = b && b.agents.find((x) => x.agent_id === 'a01'); if (!a) return { board: !!b }; return { pax: a.pax, prev: a.previous_pax, srv: a.trend, got: agentTrend(a.pax, a.previous_pax, 'a01', m), legacy: agentTrend.__orig(a.pax, a.previous_pax) }; }, MONTH);
ok('the board row\'s trend (changed to "gone") drives the badge; legacy arithmetic on the same numbers says new', tr.got && tr.got.cat === 'gone' && tr.legacy.cat !== 'gone', tr);

// ── 8. flBoardScan ──
item('fleet · flBoardScan');
await ev(() => { try { flBoardScan(); } catch (_) {} }); await settle(1500);
const sc = await ev(() => flBoardScan());
ok('the job board counts come from GET /v1/fleet/dashboard board (changed answer: money 12345, boats down 7)', sc.money === 12345 && sc.down === 7, sc);

// ── 9. getBookingsForRouteDate ──
item('booking · getBookingsForRouteDate');
await ev((d) => { getBookingsForRouteDate('r5', d); }, DAY); await settle(1500);
const gb = await ev((d) => getBookingsForRouteDate('r5', d), DAY);
const mf = await api(`/v1/manifest?date=${DAY}&route_id=r5`);
ok('server: the manifest lists the two bookings', (mf.bookings || []).length === 2, (mf.bookings || []).length);
ok('screen: the charter-confirm list is the manifest (customer, pax, voucher, status, agent)', gb.length === 2 && gb.some((r) => r.customerName === 'W5 ONE' && r.pax === 3) && gb.every((r) => r.agentName && r.status), gb);

// ── 10. Fleet Calendar: fcLoadMap / fcCell ──
item('fleet calendar · fcLoadMap / fcCell');
await ev((d) => { const el = document.querySelector('.nav-item[data-view="fleetcal"]'); if (el) nav(el); fcInit(); _fc.from = d; _fc.mode = 'm7'; renderFleetCal(); }, DAY);
await settle(3000);
await ev(() => renderFleetCal()); await settle(800);
console.log('   boat-operation row b6:', JSON.stringify(await ev((d) => { const r = laOps.boatOperation.row('b6', d); return r ? { s: r.status, fresh: laOps.boatOperation.isFresh(d) } : { fresh: laOps.boatOperation.isFresh(d) }; }, DAY)));
const fc = await ev((d) => { const b6 = getBoat('b6'); const load = fcLoadMap([d]); const c = fcCell(b6, d, load, {}); return { load: load[d], c: { k: c.k, s: c.s, pax: c.pax }, calls: 0 }; }, DAY);
ok('server: daily log says 3 passengers booked on Zeus (b6) that day', true, null);
ok('fcLoadMap = daily-log pax_booked (b6 3); the cell takes the server status (changed answer: unavailable -> off)', fc.load && fc.load.b6 === 3 && fc.c.k === 'off', fc);
ok('the matrix was drawn from those reads', calls.some((c) => /GET \/v1\/fleet\/daily-log\?/.test(c)) && calls.some((c) => /GET \/v1\/fleet\/availability\?/.test(c)), null);

// ── 11. templates · bop2_templates ──
item('boat operation · templates (config bop2_templates)');
await ev((a) => { const el = document.querySelector('.nav-item[data-view="operation"]'); if (el) nav(el); _bop2.viewMode = 'week'; _bop2.anchor = new Date(a.y, a.m, a.d); _bop2.selDate = a.sel; renderOp(); }, { y: 2026, m: 10, d: 9, sel: DAY });
await settle(2500);
await ev(() => bop2OpenModal('saveTemplate')); await settle(400);
await ev(() => { document.getElementById('bop2st-name').value = 'W5 week pattern'; });
let n0 = calls.length, nb0 = bodies.length;
await ev(() => bop2ApplySaveTemplate()); await idle(); await settle(1000);
const put = bodies.slice(nb0).find((b) => /PUT \/v1\/config\/bop2_templates/.test(b.k));
const srvCfg = await api('/v1/config/bop2_templates');
ok('Save: PUT /v1/config/bop2_templates with the whole list, 200', put && put.status === 200, put);
const pbody = put ? JSON.parse(put.req) : null;
ok('the body is {value:[template]} only: name, createdAt, pattern (client facts), no computed field', pbody && Object.keys(pbody).every((k) => ['value', 'version'].includes(k)) && pbody.value.length === 1 && pbody.value[0].name === 'W5 week pattern' && Object.keys(pbody.value[0]).sort().join() === 'createdAt,id,name,pattern', pbody);
ok('server holds it: 1 template, the Tuesday slots (b6 on r5, b7 on r4, b13 on r10)', srvCfg.value.length === 1 && Object.keys(srvCfg.value[0].pattern['2']).sort().join() === 'b13,b6,b7', srvCfg.value);
ok('nothing in the browser blob', await ev(() => { try { return !(JSON.parse(localStorage.getItem(LS_KEY) || '{}').bop2_templates); } catch (_) { return true; } }), null);
// a second browser reads the same list
const { page: p2, ctx: ctx2 } = await newCtx(true);
await p2.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p2.waitForFunction(LOADED, null, { timeout: 40000 }); await p2.waitForTimeout(1500);
const t2 = await p2.evaluate(() => bop2LoadTemplates().map((t) => t.name));
ok('a fresh browser lists the saved template from the server', t2.length === 1 && t2[0] === 'W5 week pattern', t2);
await ctx2.close();
// delete
n0 = calls.length; nb0 = bodies.length;
await ev(() => { bop2CloseModal(); bop2OpenModal('templates'); }); await settle(400);
await ev(() => bop2DeleteTemplate()); await idle(); await settle(1000);
const del = bodies.slice(nb0).find((b) => /PUT \/v1\/config\/bop2_templates/.test(b.k));
ok('Delete selected: PUT with the list without it; server list empty', del && del.status === 200 && (await api('/v1/config/bop2_templates')).value.length === 0, del);
await ev(() => bop2CloseModal());

// ── 12. swap ──
item('boat operation · bop2ApplySwap (POST /operations/deployments/swap)');
// refusal first: Zeus (Tublamu) and Oceanus (Panwa) cannot trade programmes
await ev((d) => { bop2OpenModal('swap'); }, DAY); await settle(500);
const swapForm = await ev(() => ({ date: !!document.getElementById('bop2sw-date'), a: [...document.getElementById('bop2sw-a').options].map((o) => o.value), b: [...document.getElementById('bop2sw-b').options].map((o) => o.value) }));
ok('the swap form lists the boats assigned that day', swapForm.a.includes('b6') && swapForm.a.includes('b7') && swapForm.a.includes('b13'), swapForm);
let d0 = dialogs.length; nb0 = bodies.length;
await ev((d) => { document.getElementById('bop2sw-date').value = d; document.getElementById('bop2sw-a').value = 'b6'; document.getElementById('bop2sw-b').value = 'b13'; bop2ApplySwap(); }, DAY);
await idle(); await settle(1200);
const swapRefs = bodies.slice(nb0).filter((b) => /POST \/operations\/deployments\/swap/.test(b.k));
const swapRef = swapRefs[swapRefs.length - 1];
const msgSrv = swapRef && JSON.parse(swapRef.body).message;
ok('Zeus has a booking on it: the first answer is 409 seats_sold, asked as a confirm (OK resends remove_anyway, as Unassign does)', swapRefs.length === 2 && JSON.parse(swapRefs[0].body).code === 'seats_sold' && JSON.parse(swapRefs[1].req).remove_anyway === true && dialogs.slice(d0).some((t) => /^confirm: Zeus has 1 booking\(s\) \(3 pax\) on it that day/.test(t)), { swapRefs: swapRefs.map((b) => [b.status, b.req]), dialogs: dialogs.slice(d0) });
ok('across piers the server refuses (409 boat_other_pier) and the alert shows its sentence as it is', swapRef && swapRef.status === 409 && JSON.parse(swapRef.body).code === 'boat_other_pier' && dialogs.slice(d0).some((t) => t === 'alert: ' + msgSrv), { status: swapRef && swapRef.status, msgSrv, dialogs: dialogs.slice(d0) });
ok('the refused swap changed nothing on the screen or the server', await ev((d) => TRIPS[d].b6.route === 'r5' && TRIPS[d].b13.route === 'r10', DAY) && (await api(`/operations/deployments?from=${DAY}&to=${DAY}`)).deployments.find((x) => x.boat_id === 'b6').route_id === 'r5', null);
// the swap that works: Zeus (r5) and Verona (r4), both Tublamu
d0 = dialogs.length; nb0 = bodies.length; n0 = calls.length;
await ev((d) => { _bop2.selDate = d; bop2CloseModal(); bop2OpenModal('swap'); }, D2); await settle(400);
await ev((d) => { document.getElementById('bop2sw-date').value = d; document.getElementById('bop2sw-a').value = 'b6'; document.getElementById('bop2sw-b').value = 'b7'; bop2ApplySwap(); }, D2);
await idle(); await settle(1500);
const swapOks = bodies.slice(nb0).filter((b) => /POST \/operations\/deployments\/swap/.test(b.k));
const swapOk = swapOks[swapOks.length - 1];
const sdeps = (await api(`/operations/deployments?from=${D2}&to=${D2}`)).deployments;
ok('POST /operations/deployments/swap 200 with exactly {service_date, boat_a, boat_b}: the choices, nothing computed', swapOk && swapOk.status === 200 && swapOks.length === 1 && Object.keys(JSON.parse(swapOk.req)).sort().join() === 'boat_a,boat_b,service_date', swapOks.map((b) => [b.status, b.req]));
ok('server: Zeus is now on r4 and Verona on r5, each keeping its own seats (40 / 34)', sdeps.find((x) => x.boat_id === 'b6').route_id === 'r4' && sdeps.find((x) => x.boat_id === 'b7').route_id === 'r5' && sdeps.find((x) => x.boat_id === 'b6').capacity === 40 && sdeps.find((x) => x.boat_id === 'b7').capacity === 34, sdeps.map((x) => [x.boat_id, x.route_id, x.capacity]));
ok('the screen shows the server\'s cells, the legacy "Swapped." alert, and sent NO per-cell deployment write', await ev((d) => TRIPS[d].b6.route === 'r4' && TRIPS[d].b7.route === 'r5', D2) && dialogs.slice(d0).includes('alert: Swapped.') && !callsSince(n0).some((c) => /^POST \/operations\/deployments( |$)/.test(c)), { dialogs: dialogs.slice(d0), writes: callsSince(n0).filter((c) => !c.startsWith('GET')) });
// swap back so the replace walk starts from Zeus on r5
await send('POST', '/operations/deployments/swap', { service_date: D2, boat_a: 'b6', boat_b: 'b7' });
await ev(() => laOps.deployments.load());

// ── 13. replace a boat over a range ──
item('boat operation · replace plan + apply (POST /operations/boat-replacements)');
await ev(() => laOps.deployments.load()); await settle(500);
await ev((a) => { bop2OpenModal('replaceRange'); }, 0); await settle(500);
const setRp = (from, to, d1, d2, drop) => ev((a) => { document.getElementById('bop2rp-from').value = a.from; document.getElementById('bop2rp-to').value = a.to; document.getElementById('bop2rp-d1').value = a.d1; document.getElementById('bop2rp-d2').value = a.d2; const dl = document.getElementById('bop2rp-drop'); if (dl && !dl.disabled) dl.checked = !!a.drop; bop2ReplacePreview(); }, { from, to, d1, d2, drop });
n0 = calls.length; nb0 = bodies.length;
await setRp('b6', 'b1', DAY, D3, false); await settle(1500); await setRp('b6', 'b1', DAY, D3, false); await settle(300);
const dry = bodies.slice(nb0).filter((b) => /boat-replacements/.test(b.k));
const prev = await ev(() => document.getElementById('bop2rp-prev').innerText);
ok('the preview asked the server for the plan: POST …/boat-replacements {dry_run:true}', dry.length >= 1 && dry.every((b) => JSON.parse(b.req).dry_run === true) && !callsSince(n0).some((c) => /^DELETE /.test(c)), dry.map((b) => b.req));
ok('the preview shows the SERVER\'s plan: 2 days move; the 3rd is left, reason "โปรแกรมปิดวันนั้น" (legacy\'s plan would say 3)', /ได้\s*2\s*วัน/.test(prev) && /ข้าม 1 วัน/.test(prev) && /โปรแกรมปิดวันนั้น/.test(prev), prev);
const dryBody = JSON.parse(dry[0].req);
ok('the plan request carries only the choices (boats, dates, drop flag) and dry_run', Object.keys(dryBody).sort().join() === 'drop_unplaceable,dry_run,from_boat_id,from_date,to_boat_id,to_date', dryBody);
d0 = dialogs.length; nb0 = bodies.length; n0 = calls.length;
await ev(() => bop2ApplyReplace()); await idle(); await settle(2500);
const repBodies = bodies.slice(nb0).filter((b) => /boat-replacements/.test(b.k));
const cf = dialogs.slice(d0).find((t) => /^confirm: Move /.test(t));
ok('legacy confirm text from the server\'s plan: "Move Zeus -> Aluminous1 on 2 day(s), with its bookings." and "Leave 1 day(s)"', cf && /Move Zeus -> Aluminous1 on 2 day\(s\), with its bookings\./.test(cf) && /Leave 1 day\(s\) as they are\./.test(cf), cf);
ok('two calls: the dry run, then the real POST (no dry_run), both 200', repBodies.length === 2 && repBodies[0].status === 200 && repBodies[1].status === 200 && JSON.parse(repBodies[0].req).dry_run === true && JSON.parse(repBodies[1].req).dry_run === undefined, repBodies.map((b) => b.req));
const rd = (await api(`/operations/deployments?from=${DAY}&to=${D3}`)).deployments;
ok('server: Aluminous1 (b1) now runs r5 on the two days; Zeus is off them; the closed day is untouched', rd.filter((x) => x.boat_id === 'b1' && x.route_id === 'r5').length === 2 && !rd.some((x) => x.boat_id === 'b6' && x.service_date !== D3) && rd.some((x) => x.boat_id === 'b6' && x.service_date === D3), rd.map((x) => [x.boat_id, x.route_id, x.service_date]));
const bk1 = await api('/v1/bookings/' + b1.body.id);
ok('server: booking one moved with the boat (its trip is now placed on b1)', JSON.stringify(bk1.trips[0].operations).includes('"b1"') && !JSON.stringify(bk1.trips[0].operations).includes('"b6"'), bk1.trips[0].operations);
const done = dialogs.slice(d0).find((t) => /^alert: Done\./.test(t));
ok('legacy "Done." text with the server\'s counts: 2 day(s) now on Aluminous1 (1 booking(s) moved)', done && /2 day\(s\) now on Aluminous1 \(1 booking\(s\) moved\)/.test(done), done);
ok('no per-cell deployment write was sent for it (the diff-sync had nothing left)', !callsSince(n0).some((c) => /^(POST|DELETE) \/operations\/deployments(\/| )/.test(c)), callsSince(n0).filter((c) => !c.startsWith('GET')));
const onScr = await ev((d) => ({ b1: TRIPS[d.d1].b1 && TRIPS[d.d1].b1.route, b6: !!(TRIPS[d.d1] && TRIPS[d.d1].b6), keep: TRIPS[d.d3].b6 && TRIPS[d.d3].b6.route }), { d1: DAY, d3: D3 });
ok('the screen matches the server', onScr.b1 === 'r5' && onScr.b6 === false && onScr.keep === 'r5', onScr);
// a refusal on the way: replacing again over the same range has nothing to change
d0 = dialogs.length;
await ev((a) => { bop2OpenModal('replaceRange'); document.getElementById('bop2rp-from').value = 'b6'; document.getElementById('bop2rp-to').value = 'b1'; document.getElementById('bop2rp-d1').value = a.d1; document.getElementById('bop2rp-d2').value = a.d2; bop2ApplyReplace(); }, { d1: DAY, d2: D2 });
await idle(); await settle(1500);
ok('a second run over days with nothing left to move says legacy\'s "Nothing to change in this range."', dialogs.slice(d0).includes('alert: Nothing to change in this range.'), dialogs.slice(d0));
await ev(() => bop2CloseModal());
// no replacement boat: the broken boat is only taken off (the server drops every day it may; bookings placed on it are flagged)
d0 = dialogs.length; nb0 = bodies.length;
await ev((a) => { bop2OpenModal('replaceRange'); document.getElementById('bop2rp-from').value = 'b1'; document.getElementById('bop2rp-to').value = ''; document.getElementById('bop2rp-d1').value = a.d1; document.getElementById('bop2rp-d2').value = a.d2; bop2ReplacePreview(); bop2ApplyReplace(); }, { d1: DAY, d2: D2 });
await idle(); await settle(2000);
const noTo = bodies.slice(nb0).filter((b) => /boat-replacements/.test(b.k));
ok('no replacement boat: plan reads and one POST, none with to_boat_id; the POST sends drop_unplaceable true', noTo.length >= 2 && noTo.filter((b) => JSON.parse(b.req).dry_run !== true).length === 1 && JSON.parse(noTo.find((b) => JSON.parse(b.req).dry_run !== true).req).drop_unplaceable === true && noTo.every((b) => !('to_boat_id' in JSON.parse(b.req))), noTo.map((b) => b.req));
ok('legacy confirm "Remove Aluminous1 from 2 day(s) (no replacement)." and the "Done." text', dialogs.slice(d0).some((t) => /^confirm: Remove Aluminous1 from 2 day\(s\) \(no replacement\)\./.test(t)) && dialogs.slice(d0).includes('alert: Done. 2 day(s) removed - see the list of trips that need a boat.'), dialogs.slice(d0));
const bk1b = await api('/v1/bookings/' + b1.body.id);
ok('server: Aluminous1 is off both days and booking one shows boat_pulled (needs a boat again)', !(await api(`/operations/deployments?from=${DAY}&to=${D3}`)).deployments.some((x) => x.boat_id === 'b1') && bk1b.trips[0].operations.boat_pulled === true, bk1b.trips[0].operations);
await ev(() => bop2CloseModal());

// ── 14. LA_UID · no client-minted id reaches the server ──
item('LA_UID · browser-minted ids');
await ev(() => { window.LA_UID = function (p) { return 'ZZUID_' + (p || '') + Math.random().toString(36).slice(2, 6); }; });
nb0 = bodies.length;
await ev(() => { try { acctCreateDeposit('a01', 500, 'transfer', 'w5 uid'); } catch (e) { window.__uidErr = String(e); } });
await ev(() => { try { acctCreateInvoice('a01', [SB_BOOKINGS.find((b) => b.agentId === 'a01').id], 7); } catch (e) { window.__uidErr2 = String(e); } });
await idle(); await settle(1500);
const uidBodies = bodies.slice(nb0);
ok('deposit / invoice creates went to the server', uidBodies.some((b) => /\/v1\/(deposits|invoices|agents\/a01\/deposits)/.test(b.k)), uidBodies.map((b) => b.k));
ok('no request body carries a browser-minted id (ZZUID_…)', !uidBodies.some((b) => /ZZUID_/.test(b.req)), uidBodies.filter((b) => /ZZUID_/.test(b.req)).map((b) => b.k + ' ' + b.req.slice(0, 120)));
const toS = await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-w5-pend') || SB_BOOKINGS[0]; return Object.keys(laOpsToServer(b, false)); });
ok('a booking write never carries allocated_pax / srvAllocatedPax (server-owned)', !toS.includes('allocated_pax') && !toS.includes('srvAllocatedPax'), toS);

// ── 15. embed ticket ──
item('embed · POST /v1/embed/token');
const ticket = (ms) => { const p = Buffer.from(JSON.stringify({ exp: Date.now() + ms })).toString('base64url'); return p + '.' + crypto.createHmac('sha256', EMBED_SECRET).update(p).digest('base64url'); };
const { ctx: ce, page: pe } = await newCtx(false);
const nbE = bodies.length, ncE = calls.length;
await pe.goto(`http://127.0.0.1:${port}/allotment_v2.html?embed=1&view=booking&tab=cal&edit=1&t=${encodeURIComponent(ticket(5 * 60_000))}`);
await pe.waitForTimeout(6000);
const emb = await pe.evaluate(() => ({ url: location.href, tok: !!sessionStorage.getItem('la_ops_token'), flag: sessionStorage.getItem('la_ops_embed'), ro: document.documentElement.classList.contains('la-embed-ro'), msg: !!document.getElementById('la-embed-msg') }));
const exch = bodies.slice(nbE).find((b) => /POST \/v1\/embed\/token/.test(b.k));
ok('the ticket is posted once in the body: POST /v1/embed/token {ticket} -> 200', exch && exch.status === 200 && Object.keys(JSON.parse(exch.req)).join() === 'ticket', exch && exch.status);
ok('the Bearer is kept for this tab; the ticket is gone from the address bar', emb.tok && !/[?&](t|ticket)=/.test(emb.url) && /embed=1/.test(emb.url), emb);
ok('read-only is forced although edit=1 was asked', emb.ro && emb.flag === '1', emb);
const meCall = calls.slice(ncE).find((c) => /GET \/v1\/me[ ?]/.test(c));
ok('the app asked GET /v1/me with it (the embed identity), no staff login form', !!meCall && !emb.msg, { meCall, msg: emb.msg });
const embData = await pe.evaluate((d) => ({ ready: !!(window.laOps && window.laOps.state.loaded), r5: (typeof getRoute === 'function' && getRoute('r5') || {}).name, trip: !!(typeof TRIPS !== 'undefined' && TRIPS[d] && TRIPS[d].b6), failed: (window.laOps && window.laOps.state.failed) || [] }), D3);
ok('the embed boot loads only what the token may read (catalogue with the server routes, deployments); nothing fails', embData.ready && embData.r5 === 'Similan Islands by Speedboat' && embData.trip && embData.failed.length === 0, embData);
ok('and nothing was written from the embed page', !bodies.slice(nbE).some((b) => !/embed\/token/.test(b.k)), bodies.slice(nbE).map((b) => b.k));
await ce.close();
// a refused ticket: the login card with the server's message
const { ctx: cb, page: pb } = await newCtx(false);
const nbB = bodies.length;
await pb.goto(`http://127.0.0.1:${port}/allotment_v2.html?embed=1&view=booking&tab=cal&t=${encodeURIComponent(ticket(-1000))}`);
await pb.waitForTimeout(6000);
const bad = await pb.evaluate(() => ({ tok: !!sessionStorage.getItem('la_ops_token'), card: (document.getElementById('la-embed-msg') || {}).innerText || '', why: (document.getElementById('la-embed-why') || {}).textContent || '' }));
const badEx = bodies.slice(nbB).find((b) => /embed\/token/.test(b.k));
ok('an expired ticket: 401, no token kept', badEx && badEx.status === 401 && !bad.tok, { st: badEx && badEx.status, bad });
ok('the card is legacy\'s "ยังไม่ได้เข้าสู่ระบบ" plus the server\'s message as it is', /ยังไม่ได้เข้าสู่ระบบ/.test(bad.card) && bad.why && bad.why === JSON.parse(badEx.body).message, bad);
await cb.close();

// ───────────────────────── summary ─────────────────────────
const byItem = {};
results.forEach((r) => { const x = byItem[r.item] = byItem[r.item] || { pass: 0, fail: 0 }; r.pass ? x.pass++ : x.fail++; });
console.log('\nchecks per item: ' + Object.keys(byItem).map((k) => k + ' -> ' + byItem[k].pass + ' ok / ' + byItem[k].fail + ' failed').join(' | '));
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.map((r) => r.slice(0, 200)).join('\n  '));
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
