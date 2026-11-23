// Probe the new frontend alone against an already running local operation-backend
//   OPS=http://127.0.0.1:3913 TOKEN=… node test/uiparity/probe-new.mjs <view> "<js expression to print>" [waitMs]
// A debugging helper for findings from run.mjs: opens one view, waits, prints the expression's value, the calls made
// and the console errors.
import { serve } from '../ui/_harness.mjs';
import { chromium } from 'playwright';

const [view, expr = 'null', waitMs = '15000'] = process.argv.slice(2);
const OPS = process.env.OPS || 'http://127.0.0.1:3913', TOKEN = process.env.TOKEN;
if (!view || !TOKEN) { console.error('usage: OPS=… TOKEN=… node test/uiparity/probe-new.mjs <view> "<expr>" [waitMs]'); process.exit(2); }
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Bangkok' });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, TOKEN);
const calls = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url()), hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const t0 = Date.now();
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push(`${req.method()} ${u.pathname}${u.search} → ${r.status} ${Date.now() - t0}ms`);
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' }, body: buf });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error' || /\[ops\]|vanjob/i.test(m.text())) errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`);
await page.waitForFunction(() => window.laOps && window.laOps.state && window.laOps.state.loaded, null, { timeout: 300000 });
const n0 = calls.length;
await page.evaluate((v) => nav(document.querySelector('.nav-item[data-view="' + v + '"]')), view);
await page.waitForTimeout(+waitMs);
console.log('value:', JSON.stringify(await page.evaluate((e) => { try { return eval(e); } catch (err) { return 'threw: ' + err.message; } }, expr), null, 1).slice(0, 3000));
console.log('calls after nav:\n  ' + calls.slice(n0).join('\n  '));
console.log('errors:\n  ' + errors.join('\n  '));
await browser.close(); srv.close();
