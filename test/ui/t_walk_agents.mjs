// t_walk_agents · browser walk-through of AGENTS · CONTRACTS · RATE TYPES · USERS against a REAL operation-backend
//
//   node test/ui/t_walk_agents.mjs      (OPS_BACKEND_DIR, default D:/projects/operation-backend)
//
// Same method as t_ops.mjs: the app's calls to the production URL are re-routed to a local seeded backend.
// Every check reads BOTH sides: the screen (page state / DOM) and the server (asked directly with api()).
//
//   [1] alerts     Needs action rows + list KPI counts from the server's three pricing alerts
//   [2] import     Agent Excel import: dry run preview, refused row, Import with the ticked lines
//   [3] unbind     rtUnbindAgent -> PUT /v1/agents/{id}/rate-type {rate_type_id:null}
//   [4] rate type  custom add-on price save, add-on types dialog, Active switch
//   [5] documents  contract PDF record, history, remove, reopen
//   [6] users      server warnings, nav_pages once, rename, agent colour
//   [7] promo      promo badge / bonus counter, agIncompleteFields
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;      // e.g. ONLY=1,3
const want = (n) => !ONLY || ONLY.includes(String(n));

// ── local backend ──
process.env.WALK_AGENTS = '1';           // the backend helper then seeds a main contract + rt002 for a01 (drift alert)
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
// api(): ask the server directly. Returns the JSON body (null for 204); `.__status` is not added, use raw() for the status.
const raw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  const text = r.status === 204 ? '' : await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { status: r.status, json };
};
const api = async (p, init = {}) => (await raw(p, init)).json;
const send = (method, p, body) => raw(p, { method, body: body === undefined ? undefined : JSON.stringify(body) });

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
const calls = [], refusals = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' → ' + r.status + ' ' + buf.toString().slice(0, 220));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [], toasts = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 200)); d.type() === 'prompt' ? d.accept('Tester') : d.accept(); });

const fails = [];
const results = {};                                       // item -> [pass, fail]
let item = 0;
const ok = (name, cond, got) => {
  console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got).slice(0, 500)));
  if (!cond) fails.push(item + ': ' + name);
  (results[item] = results[item] || [0, 0])[cond ? 0 : 1]++;
};
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const nav = async (view) => { await ev((v) => { const el = document.querySelector('.nav-item[data-view="' + v + '"]'); if (el) el.click(); else nav({ dataset: { view: v }, classList: { add() {}, remove() {} } }); }, view); await settle(600); };

// ── seed through the API ──
const AGENT_BASE = { market_id: 'ru', pay_type: 'invoice', vat_mode: 'exclude', credit_days: 30, credit_limit: 100000, email: 'zz@example.com',
  company: { legal_name: 'ZZ Co', address: '1 Test Rd' } };
const mkAgent = async (name, extra = {}) => {
  const r = await send('POST', '/v1/agents', { ...AGENT_BASE, name, rate_type_id: 'rt001', sales_id: 's1', ...extra });
  if (r.status !== 201) throw new Error('seed agent ' + name + ' → ' + r.status + ' ' + JSON.stringify(r.json));
  return r.json;
};
const must = async (label, p) => { const r = await p; if (r.status >= 300) throw new Error('seed ' + label + ' → ' + r.status + ' ' + JSON.stringify(r.json)); return r.json; };

const agNoRate = await mkAgent('ZZ NoRate Agent', { code: 'ZZNORATE' });
await must('unbind', send('PUT', '/v1/agents/' + agNoRate.id + '/rate-type', { rate_type_id: null }));
const agNoPrice = await mkAgent('ZZ NoPrice Agent', { code: 'ZZNOPRICE' });
await must('programs', send('PUT', '/v1/agents/' + agNoPrice.id + '/programs', { programs: ['r5', 'r10'] }));
const agClean = await mkAgent('ZZ Clean Agent', { code: 'ZZCLEAN' });

if (process.env.PROBE) {
  for (const a of [{ id: 'a01' }, agNoRate, agNoPrice, agClean]) { const g = await api('/v1/agents/' + a.id); console.log(a.id, JSON.stringify({ alerts: g.alerts, inc: g.incomplete, programs: g.programs.map((p) => p.route_id), rt: g.rate_type_id })); }
  console.log(JSON.stringify((await api('/v1/agents?active=all')).agents.map((a) => [a.id, a.alerts.map((x) => x.code)])));
  process.exit(0);
}

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/agents`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);

// ============================================================================================
// STEPS ARE ADDED BELOW
// ============================================================================================
if (want(1)) {
console.log('\n[1] Needs action rows + list KPI counts = the server\'s pricing alerts');
item = 1;
await nav('agents'); await settle(800);
const srvList = (await api('/v1/agents?active=all')).agents;
const alertsOf = (id) => (srvList.find((a) => a.id === id) || {}).alerts || [];
const srvCodes = {}; srvList.forEach((a) => { if ((a.program_route_ids || []).length) alertsOf(a.id).forEach((x) => { srvCodes[x.code] = (srvCodes[x.code] || 0) + 1; }); });
const srvNeed = srvList.filter((a) => (a.program_route_ids || []).length && alertsOf(a.id).length).length;
const cases = [['a01', 'contract_rate_differs', 'Contract ≠ bound rate'], [agNoRate.id, 'no_rate_bound', 'No rate bound'], [agNoPrice.id, 'route_no_price', 'Route with no price']];
for (const [id, code, title] of cases) {
  const srv = alertsOf(id).find((x) => x.code === code);
  await ev((i) => { _agSelected = i; agRenderDetail(i); }, id);
  await waitFor((i) => !!document.querySelector('#ag-main .ag-al, #ag-main .ag-ok') && _agSelected === i, id);
  await settle(500);
  const rows = await ev(() => [...document.querySelectorAll('#ag-main .ag-als .ag-al')].map((r) => ({ t: r.querySelector('.t').textContent, d: r.querySelector('.d').textContent, sev: r.querySelector('.sev').textContent, go: (r.querySelector('.go') || {}).textContent })));
  const row = rows.find((r) => r.t === title);
  ok(`${code}: the "${title}" row is on ${id}'s page with the server's message`, !!srv && !!row && row.d === srv.message, { rows, srv });
  if (code === 'no_rate_bound' || code === 'route_no_price') ok(`${code}: severity Blocked (server severity blocked)`, row && /Blocked/.test(row.sev), row);
}
await ev((i) => { _agSelected = i; agRenderDetail(i); }, agClean.id);
await settle(900);
const cleanRows = await ev(() => [...document.querySelectorAll('#ag-main .ag-als .ag-al .t')].map((r) => r.textContent));
ok('a clean agent has none of the three pricing rows', !cleanRows.some((t) => ['No rate bound', 'Route with no price', 'Contract ≠ bound rate'].includes(t)), cleanRows);
await ev(() => { renderAgKPI(); });
const kpi = await ev(() => ({ need: (document.querySelector('#ag-kpi .ag-chip.warn b') || {}).textContent,
  rows: [...document.querySelectorAll('#ag-hd-pop .ag-hd-pr:not(.dim)')].reduce((o, r) => { o[r.querySelector('.t b').textContent] = r.querySelector('.n').textContent; return o; }, {}) }));
ok('list KPI popup counts = server alerts (norate / orph / drift)', kpi.rows['No rate bound'] == (srvCodes.no_rate_bound || 0) && kpi.rows['Route with no price'] == (srvCodes.route_no_price || 0) && kpi.rows['Contract ≠ bound rate'] == (srvCodes.contract_rate_differs || 0), { kpi, srvCodes });
ok('list KPI "Needs action" chip = agents selling with an alert', Number(kpi.need) === srvNeed, { kpi, srvNeed });
}
//@@STEPS@@

await browser.close(); srv.close(); backend.kill();
console.log('\nresults per item (pass/fail): ' + JSON.stringify(results));
console.log('server refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
ok('no page errors', errors.length === 0, errors);
console.log(fails.length ? `\n✖ ${fails.length} failed:\n  ${fails.join('\n  ')}` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
