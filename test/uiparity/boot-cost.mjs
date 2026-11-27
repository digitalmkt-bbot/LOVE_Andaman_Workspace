// What a login costs: every operation-backend request the new frontend makes from page load until the boot and its
// background loads are through, with the bytes each answered.
//   OPS=http://127.0.0.1:3921 node test/uiparity/boot-cost.mjs [view] [--quiet=4000]
// Logs in as uiparity/uiparity (the UI-parity login, test/uiparity/README.md), lands on the Dashboard (or opens [view]
// once the boot is done), and waits until no request has started for --quiet ms. Prints one line per path and the totals.
import { serve } from '../ui/_harness.mjs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const view = args.find((a) => !a.startsWith('--')) || '';
const quiet = +((args.find((a) => a.startsWith('--quiet=')) || '').split('=')[1] || 4000);
const OPS = process.env.OPS || 'http://127.0.0.1:3921';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(OPS)) { console.error('OPS must be a local backend'); process.exit(2); }
const login = await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'uiparity', password: 'uiparity' }) });
const TOKEN = (await login.json()).access_token;
if (!TOKEN) { console.error('login failed ' + login.status); process.exit(2); }

const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Bangkok' });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, TOKEN);
const calls = []; let last = Date.now();
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url()), hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  last = Date.now();
  const c = { m: req.method(), path: u.pathname, q: u.search, bytes: 0, phase: 'boot', t: Date.now() };
  calls.push(c);
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  c.bytes = buf.length; c.status = r.status;
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' }, body: buf });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`);
await page.waitForFunction(() => window.laOps && window.laOps.state && window.laOps.state.loaded, null, { timeout: 300000 });
// --trace-need: print who asked for a load through laOps.later.need (§loadOnNeed), with the caller's stack
if (args.includes('--trace-need')) await page.evaluate(() => {
  const L = window.laOps.later, need = L.need;
  L.need = function (name) { console.log('[need] ' + name + ' ← ' + String(new Error().stack).split('\n').slice(2, 9).join(' | ')); return need.apply(this, arguments); };
});
page.on('console', (m) => { if (m.text().startsWith('[need]')) console.log(m.text().slice(0, 1200)); });
// --max=<ms>: stop waiting after that long even if requests keep starting (a screen that keeps asking is itself a finding)
const maxWait = +((args.find((a) => a.startsWith('--max=')) || '').split('=')[1] || 120000);
async function settle() { const t0 = Date.now(); last = Date.now(); while (Date.now() - last < quiet && Date.now() - t0 < maxWait) await page.waitForTimeout(500); if (Date.now() - t0 >= maxWait) console.log('still asking after ' + maxWait + ' ms'); }
await settle();
const nBoot = calls.length;
if (view) {
  await page.evaluate((v) => nav(document.querySelector('.nav-item[data-view="' + v + '"]')), view);
  await settle();
  calls.slice(nBoot).forEach((c) => { c.phase = view; });
}
const by = {};
for (const c of calls) { const k = c.phase + ' ' + c.m + ' ' + c.path; (by[k] ||= { n: 0, bytes: 0 }); by[k].n++; by[k].bytes += c.bytes; }
for (const [k, v] of Object.entries(by).sort((a, b) => b[1].bytes - a[1].bytes)) console.log(String(v.n).padStart(3), String(Math.round(v.bytes / 1024)).padStart(7) + ' KB  ' + k);
// --calls=<path prefix>: each such request with its query and size, in order
const callsOf = (args.find((a) => a.startsWith('--calls=')) || '').slice(8);
if (callsOf) calls.filter((c) => (c.path + c.q).startsWith(callsOf)).forEach((c) => console.log(`  ${((c.t - calls[0].t) / 1000).toFixed(1)}s ${c.phase} ${c.m} ${c.path}${c.q} → ${c.status} ${Math.round(c.bytes / 1024)} KB`));
const tot = (ph) => calls.filter((c) => c.phase === ph).reduce((a, c) => ({ n: a.n + 1, bytes: a.bytes + c.bytes }), { n: 0, bytes: 0 });
const b = tot('boot');
console.log(`LOGIN (dashboard): ${b.n} requests, ${(b.bytes / 1048576).toFixed(2)} MB`);
if (view) { const v = tot(view); console.log(`OPEN ${view}: ${v.n} requests, ${(v.bytes / 1048576).toFixed(2)} MB`); }
console.log('background loads: ' + await page.evaluate(() => window.laOps.later ? window.laOps.later.names().join(', ') : ''));
if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
// --text=<file>: the open screen's visible text, to compare two checkouts (LA_APP_ROOT=<other allotment_v2>)
const textOut = (args.find((a) => a.startsWith('--text=')) || '').slice(7);
if (textOut) (await import('node:fs')).writeFileSync(textOut, await page.evaluate(() => (document.querySelector('.view.active') || document.body).innerText));
await browser.close(); srv.close();
