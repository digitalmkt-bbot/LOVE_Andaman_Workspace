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
const calls = [], refusals = [], bodies = [];          // bodies: every non-GET the app sent (method, path, JSON body)
const sentTo = (m, re) => bodies.filter((x) => x.m === m && re.test(x.p));
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname);
  if (req.method() !== 'GET') { try { bodies.push({ m: req.method(), p: u.pathname, b: req.postData() ? JSON.parse(req.postData()) : null }); } catch (_) { bodies.push({ m: req.method(), p: u.pathname, b: req.postData() }); } }
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
  console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + String(JSON.stringify(got)).slice(0, 500)));
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
if (want(2)) {
console.log('\n[2] Agent Excel import · dry run preview, refused row, Import with the ticked lines');
item = 2;
await nav('agents'); await settle(500);
const hasXlsx = await ev(() => typeof XLSX !== 'undefined');
ok('SheetJS (XLSX) is loaded in the page (CDN)', hasXlsx, hasXlsx);
if (hasXlsx) {
  const n0 = bodies.length;
  const sheet = [
    { name: 'ZZ Import New', code: 'ZZIMPNEW', market: 'ru', sales: 'Tata', payType: 'invoice', creditDays: 15, creditLimit: 50000, vatMode: 'exclude', programs: 'r5', rateType: 'RT001', email: 'new@imp.test', legalName: 'ZZ Import New Co', address: '9 Import Rd' },
    { name: 'ZZ Clean Agent', code: 'ZZCLEAN', phone: '+66 800 111 222' },
    { name: 'ZZ Import Bad', code: 'ZZIMPBAD', market: 'ru', sales: 'Tata', payType: 'bogus', vatMode: 'exclude', rateType: 'RT001', legalName: 'ZZ Bad Co', address: '1 Bad Rd' },
    { name: 'ZZ Import Skipped', code: 'ZZIMPSKIP', market: 'ru', sales: 'Tata', payType: 'invoice', vatMode: 'exclude', rateType: 'RT001', legalName: 'ZZ Skip Co', address: '2 Skip Rd' }
  ];
  await ev((rows) => {
    const cols = AGIMP_COLS;
    const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Agents');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    agImportFile(new File([bytes], 'zz-agents.xlsx'));
  }, sheet);
  const shown = await waitFor(() => !!document.getElementById('agimp-modal') && !!_agImp && _agImp.rows.every((r) => r.serverError !== undefined), null, 15000);
  await settle(500);
  const dry = sentTo('POST', /\/v1\/agents\/import$/).slice(-1)[0];
  ok('preview opened from the server dry run (POST /v1/agents/import dry_run:true, sheet rows as typed)', shown && dry && dry.b.dry_run === true && dry.b.rows.length === 4 && dry.b.rows[0].name === 'ZZ Import New', { shown, dry: dry && dry.b });
  const view = await ev(() => ({ rows: _agImp.rows.map((r) => ({ n: r.n, name: r.src.name, action: r.action, checked: r.checked, err: r.serverError, writes: r.writes, match: r.match && r.match.id })),
    html: [...document.querySelectorAll('#agimp-modal tbody tr')].map((tr) => ({ text: tr.innerText, box: tr.querySelector('input[type=checkbox]').checked })) }));
  const dryServer = await send('POST', '/v1/agents/import', { rows: dry.b.rows, overwrite: false, dry_run: true });
  const srvRow = (n) => dryServer.json.rows.find((r) => r.row === n);
  ok('rows 2 (new) and 3 (existing, phone filled) are what the server says: create / update', srvRow(2).action === 'create' && srvRow(3).action === 'update' && view.rows[0].action === 'create' && view.rows[1].action === 'update' && view.rows[1].match === agClean.id && view.rows[1].writes.join() === srvRow(3).writes.join(), { view: view.rows, srv: dryServer.json.rows });
  ok('refused row: server says error, screen shows the server\'s message and the row is unticked', srvRow(4).action === 'error' && !!srvRow(4).error && view.rows[2].err === srvRow(4).error && view.rows[2].checked === false && view.html[2].text.includes(srvRow(4).error) && view.html[2].box === false, { screen: view.rows[2], html: view.html[2] });
  ok('nothing saved by the dry run (no ZZIMPNEW agent on the server)', !(await api('/v1/agents?active=all&q=ZZ%20Import')).agents.length, null);
  // untick row 5 (valid) so only rows 2 and 3 are "the ticked lines"
  await page.locator('#agimp-modal tbody tr').nth(3).locator('input[type=checkbox]').uncheck();
  await settle(400);
  const sel = await ev(() => _agImp.rows.filter((r) => r.checked).map((r) => r.n));
  ok('screen: ticked lines are 2 and 3 (4 refused, 5 unticked by hand)', sel.join() === '2,3', sel);
  await page.locator('#agimp-modal button[onclick="agImportApply()"]').click();
  await idle(); await waitFor(() => !document.getElementById('agimp-modal'), null, 10000); await settle(600);
  const real = sentTo('POST', /\/v1\/agents\/import$/).slice(-1)[0];
  ok('Import sends dry_run:false with select = the ticked lines [2,3]', real && real.b.dry_run === false && JSON.stringify(real.b.select) === '[2,3]' && real.b !== dry.b, real && real.b && { dry_run: real.b.dry_run, select: real.b.select });
  const made = (await api('/v1/agents?active=all&q=ZZ%20Import')).agents.map((a) => a.name);
  const cleanNow = await api('/v1/agents/' + agClean.id);
  ok('server: ZZ Import New created, ZZ Clean got the phone, refused + unticked rows NOT created', made.join() === 'ZZ Import New' && cleanNow.phone === '+66 800 111 222', { made, phone: cleanNow.phone });
  const scr = await ev(() => ({ names: SB_AGENTS.filter((a) => /^ZZ Import/.test(a.name)).map((a) => a.name), phone: SB_AGENTS.find((a) => a.code === 'ZZCLEAN').phone, modal: !!document.getElementById('agimp-modal') }));
  ok('screen: the new agent is in the list, the modal is closed', scr.names.join() === 'ZZ Import New' && scr.phone === '+66 800 111 222' && !scr.modal, scr);
}
}
if (want(3)) {
console.log('\n[3] rtUnbindAgent → PUT /v1/agents/{id}/rate-type {rate_type_id:null}, stays unbound after reload');
item = 3;
await nav('rate-types'); await waitFor(() => window.laOps.rateTypes && window.laOps.rateTypes.state.loaded, null, 15000); await settle(600);
const victim = agClean.id;
ok('before: the agent is bound to rt001 on the server', (await api('/v1/agents/' + victim)).rate_type_id === 'rt001', null);
await ev(() => { _rtSelected = 'rt001'; rtRenderCards(); rtRenderDetail('rt001'); });
await settle(600);
await page.locator('#rt-detail details summary').first().click();      // the agents chips are folded: "AGENTS · 4 (click to show / hide)"
await settle(300);
const btn = page.locator(`button[onclick^="rtUnbindAgent('${victim}'"]:visible`).first();   // the other copy sits in the hidden agents column
const btnShown = await btn.count();
ok('the ✕ button for that agent is on the Rate Types screen', btnShown > 0, btnShown);
const n3 = bodies.length;
if (btnShown) await btn.click({ timeout: 5000 });   // a real mouse click on the visible ✕
await idle(); await settle(600);
const put = bodies.slice(n3).filter((x) => x.m === 'PUT' && x.p === '/v1/agents/' + victim + '/rate-type');
ok('app sent PUT /v1/agents/{id}/rate-type {rate_type_id:null}', put.length === 1 && put[0].b && put[0].b.rate_type_id === null, put);
const srvA = await api('/v1/agents/' + victim);
ok('server: rate_type_id is null, alert no_rate_bound now raised', srvA.rate_type_id === null && srvA.alerts.some((x) => x.code === 'no_rate_bound'), { rt: srvA.rate_type_id, alerts: srvA.alerts });
const scrA = await ev((id) => ({ rt: SB_AGENTS.find((a) => a.id === id).rateTypeId, onDetail: document.body.innerHTML.includes("rtUnbindAgent('" + id + "'") }), victim);
ok('screen: agent unbound in memory and its ✕ row is gone', scrA.rt === null && !scrA.onDetail, scrA);
await page.reload();
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 }); await settle(1200);
await waitFor((id) => SB_AGENTS.some((a) => a.id === id), victim, 15000);
const afterReload = await ev((id) => (SB_AGENTS.find((a) => a.id === id) || {}).rateTypeId, victim);
ok("after reload the agent is still unbound (screen: no rate type, server: null)", !afterReload && (await api('/v1/agents/' + victim)).rate_type_id === null, afterReload);
}
if (want(4)) {
console.log('\n[4] rate type: add-on types dialog, custom add-on prices (PUT/DELETE .../addons/{key}), Active switch');
item = 4;
await nav('rate-types'); await waitFor(() => window.laOps.rateTypes && window.laOps.rateTypes.state.loaded, null, 15000); await settle(600);
// --- the add-on types dialog (rtAddonTypesOpen) and a custom type created through it (ops/29) ---
await page.click('button[onclick="rtAddonTypesOpen()"]');
const dlg = await waitFor(() => !!document.getElementById('rt-addon-types-modal') && !!document.getElementById('rtat-en'), null, 5000);
ok('the "ชนิด Add-on" button opens the add-on types dialog (rtAddonTypesOpen)', dlg, dlg);
const mkType = async (en, th, model, unit) => {
  await page.fill('#rtat-en', en); await page.fill('#rtat-th', th); await page.selectOption('#rtat-model', model); await page.fill('#rtat-unit', unit);
  const n = bodies.length;
  await page.click('#rt-addon-types-modal button[onclick="rtAddonTypeCreate()"]');
  await idle(); await settle(500);
  return bodies.slice(n).filter((x) => x.m === 'POST' && x.p === '/v1/addon-types');
};
const post1 = await mkType('ZZ Park Fee', 'ค่าอุทยาน ZZ', 'perPax', 'per pax');
const post2 = await mkType('ZZ Towel Hire', 'ผ้าเช็ดตัว ZZ', 'flat', 'per trip');
const post3 = await mkType('ZZ Temp Type', 'ชั่วคราว ZZ', 'perPax', 'per pax');
const types = (await api('/v1/addon-types')).addon_types;
const t1 = types.find((t) => t.name === 'ZZ Park Fee'), t2 = types.find((t) => t.name === 'ZZ Towel Hire'), t3 = types.find((t) => t.name === 'ZZ Temp Type');
ok('three custom types created: one POST /v1/addon-types each; server holds them with the models chosen', post1.length === 1 && post2.length === 1 && post3.length === 1 && t1 && t1.model === 'perPax' && t2 && t2.model === 'flat' && t3, { posts: [post1.length, post2.length, post3.length], types });
const dlgText = await ev(() => document.getElementById('rt-addon-types-body').innerText);
ok('dialog lists the new types (screen)', dlgText.includes('ZZ Park Fee') && dlgText.includes('ZZ Towel Hire'), dlgText.slice(0, 300));
await page.locator(`#rt-addon-types-modal button[onclick="rtAddonTypeDelete('${t3.key}')"]`).click();
await idle(); await settle(500);
ok('delete of a custom type (✕) → DELETE /v1/addon-types/{key}; gone on the server and in the dialog', !(await api('/v1/addon-types')).addon_types.some((t) => t.key === t3.key) && !(await ev(() => document.getElementById('rt-addon-types-body').innerText)).includes('ZZ Temp Type') && sentTo('DELETE', /\/v1\/addon-types\//).length === 1, null);
await page.click('#rt-addon-types-modal button[onclick="rtAddonTypesClose()"]');
// --- custom add-on prices on rt002 through the edit modal ---
const editRt = async (id) => { await ev((i) => rtOpenEdit(i), id); await waitFor(() => !!document.querySelector('button[onclick="rtSaveDraft()"]'), null, 8000); await settle(500); };
const priceCall = (m, key) => bodies.filter((x) => x.m === m && x.p === `/v1/rate-types/rt002/addons/${key}`);
await editRt('rt002');
await page.locator(`input[onchange="rtToggleAddOn('${t1.key}',this.checked)"]`).check();
await page.locator(`input[oninput*="addOns.${t1.key}.adult"]`).fill('300');
await page.locator(`input[oninput*="addOns.${t1.key}.child"]`).fill('150');
await page.locator(`span[onclick="rtToggleAddOnRoute('${t1.key}','r5')"]`).click();
await page.locator(`input[onchange="rtToggleAddOn('${t2.key}',this.checked)"]`).check();
await page.locator(`input[oninput*="addOns.${t2.key}.price"]`).fill('900');
await page.click('button[onclick="rtSaveDraft()"]');
await idle(); await settle(900);
const rt2 = await api('/v1/rate-types/rt002');
const a1 = priceCall('PUT', t1.key), a2 = priceCall('PUT', t2.key);
ok('save sent PUT .../addons/{key}: per-pax {adult:300, child:150, applies:[r5]} and flat {price:900, applies:[]}', a1.length === 1 && a1[0].b.adult === 300 && a1[0].b.child === 150 && JSON.stringify(a1[0].b.applies) === '["r5"]' && a2.length === 1 && a2[0].b.price === 900 && a2[0].b.adult === undefined, { a1, a2 });
ok('server holds both prices on rt002', rt2.addons && rt2.addons[t1.key] && rt2.addons[t1.key].adult === 300 && rt2.addons[t1.key].child === 150 && JSON.stringify(rt2.addons[t1.key].applies) === '["r5"]' && rt2.addons[t2.key] && rt2.addons[t2.key].price === 900, rt2.addons);
const scr4 = await ev((k) => { const r = SB_RATE_TYPES.find((x) => x.id === 'rt002'); return { p: r.addOns[k[0]], f: r.addOns[k[1]], modal: document.getElementById('rt-modal').style.display !== 'none' }; }, [t1.key, t2.key]);
ok('screen: rt002 carries the add-on prices (adult 300 / child 150 / flat 900) and the editor closed', scr4.p && scr4.p.adult === 300 && scr4.p.child === 150 && scr4.f && scr4.f.price === 900 && !scr4.modal, scr4);
// turn the flat one off → DELETE
await editRt('rt002');
const on = await ev((k) => ({ p: _rtDraft.addOns[k[0]], f: _rtDraft.addOns[k[1]] }), [t1.key, t2.key]);
ok('re-opened editor shows the saved prices', on.p && on.p.adult === 300 && on.f && on.f.price === 900, on);
await page.locator(`input[onchange="rtToggleAddOn('${t2.key}',this.checked)"]`).uncheck();
await page.click('button[onclick="rtSaveDraft()"]');
await idle(); await settle(900);
const rt2b = await api('/v1/rate-types/rt002');
ok('switch off + save → DELETE .../addons/{key}; server keeps only the per-pax one', priceCall('DELETE', t2.key).length === 1 && rt2b.addons && !rt2b.addons[t2.key] && rt2b.addons[t1.key] && rt2b.addons[t1.key].adult === 300, rt2b.addons);
// --- Active switch ---
await ev(() => { _rtSelected = 'rt002'; rtRenderCards(); rtRenderDetail('rt002'); });
await settle(400);
const nA = bodies.length;
await page.locator('button[onclick^="rtToggleActive(\'rt002\'"]').first().click();
await idle(); await settle(600);
const patch1 = bodies.slice(nA).filter((x) => x.m === 'PATCH' && x.p === '/v1/rate-types/rt002');
const off = await ev(() => SB_RATE_TYPES.find((x) => x.id === 'rt002').active);
ok('Deactivate → PATCH /v1/rate-types/rt002 {active:false}; server inactive; screen inactive', patch1.length === 1 && patch1[0].b.active === false && (await api('/v1/rate-types/rt002')).active === false && off === false, { patch1, off });
await page.locator('button[onclick^="rtToggleActive(\'rt002\'"]').first().click();
await idle(); await settle(600);
ok('Activate again → server active true; screen active', (await api('/v1/rate-types/rt002')).active === true && (await ev(() => SB_RATE_TYPES.find((x) => x.id === 'rt002').active)) === true, null);
}
if (want(5)) {
console.log('\n[5] contract documents: issue (POST), history, remove (DELETE), reopen');
item = 5;
await nav('agents'); await settle(500);
// window.print() opens a native dialog that a headless run cannot answer: stand in for "the user closed it" by firing
// afterprint, which is what the app's own _ctDocPrintFlow waits for before it records the document.
await ev(() => { window.print = () => setTimeout(() => window.dispatchEvent(new Event('afterprint')), 20); });
const docsOf = async () => (await api('/v1/agents/a01/documents')).documents;
const histRows = () => ev(() => [...document.querySelectorAll('#ag-tabbody button[onclick^="ctArtifactRemove("]')].map((b) => b.getAttribute('onclick')));
ok('before: the server holds no document for a01', (await docsOf()).length === 0, await docsOf());
await ev(() => { _agSelected = 'a01'; agRenderDetail('a01'); });
await settle(900);
await ev(() => agSwitchTab('contracts', 'a01'));
await settle(700);
// -- Generate New (opens the wizard) --
await page.locator('#ag-tabbody button[onclick="ctDocOpen(\'a01\')"]').first().click();
await settle(600);
const wiz = await ev(() => ({ modal: document.getElementById('ct-doc-modal').style.display, doc: typeof _ctDoc !== 'undefined' && !!_ctDoc, viewer: !!document.getElementById('la-ops-contract-doc'), dialogs: 0 }));
ok('"Generate New" opens the contract wizard (#ct-doc-modal, _ctDoc set)', wiz.modal === 'flex' && wiz.doc, { wiz, dialogs: dialogs.slice(-2) });
if (wiz.modal === 'flex' && wiz.doc) {
  await ev(() => { _ctDoc.lang = 'th'; ctDocRender(); });
  const n5 = bodies.length;
  await ev(() => ctDocExportPDF());
  await settle(900); await idle(); await settle(500);
  const posts = bodies.slice(n5).filter((x) => x.m === 'POST' && x.p === '/v1/agents/a01/documents');
  const sdocs = await docsOf();
  ok('Export PDF recorded it: one POST /v1/agents/a01/documents {lang:th, content…}', posts.length === 1 && posts[0].b.lang === 'th' && posts[0].b.content && posts[0].b.content.sections && typeof posts[0].b.page_count === 'number', posts.map((p) => p.b && Object.keys(p.b)));
  ok('server: one document, version/lang/generated_by stamped by the server, activity line written', sdocs.length === 1 && sdocs[0].lang === 'th' && !!sdocs[0].generated_by && /^gc_/.test(sdocs[0].id), sdocs);
  const act = (await api('/v1/agents/a01/activity?limit=10')).activity;
  ok('server activity has "Contract generated"', act.some((x) => /Contract generated/.test(x.text)), act.slice(0, 3));
  await ev(() => ctDocClose && ctDocClose());
  await ev(() => agSwitchTab('contracts', 'a01')); await settle(700);
  const rows = await histRows();
  const hist = await ev(() => document.getElementById('ag-tabbody').innerText);
  ok('history on screen lists it (1 document, Thai) with the server id', rows.length === 1 && rows[0].includes(sdocs[0].id) && /1 document/.test(hist) && /Thai/.test(hist), { rows, hist: hist.slice(0, 200) });
  // -- reopen --
  const d0 = dialogs.length;
  await page.locator(`#ag-tabbody button[onclick="ctArtifactReopen('a01','${sdocs[0].id}')"]`).click();
  await settle(900);
  const re = await ev(() => ({ modal: document.getElementById('ct-doc-modal').style.display, lang: typeof _ctDoc !== 'undefined' && _ctDoc && _ctDoc.lang, tmpl: typeof _ctDoc !== 'undefined' && _ctDoc && _ctDoc.templateName }));
  ok('View / Edit reopens the wizard with the saved state (lang th) · GET /v1/contract-documents/{id}', re.modal === 'flex' && re.lang === 'th' && calls.includes('GET /v1/contract-documents/' + sdocs[0].id), { re, dialogs: dialogs.slice(d0) });
  await ev(() => ctDocClose && ctDocClose());
  // -- remove --
  await ev(() => agSwitchTab('contracts', 'a01')); await settle(500);
  await page.locator(`#ag-tabbody button[onclick="ctArtifactRemove('a01','${sdocs[0].id}')"]`).click();
  await idle(); await settle(700);
  const rm = bodies.filter((x) => x.m === 'DELETE' && x.p === '/v1/contract-documents/' + sdocs[0].id);
  ok('✕ remove → DELETE /v1/contract-documents/{id}; server list empty; history empty on screen', rm.length === 1 && (await docsOf()).length === 0 && (await histRows()).length === 0, { rm: rm.length });
}
}
if (want(6)) {
console.log('\n[6] user window: server warnings, nav_pages once per session, rename; agent colour');
item = 6;
await nav('agents'); await settle(500);
const pages = await ev(() => laNavPages());
const mkUser = async (username, extra) => must('user ' + username, send('POST', '/v1/users', { username, password: 'secret1', name: username.toUpperCase(), role: 'staff', ...extra }));
const uWide = await mkUser('zz_wide', { view_perms: pages.map((p) => p.v) });
const uNone = await mkUser('zz_none', { view_perms: [] });
const uRen = await mkUser('zz_ren', { view_perms: [pages[0].v] });
await mkUser('zz_adm2', { role: 'admin' }); await mkUser('zz_adm3', { role: 'admin' });
ok('before the window opens the server holds no page list (nav_pages empty)', ((await api('/v1/config/nav_pages')).value || []).length === 0, await api('/v1/config/nav_pages'));
const navCalls = () => ({ get: calls.filter((c) => c === 'GET /v1/config/nav_pages').length, put: calls.filter((c) => c === 'PUT /v1/config/nav_pages').length });
const nav0 = navCalls();
await ev(() => __laUsers());
await waitFor(() => !!document.getElementById('la-uwin') && document.getElementById('la-uwin').innerText.includes('zz_none'), null, 10000);
await settle(600);
const navAfter1 = navCalls();
const stored = (await api('/v1/config/nav_pages')).value || [];
ok('first list read: GET then PUT /v1/config/nav_pages (once) with the window\'s page list', navAfter1.get - nav0.get === 1 && navAfter1.put - nav0.put === 1 && stored.length === pages.length && stored.every((n) => pages.some((p) => p.v === n.v && p.a === n.a)), { navAfter1, nav0, stored: stored.length, pages: pages.length });
const order = calls.filter((c) => /nav_pages|GET \/v1\/users$/.test(c));
const iGet = order.indexOf('GET /v1/config/nav_pages'), iPut = order.indexOf('PUT /v1/config/nav_pages'), iUsers = order.indexOf('GET /v1/users');
ok('order: GET nav_pages → PUT nav_pages → GET /v1/users (warnings are counted against the stored list)', iGet >= 0 && iGet < iPut && iPut < iUsers, order);
// reload the list a few times in the same session: no more nav_pages traffic
await ev(() => __laLoadUsers()); await settle(500); await ev(() => __laLoadUsers()); await settle(500);
ok('re-reading the user list in the same session does not touch nav_pages again', JSON.stringify(navCalls()) === JSON.stringify(navAfter1), { navCalls: navCalls(), navAfter1 });
// warnings from the server
const srvWide = await api('/v1/users/' + uWide.id), srvNone = await api('/v1/users/' + uNone.id), srvAll = await api('/v1/users');
const wcodes = (srvWide.warnings || []).map((w) => w.code), ncodes = (srvNone.warnings || []).map((w) => w.code);
ok('server warnings: zz_wide → wide; zz_none → no_menus; overview → many_admins', wcodes.includes('wide') && ncodes.includes('no_menus') && (srvAll.warnings || []).some((w) => w.code === 'many_admins'), { wcodes, ncodes, overview: (srvAll.warnings || []).map((w) => w.code) });
const alertHtml = async (u) => { await ev((id) => __laPick(id), u.id); await settle(500); return ev(() => [...document.querySelectorAll('#la-uwin .al3')].map((x) => ({ cls: x.className, text: x.innerText.replace(/^!\s*/, '').trim() }))); };
const norm = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const wideRows = await alertHtml(uWide);
ok('user detail (zz_wide): the red "wide" row shows the server\'s message', srvWide.warnings.filter((w) => w.code === 'wide').every((w) => wideRows.some((r) => r.cls.includes('red') && norm(r.text) === norm(w.message))), { wideRows, srv: srvWide.warnings });
const noneRows = await alertHtml(uNone);
ok('user detail (zz_none): the amber "no menus" row shows the server\'s message', srvNone.warnings.filter((w) => w.code === 'no_menus').every((w) => noneRows.some((r) => r.cls.includes('amb') && norm(r.text) === norm(w.message))), { noneRows, srv: srvNone.warnings });
await ev(() => __laSetTab('ov')); await settle(600);
const ovText = await ev(() => document.querySelector('#la-uwin .ov .note p').innerText);
ok('overview tab (laOpsUserOverview): every server overview warning is shown as sent', (srvAll.warnings || []).length > 0 && srvAll.warnings.every((w) => norm(ovText).includes(norm(w.message))), { ovText, srv: (srvAll.warnings || []).map((w) => w.message) });
await ev(() => __laSetTab('list')); await settle(300);
// rename through the real dialog
await ev((id) => __laRename(id), uRen.id);
await page.fill('#la-r1', 'zz_renamed'); await page.fill('#la-r2', 'ZZ Renamed Person');
await settle(300);
const goEnabled = await ev(() => !document.getElementById('la-rgo').disabled);
await page.click('#la-rgo');
await settle(900);
const srvRen = await api('/v1/users/' + uRen.id);
const renPost = bodies.filter((x) => x.m === 'POST' && x.p === '/v1/users/' + uRen.id + '/rename');
ok('rename dialog: Save enabled; POST /v1/users/{id}/rename {username, name}; server holds the new names and the old one in previous_usernames', goEnabled && renPost.length === 1 && renPost[0].b.username === 'zz_renamed' && srvRen.username === 'zz_renamed' && srvRen.name === 'ZZ Renamed Person' && (srvRen.previous_usernames || []).includes('zz_ren'), { goEnabled, renPost, srvRen });
const rowOnScreen = (await ev(() => document.getElementById('la-uwin').innerText)).toLowerCase();
ok('screen: the user list shows the new username and display name, legacy toast "เปลี่ยน … แล้ว", dialog closed', rowOnScreen.includes('zz_renamed') && rowOnScreen.includes('zz renamed person') && /เปลี่ยน zz_ren เป็น zz_renamed แล้ว/.test(rowOnScreen) && !(await ev(() => !!document.getElementById('la-rmask'))), { zz: rowOnScreen.split(String.fromCharCode(10)).filter((l) => /zz/.test(l)), mask: await ev(() => !!document.getElementById('la-rmask')) });
// taken name → the server's refusal shown as legacy's text
await ev((id) => __laRename(id), uRen.id);
await page.fill('#la-r1', 'ZZ_WIDE'); await settle(200);
const hint = await ev(() => document.getElementById('la-rmsg').innerText);
ok('rename to a taken name (any case): the dialog hint refuses before sending', /มีคนใช้อยู่แล้ว/.test(hint), hint);
await ev(() => document.getElementById('la-rmask').remove());
await ev(() => __laClose());
// agent colour (PATCH)
await ev(() => { bookingV2AgentColorEdit('a01', {}); });
const sw = page.locator('#bkv2-agcol-pop button[onclick^="bookingV2AgentColorSet(\'a01\'"]').first();
const swCol = await sw.getAttribute('title');
const nC = bodies.length;
await sw.click();
await idle(); await settle(500);
const cp = bodies.slice(nC).filter((x) => x.m === 'PATCH' && x.p === '/v1/agents/a01');
ok('agent colour swatch → PATCH /v1/agents/a01 {color}; server and screen hold it; popover closed', cp.length === 1 && cp[0].b.color === swCol && (await api('/v1/agents/a01')).color === swCol && (await ev(() => SB_AGENTS.find((a) => a.id === 'a01').color)) === swCol && !(await ev(() => !!document.getElementById('bkv2-agcol-pop'))), { cp, swCol });
await ev(() => bookingV2AgentColorEdit('a01', { altKey: true }));
await idle(); await settle(500);
ok('Alt-click reset → PATCH {color:null}; server colour null', (await api('/v1/agents/a01')).color === null, await api('/v1/agents/a01'));
}
if (want(7)) {
console.log('\n[7] promo badge + bonus counter from the server state; agIncompleteFields from the server list');
item = 7;
// ---- seed: a booking with 4 adults for a01 on r5 inside the promo window, and four promos ----
const D = '2026-11-10';
await must('deployment', send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: D, capacity: 40 }));
await must('booking', send('POST', '/v1/bookings', { external_id: 'zz-promo-bk', intent: 'confirm', guides: { english: true }, leadNationality: 'RU', agentId: 'a01', leadPax: 'ZZ PROMO PAX', pickupSelf: true, trips: [{ routeId: 'r5', date: D, pax: { ad_fr: 4 }, zone: 'NoTransfer' }] }));
const promo = (note, from, to, extra = {}) => ({ agent_id: 'a01', price_mode: 'discount', discount: { mode: 'pct', value: 10 }, active_from: from, active_to: to, route_ids: ['r5'], priority: 10, note, ...extra });
const pA = await must('promo active', send('POST', '/v1/contracts', promo('ZZ PROMO ACTIVE', '2026-10-01', '2027-03-31', { bonus: { buy: 2, free: 1, basis: 'adchd' } })));
const pS = await must('promo scheduled', send('POST', '/v1/contracts', promo('ZZ PROMO SCHEDULED', '2027-06-01', '2027-09-30')));
const pV0 = await must('promo to void', send('POST', '/v1/contracts', promo('ZZ PROMO VOID', '2026-10-01', '2027-03-31', { bonus: { buy: 3, free: 1, basis: 'ad' } })));
const pV = await must('void', send('POST', '/v1/contracts/' + pV0.id + '/void', {}));
const pE = await send('POST', '/v1/contracts', promo('ZZ PROMO EXPIRED', '2026-01-01', '2026-03-31'));
const srvC = (await api('/v1/contracts?agent_id=a01')).contracts;
const byNote = (n) => srvC.find((c) => c.note === n);
const srvStates = Object.fromEntries(['ZZ PROMO ACTIVE', 'ZZ PROMO SCHEDULED', 'ZZ PROMO VOID', 'ZZ PROMO EXPIRED'].map((n) => [n, (byNote(n) || {}).state]));
console.log('  server states:', JSON.stringify(srvStates), '· expired promo create → ' + pE.status);
await ev(() => laOpsContracts.load()); await settle(800);
await nav('agents');
await ev(() => { _agSelected = 'a01'; agRenderDetail('a01'); }); await settle(900);
await ev(() => agSwitchTab('prices', 'a01')); await settle(900);
const LABEL = { void: 'ยกเลิก', expired: 'หมดอายุ', scheduled: 'รอเริ่ม', active: 'ใช้งาน' };
const rowText = (note) => ev((n) => { const r = [...document.querySelectorAll('#ag-tabbody div')].filter((d) => d.style.borderRadius === '10px' && d.innerText.includes(n)); return r.length ? r[r.length - 1].innerText : null; }, note);
for (const [note, state] of Object.entries(srvStates)) {
  if (!state) continue;
  const t = await rowText(note);
  ok(`promo "${note}": server state "${state}" → badge "${LABEL[state]}" on the pricing tab`, t && t.includes(LABEL[state]), { t, state });
}
ok('the main contract (server state active) shows "ใช้งาน" on the same tab', await ev(() => { const r = [...document.querySelectorAll('#ag-tabbody div')].filter((d) => d.style.borderRadius === '10px' && d.innerText.includes('MAIN')); return r.length > 0 && r[r.length - 1].innerText.includes('ใช้งาน'); }), null);
// the function itself, for the four server states (_ctContractStatus is what the badge calls)
const fnStates = await ev(() => Object.fromEntries(SB_CONTRACTS.filter((c) => c.agentId === 'a01' && c.kind === 'promo').map((c) => [c.note, { key: _ctContractStatus(c).key, ss: c.serverState }])));
ok('_ctContractStatus answers the server\'s state, not the browser date test', Object.entries(fnStates).every(([n, v]) => v.key === v.ss && v.ss === srvStates[n]), fnStates);
// bonus counter
const bp = byNote('ZZ PROMO ACTIVE').bonus_progress;
ok('server counted the booking: sold 4, 1 booking, earned 2 (buy 2)', bp && bp.sold === 4 && bp.bookings === 1 && bp.earned === 2, bp);
const at = await rowText('ZZ PROMO ACTIVE');
ok('bonus counter on screen = server bonus_progress (ขายแล้ว 4 หัว · 1 ใบ · ได้สิทธิ์ 2 · ใช้ไปแล้ว 0 · คงเหลือ 2)', at && at.includes('ซื้อ 2 แถม 1') && at.includes('ขายแล้ว ' + bp.sold) && at.includes(bp.sold + ' หัว · ' + bp.bookings + ' ใบ') && new RegExp('ได้สิทธิ์\\s*' + bp.earned + '\\s*ที่').test(at) && new RegExp('คงเหลือ\\s*' + bp.left + '\\s*ที่').test(at), { at, bp });
const ps = await ev(() => laPromoStat(SB_CONTRACTS.find((c) => c.note === 'ZZ PROMO ACTIVE')));
ok('laPromoStat (function) = server bonus_progress', ps.sold === bp.sold && ps.earned === bp.earned && ps.used === bp.used && ps.left === bp.left && ps.toNext === bp.to_next && ps.pct === bp.pct, { ps, bp });
ok('a void promo shows no counter (server gives null)', byNote('ZZ PROMO VOID').bonus_progress === null && !(await rowText('ZZ PROMO VOID') || '').includes('ซื้อ'), byNote('ZZ PROMO VOID').bonus_progress);
// ---- agIncompleteFields ----
const agInc = await send('POST', '/v1/agents', { ...AGENT_BASE, name: 'ZZ Incomplete Agent', code: 'ZZINC', rate_type_id: 'rt001', email: null, phone: null, contact: null });
const incId = agInc.json && agInc.json.id;
const srvInc = incId ? await api('/v1/agents/' + incId) : null;
const srvListInc = (await api('/v1/agents?active=all')).agents;
console.log('  incomplete (server): ' + JSON.stringify(srvListInc.map((a) => [a.name, a.incomplete])));
await ev(() => laOps.catalogue.load()); await settle(1000);
const screenInc = await ev(() => Object.fromEntries(SB_AGENTS.map((a) => [a.name, agIncompleteFields(a)])));
const LAB = { market: 'Market', sales: 'Sales owner', pay_type: 'Payment', rate_type: 'Rate Type', programs: 'Programs', contact: 'Contact' };
const expect = Object.fromEntries(srvListInc.map((a) => [a.name, a.incomplete.map((k) => LAB[k])]));
ok('agIncompleteFields on every list row = the server\'s `incomplete` list (same labels, same order)', Object.keys(expect).every((n) => JSON.stringify(screenInc[n]) === JSON.stringify(expect[n])), { screenInc, expect });
ok('sanity: the server list is not trivially empty (an agent without a rate type / contact is flagged)', expect['ZZ NoRate Agent'].includes('Rate Type') && (!incId || expect['ZZ Incomplete Agent'].length > 0), expect);
ok('a01 has an email: the server says complete and the screen shows no "Contact" gap (a local count over list rows would)', expect['Sun Tour'].length === 0 && screenInc['Sun Tour'].length === 0, { server: expect['Sun Tour'], screen: screenInc['Sun Tour'] });
// the list badge + agent page row
await ev(() => { agRenderList(); }); await settle(500);
const badge = await ev(() => { const out = {}; document.querySelectorAll('#ag-list .sb-ag-row').forEach((r) => { const nm = r.querySelector('.sb-ag-row-name-wrap span'); const b = r.querySelector('span[title^="ข้อมูลไม่ครบ"]'); if (nm) out[nm.textContent] = b ? b.getAttribute('title') : null; }); return out; });
ok('list badge "ข้อมูลไม่ครบ — ขาด: …" appears exactly for the agents the server flags, with its labels', Object.keys(expect).every((n) => badge[n] !== undefined && (expect[n].length ? badge[n] === 'ข้อมูลไม่ครบ — ขาด: ' + expect[n].join(', ') : badge[n] === null)), { badge, expect });
await ev((i) => { _agSelected = i; agRenderDetail(i); }, agNoRate.id); await settle(900);
const inc7 = await ev(() => [...document.querySelectorAll('#ag-main .ag-als .ag-al')].filter((r) => r.querySelector('.t').textContent === 'Incomplete profile').map((r) => r.querySelector('.d').textContent));
ok('agent page "Incomplete profile" row says missing Rate Type (server list)', inc7.length === 1 && /Rate Type/.test(inc7[0]), inc7);
}
//@@STEPS@@

await browser.close(); srv.close(); backend.kill();
console.log('\nresults per item (pass/fail): ' + JSON.stringify(results));
console.log('server refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
ok('no page errors', errors.length === 0, errors);
console.log(fails.length ? `\n✖ ${fails.length} failed:\n  ${fails.join('\n  ')}` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
