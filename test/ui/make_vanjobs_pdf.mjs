// make_vanjobs_pdf · PDFs of the Van Job Order sheet drawn from the server, for the developer to compare with legacy on paper (Q41).
// Seeds the day in _vanjobs_seed.mjs into an in-process operation-backend (2 rounds on one van, a merged row, a cancelled booking
// still in its group, return trips on other vans, a no-show tag, an overnight out and its return leg), drives the real Van Job Orders
// screen and opens the print windows. Writes to docs/walk/pdf/:
//   vanjobs-order.pdf          Van Alpha, round 1: outbound + return, merged row, overnight out, van stop, "back on Bravo" tag
//   vanjobs-order-round2.pdf   Van Alpha, round 2: struck row, the "return is on round 1" note, the unassigned banner
//   vanjobs-return.pdf         Van Bravo on the overnight return day: a return-only sheet with the overnight leg tag
//   vanjobs-bravo.pdf          Van Bravo, day 1: a return with a "from another van" row and a no-show tag
//   vanjobs-order-legacy.pdf   the browser-built legacy sheet for round 1 of the same data, beside vanjobs-order.pdf
//
//   node test/ui/make_vanjobs_pdf.mjs        (OPS_BACKEND_DIR, default D:/projects/operation-backend)
import { serve } from './_harness.mjs';
import { seedVanJobs, D, D2 } from './_vanjobs_seed.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../docs/walk/pdf');
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
fs.mkdirSync(OUT, { recursive: true });

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
const send = async (method, p, body) => {
  const r = await fetch(OPS + p, { method, headers: { authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = r.status === 204 ? '' : await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (_) { j = txt; }
  return { status: r.status, body: j };
};
await seedVanJobs(send);

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript((t) => {
  try { sessionStorage.setItem('la_ops_token', t); } catch (_) {}
  window.print = function () {};            // a print window must stay open until the PDF is taken
  window.close = function () {};
}, token);
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url()), hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const popups = [];
ctx.on('page', (p) => { if (p !== page) popups.push(p); });
const settle = (ms = 700) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1200);

let bad = 0;
const openDay = async (date) => {
  await ev((d) => { _vanJobsDate = d; const el = document.querySelector('.nav-item[data-view="vanjobs"]'); if (el) nav(el); renderVanJobs(); }, date);
  await page.waitForFunction(() => document.querySelector('#vanjobs-host tbody tr'), null, { timeout: 20000 });
  await settle(2000);
};
const pdfOf = async (name, open) => {
  const before = popups.length;
  await open();
  const t0 = Date.now(); while (popups.length === before && Date.now() - t0 < 10000) await settle(100);
  if (popups.length === before) { bad++; console.log('  x ' + name + ': no print window opened'); return; }
  const w = popups[popups.length - 1]; await settle(1200);
  const txt = await w.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  fs.writeFileSync(path.join(OUT, name.replace(/\.pdf$/, '.txt')), await w.evaluate(() => document.body.innerText));   // the sheet's text, for diffing against legacy's
  await w.emulateMedia({ media: 'print' });
  await w.pdf({ path: path.join(OUT, name), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await w.close().catch(() => {});
  const empty = /Loading the job order|The server has no job order|No bookings assigned/.test(txt);
  if (empty) { bad++; console.log('  x ' + name + ': the sheet is empty: ' + txt.slice(0, 160)); return; }
  console.log('  ok ' + name + '  (' + fs.statSync(path.join(OUT, name)).size + ' bytes) ' + txt.slice(0, 100));
};

// day 1: the list, the drawer preview of round 1, then the print windows
await openDay(D);
await ev(() => vanJobsOpenPreview('veh01~r5~1'));
await page.waitForFunction(() => /WALK TWO/.test((document.getElementById('vjo-page') || {}).innerText || ''), null, { timeout: 15000 }).catch(() => { bad++; console.log('  x the drawer preview did not show WALK TWO'); });
await settle(500);
await page.screenshot({ path: path.join(OUT, 'vanjobs-screen.png') });
await pdfOf('vanjobs-order.pdf', () => ev((d) => bookingV2VanJobOrder(d, 'veh01', 'r5', 'out', 1), D));
await pdfOf('vanjobs-order-round2.pdf', () => ev((d) => { vanJobsOpenPreview('veh01~r5~2'); return bookingV2VanJobOrder(d, 'veh01', 'r5', 'out', 2); }, D));
await pdfOf('vanjobs-bravo.pdf', () => ev((d) => bookingV2VanJobOrder(d, 'veh02', 'r5', 'out', 0), D));

// the legacy sheet of round 1, built in the browser from the same data (the original function, kept for this)
{
  const legacyHtml = await ev((d) => {
    const f = window.laOps.vanJobs.sheet.legacy;
    return '<!doctype html><html><head><meta charset="utf-8"><title>legacy</title>' + vanJobsOrderCss(false) + '</head><body style="' + vjTplVars('veh01') + '">' + f(d, 'veh01', 'r5', 'out', 1) + '</body></html>';
  }, D);
  const lp = await ctx.newPage(); await lp.setContent(legacyHtml); await lp.emulateMedia({ media: 'print' });
  fs.writeFileSync(path.join(OUT, 'vanjobs-order-legacy.txt'), await lp.evaluate(() => document.body.innerText));
  await lp.pdf({ path: path.join(OUT, 'vanjobs-order-legacy.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true }); await lp.close();
  console.log('  ok vanjobs-order-legacy.pdf  (' + fs.statSync(path.join(OUT, 'vanjobs-order-legacy.pdf')).size + ' bytes)');
}

// day 2: the overnight return leg (a return-only sheet)
await openDay(D2);
await pdfOf('vanjobs-return.pdf', () => ev((d) => bookingV2VanJobOrder(d, 'veh02', 'r5', 'ret', 0), D2));

console.log(bad ? '\nFAILED: ' + bad : '\nPDFs written to ' + OUT);
process.exit(bad ? 1 : 0);
