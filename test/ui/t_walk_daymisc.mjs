// t_walk_daymisc · Q49 (Boat Operation past day: admin edits, others blocked) and Q34a (an open Van Check-in repaints
// when somebody else changes something), against a REAL operation-backend (in-process store, seeded).
//   node test/ui/t_walk_daymisc.mjs
// Every check reads BOTH sides: the screen and what the server holds (asked directly).
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
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const login = async (username, password) => (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) })).json()).access_token;
const token = await login('tester', 'pw');
const apiRaw = async (p, init = {}, tok = token) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + tok, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await apiRaw(p, init)).body;
const send = (m, p, b, tok) => apiRaw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) }, tok);

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

const errors = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
const calls = [];
// one browser context per login; every call to the production host goes to the in-process backend
async function openApp(tok, who) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, tok);
  await ctx.route(PROD, async (route) => {
    const req = route.request(), u = new URL(req.url());
    const hd = req.headers(), fwd = {};
    for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
    const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
    const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
    calls.push(who + ' ' + req.method() + ' ' + u.pathname + ' ' + r.status);
    await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
  });
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('pageerror', (e) => errors.push(who + ' pageerror: ' + String(e.stack || e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(who + ' console: ' + m.text().slice(0, 300)); });
  page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); d.accept(); });
  await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
  await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  return { page, dialogs, ev: (fn, arg) => page.evaluate(fn, arg), idle: () => page.evaluate(() => window.laOps.queue(() => null)) };
}

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 500))); if (!cond) fails.push(name); };
const bangkok = (plus) => new Date(Date.now() + 7 * 3600e3 + plus * 86400e3).toISOString().slice(0, 10);
const PAST = bangkok(-2), DAY = bangkok(10);

// ── seed through the API (as the admin) ──
const dep = await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: PAST, capacity: 40 });
console.log('seed past deployment (admin):', dep.status);
const nu = await send('POST', '/v1/users', { username: 'ops2', password: 'secret12', name: 'Ops Two', role: 'staff', edit_areas: ['operations'], can_edit: true });
console.log('seed non-admin user:', nu.status, nu.status >= 400 ? JSON.stringify(nu.body) : '');
const opsTok = await login('ops2', 'secret12');
const depsOn = async (d) => ((await api(`/operations/deployments?from=${d}&to=${d}`)).deployments || []).map((x) => x.boat_id + '@' + x.route_id);

// Van Check-in data for Q34a
await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DAY, capacity: 40 });
const vanA = (await send('POST', '/operations/vans', { name: 'Van Alpha', capacity: 9 })).body;
await send('PUT', `/operations/van-days/${DAY}/${vanA.id}`, { route_ids: ['r5'] });
const mk = async (id, lead, pax) => (await send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  guides: { english: true }, pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: 'r5', date: DAY, pax: { ad_fr: pax }, zone: 'PK' }] })).body;
const m1 = await mk('zz-m1', 'MISC ONE', 2), m2 = await mk('zz-m2', 'MISC TWO', 1);
if (!m1.trips) { console.log('booking refused', JSON.stringify(m1)); process.exit(2); }
const grp = await send('POST', '/operations/van-groups', { service_date: DAY, route_id: 'r5', zone: 'PK', members: [{ trip_id: m1.trips[0].id }, { trip_id: m2.trips[0].id }], van_id: vanA.id });
console.log('seed bookings/group:', m1.id ? 'ok' : JSON.stringify(m1), grp.status);

// ════════════ Q49 · Boat Operation, a past day ════════════
console.log('\n[Q49] Boat Operation: past day');
const admin = await openApp(token, 'admin');
const staff = await openApp(opsTok, 'staff');
const A = await admin.ev(() => ({ role: window.LA_ME && window.LA_ME.role, isAdmin: laIsAdmin() }));
const S = await staff.ev(() => ({ role: window.LA_ME && window.LA_ME.role, isAdmin: laIsAdmin() }));
ok('the frontend knows who is admin: LA_ME.role / laIsAdmin() (admin yes, staff no)', A.isAdmin === true && S.isAdmin === false, { A, S });
const pastA = await admin.ev((p) => ({ isPast: bop2IsPast(p), guard: bop2GuardPast(p, true) }), PAST);
const pastS = await staff.ev((p) => ({ isPast: bop2IsPast(p), guard: bop2GuardPast(p, true) }), PAST);
ok('admin: a past day is not locked (bop2IsPast false, guard passes)', pastA.isPast === false && pastA.guard === false, pastA);
ok('non-admin: a past day is locked (bop2IsPast true, guard blocks)', pastS.isPast === true && pastS.guard === true, pastS);
// the admin puts a second boat on the past day: the screen function runs, the server accepts it
let n0 = calls.length;
await admin.ev((p) => bop2AssignBoat('r5', p, 'b7'), PAST);
await admin.page.waitForTimeout(1200); await admin.idle(); await admin.page.waitForTimeout(500);
const postsA = calls.slice(n0).filter((c) => /^admin POST \/operations\/deployments /.test(c));
ok('admin: assigning a boat on a past day sends POST /operations/deployments and the server answers 2xx', postsA.length === 1 && / 20[01]$/.test(postsA[0]), calls.slice(n0));
ok('server: the admin\'s boat is on the past day (b6 and b7)', (await depsOn(PAST)).sort().join() === 'b6@r5,b7@r5', await depsOn(PAST));
// the admin removes it again
n0 = calls.length;
await admin.ev((p) => bop2UnassignBoat(p, 'b7'), PAST);
await admin.page.waitForTimeout(1200); await admin.idle(); await admin.page.waitForTimeout(500);
ok('admin: removing it on a past day is accepted too (DELETE 2xx, server back to b6)', calls.slice(n0).some((c) => /^admin DELETE \/operations\/deployments\/\S+ 20\d$/.test(c)) && (await depsOn(PAST)).join() === 'b6@r5', { c: calls.slice(n0), d: await depsOn(PAST) });
// the non-admin is blocked, with the server's wording, and nothing is sent
n0 = calls.length; const d0 = staff.dialogs.length;
await staff.ev((p) => bop2AssignBoat('r5', p, 'b7'), PAST);
await staff.ev((p) => bop2UnassignBoat(p, 'b6'), PAST);
await staff.page.waitForTimeout(1500); await staff.idle();
const sdl = staff.dialogs.slice(d0);
ok('non-admin: an alert with the server\'s text ("is in the past ... ask an admin to correct it") for both actions', sdl.length === 2 && sdl.every((m) => m.includes(PAST + ' is in the past: a deployment can\'t change') && /ask an admin to correct it/.test(m)), sdl);
ok('non-admin: no write is sent, server unchanged (still only b6)', !calls.slice(n0).some((c) => /^staff (POST|DELETE|PUT|PATCH) \/operations\/deployments/.test(c)) && (await depsOn(PAST)).join() === 'b6@r5', { c: calls.slice(n0), d: await depsOn(PAST) });
// and the server itself refuses a non-admin who gets past the screen (the rule is the server's)
const direct = await send('POST', '/operations/deployments', { boat_id: 'b7', route_id: 'r5', service_date: PAST, capacity: 34 }, opsTok);
ok('server: a non-admin POST on a past day is 409 past_date', direct.status === 409 && direct.body && direct.body.code === 'past_date', direct);
await staff.page.close();

// ════════════ Q34a · Van Check-in repaints on other people's changes ════════════
console.log('\n[Q34a] Van Check-in repaints when somebody else changes something');
const openCk = async () => {
  await admin.ev((d) => { _vanCkDate = d; const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el); renderVanCheckin(); }, DAY);
  await admin.page.waitForSelector('#vancheckin-host .vck-arr', { timeout: 15000 });
  await admin.idle(); await admin.page.waitForTimeout(800);
};
const rowStatus = (id) => admin.ev((i) => { const s = [...document.querySelectorAll('#vancheckin-host .vck-sel')].find((x) => (x.getAttribute('onchange') || '').includes("'" + i + "'")); return s ? s.value : null; }, id);
const pull = () => admin.ev(() => window.laOps.changes.pull());
const waitStatus = async (want) => { let st = null; for (let i = 0; i < 24 && st !== want; i++) { await admin.page.waitForTimeout(500); st = await rowStatus('zz-m1'); } return st; };
await openCk();
await admin.page.waitForFunction(() => window.laOps.changes && window.laOps.changes.started(), null, { timeout: 15000 });
const before = await rowStatus('zz-m1');
ok('Van Check-in open: the row waits', before === '', before);
// another session marks the driver as arrived (straight to the server): the rows go to standby
const arr = await send('PUT', `/operations/van-arrivals/${DAY}/${vanA.id}/r5`);
ok('server: another session marked the van arrived', arr.status === 200 && arr.body.moved_to_standby === 2, arr);
await pull();
ok('screen: the open Van Check-in shows Standby after the change arrives, without re-opening it', (await waitStatus('standby')) === 'standby', await rowStatus('zz-m1'));
// scroll position is kept
await admin.ev(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 120); });
const y0 = await admin.ev(() => window.scrollY);
await send('DELETE', `/operations/van-arrivals/${DAY}/${vanA.id}/r5`);
await pull();
const back = await waitStatus('');
const y1 = await admin.ev(() => window.scrollY);
ok('screen: row back to Wait after the arrival is removed; scroll position kept', back === '' && Math.abs(y1 - y0) <= 2 && y0 > 0, { back, y0, y1 });
// typing is not interrupted: while a field has focus the redraw waits
const box = await admin.ev(() => { const el = document.querySelector('#vancheckin-host input[type=text], #vancheckin-host input:not([type]), #vancheckin-host textarea'); if (!el) return null; el.id = el.id || 'zz-typing'; return el.id; });
if (!box) { console.log('  note  no text field on this screen state; typing check skipped'); } else {
  await admin.page.focus('#' + box); await admin.page.keyboard.type('hello');
  const el0 = await admin.ev((i) => { window.__typingEl = document.getElementById(i); return document.getElementById(i).value; }, box);
  await send('PUT', `/operations/van-arrivals/${DAY}/${vanA.id}/r5`);
  await pull(); await admin.page.waitForTimeout(1200);
  const kept = await admin.ev((i) => ({ same: document.getElementById(i) === window.__typingEl, v: document.getElementById(i) && document.getElementById(i).value }), box);
  ok('typing: while a field has focus the screen is not redrawn (same element, text kept)', kept.same && kept.v === el0 && el0 === 'hello', { kept, el0 });
  await admin.page.evaluate(() => document.activeElement && document.activeElement.blur());
  let redrawn = false; for (let i = 0; i < 24 && !redrawn; i++) { await admin.page.waitForTimeout(500); redrawn = await admin.ev((i2) => document.getElementById(i2) !== window.__typingEl, box); }
  ok('typing: once the field is left the waiting change is drawn (the screen is redrawn)', redrawn, null);
}

// ════════════ Q34d · the trip amount without opening Travel Summary ════════════
console.log('\n[Q34d] trip amount from the server without opening Travel Summary');
const nA = calls.length;
const amt = await admin.ev((d) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-m1'); const t = (b.trips || []).find((x) => x.date === d); return { fallback: tsTripAmount(b, t), own: !!tsTripAmount.__ownRead }; }, DAY);
await admin.page.waitForTimeout(1500);
const amt2 = await admin.ev((d) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-m1'); const t = (b.trips || []).find((x) => x.date === d); return tsTripAmount(b, t); }, DAY);
const srvRow = ((await api('/v1/after-trip?date=' + DAY)).rows || []).find((r) => r.booking_id === m1.id);
const afterCalls = calls.slice(nA).filter((c) => /^admin GET \/v1\/after-trip /.test(c));
ok('the screen asked GET /v1/after-trip itself (once), Travel Summary never opened', amt.own && afterCalls.length === 1, { amt, afterCalls });
ok('tsTripAmount now answers the server\'s trip_amount (' + (srvRow && srvRow.trip_amount) + ')', srvRow && srvRow.trip_amount != null && amt2 === Number(srvRow.trip_amount), { amt, amt2, srvRow });

console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
ok('no page errors', errors.length === 0, errors);
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
