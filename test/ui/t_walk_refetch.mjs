// t_walk_refetch · the booking list must not be re-paged by remote change-feed events
//
//   node test/ui/t_walk_refetch.mjs      (OPS_BACKEND_DIR, default D:/projects/operation-backend)
//   REFETCH_IDLE_MS=120000 for the 2-minute run (default 70 s: the feed polls every 20 s)
//
// Opens the Booking screen on a month holding >100 bookings (so one load is several pages), waits idle while
// "another client" writes (deployment, booking, boat), and counts GET /v1/bookings list requests. Before the fix
// every remote event dropped the range cache and the next draw re-paged the month.
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const IDLE = +process.env.REFETCH_IDLE_MS || 70000;

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
  const text = r.status === 204 ? '' : await r.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { status: r.status, body };
};
const post = (p, b) => raw(p, { method: 'POST', body: JSON.stringify(b || {}) });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push({ at: Date.now(), line: req.method() + ' ' + u.pathname + u.search });
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got).slice(0, 600))); if (!cond) fails.push(name); };

// a month holding 130 bookings (the 15th of the current month)
const now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'), DAY = ym + '-15', DAY2 = ym + '-16';
await post('/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DAY, capacity: 40 });
await post('/operations/deployments', { boat_id: 'b1', route_id: 'r4', service_date: DAY2, capacity: 64 });
const book = (ext, lead) => post('/v1/bookings', { external_id: ext, intent: 'quote', agentId: 'a01', leadPax: lead, leadNationality: 'RU', pickupSelf: true,
  guides: { english: true }, trips: [{ routeId: 'r5', date: DAY, pax: { ad_fr: 1 }, zone: 'NoTransfer' }] });
let made = 0, lastErr = null;
for (let i = 0; i < 130; i++) { const r = await book('zz-rf-' + i, 'ZZ RF ' + i); if (r.status === 201) made++; else lastErr = r.body; }
console.log('seeded bookings:', made, lastErr ? JSON.stringify(lastErr).slice(0, 200) : '');
ok('setup: >100 bookings seeded (one load = several pages)', made > 100, made);

const isList = (c) => /^GET \/v1\/bookings\?/.test(c.line);
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await page.waitForTimeout(6000);
const t0 = Date.now();
const initial = calls.filter(isList).length;
console.log('list requests after the first load:', initial);
ok('first load fetched the month', initial >= 1, initial);

// remote events from "another client": a booking, a deployment, a boat
const burst = async (n) => {
  await post('/operations/deployments', { boat_id: 'b7', route_id: 'r5', service_date: DAY2, capacity: 30 + n });
  await book('zz-rf-ev-' + n, 'ZZ RF EV ' + n);
  await raw('/v1/boats/b13', { method: 'PATCH', body: JSON.stringify({ note: 'ev ' + n }) });
};
let n = 0;
while (Date.now() - t0 < IDLE) {
  await burst(++n);
  // a redraw every few seconds, as clicking around would do
  await page.evaluate(() => { if (typeof bookingV2Render === 'function') bookingV2Render(); });
  await page.waitForTimeout(9000);
}
await page.waitForTimeout(3000);
const lists = calls.filter(isList), singles = calls.filter((c) => /^GET \/v1\/bookings\/[^?/]+$/.test(c.line));
console.log('events sent: ' + n + ' bursts; GET /v1/bookings? total: ' + lists.length + ' (after first load: ' + (lists.length - initial) + '); GET /v1/bookings/{id}: ' + singles.length);
lists.forEach((c) => console.log('   ' + ((c.at - t0) / 1000).toFixed(1) + 's ' + c.line));
const seen = await page.evaluate(() => SB_BOOKINGS.filter((b) => /^ZZ RF EV/.test(b.leadPax)).length);
console.log('remote bookings visible in SB_BOOKINGS:', seen, 'of', n);
ok('remote events do not re-page the month (list requests after the first load stay bounded)', lists.length - initial <= 2, lists.length - initial);
ok('a remote booking reaches the screen (targeted refresh)', seen >= n - 1, seen);
ok('no page errors', errors.length === 0, errors);
await browser.close(); srv.close(); backend.kill();
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
