import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;

// ── local backend ──
const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = '';
const opsPort = await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 30000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m){ clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const api = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  return r.status === 204 ? null : r.json();
};

// ── app ──
const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });

const cleanup = () => {
  try { backend.kill(); } catch (_) {}
  try { srv.close(); } catch (_) {}
  try { browser.close(); } catch (_) {}
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], bodies = [];      // refusals: every 4xx/5xx the server answered the app (listed at the end)
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname); if (req.method() !== 'GET') bodies.push([req.method() + ' ' + u.pathname, req.postData() || '']);
  // forward what the client means: its login, body type, and If-Match (lock writes and booking writes after
  // the create carry the version they read; operation-backend checks it · src/routes/operations.ts seat-lock
  // routes "Every write to one lock needs its version", c9bbf2d). Dropping it made every lock edit fail here.
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' → ' + r.status + ' ' + buf.toString().slice(0, 220));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 160)); d.type() === 'prompt' ? d.accept('Tester') : d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got).slice(0, 400))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));      // every queued write has finished
const ev = (fn, arg) => page.evaluate(fn, arg);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const D1 = day(1), D2 = day(2), D3 = day(3), D4 = day(4);
const D = (n) => day(n);
const findings = {};        // item -> [ [label, ok, evidence] ]
let cur = 0;
const item = (n, title) => { cur = n; findings[n] = []; console.log(`\n[${n}] ${title}`); };
const chk = (name, cond, got) => { ok(name, cond, got); findings[cur].push([name, !!cond, cond ? '' : JSON.stringify(got).slice(0, 300)]); };
const waitFor = async (fn, arg, ms = 6000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
let s;
const clickText = async (sel) => { await page.click(sel); };
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b) });

item(1, 'saveBoat · add / edit boat modal');
let c1 = calls.length;
await ev(() => { openBoatModal(); openModal('boat-modal'); });
await page.fill('#fm-boat-name', 'Walk Boat'); await page.fill('#fm-boat-licensepax', '20'); await page.fill('#fm-boat-crew', '2'); await page.fill('#fm-boat-cap', '18');
await page.selectOption('#fm-boat-type', 'Speedboat');
await page.click('#boat-modal button[onclick="saveBoat()"]');
await idle(); await settle(800);
let sb = (await api('/v1/boats')).boats.find((b) => b.name === 'Walk Boat');
chk('add → POST /v1/boats, boat on server (capacity 18, license 20, crew 2)', calls.slice(c1).includes('POST /v1/boats') && sb && sb.capacity === 18 && sb.license_pax === 20 && sb.crew === 2, { calls: calls.slice(c1), sb });
s = await ev((id) => ({ b: BOATS.find((x) => x.name === 'Walk Boat'), open: document.getElementById('boat-modal').classList.contains('open') }), 0);
chk('screen has the boat with the server id · modal closed', s.b && sb && s.b.id === sb.id && !s.open, s);
const wid = sb && sb.id;
await ev((id) => flOpenEditBoatModal(id), wid);
await page.fill('#fm-boat-name', 'Walk Boat 2'); await page.fill('#fm-boat-cap', '16');
c1 = calls.length;
await page.click('#boat-modal button[onclick="saveBoat()"]');
await idle(); await settle(800);
sb = await api('/v1/boats/' + wid);
chk('edit → PATCH /v1/boats/{id}: name + capacity 16 on server', calls.slice(c1).includes('PATCH /v1/boats/{id}'.replace('{id}', wid)) && sb.name === 'Walk Boat 2' && sb.capacity === 16, { calls: calls.slice(c1), sb });
await page.reload(); await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 }); await settle(1500);
s = await ev((id) => BOATS.find((x) => x.id === id), wid);
chk('survives reload (name + cap)', s && s.name === 'Walk Boat 2' && s.cap === 16, s && { name: s.name, cap: s.cap });
// oversell: deploy Walk Boat on D5 r5, book 14 pax, then edit seats to 8 → 409 seats_sold → asks → capacity_anyway
const D5 = D(5);
await post('/operations/deployments', { boat_id: wid, route_id: 'r5', service_date: D5, capacity: 16 });
const bkr = await post('/v1/bookings', { external_id: 'zz-walk-1', intent: 'confirm', agentId: 'a01', leadPax: 'ZZ WALK', pickupSelf: true, trips: [{ routeId: 'r5', date: D5, pax: { ad_fr: 14 }, zone: 'NoTransfer' }] });
const aa = await post('/operations/deployments/' + D5 + '/auto-assign', { route_id: 'r5' });
await ev((id) => flOpenEditBoatModal(id), wid);
await page.fill('#fm-boat-cap', '8');
const dn = dialogs.length; c1 = calls.length;
await page.click('#boat-modal button[onclick="saveBoat()"]');
await idle(); await settle(1000);
const sent = calls.slice(c1).filter((c) => /PATCH \/v1\/boats/.test(c));
sb = await api('/v1/boats/' + wid);
chk('oversell edit: refused 409 seats_sold, asked, resent (2 PATCH) and server now 8', refusals.some((r) => /409/.test(r) && /seats_sold|sold/i.test(r)) && sent.length === 2 && sb.capacity === 8, { aa, sent, cap: sb.capacity, dialogs: dialogs.slice(dn), ref: refusals.slice(-2), bk: bkr && bkr.id });
console.log('   dialogs:', dialogs.slice(dn));

item(2, 'saveRoute · Programs form');
await ev(() => { openRouteModal(); });
await page.fill('#fm-route-name', 'Walk Route'); await page.fill('#fm-route-islands', 'Koh Walk');
await page.click('#loc-panwa');
await page.selectOption('#fm-route-family', 'similan');
c1 = calls.length; let b1 = bodies.length;
await page.click('#route-modal button[onclick="saveRoute()"]');
await idle(); await settle(800);
let rts = (await api('/v1/routes')).routes || [];
let wr = rts.find((r) => r.name === 'Walk Route');
chk('add → POST /v1/routes; server holds name, islands, pier panwa, family similan', calls.slice(c1).includes('POST /v1/routes') && wr && wr.islands === 'Koh Walk' && wr.pier === 'panwa' && wr.family_id === 'similan', { calls: calls.slice(c1), wr, n: rts.length });
chk('body has no daily_cap', !bodies.slice(b1).some((b) => /daily_cap|dailyCap/.test(b[1])), bodies.slice(b1));
s = await ev((n) => ({ r: ROUTES.find((x) => x.name === n), open: document.getElementById('route-modal').classList.contains('open') }), 'Walk Route');
chk('screen: route in ROUTES with the server id · modal closed', s.r && wr && s.r.id === wr.id && !s.open, s);
await ev((id) => openRouteModal(id), wr && wr.id);
await page.fill('#fm-route-name', 'Walk Route Edited'); await page.click('#loc-tublamu');
c1 = calls.length;
await page.click('#route-modal button[onclick="saveRoute()"]');
await idle(); await settle(800);
wr = ((await api('/v1/routes')).routes || []).find((r) => r.id === wr.id);
chk('edit → PATCH /v1/routes/{id}; name + pier tublamu on server', calls.slice(c1).includes('PATCH /v1/routes/' + wr.id) && wr.name === 'Walk Route Edited' && wr.pier === 'tublamu', { calls: calls.slice(c1), wr });

item(3, 'bsCleanupLog · boat status-log clean-up');
// the server keeps a log without overlaps, so the overlap is made on the SCREEN's copy (a stale screen): the
// clean-up is the real function; what it removes / moves must reach the server
const E = (status, from, to, extra) => post('/v1/boats/b13/status-log', Object.assign({ status, from_date: from, to_date: to, province: 'Phuket', loc_type: 'pier', loc: 'Panwa', reason: status === 'unavailable' ? 'test' : undefined }, extra || {}));
const eA = await E('unavailable', '2026-12-01', '2026-12-05');
const eB = await E('available', '2026-12-10', '2026-12-12');
const eC = await E('unavailable', '2026-12-20', '2026-12-22');
await ev(() => laOps.fleetBoats.refetchBoat('b13'));
chk('server holds the 3 entries', eA && eB && eC && eA.id && eB.id && eC.id, { eA, eB, eC });
// screen copy: A runs on to 12-15 (overlaps B) · C is covered by B starting before it (B.from = C.from)
await ev((a) => { const b = BOATS.find((x) => x.id === 'b13'); b.log.find((e) => e.id === a.A).to = '2026-12-15'; b.log.find((e) => e.id === a.C).from = '2026-12-10'; b.log.find((e) => e.id === a.C).to = '2026-12-10'; }, { A: eA.id, C: eC.id });
c1 = calls.length; const dn3 = dialogs.length;
await ev(() => bsCleanupLog('b13'));
await idle(); await settle(900);
const sc = calls.slice(c1).filter((c) => /status-log/.test(c));
const srvBoat = await api('/v1/boats/b13');
const sl = srvBoat.status_log || [];
chk('clean-up asked (confirm) and sent writes: ' + sc.join(' | '), dialogs.slice(dn3).some((d) => /confirm/.test(d)) && sc.length >= 1, { sc, dialogs: dialogs.slice(dn3) });
chk('server: A end date moved to the day before B (2026-12-09) [PATCH to_date]', (sl.find((e) => e.id === eA.id) || {}).to_date === '2026-12-09', sl.map((e) => [e.id, e.from_date, e.to_date]));
s = await ev((id) => (BOATS.find((x) => x.id === 'b13').log || []).map((e) => [e.id, e.from, e.to]), 0);
console.log('   server log:', JSON.stringify(sl.map((e) => [e.from_date, e.to_date])), ' screen log:', JSON.stringify(s));
//__END__
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
console.log('\npage errors: ' + errors.length + '\n  ' + errors.slice(0, 10).join('\n  '));
console.log('\nSUMMARY');
for (const n of Object.keys(findings)) { const f = findings[n]; console.log(` item ${n}: ${f.filter((x) => x[1]).length}/${f.length} ok` + f.filter((x) => !x[1]).map((x) => '\n     FAIL ' + x[0]).join('')); }
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
