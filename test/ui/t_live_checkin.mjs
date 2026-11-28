// t_live_checkin · two browsers on one REAL operation-backend (in-process store, no database, no customer data):
// machine A ticks a check-in, how long until machine B's open check-in screen shows it? (§ckSse, PR #137)
//
//   node test/ui/t_live_checkin.mjs     (OPS_BACKEND_DIR = the operation_backend checkout, with node_modules)
//   LIVE_N=10 rounds per screen · prints min / median / max of: B's data has it, B's screen shows it
//
// The app talks to the local backend directly (LA_CONFIG.opsBackend), not through page.route: route.fulfill
// buffers a whole answer, so the change stream would never reach the page.
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const N = +process.env.LIVE_N || 10;

const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = '';
const opsPort = await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 30000);
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const send = async (method, p, body) => {
  const r = await fetch(OPS + p, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) { j = t; }
  if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${t.slice(0, 300)}`);
  return j;
};

const DAY = '2026-11-10';
await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DAY, capacity: 40 });
const van = await send('POST', '/operations/vans', { name: 'Van Live', capacity: 12 });
await send('PUT', `/operations/van-days/${DAY}/${van.id}`, { route_ids: ['r5'] });
const b = await send('POST', '/v1/bookings', { external_id: 'zz-live', intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: 'LIVE TEST', leadNationality: 'RU',
  leadPhone: '+7 900 1', pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: 'r5', date: DAY, pax: { ad_fr: 2 }, zone: 'PK' }] });
await send('POST', '/operations/van-groups', { service_date: DAY, route_id: 'r5', zone: 'PK', members: [{ trip_id: b.trips[0].id }], van_id: van.id });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);

async function machine(name) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  await ctx.addInitScript(({ t, ops }) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} window.LA_CONFIG = { opsBackend: ops }; }, { t: token, ops: OPS });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => console.log(`  [${name}] pageerror ${String(e).slice(0, 200)}`));
  await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
  await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return page;
}
const A = await machine('A'), B = await machine('B');
const open = async (pg, view) => {
  await pg.evaluate(({ d, view }) => {
    if (view === 'vancheckin') window._vanCkDate = d; else window._pckDate = d;
    const el = document.querySelector(`.nav-item[data-view="${view}"]`); if (el) nav(el);
    if (view === 'vancheckin') renderVanCheckin(); else renderPierCheckin();
  }, { d: DAY, view });
  await pg.waitForTimeout(2500);
};
const stream = (pg) => pg.evaluate(() => (window.laOps.changes && window.laOps.changes.stream) ? window.laOps.changes.stream() : null);
const stats = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? `min ${a[0]} ms · median ${a[Math.floor(a.length / 2)]} ms · max ${a[a.length - 1]} ms` : 'no samples'; };

async function rounds(view, side, label, bFocus = true) {
  await open(A, view); await open(B, view);
  await B.evaluate((f) => { document.hasFocus = () => f; }, bFocus);
  console.log(`\n[${label}] B stream: ${JSON.stringify(await stream(B))}`);
  const data = [], dom = [], miss = [];
  for (let i = 0; i < N; i++) {
    await B.waitForTimeout(bFocus ? 2500 : 31000);          // past the redraw gap, as a check-in that comes alone
    const before = await B.evaluate(({ d, side }) => {
      const bk = SB_BOOKINGS.find((x) => x.id === 'zz-live'); const r = ckRead(bk, d, side);
      const host = document.getElementById(side === 'van' ? 'vancheckin-host' : 'piercheckin-host');
      window.__liveSeen = { at: !!(r && r.at), html: host ? host.innerHTML : '', data: 0, dom: 0 };
      (function watch() {
        const s = window.__liveSeen; const b2 = SB_BOOKINGS.find((x) => x.id === 'zz-live'); const r2 = ckRead(b2, d, side);
        const h = document.getElementById(side === 'van' ? 'vancheckin-host' : 'piercheckin-host');
        if (!s.data && !!(r2 && r2.at) !== s.at) s.data = Date.now();
        if (s.data && !s.dom && h && h.innerHTML !== s.html) s.dom = Date.now();
        if (!s.dom) setTimeout(watch, 20);
      })();
      return window.__liveSeen.at;
    }, { d: DAY, side });
    const t0 = Date.now();
    await A.evaluate(({ d, side }) => ckToggle('zz-live', d, side), { d: DAY, side });
    let seen = null;
    for (let w = 0; w < 600 && !(seen && seen.dom); w++) { await B.waitForTimeout(100); seen = await B.evaluate(() => window.__liveSeen); }
    if (seen && seen.dom) { data.push(seen.data - t0); dom.push(seen.dom - t0); } else miss.push(i);
    process.stdout.write(seen && seen.dom ? `  round ${i + 1}: ${before ? 'untick' : 'tick'} → B data ${seen.data - t0} ms, B screen ${seen.dom - t0} ms\n` : `  round ${i + 1}: B did not show it within 60 s\n`);
  }
  console.log(`  ${label} · B has the data:   ${stats(data)}`);
  console.log(`  ${label} · B screen redrawn: ${stats(dom)}${miss.length ? ` · missed ${miss.length}` : ''}`);
  return { label, data, dom, miss };
}

const out = [];
out.push(await rounds('vancheckin', 'van', 'Van check-in, B in front'));
out.push(await rounds('piercheckin', 'pier', 'Pier check-in, B in front'));
out.push(await rounds('piercheckin', 'pier', 'Pier check-in, B behind another window', false));
console.log('\nSUMMARY ' + JSON.stringify(out.map((r) => ({ label: r.label, screen_ms: r.dom, missed: r.miss.length }))));
cleanup(); process.exit(out.some((r) => r.miss.length) ? 1 : 0);
