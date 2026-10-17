// make_print_pdfs · PDFs of the van-bill print windows, for the developer to compare with legacy on paper.
// Seeds the same data as t_walk_pier.mjs section 7 into an in-process operation-backend, drives the real
// Van Bills screen, opens the print windows (overview summary, supplier billing note, internal billing note)
// and writes page.pdf() of each to docs/walk/pdf/:  vb-summary.pdf  vb-note-supplier.pdf  vb-note-internal.pdf
//
//   node test/ui/make_print_pdfs.mjs        (OPS_BACKEND_DIR, default D:/projects/operation-backend)
import { serve } from './_harness.mjs';
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
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 30000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const seed = async (method, p, body) => {
  const r = await fetch(OPS + p, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); const j = txt ? JSON.parse(txt) : null;
  if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${txt.slice(0, 300)}`);
  return j;
};

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

// seed: a partner van that ran a panwa trip on 2026-10-19 (period 11-20 of 2026-10), staff rates on the bill
const VD = '2026-10-19';
const vanA = await seed('POST', '/operations/vans', { name: 'Walk Van', capacity: 12, ownership: 'partner', partner_name: 'WalkPartner' });
await seed('PUT', `/operations/van-days/${VD}/${vanA.id}`, { route_ids: ['r10'] });
await seed('POST', '/operations/deployments', { boat_id: 'b13', route_id: 'r10', service_date: VD, capacity: 38, deploy_anyway: true });
const vbBk = await seed('POST', '/v1/bookings', { external_id: `b2c_walk_vb_${Date.now().toString(36)}`, lead_pax: 'Guest', pickup_area: 'Patong', total: 3000, trips: [{ route_id: 'r10', date: VD, pax: { ad_fr: 3 }, zone: 'PK' }] });
await seed('POST', '/operations/van-groups', { service_date: VD, route_id: 'r10', zone: 'PK', members: [{ trip_id: vbBk.trips[0].id }], van_id: vanA.id, allow_second_round: true });
await seed('PATCH', '/v1/van-bills/WalkPartner/2026-10/2', { per_pax: 200, route_rates: { PP: 1500 }, row_overrides: { [`${VD}~r10~${vanA.id}`]: { rate: null, ex: 300, cut: 100, per: null } } });

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1200);
await ev(() => nav({ dataset: { view: 'vanbill' }, classList: { add() {} } })); await settle(2500);
await ev(() => { _vb.ym = '2026-10'; _vb.per = 2; _vb.mode = 'ov'; _vb.pier = ''; renderVanBill(); }); await settle(2500);

let bad = 0;
const pdfOf = async (name, click) => {
  const before = popups.length;
  await click();
  const t0 = Date.now(); while (popups.length === before && Date.now() - t0 < 8000) await settle(100);
  if (popups.length === before) { bad++; console.log('  x ' + name + ': no print window opened'); return; }
  const w = popups[popups.length - 1]; await settle(1500);
  const txt = await w.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  await w.emulateMedia({ media: 'print' });
  await w.pdf({ path: path.join(OUT, name), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await w.close().catch(() => {});
  console.log('  ok ' + name + '  (' + fs.statSync(path.join(OUT, name)).size + ' bytes) ' + txt.slice(0, 90));
};

await pdfOf('vb-summary.pdf', () => page.locator('#vanbill-host button[onclick="vbPrint()"]').first().click());
await ev(() => vbOpenSup('WalkPartner')); await settle(2500);
await ev(() => { _vb.pier = 'panwa'; renderVanBill(); }); await settle(2000);
await pdfOf('vb-note-supplier.pdf', () => page.locator('#vanbill-host button[onclick="vbPrint()"]').first().click());
await pdfOf('vb-note-internal.pdf', () => page.locator('#vanbill-host button[onclick="vbPrint(1)"]').first().click());
console.log(bad ? '\nFAILED: ' + bad : '\nPDFs written to ' + OUT);
process.exit(bad ? 1 : 0);
