// t_walk_w4_f2 · browser walk of the "day operations" wiring (w4-f2) against a REAL operation-backend (in-process store, seeded):
//   1 ckEventUndo -> POST events/{i}/undo · no PUT of a whole check-in record · ckStrandClear -> POST clear-arrangement
//   2 ckEventTally / ckPaxBreak read trip.aboard          3 pier Service column (bkLtState, ckAddonList, pckJobService) from GET /v1/pier-checkin
//   4 Van Check-in: KPI, order, unassigned from GET /v1/van-checkin
//   5 Travel Summary: checks, net, zone, add-on lines, cancelled rows, scoped totals from GET /v1/reports/travel-summary
//   6 job card permits (pjDocsHtml)                        7 pickup-area plan + PATCH (bookingV2ZonePickConfirm)
// (pay_owed's skip dialog is checked in t_walk_cmds.mjs item 6.)
//
//   node test/ui/t_walk_w4_f2.mjs       (OPS_BACKEND_DIR, default D:/projects/operation-backend · WALK_ONLY=1,3 runs sections)
//
// Every check reads BOTH sides: the screen (functions / DOM) and the server (asked directly). "Tamper" checks change what the
// server answers on the wire (the test's proxy) to something legacy's arithmetic would never give, and expect the screen to show
// the server's figure: that is what proves the browser no longer decides.
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
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 90000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const raw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text(); let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await raw(p, init)).body;
const send = (m, p, b) => raw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) });
// a booking write names the version it read (If-Match)
const sendV = async (method, p, id, body) => { const v = (await api('/v1/bookings/' + id)).version; return raw(p, { method, body: JSON.stringify(body), headers: { 'if-match': '"' + v + '"' } }); };
const seedV = async (method, p, id, body) => { const r = await sendV(method, p, id, body); if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); return r.body; };
const seed = async (method, p, body) => {
  const r = await send(method, p, body);
  if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
};

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], bodies = [];
let tamper = [];       // [{ re: /path/, fn(json) }]: what the server answers on the wire is changed before the page reads it
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  let buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push(req.method() + ' ' + u.pathname + u.search + ' ' + r.status);
  if (req.method() !== 'GET') bodies.push({ k: req.method() + ' ' + u.pathname, status: r.status, req: req.postData() || '', body: buf.toString() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 260));
  if (req.method() === 'GET' && r.status === 200) for (const t of tamper) if (t.re.test(u.pathname + u.search)) { try { const j = JSON.parse(buf.toString()); t.fn(j, u); buf = Buffer.from(JSON.stringify(j)); } catch (_) {} }
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 300)); d.type() === 'prompt' ? d.accept('Tester') : d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 900))); if (!cond) fails.push(name); return cond; };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const todo = [];
const section = (name, fn) => todo.push([name, fn]);
const callsSince = (n) => calls.slice(n);
const waitCalls = async (re, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (calls.some((c) => re.test(c))) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
const lastBody = (re) => { const b = bodies.filter((x) => re.test(x.k)).pop(); return b ? { status: b.status, req: b.req ? JSON.parse(b.req) : null, json: (() => { try { return JSON.parse(b.body); } catch (_) { return null; } })() } : null; };
const goView = (v) => ev((v) => { const el = document.querySelector('.nav-item[data-view="' + v + '"]'); nav(el || { dataset: { view: v }, classList: { add() {} } }); }, v);
const COMPUTED = ['actual_pax', 'expected', 'no_show', 'self_add', 'reinstate', 'checked_in_at', 'checked_in_by', 'arrived_at', 'arrived_by', 'cleared_at', 'cleared_by', 'flow_at', 'flow_by', 'by', 'ts', 'net', 'permits', 'service', 'aboard'];
const noComputed = (req) => !req || !Object.keys(req).some((x) => COMPUTED.includes(x));

const DAY = '2026-11-10';
const PIER = 'tublamu';
const addDays = (d, n) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);

// ══════════ seed (through the API, before the app boots) ══════════
for (const [b, r, cap] of [['b6', 'r5', 40], ['b1', 'r4', 64]]) await seed('POST', '/operations/deployments', { boat_id: b, route_id: r, service_date: DAY, capacity: cap, deploy_anyway: true });
const mkVan = async (name, cap) => seed('POST', '/operations/vans', { name, capacity: cap });
const vanA = await mkVan('Van Alpha', 12), vanB = await mkVan('Van Bravo', 12), vanC = await mkVan('Van Charlie', 12);
for (const v of [vanA, vanB, vanC]) await seed('PUT', `/operations/van-days/${DAY}/${v.id}`, { route_ids: ['r5'] });
const mkBk = async (id, lead, pax, extra = {}, tripExtra = {}, route = 'r5') => send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: route, date: DAY, pax: { ad_fr: pax }, zone: 'PK', ...tripExtra }], ...extra });
const bk = {};
const mk = async (k, lead, pax, extra, tripExtra, route) => {
  const r = await mkBk('zz-' + k, lead, pax, extra, tripExtra, route);
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body)); process.exit(2); }
  bk[k] = { id: r.body.id, trip: r.body.trips[0].id, ext: 'zz-' + k, body: r.body };
};
await mk('t1', 'F2 ONE', 2); await mk('t2', 'F2 TWO', 3); await mk('t3', 'F2 THREE', 2); await mk('t4', 'F2 FOUR', 2, { pickupSelf: true, hotelName: '', pickupZone: 'NoTransfer' }, { zone: 'NoTransfer' });
await mk('t5', 'F2 FIVE', 2);                    // zone PK, no van: "not yet in a van"
await mk('t6', 'F2 SIX', 2);                     // cancelled below, with a van: a struck row to clear
await mk('t7', 'F2 SEVEN', 2);                   // a live booking in a van with nothing else (not_cancelled)
// the pier "Service" column: a charter longtail with a kayak, a join, heads sold on tour, an upgrade still to collect, a stale join (0 + 0)
await mk('sA', 'F2 SVC CHARTER', 4, { addOns: [{ type: 'longtail-charter', label: 'Longtail Charter (per boat)', qty: 2, note: 'early' }, { type: 'kayak', label: 'Kayak', note: '2 pcs' }] });
await mk('sB', 'F2 SVC JOIN', 4, { addOns: [{ type: 'longtail-join', label: 'Longtail Join', join_adults: 2, join_children: 1 }] });
await mk('sC', 'F2 SVC SOLD', 3);
await seedV('POST', `/v1/bookings/${bk.sC.id}/tour-sales`, bk.sC.id, { service: 'Longtail Join', qty: 2, unit_price: 500, method: 'cash' });
await mk('sD', 'F2 SVC UPGRADE', 2, { upgrades: [{ id: 'up_f2', label: 'Longtail เหมา', sell_price: 3000, collected: false }] });
await mk('sE', 'F2 SVC STALE', 2, { addOns: [{ type: 'longtail-join', label: 'Longtail Join', join_adults: 0, join_children: 0 }] });
const mkGroup = async (members, van_id) => seed('POST', '/operations/van-groups', { service_date: DAY, route_id: 'r5', zone: 'PK', members: members.map((m) => ({ trip_id: bk[m].trip })), van_id });
await mkGroup(['t1', 't2', 't6'], vanA.id); await mkGroup(['t3', 't7'], vanB.id);
// check-in facts the screens read: t1 boarded on the van; t2 boarded, one no-show event (needs a decision at Travel Summary)
const cmd = (k, side, action, body = {}) => seed('POST', `/operations/trip-ops/${bk[k].trip}/checkins/${side}/0/${action}`, body);
await cmd('t1', 'van', 'check-in');
await cmd('t2', 'van', 'check-in');
await cmd('t2', 'van', 'events', { type: 'no_show', reason_code: 'no_contact', ad: 1, note: 'f2 walk' });

// t3 and t1 carry live events (a no-show, an on-site cancel): ckEventTally / ckPaxBreak, and a case to decide at Travel Summary
await cmd('t3', 'van', 'check-in');
await cmd('t3', 'van', 'events', { type: 'no_show', reason_code: 'late', ad: 1 });
await cmd('t1', 'van', 'events', { type: 'cxl', reason_code: 'sick', ad: 1 }).catch(() => null);
// permits: b6 holds a Similan permit with 20 days left; a route that enters Similan AND Surin runs on b7, whose Surin permit is expired
await seed('PATCH', '/v1/boats/b6', { documents: [{ name: 'ใบอนุญาต สิมิลัน', expires_on: addDays(DAY, 20) }] });
const rSS = (await seed('POST', '/v1/routes', { name: 'F2 Similan Surin Day', pier: PIER, family_id: null, islands: 'Surin' })).route.id;
await seed('PATCH', '/v1/boats/b7', { documents: [{ name: 'ใบอนุญาต สิมิลัน', expires_on: addDays(DAY, 20) }, { name: 'ใบอนุญาต สุรินทร์', expires_on: addDays(DAY, -9) }] });
await seed('POST', '/operations/deployments', { boat_id: 'b7', route_id: rSS, service_date: DAY, capacity: 40, deploy_anyway: true });
// the pickup-zone dialog: a route with two pickup areas in two zones (07:00-07:15 and 08:00-08:15), one booking on the area's own time, one typed by hand
const rZp = (await seed('POST', '/v1/routes', { name: 'F2 Zone Pick Day', pier: 'panwa', family_id: null })).route.id;
await seed('POST', '/operations/deployments', { boat_id: 'b13', route_id: rZp, service_date: DAY, capacity: 38, deploy_anyway: true });
const areaA = await seed('POST', '/v1/pickup-areas', { name: 'F2 Area A', zone: 'PK', time_group: 'F2A' });
const areaB = await seed('POST', '/v1/pickup-areas', { name: 'F2 Area B', zone: 'KL', time_group: 'F2B' });
const profile = await seed('POST', '/v1/pickup-time-profiles', { name: 'F2 profile', from_date: '2026-01-01', to_date: '2027-12-31' });
await seed('PUT', `/v1/pickup-time-profiles/${profile.id}/times/${rZp}/${areaA.id}`, { pickup_time: '07:00', pickup_time_end: '07:15' });
await seed('PUT', `/v1/pickup-time-profiles/${profile.id}/times/${rZp}/${areaB.id}`, { pickup_time: '08:00', pickup_time_end: '08:15' });
const mkZp = async (k, lead, tripExtra = {}) => {
  const r = await send('POST', '/v1/bookings', { external_id: 'zz-' + k, leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 2', pickup_area_id: areaA.id, hotel_name: 'Zp Hotel', trips: [{ routeId: rZp, date: DAY, zone: 'PK', pax: { ad_fr: 2 }, ...tripExtra }] });
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body).slice(0, 300)); process.exit(2); }
  bk[k] = { id: r.body.id, trip: r.body.trips[0].id, ext: 'zz-' + k, body: r.body };
};
await mkZp('zOwn', 'F2 ZONE OWN'); await mkZp('zTyped', 'F2 ZONE TYPED', { pickupTime: '09:30' });

// t6 is cancelled on the server and keeps its van part: a cancelled booking still arranged (the server's kpi.strand, cancelled_rows)
await seedV('POST', `/v1/bookings/${bk.t6.id}/cancel`, bk.t6.id, { category: 'sick', charge_type: 'none' });

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
const s0 = await ev(() => ({ failed: laOps.state.failed }));
ok('boot: nothing failed to load', s0.failed.length === 0, s0);
const openVanCk = async (date, wait = true) => {
  await ev((d) => { _vanCkDate = d; const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el); renderVanCheckin(); }, date);
  if (wait) await waitFor(() => document.querySelector('#vancheckin-host .vck-arr'), null, 15000);
  await idle(); await settle(1200);
};
const openPier = async (date) => {
  await ev((d) => { _pckDate = d; const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); renderPierCheckin(); }, date);
  await waitFor(() => !!document.querySelector('#piercheckin-host'), null, 10000);
  await idle(); await settle(1500);
};
const srvRec = async (k, side, slot = 0) => ((await api('/v1/bookings/' + bk[k].id)).trips[0].operations.checkins[side].find((r) => r.slot === slot)) || null;

// ═══ 1 · ckEventUndo, no PUT of a whole record, ckStrandClear ═══
section('1', async () => {
  console.log('\n[1] ckEventUndo -> POST events/{i}/undo · ckStrandClear -> POST clear-arrangement');
  await openVanCk(DAY);
  const before = await srvRec('t2', 'van');
  ok('seed: t2 is boarded on the van with one live no-show event', before && before.checked_in_at && (before.events || []).filter((e) => !e.undone).length === 1, before);
  const n0 = calls.length, b0 = bodies.length;
  await ev(() => ckEventUndo('zz-t2', '2026-11-10', 'van'));
  await idle(); await settle(1500);
  const p = lastBody(/POST .*\/checkins\/van\/0\/events\/0\/undo$/), after = await srvRec('t2', 'van');
  ok('ckEventUndo: legacy confirm "ถอนรายการล่าสุด?" shown', dialogs.some((d) => /ถอนรายการล่าสุด/.test(d)), dialogs.slice(-3));
  ok('ckEventUndo: POST …/events/0/undo with exactly {why:"mistake"} (no count, no stamp, no events list)', p && p.status === 200 && JSON.stringify(p.req) === '{"why":"mistake"}', p);
  ok('server: the event is struck (undone, mistake) and the count is back (3 of 3)', after.events[0].undone && after.events[0].undone.why === 'mistake' && after.actual_pax === 3, after);
  const scr = await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-t2'); const c = ckRead(b, '2026-11-10', 'van'); return { n: (c.events || []).length, undone: !!(c.events[0] && c.events[0].undone), actual: c.actualPax }; });
  ok('screen: the record shows the undone event and the count the server left', scr.n === 1 && scr.undone && scr.actual === 3, scr);
  ok('no PUT of a whole check-in record was sent (the old PUT would be refused with use_command)', !bodies.slice(b0).some((x) => /^PUT .*\/checkins\/(van|pier)\/\d+$/.test(x.k)), bodies.slice(b0).map((x) => x.k));
  // the server refuses a hand-made whole record that moves a computed field
  const put = await send('PUT', `/operations/trip-ops/${bk.t2.trip}/checkins/van/0`, { ...after, actual_pax: 1 });
  ok('server: the whole-record PUT with a different actual_pax is 400 use_command', put.status === 400 && /use_command|command/.test(JSON.stringify(put.body)), put);
  ok('undoing again: nothing live is left, legacy\'s alert "ไม่มีรายการให้ถอน"', await (async () => { const d0 = dialogs.length; await ev(() => ckEventUndo('zz-t2', '2026-11-10', 'van')); await settle(300); return dialogs.slice(d0).some((d) => /ไม่มีรายการให้ถอน/.test(d)); })(), dialogs.slice(-2));

  // ckStrandClear on the cancelled t6
  await openVanCk(DAY);
  const t6 = await api('/v1/bookings/' + bk.t6.id);
  ok('seed: t6 is cancelled and still in a van group', /cancel/.test(t6.status) && (t6.trips[0].operations.van_parts || []).length > 0, { status: t6.status, parts: t6.trips[0].operations.van_parts });
  const hasRow = await ev(() => /ค้างจัดการ 1/.test(document.querySelector('#vancheckin-host .ck-kpi').innerText));
  ok('screen: the KPI chip says ค้างจัดการ 1 (kpi.strand of the server: one cancelled booking still arranged)', hasRow, await ev(() => document.querySelector('#vancheckin-host .ck-kpi').innerText));
  const n1 = calls.length, b1 = bodies.length, d1 = dialogs.length;
  await ev(() => ckStrandClear('zz-t6', '2026-11-10'));
  await idle(); await settle(1800);
  const cl = bodies.slice(b1).filter((x) => /clear-arrangement/.test(x.k));
  ok('ckStrandClear: legacy confirm shown, then POST …/clear-arrangement with no body', dialogs.slice(d1).some((d) => /ล้างการจัดรถ\/เรือของ/.test(d)) && cl.length === 1 && cl[0].status === 200 && cl[0].req === '', cl);
  ok('the old PATCH {van_parts:null} is gone', !bodies.slice(b1).some((x) => /^PATCH .*\/trip-ops\//.test(x.k)), bodies.slice(b1).map((x) => x.k));
  const t6b = await api('/v1/bookings/' + bk.t6.id), hist = (await api(`/v1/bookings/${bk.t6.id}/history`)).history || [];
  ok('server: no van parts left, the booking is still cancelled, a history line names the clearing', (t6b.trips[0].operations.van_parts || []).every((x) => !x.group) && /cancel/.test(t6b.status) && hist.some((h) => /ล้างการจัดรถ\/เรือของวันที่/.test(h.text)), { parts: t6b.trips[0].operations.van_parts, hist: hist.map((h) => h.text).slice(0, 3) });
  const gone = await ev(() => /ค้างจัดการ/.test(document.querySelector('#vancheckin-host .ck-kpi').innerText));
  ok('screen: the ค้างจัดการ chip is gone from Van Check-in KPI', !gone, await ev(() => document.querySelector('#vancheckin-host .ck-kpi').innerText));
  // nothing left to clear: the server decides (409 nothing_to_clear) and its words are legacy's alert
  const d2 = dialogs.length;
  await ev(() => ckStrandClear('zz-t6', '2026-11-10'));
  await idle(); await settle(1200);
  ok('nothing arranged any more: 409 nothing_to_clear, shown as an alert with the server\'s words', refusals.some((r) => /clear-arrangement -> 409.*nothing_to_clear/.test(r)) && dialogs.slice(d2).some((d) => /alert: No van or boat arrangement is left/.test(d) || /No van or boat arrangement is left/.test(d)), { r: refusals.slice(-2), d: dialogs.slice(d2) });
  // a live booking is not cleared like this
  const d3 = dialogs.length;
  await ev(() => ckStrandClear('zz-t7', '2026-11-10'));
  await idle(); await settle(1200);
  ok('a live booking: 409 not_cancelled with the server\'s message on screen, the van group untouched', refusals.some((r) => /clear-arrangement -> 409.*not_cancelled/.test(r)) && ((await api('/v1/bookings/' + bk.t7.id)).trips[0].operations.van_parts || []).length > 0, refusals.slice(-2));
});

// ═══ 2 · ckEventTally and ckPaxBreak read trip.aboard ═══
section('2', async () => {
  console.log('\n[2] ckEventTally / ckPaxBreak -> trip.aboard (the booking is not passed: the record and the pax map are found)');
  await openVanCk(DAY);
  const ab3 = (await api('/v1/bookings/' + bk.t3.id)).trips[0].aboard;
  const read = () => ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-t3'), t = b.trips[0], ck = ckRead(b, '2026-11-10', 'van');
    return { tally: ckEventTally(ck), pax: ckPaxBreak(t.pax), tagged: laOps.aboardCalls.paxTagged(t.pax), recTagged: !!ck._aboardTrip, legacySum: Object.keys(t.pax).reduce((s, k) => s + (+t.pax[k] || 0), 0) }; });
  const r0 = await read();
  ok('seed: t3 has one live no-show on the van (server tally.van = 1 no-show)', ab3.tally.van.no_show === 1 && ab3.tally.van.total === 1, ab3.tally);
  ok('ckEventTally(ck) = aboard.tally.van {no_show, cxl, total}', r0.recTagged && r0.tally.no_show === ab3.tally.van.no_show && r0.tally.cxl === ab3.tally.van.cxl && r0.tally.total === ab3.tally.van.total, { r0, ab3: ab3.tally });
  ok('ckPaxBreak(t.pax) = aboard.booked {ad chd inf foc}', r0.tagged && r0.pax.ad === ab3.booked.ad && r0.pax.chd === ab3.booked.chd && r0.pax.inf === ab3.booked.inf && r0.pax.foc === ab3.booked.foc, { r0, booked: ab3.booked });
  // the server's answer differs from the browser's sum: the screen shows the server's
  tamper = [{ re: /\/v1\/bookings\b/, fn: (j) => { for (const b of (j.bookings || (j.trips ? [j] : []))) if (b.id === bk.t3.id) { const a = b.trips[0].aboard; a.tally.van.no_show = 7; a.tally.van.total = 7; a.booked.ad = 9; } } }];
  await ev(() => bookingV2EnsureOpsRange({ from: '2026-11-10', to: '2026-11-10', refresh: true })); await idle(); await settle(800);
  const r1 = await read();
  ok('tampered answer (7 no-shows, 9 adults): ckEventTally and ckPaxBreak give the server\'s figures, not the sum of the records the browser holds', r1.tally.no_show === 7 && r1.tally.total === 7 && r1.pax.ad === 9 && r1.legacySum === 2, r1);
  // heads edited in the browser and not saved: the browser's own map is read (no server figure for heads it has not seen)
  const r2 = await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-t3'), t = b.trips[0]; const k = Object.keys(t.pax).find((x) => /^ad/.test(x)); const old = t.pax[k]; t.pax[k] = 5; const out = ckPaxBreak(t.pax); t.pax[k] = old; return out; });
  ok('heads edited here and not saved (ad 5): ckPaxBreak answers 5, the browser\'s own', r2.ad === 5, r2);
  tamper = [];
  await ev(() => bookingV2EnsureOpsRange({ from: '2026-11-10', to: '2026-11-10', refresh: true })); await idle(); await settle(800);
  const r3 = await read();
  ok('answer back to normal: the figures follow it (1 no-show, 2 adults)', r3.tally.no_show === 1 && r3.pax.ad === ab3.booked.ad, r3);
  // after a check-in command the answer carries a new block: the tally follows without a booking read
  const n0 = calls.length;
  await ev(() => ckToggle('zz-t3', '2026-11-10', 'van')); await idle(); await settle(1200);
  const r4 = await read(), ab3b = (await api('/v1/bookings/' + bk.t3.id)).trips[0].aboard;
  ok('the record the command answered is tagged again: tally = the new aboard.tally.van', r4.recTagged && r4.tally.no_show === ab3b.tally.van.no_show && r4.tally.total === ab3b.tally.van.total, { r4, ab3b: ab3b.tally });
  await ev(() => ckToggle('zz-t3', '2026-11-10', 'van')); await idle(); await settle(800);   // put the tick back
});

// ═══ 3 · the pier Service column from GET /v1/pier-checkin ═══
section('3', async () => {
  console.log('\n[3] Service: bkLtState / bkLtUpgrade / ckAddonList / pckJobService <- GET /v1/pier-checkin rows[].service');
  const n0 = calls.length;
  await openPier(DAY);
  await waitFor(() => window.laOps.pierService && laOps.pierService.loaded('2026-11-10'), null, 15000);
  ok('Pier Check-in asked GET /v1/pier-checkin?date=… for its day', callsSince(n0).some((c) => /^GET \/v1\/pier-checkin\?date=2026-11-10 200/.test(c)), callsSince(n0).filter((c) => /pier-checkin/.test(c)));
  const sheet = await api('/v1/pier-checkin?date=' + DAY);
  const svc = (k) => sheet.rows.find((r) => r.booking_id === bk[k].id).service;
  const scr = (k) => ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-' + a.k), t = b.trips[0];
    return { st: bkLtState(b, t.routeId, '2026-11-10'), up: bkLtUpgrade(b), add: ckAddonList(b, t.routeId), job: pckJobService({ b, t }, '2026-11-10').map((x) => x.t), addons: pckJobAddons({ b, t }) }; }, { k });
  const A = await scr('sA'), B = await scr('sB'), C = await scr('sC'), D = await scr('sD'), E = await scr('sE');
  ok('charter: mode, boats and the add-ons are the server\'s (2 boats; Longtail Charter early + Kayak 2 pcs), pckJobService prints them', A.st.mode === svc('sA').kind && A.st.boats === svc('sA').boats && JSON.stringify(A.add) === JSON.stringify(svc('sA').add_ons)
    && A.job.some((t) => /^Longtail Charter · 2 ลำ/.test(t)) && A.job.some((t) => /Kayak \(2 pcs\)/.test(t)) && A.addons.some((t) => /Longtail Charter \(early\)/.test(t)), { A, s: svc('sA') });
  ok('join booked: mode join, join_pax 3 (2 adults + 1 child), joinBooked', B.st.mode === 'join' && B.st.joinBooked === true && B.st.joinPax === svc('sB').join_pax && svc('sB').join_pax === 3 && B.job.some((t) => /^Longtail Join$/.test(t)), { B, s: svc('sB') });
  ok('heads sold on tour: join, joinExtra 2 (extra_pax), "Longtail Join +2"', C.st.mode === 'join' && C.st.joinExtra === svc('sC').extra_pax && svc('sC').extra_pax === 2 && C.job.some((t) => /^Longtail Join \+2$/.test(t)), { C, s: svc('sC') });
  ok('upgrade still to collect: one charter boat from the upgrade, up 1, upDue 1, "Longtail Charter · 1 ลำ ⬆ *"; bkLtUpgrade {n 1, due 1}', D.st.mode === 'charter' && D.st.boats === 1 && D.st.fromUp === true && D.st.up === 1 && D.st.upDue === 1 && D.up.n === 1 && D.up.due === 1 && D.job.some((t) => /^Longtail Charter · 1 ลำ ⬆ \*$/.test(t)), { D, s: svc('sD') });
  ok('a join of 0 + 0 is nobody: mode none, no add-on', E.st.mode === 'none' && E.add.length === 0 && E.job.length === 0 && svc('sE').kind === 'none', { E, s: svc('sE') });
  const colTxt = await ev(() => document.querySelector('#piercheckin-host').innerText);
  ok('the sheet\'s Add-on column shows the server\'s add-ons (Longtail Charter, Kayak)', /Longtail Charter/.test(colTxt) && /Kayak/.test(colTxt), colTxt.slice(0, 300));
  // the server answers something legacy\'s arithmetic would never say: the screen shows the server\'s
  tamper = [{ re: /\/v1\/pier-checkin/, fn: (j) => { for (const r of j.rows) if (r.booking_id === bk.sA.id) { r.service.boats = 7; r.service.lines = [{ kind: 'longtail', label: 'Longtail Charter · 7 ลำ' }]; r.service.add_ons = [{ kind: 'longtail', label: 'Longtail Charter', note: 'server says' }]; } } }];
  await ev(() => laOps.pierService.clear()); await ev(() => laOps.pierService.ensure('2026-11-10', true)); await settle(500);
  const A2 = await scr('sA');
  ok('tampered answer (7 boats): bkLtState.boats = 7, pckJobService "Longtail Charter · 7 ลำ", ckAddonList = the server\'s one add-on (Kayak gone)', A2.st.boats === 7 && A2.job.some((t) => /^Longtail Charter · 7 ลำ/.test(t)) && A2.add.length === 1 && A2.add[0].note === 'server says' && !A2.job.some((t) => /Kayak/.test(t)), A2);
  tamper = [];
  // a write drops the answers (the booking may have changed); offline / before the first answer legacy's arithmetic answers
  await ev(() => laOps.wrote('booking'));
  const gone = await ev(() => laOps.pierService.loaded('2026-11-10'));
  const A3 = await scr('sA');
  ok('after a write the held answer is dropped and legacy\'s arithmetic answers meanwhile (2 boats, from the local booking)', gone === false && A3.st.mode === 'charter' && A3.st.boats === 2, { gone, A3 });
  await waitFor(() => laOps.pierService.loaded('2026-11-10'), null, 15000);
  const A4 = await scr('sA');
  ok('...and the open Pier Check-in reads the day again: the server\'s 2 boats are back', A4.st.boats === 2 && A4.add.length === 2, A4);
  await settle(3500);      // let the change feed echo the earlier writes first
  const tapBefore = calls.length;
  await ev(() => { window.__wk = []; laOps.onWrite((k) => window.__wk.push(k)); });
  await ev(() => ckToggle('zz-sA', '2026-11-10', 'pier')); await idle(); await settle(1500);
  const kinds = await ev(() => window.__wk);
  // w5-d (decision 1): the sheet's figures are the server's now, so a tap makes the open sheet read the day again; the Service answer stays held meanwhile (bkLtState keeps answering)
  ok('a check-in tap (and the seat-lock reload after it) makes the open sheet read GET /v1/pier-checkin again (w5-d), and the Service answers are still the server\'s', callsSince(tapBefore).some((c) => /GET \/v1\/pier-checkin/.test(c)) && kinds.some((k) => /^trip-checkin/.test(k)) && (await ev(() => !!laOps.pierService.serviceOf(SB_BOOKINGS.find((x) => x.id === 'zz-sA'), SB_BOOKINGS.find((x) => x.id === 'zz-sA').trips[0].routeId, '2026-11-10'))), { calls: callsSince(tapBefore), kinds });
});

// ═══ 4 · Van Check-in: KPI, order, unassigned from GET /v1/van-checkin ═══
section('4', async () => {
  console.log('\n[4] Van Check-in: KPI chips, van order + zone bands, van header tally, "not yet in a van" <- GET /v1/van-checkin');
  const n0 = calls.length;
  await openVanCk(DAY);
  await waitFor(() => !!document.querySelector('#vancheckin-host[data-ops-vck]'), null, 15000);
  ok('Van Check-in asked GET /v1/van-checkin?date=…', callsSince(n0).some((c) => /^GET \/v1\/van-checkin\?date=2026-11-10 200/.test(c)), callsSince(n0).filter((c) => /van-checkin/.test(c)));
  const kpiTxt = () => ev(() => document.querySelector('#vancheckin-host .ck-kpi').innerText.replace(/\s+/g, ' ').trim());
  const kpiOf = (k) => { const h = k.heads; return `ขึ้นรถแล้ว ${k.checked}/${k.rows}` + (k.strand > 0 ? ` ค้างจัดการ ${k.strand}` : '') + (h.waiting > 0 ? ` รอ ${h.waiting}` : '') + (h.no_show > 0 ? ` No-show ${h.no_show}` : '') + (h.cxl > 0 ? ` CXL ${h.cxl}` : '') + (h.to_pier > 0 ? ` ไปเจอที่ท่า ${h.to_pier}` : ''); };
  const sanit = (k) => 'vckg-' + String(k).replace(/[^A-Za-z0-9_-]/g, '_');
  const shape = () => ev(() => ({ order: Array.from(document.querySelectorAll('#vancheckin-host div[id^="vckg-"]')).map((e) => e.id),
    tally: Object.fromEntries(Array.from(document.querySelectorAll('#vancheckin-host div[id^="vckg-"]')).map((e) => [e.id, e.lastElementChild.innerText.replace(/\s+/g, ' ').trim()])),
    zones: Array.from(document.querySelectorAll('#vancheckin-host tr.ck-zhead')).map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
    warn: ((document.querySelector('#vancheckin-host tr.ck-warn') || {}).innerText || '').replace(/\s+/g, ' ').trim(), nUn: document.querySelectorAll('#vancheckin-host tr.ck-unassigned').length }));
  const srv = await api('/v1/van-checkin?date=' + DAY);
  const expTally = (v) => `ขึ้นรถ ${v.checked}/${v.rows} · ` + (v.lost > 0 ? `${v.going} pax ${v.booked} · หาย ${v.lost}` : `${v.booked} pax`);
  let s = await shape();
  const vOrder = srv.vans.slice().sort((a, b) => a.order - b.order);
  ok('KPI chips = the server\'s kpi (checked/rows, ค้างจัดการ, รอ, No-show, CXL, ไปเจอที่ท่า)', (await kpiTxt()) === kpiOf(srv.kpi), { screen: await kpiTxt(), want: kpiOf(srv.kpi) });
  ok('van blocks in the server\'s order, each header tally = the server\'s (ขึ้นรถ x/y · pax · หาย)', JSON.stringify(s.order) === JSON.stringify(vOrder.map((v) => sanit(v.van_id + '~' + v.route_id))) && vOrder.every((v) => s.tally[sanit(v.van_id + '~' + v.route_id)] === expTally(v)), { s, want: vOrder.map((v) => [v.van_id, expTally(v)]) });
  ok('zone band: "Phuket · 2 คัน · 4 booking · 9 pax" from the server\'s zones', srv.zones.length > 0 && srv.zones.every((z, i) => new RegExp(`${z.vans} คัน · ${z.rows} booking · ${z.pax} pax`).test(s.zones[i] || '')), { zones: srv.zones, s: s.zones });
  ok('"ยังไม่จัดรถ" header and rows = the server\'s unassigned (n, pax, one row each)', s.warn.includes(`ยังไม่จัดรถ · ${srv.unassigned.n} booking · ${srv.unassigned.pax} pax`) && s.nUn === srv.unassigned.n, { warn: s.warn, nUn: s.nUn, un: srv.unassigned.n });
  // the server answers something legacy's counts would never give
  tamper = [{ re: /\/v1\/van-checkin/, fn: (j) => { j.kpi.checked = 4; j.kpi.heads.waiting = 99; j.kpi.strand = 0; const [a, b] = [j.vans.find((v) => v.van_id === vanA.id), j.vans.find((v) => v.van_id === vanB.id)]; const o = a.order; a.order = b.order; b.order = o; a.checked = 9;
    j.unassigned.n = 2; j.unassigned.pax = 4; j.unassigned.rows = j.unassigned.rows.slice(0, 2); } }];
  await ev(() => laOps.vanCheckin.clear()); await ev(() => renderVanCheckin()); await waitFor(() => /รอ 99/.test(document.querySelector('#vancheckin-host .ck-kpi').innerText), null, 10000); await settle(300);
  s = await shape();
  const kt = await kpiTxt();
  ok('tampered answer: KPI shows ขึ้นรถแล้ว 4/… and รอ 99, no ค้างจัดการ chip', /^ขึ้นรถแล้ว 4\//.test(kt) && /รอ 99/.test(kt) && !/ค้างจัดการ/.test(kt), kt);
  const ia = s.order.indexOf(sanit(vanA.id + '~r5')), ib = s.order.indexOf(sanit(vanB.id + '~r5'));
  ok('tampered answer: Van Bravo is now drawn before Van Alpha, and Alpha\'s header says ขึ้นรถ 9/…', ib >= 0 && ia >= 0 && ib < ia && /^ขึ้นรถ 9\//.test(s.tally[sanit(vanA.id + '~r5')]), { order: s.order, tally: s.tally });
  ok('tampered answer: "ยังไม่จัดรถ · 2 booking · 4 pax" with exactly 2 rows', s.warn.includes('ยังไม่จัดรถ · 2 booking · 4 pax') && s.nUn === 2, s);
  tamper = [];
  // a tick: the screen draws legacy's count at once and the server's answer lands on it (the same number)
  await ev(() => laOps.vanCheckin.clear());
  await ev(() => ckToggle('zz-t7', '2026-11-10', 'van')); await idle();
  await waitFor(() => /ขึ้นรถแล้ว 3\//.test(document.querySelector('#vancheckin-host .ck-kpi').innerText), null, 10000); await settle(600);
  const srv2 = await api('/v1/van-checkin?date=' + DAY);
  ok('a tick on t7: GET /v1/van-checkin again and the KPI = the server\'s new kpi', (await kpiTxt()) === kpiOf(srv2.kpi) && srv2.kpi.checked === srv.kpi.checked + 1, { screen: await kpiTxt(), want: kpiOf(srv2.kpi) });
  // a text search is the client's: the server's counts are not put on a filtered list
  await ev(() => { vckSetQ('SEVEN'); }); await settle(600);
  const q1 = await kpiTxt();
  ok('with a text search typed legacy\'s own counts stay (the server leaves search to the client): ขึ้นรถแล้ว 1/1', /^ขึ้นรถแล้ว 1\/1/.test(q1), q1);
  await ev(() => { vckSetQ(''); }); await settle(400);
});

// ═══ 5 · Travel Summary ═══
section('5', async () => {
  console.log('\n[5] Travel Summary: checks, close-day pill, net, zone, add-on lines, cancelled rows, scoped totals <- GET /v1/reports/travel-summary');
  const money = (v) => '฿' + Math.round(+v || 0).toLocaleString('en-US');
  const open = async () => {
    await ev((d) => { _tsDate = d; _tsPier = ''; _tsRoute = ''; _tsVatF = ''; const el = document.querySelector('.nav-item[data-view="travelsum"]'); if (el) nav(el); renderTravelSum(); }, DAY);
    await waitFor(() => !!document.querySelector('[data-ops-ts-view]') && document.querySelectorAll('[data-ops-ts-man]').length > 0, null, 25000);
    await idle(); await settle(1500);
  };
  const reset = () => ev(() => { laOps.moneyReports.clear(); laOps.travelRows.clear(); laOps.travelServer.clear(); laOps.travelView.clear(); });
  const n0 = calls.length;
  await open();
  ok('Travel Summary asked GET /v1/reports/travel-summary?date=…', callsSince(n0).some((c) => /^GET \/v1\/reports\/travel-summary\?date=2026-11-10 200/.test(c)), callsSince(n0).filter((c) => /travel-summary/.test(c)));
  const S = await api('/v1/reports/travel-summary?date=' + DAY);
  const chk = (k) => S.checks.find((c) => c.key === k);
  const liTxt = (k) => ev((k) => ((document.querySelector(`li[data-tschk="${k}"]`) || {}).innerText || '').replace(/\s+/g, ' ').replace(/^[!✓]\s*/, '').trim(), k);
  const pend = chk('pend').values, bkv = chk('bk').values, nsv = chk('ns').values;
  ok('headline check "Booking … → เดินทางจริง … (%)" = the server\'s bk values', (await liTxt('bk')) === `Booking ${bkv.bookings} ใบ · จอง ${bkv.booked} → เดินทางจริง ${bkv.travelled} (${bkv.percent}%)`, await liTxt('bk'));
  ok('headline check "No-show … คน · ยกเลิกหน้างาน … คน" = the server\'s ns values', (await liTxt('ns')) === `No-show ${nsv.no_show} คน · ยกเลิกหน้างาน ${nsv.cxl} คน`, await liTxt('ns'));
  ok('headline check "รอตัดสิน n เคส · เก็บค่าปรับได้ ฿" = the server\'s pend values (t3 has a no-show to decide)', pend.pending >= 1 && (await liTxt('pend')) === `รอตัดสิน ${pend.pending} เคส · เก็บค่าปรับได้ ${money(pend.charged)}`, { got: await liTxt('pend'), pend });
  const pill = await ev(() => { const p = document.querySelector('[data-tsv6="pill"]'); return p ? { t: p.innerText.trim(), w: p.getAttribute('data-w') } : null; });
  ok('close-day badge = the server\'s blocking / can_close', pill && String(pill.w) === String(S.blocking) && (S.can_close ? /ปิดวันได้/.test(pill.t) : pill.t === `เหลือ ${S.blocking} เรื่องก่อนปิดวัน`), { pill, blocking: S.blocking, can: S.can_close });
  const man = await ev(() => Object.fromEntries(Array.from(document.querySelectorAll('tr[data-ops-ts-man]')).map((tr) => [tr.getAttribute('data-ops-ts-man'), { zone: ((tr.querySelector('.ts-ztag') || {}).innerText || ''), net: ((tr.querySelector('.ts-net') || {}).innerText || ''), tot: ((tr.querySelector('.ts-totc') || {}).innerText || ''), cls: tr.className, ao: Array.from(tr.querySelectorAll('.ts-ao')).map((e) => e.innerText.trim()), actual: Array.from(tr.querySelectorAll('td.ts-mono')).map((e) => e.innerText.trim()).find((t) => /^\S+ \/ \d+$/.test(t)) || '' }])));
  const zOf = (g) => g === 'OWN' ? 'Own' : g;
  ok('Zone column: every live row shows the server\'s zone_group (Own for the self-arrival t4, PK for the rest)', S.rows.length >= 8 && S.rows.every((r) => man[r.booking_id] && man[r.booking_id].zone === zOf(r.zone_group)) && S.rows.some((r) => r.zone_group === 'OWN') && S.rows.some((r) => r.zone_group === 'PK'), S.rows.map((r) => [r.booking_id.slice(-4), r.zone_group, man[r.booking_id] && man[r.booking_id].zone]));
  ok('net beside the trip amount: "(2×1,500)" etc. = rows[].net_text (a dash where the server says it cannot)', S.rows.every((r) => man[r.booking_id] && man[r.booking_id].net === (r.net != null ? `(${r.net_text})` : '(—)')) && S.rows.some((r) => r.net != null), S.rows.map((r) => [r.net, r.net_text, man[r.booking_id] && man[r.booking_id].net]));
  const sa = S.rows.find((r) => r.booking_id === bk.sA.id);
  ok('Add-on · Upsell cell = rows[].add_on_lines (charter booking: Longtail Charter, Kayak)', sa.add_on_lines.length >= 2 && JSON.stringify(man[bk.sA.id].ao.map((t) => t.replace(/ ×\d+| \+฿[\d,]+/g, ''))) === JSON.stringify(sa.add_on_lines.map((l) => l.label)), { ao: man[bk.sA.id].ao, lines: sa.add_on_lines.map((l) => l.label) });
  const sc = S.rows.find((r) => r.booking_id === bk.sC.id);
  ok('heads sold on tour: the line "Longtail Join" ×2 with its amount (฿1,000) is in the cell', sc.add_on_lines.some((l) => l.src === 'ex') && man[bk.sC.id].ao.some((t) => /Longtail Join/.test(t) && /1,000/.test(t)), man[bk.sC.id].ao);
  ok('Actual / Booked shows the server\'s travelled, no "?" anywhere (t3: 1 of 2 travelled)', S.rows.every((r) => man[r.booking_id] && man[r.booking_id].actual === `${r.travelled} / ${r.booked}`) && S.rows.some((r) => r.travelled < r.booked), S.rows.map((r) => [r.travelled, r.booked, man[r.booking_id] && man[r.booking_id].actual]));
  const rail = await ev(() => document.querySelector('[data-tsv6="rail"]').innerText);
  ok('pier / route chips count the heads that travelled (the server\'s rows), not "?" or "จอง n"', !/\?|จอง \d/.test(rail), rail);
  const cx = S.cancelled_rows.find((r) => r.booking_id === bk.t6.id);
  ok('cancelled rows: t6 is listed from cancelled_rows (struck row, its zone group from the server)', cx && man[bk.t6.id] && /ts-cxlrow/.test(man[bk.t6.id].cls) && man[bk.t6.id].zone === zOf(cx.zone_group), { cx, m: man[bk.t6.id] });
  // legacy functions, called the way other screens call them
  const fn = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-t4'), t = b.trips[0], b1 = SB_BOOKINGS.find((x) => x.id === 'zz-t1'), t1 = b1.trips[0]; const n1 = tsNetOf({ b: b1, t: t1 });
    return { z4: tsManZoneKey(b, t), z1: tsManZoneKey(b1, t1), net1: n1 && n1.txt, add: tsAddonList({ b: SB_BOOKINGS.find((x) => x.id === 'zz-sA'), t: SB_BOOKINGS.find((x) => x.id === 'zz-sA').trips[0] }, '2026-11-10').map((x) => x.src + ':' + x.t), cxl: tsCxlRows('2026-11-10').map((r) => r.b.id) }; });
  const t1 = S.rows.find((r) => r.booking_id === bk.t1.id);
  ok('tsManZoneKey / tsNetOf / tsAddonList / tsCxlRows called by other screens answer the server\'s values', fn.z4 === 'OWN' && fn.z1 === t1.zone_group && fn.net1 === t1.net_text && fn.add[0] === 'bk:Longtail Charter' && fn.cxl.includes('zz-t6'), fn);

  // scoped totals: pier chip, then VAT
  const n1 = calls.length;
  await ev(() => tsPickPier('tublamu')); await idle(); await waitCalls(/pier=tublamu 200/); await settle(1200);
  ok('the pier chip asked GET …/travel-summary?date=…&pier=tublamu', callsSince(n1).some((c) => /GET \/v1\/reports\/travel-summary\?date=2026-11-10&pier=tublamu 200/.test(c)), callsSince(n1).filter((c) => /travel/.test(c)));
  const SP = await api(`/v1/reports/travel-summary?date=${DAY}&pier=tublamu`);
  const cnt = async () => ev(() => (document.querySelector('[data-tsv6="count"]') || {}).innerText.replace(/\s+/g, ' ').trim());
  ok('headline count of the pier selection = the scoped answer\'s travelled / booked', (await cnt()).includes(`${SP.travelled} / ${SP.booked}`) || (await cnt()).includes(`${SP.booked}`), { cnt: await cnt(), SP: [SP.travelled, SP.booked] });
  const vchips = await ev(() => Object.fromEntries(Array.from(document.querySelectorAll('.h4-seg button')).map((b) => [b.getAttribute('data-tsvat'), (b.querySelector('i') || {}).innerText])));
  ok('VAT chips of the pier = the scoped answer\'s counts (all, vat, no_vat)', String(vchips['']) === String(SP.counts.all) && String(vchips.vat) === String(SP.counts.vat) && String(vchips.novat) === String(SP.counts.no_vat), { vchips, counts: SP.counts });
  const n2 = calls.length;
  await ev(() => tsPickVat('vat')); await idle(); await waitCalls(/vat=vat 200/); await settle(1200);
  const SV = await api(`/v1/reports/travel-summary?date=${DAY}&pier=tublamu&vat=vat`);
  const manV = await ev(() => Array.from(document.querySelectorAll('tr[data-ops-ts-man]')).map((tr) => tr.getAttribute('data-ops-ts-man')));
  ok('VAT chip: GET …&pier=tublamu&vat=vat, and the manifest lists exactly the server\'s rows of that selection (+ its cancelled ones)', callsSince(n2).some((c) => /pier=tublamu&vat=vat 200/.test(c)) && SV.rows.every((r) => manV.includes(r.booking_id)) && manV.filter((id) => !SV.cancelled_rows.some((x) => x.booking_id === id)).length === SV.rows.length, { want: SV.rows.length, got: manV.length });
  // the scoped answer says something the browser's sums would not: the head shows the server's
  await ev(() => { tsPickVat(''); }); await settle(600);
  tamper = [{ re: /travel-summary\?.*pier=tublamu/, fn: (j) => { j.booked = 99; j.travelled = 88; j.bookings = 12; j.checks.find((c) => c.key === 'bk').values.booked = 99; j.checks.find((c) => c.key === 'bk').values.travelled = 88; j.checks.find((c) => c.key === 'pend').values.pending = 5; j.checks.find((c) => c.key === 'pend').warn = true; } }];
  await reset(); await ev(() => { _tsPier = ''; _tsRoute = ''; _tsVatF = ''; tsPickPier('tublamu'); }); await waitFor(() => /88 \/ 99/.test((document.querySelector('[data-tsv6="count"]') || {}).innerText || ''), null, 12000); await settle(500);
  const li2 = async (k) => liTxt(k);
  ok('tampered scoped answer (88 of 99, 5 cases): the headline reads เดินทางจริง 88 / 99 and the check lines read the server\'s values', /88 \/ 99/.test(await cnt()) && (await li2('bk')).includes('จอง 99 → เดินทางจริง 88') && /^รอตัดสิน 5 เคส/.test(await li2('pend')), { cnt: await cnt(), bk: await li2('bk'), pend: await li2('pend') });
  tamper = [];
  // the whole-day answer decides the close-day badge: all three blocking lines warn
  tamper = [{ re: /travel-summary\?date=2026-11-10$/, fn: (j) => { for (const c of j.checks) if (c.blocks) c.warn = true; j.blocking = j.checks.filter((c) => c.blocks).length; j.can_close = false; } }];
  await reset(); await open();
  const pill2 = await ev(() => (document.querySelector('[data-tsv6="pill"]') || {}).innerText.trim());
  ok('tampered whole-day answer (3 blocking lines): the badge reads เหลือ 3 เรื่องก่อนปิดวัน', pill2 === 'เหลือ 3 เรื่องก่อนปิดวัน', pill2);
  // a row the server gives another zone / net: the manifest shows it
  tamper = [{ re: /travel-summary\?date=2026-11-10$/, fn: (j) => { const r = j.rows.find((x) => x.zone_group === 'PK'); r.zone_group = 'KL'; r.net = 4242; r.net_text = '9×9'; } }];
  await reset(); await open();
  const man2 = await ev(() => Object.fromEntries(Array.from(document.querySelectorAll('tr[data-ops-ts-man]')).map((tr) => [tr.getAttribute('data-ops-ts-man'), { zone: ((tr.querySelector('.ts-ztag') || {}).innerText || ''), net: ((tr.querySelector('.ts-net') || {}).innerText || '') }])));
  ok('tampered row (zone KL, net 9×9): the manifest shows KL and (9×9)', Object.values(man2).some((m) => m.zone === 'KL' && m.net === '(9×9)'), Object.values(man2).slice(0, 4));
  tamper = [];
  await reset(); await open();
});

// ═══ 6 · permits on the boat job card ═══
section('6', async () => {
  console.log('\n[6] job card permits: pjDocsHtml <- boats[].permits / fleet[].permits');
  await ev((a) => { window._poPier = a.p; window._poDate = a.d; }, { p: PIER, d: DAY });
  await goView('poj-' + PIER);
  await waitFor((a) => !!(laOps.pier && laOps.pier.dayBoats && laOps.pier.dayBoats.boat(a.p, a.d, 'b7')), { p: PIER, d: DAY }, 25000);
  await idle(); await settle(1500);
  const list = await api(`/v1/pier-office/${PIER}/days/${DAY}/boats`);
  const P6 = list.boats.find((b) => b.boat_id === 'b6').permits, P7 = list.boats.find((b) => b.boat_id === 'b7').permits;
  const lines = () => ev(() => Array.from(document.querySelectorAll('.pj-docs .pj-dl')).map((e) => ({ cls: e.className.replace('pj-dl', '').trim(), nm: e.querySelector('.nm').innerText.replace(/\s+/g, ' ').trim(), vl: e.querySelector('.vl').innerText.trim() })));
  let L = await lines();
  ok('server: b7\'s programme enters Similan and Surin; the expired Surin permit is worst, 1 more', P7.for_route && P7.worst.type === 'surin' && P7.worst.level === 'x' && P7.more === 1, P7);
  ok('card of b7: "ใบอนุญาต สุรินทร์ +1" in the expired colour (x), the expiry and days over as legacy words them', L.some((l) => l.cls === 'x' && l.nm === 'ใบอนุญาต สุรินทร์+1' && /^หมด .* · เกิน 9 วัน$/.test(l.vl)), L);
  ok('card of b6: "ใบอนุญาต สิมิลัน" d2 with "เหลือ 20 วัน" (server level d2)', P6.worst.level === 'd2' && L.some((l) => l.cls === 'd2' && l.nm === 'ใบอนุญาต สิมิลัน' && /เหลือ 20 วัน$/.test(l.vl)), { P6: P6.worst, L });
  ok('the first line of each card is still the boat licence (the browser\'s documents)', L.filter((l) => l.nm === 'ใบอนุญาตใช้เรือ').length >= 2, L);
  // the server says something the browser's rule would not: the card prints it
  tamper = [{ re: /\/pier-office\/tublamu\/days\/[^/]+\/boats$/, fn: (j) => { for (const b of [j.boats.find((x) => x.boat_id === 'b6'), (j.fleet || []).find((x) => x.boat_id === 'b6')]) if (b && b.permits && b.permits.worst) { b.permits.worst.level = 'd1'; b.permits.worst.days_left = 3; } } }];
  await ev(() => { laOps.wrote('walk'); renderPierJob(_poPier); }); await waitFor(() => Array.from(document.querySelectorAll('.pj-docs .pj-dl.d1')).length > 0, null, 12000); await settle(500);
  L = await lines();
  ok('tampered answer (b6 permit at 3 days): the card prints d1 "เหลือ 3 วัน"', L.some((l) => l.cls === 'd1' && /เหลือ 3 วัน$/.test(l.vl)), L);
  tamper = [];
  await ev(() => { laOps.wrote('walk'); renderPierJob(_poPier); }); await waitFor(() => Array.from(document.querySelectorAll('.pj-docs .pj-dl.d2')).length > 0, null, 12000); await settle(300);
});

// ═══ 7 · the "Pickup zone" dialog ═══
section('7', async () => {
  console.log('\n[7] pickup zone dialog: _bkV2ZonePickPlan <- GET …/pickup-area-plan · bookingV2ZonePickConfirm -> PATCH {pickup_area_id, refresh_pickup_times}');
  await waitFor(() => SB_BOOKINGS.some((b) => b.id === 'zz-zOwn' && b.opsId), null, 15000).catch(() => null);
  await ev(() => bookingV2EnsureOpsRange({ from: '2026-11-10', to: '2026-11-10', refresh: true })); await idle(); await settle(800);
  await ev(() => laOps.pickup.load());     // the areas and times of the server (the app reads them when Pickup Setup or a booking form needs them)
  const open = (id) => ev((id) => { bookingV2ZonePickOpen(document.body, id, '2026-11-10'); }, id);
  const info = () => ev(() => { const i = document.getElementById('bkv2-zonepick-info'); return { t: i ? i.innerText.replace(/\s+/g, ' ').trim() : null, box: !!document.getElementById('bkv2-zonepick-time') }; });
  // the booking on the area's own time
  const n0 = calls.length;
  await open('zz-zOwn');
  await ev((id) => bookingV2ZonePickSel(id), areaB.id);
  await waitCalls(/pickup-area-plan/, 8000); await settle(900);
  const planOwn = await api(`/v1/bookings/${bk.zOwn.id}/pickup-area-plan?pickup_area_id=${areaB.id}`);
  let I = await info();
  ok('selecting an area asks GET /v1/bookings/{id}/pickup-area-plan?pickup_area_id=…', callsSince(n0).some((c) => new RegExp(`GET /v1/bookings/${bk.zOwn.id}/pickup-area-plan\\?pickup_area_id=${areaB.id} 200`).test(c)), callsSince(n0).filter((c) => /plan/.test(c)));
  ok('own time: the dialog offers the box and shows 07:00-07:15 → 08:00-08:15 (the server\'s change)', I.box && /07:00-07:15/.test(I.t) && /08:00-08:15/.test(I.t) && planOwn.changes.length === 1, { I, planOwn: planOwn.changes });
  ok('the price-zone warning (PK trip, KL area) is the server\'s zone_differs', planOwn.zone_differs === true && /โซนราคา|โซน/.test(I.t) && /⚠|⚠/.test(I.t), { I });
  const b0 = bodies.length;
  await ev(() => bookingV2ZonePickConfirm()); await idle(); await settle(1500);
  const pr = bodies.slice(b0).filter((x) => /^PATCH \/v1\/bookings\//.test(x.k));
  const own = await api('/v1/bookings/' + bk.zOwn.id);
  ok('confirm sends only {pickup_area_id, refresh_pickup_times:true}: one PATCH, no trips, no totals, no price', pr.length === 1 && JSON.stringify(Object.keys(JSON.parse(pr[0].req)).sort()) === JSON.stringify(['pickup_area_id', 'refresh_pickup_times']) && JSON.parse(pr[0].req).refresh_pickup_times === true, pr.map((x) => x.req));
  ok('server: area B, the time followed (08:00-08:15), the price and the trip zone are as they were', own.pickup_area_id === areaB.id && own.trips[0].pickup_time === '08:00' && own.trips[0].pickup_time_end === '08:15' && own.trips[0].zone === 'PK', { a: own.pickup_area_id, t: own.trips[0].pickup_time, z: own.trips[0].zone });
  const hist = (await api(`/v1/bookings/${bk.zOwn.id}/history`)).history || [];
  ok('server: one history line "Pickup zone: … -> … · pickup time …"', hist.some((h) => /^Pickup zone: F2 Area A -> F2 Area B · pickup time/.test(h.text)), hist.map((h) => h.text));
  const scr = await ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-zOwn'); return { area: b.pickupAreaId, pt: b.trips[0].pickupTime, dlg: !!document.getElementById('bkv2-zonepick') }; });
  ok('screen: the booking shows area B and the new time, the dialog closed', scr.area === areaB.id && /08:00/.test(scr.pt) && !scr.dlg, scr);
  // the booking whose time was typed by hand
  const n1 = calls.length;
  await open('zz-zTyped');
  await ev((id) => bookingV2ZonePickSel(id), areaB.id);
  await waitCalls(new RegExp(`${bk.zTyped.id}/pickup-area-plan`), 8000); await settle(900);
  const planTyped = await api(`/v1/bookings/${bk.zTyped.id}/pickup-area-plan?pickup_area_id=${areaB.id}`);
  I = await info();
  ok('server: the typed time (09:30) is kept: no change, kept [hand_edited]', planTyped.changes.length === 0 && planTyped.kept.length === 1 && planTyped.kept[0].why === 'hand_edited', planTyped);
  ok('typed time: the dialog has no box to tick (the browser\'s pickupTimeEdited flag does not decide), still the zone warning', !I.box && /⚠/.test(I.t), I);
  const b1 = bodies.length;
  await ev(() => bookingV2ZonePickConfirm()); await idle(); await settle(1500);
  const pr1 = bodies.slice(b1).filter((x) => /^PATCH \/v1\/bookings\//.test(x.k)), typed = await api('/v1/bookings/' + bk.zTyped.id);
  ok('confirm without a box sends only {pickup_area_id}; the typed 09:30 stays', pr1.length === 1 && JSON.stringify(JSON.parse(pr1[0].req)) === JSON.stringify({ pickup_area_id: areaB.id }) && typed.trips[0].pickup_time === '09:30' && typed.pickup_area_id === areaB.id, { req: pr1.map((x) => x.req), t: typed.trips[0].pickup_time });
  // the plan says something the browser would not
  tamper = [{ re: /pickup-area-plan/, fn: (j) => { j.changes = [{ trip_id: bk.zTyped.trip, service_date: DAY, route_id: rZp, from: '09:30', to: '10:45-11:00' }]; } }];
  await ev(() => laOps.pickupPlan.clear());
  await open('zz-zTyped');
  await ev((id) => bookingV2ZonePickSel(id), areaA.id);
  await waitFor(() => !!document.getElementById('bkv2-zonepick-time'), null, 8000); await settle(500);
  I = await info();
  ok('tampered plan (09:30 → 10:45-11:00): the dialog shows the server\'s time and the box', I.box && /10:45-11:00/.test(I.t) && /09:30/.test(I.t), I);
  tamper = [];
  await ev(() => document.getElementById('bkv2-zonepick') && document.getElementById('bkv2-zonepick').remove());
  // a refusal is shown as the server words it, nothing changes in the browser
  const d0 = refusals.length;
  await ev(() => { window._bkV2ZonePick = { bkId: 'zz-zTyped', date: '2026-11-10', sel: 'no_such_area', zone: '' }; });
  await ev(() => bookingV2ZonePickConfirm()); await idle(); await settle(900);
  const typed2 = await api('/v1/bookings/' + bk.zTyped.id);
  ok('an unknown area: the server refuses (400), the booking is unchanged', typed2.pickup_area_id === areaB.id, { ref: refusals.slice(d0), area: typed2.pickup_area_id });
});

for (const [name, fn] of todo) {
  if (ONLY && !ONLY.includes(name)) continue;
  try { await fn(); } catch (e) { ok('section ' + name + ' ran to the end', false, String(e.stack || e).slice(0, 900)); }
}
const stray = bodies.filter((x) => /^PUT .*\/checkins\/(van|pier)\/\d+$/.test(x.k));
ok('the whole walk sent no whole-record check-in PUT', stray.length === 0, stray.map((x) => x.k));
console.log('\nbrowser errors:', errors.length ? errors : 'none');
console.log('server refusals:', refusals.length ? refusals : 'none');
console.log('native dialogs:', dialogs);
console.log(fails.length ? '\nFAILED: ' + fails.join(' | ') : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
