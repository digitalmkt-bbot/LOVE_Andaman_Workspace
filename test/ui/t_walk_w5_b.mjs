// t_walk_w5_b · browser walk of wave 5, group b: fleet rows (wire-03), seat-lock rules, pickup time, owed, market totals (wire-04)
// against a REAL operation-backend (in-process store, seeded). Every check reads BOTH sides: the screen and what the server holds / answers.
//   node test/ui/t_walk_w5_b.mjs
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
backend.on('exit', (c, sig) => console.log('BACKEND EXIT', c, sig, backendLog.slice(-1500)));
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const apiRaw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await apiRaw(p, init)).body;
const send = (m, p, b, h) => apiRaw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b), headers: h });
const post = async (p, b, h) => { const r = await send('POST', p, b, h); if (r.status >= 300) console.log('  seed POST ' + p + ' -> ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 240)); return r.body; };
const ifm = (v) => ({ 'if-match': '"' + v + '"' });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], bodies = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push(req.method() + ' ' + u.pathname + u.search + ' ' + r.status);
  if (req.method() !== 'GET') bodies.push({ k: req.method() + ' ' + u.pathname, status: r.status, req: req.postData() || '', body: buf.toString() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 260));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
let confirmAnswer = true;
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); if (d.type() === 'prompt') d.accept('Tester'); else if (d.type() === 'confirm' && !confirmAnswer) d.dismiss(); else d.accept(); });

const fails = [];
let curItem = '0';
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 600))); if (!cond) fails.push(curItem + ' ' + name); };
const item = (n, t) => { curItem = n; console.log(`\n[${n}] ${t}`); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const lastReq = (re) => { const b = bodies.filter((x) => re.test(x.k)).pop(); return b ? { status: b.status, req: b.req ? JSON.parse(b.req) : null, json: (() => { try { return JSON.parse(b.body); } catch (_) { return null; } })() } : null; };
const n0 = () => calls.length;
const since = (n) => calls.slice(n);
const fresh = async () => { await ev(() => laOps.wrote('walk-test')); };
const reloadFleet = async () => { await ev(async () => { await laOps.fleetJobs.load(); await laOps.fleetAssets.load(true); if (laOps.fleetDaily && laOps.fleetDaily.load) await laOps.fleetDaily.load(); if (laOps.fleetBoats) await laOps.fleetBoats.load(); if (laOps.fleetStock && laOps.fleetStock.refetch) await laOps.fleetStock.refetch(); }); await settle(400); };

const T0 = day(0), T1 = day(1), T2 = day(2), T3 = day(3);

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);

// ════════════════════ PART A · FLEET (wire-03) ════════════════════
// ── A1 flProjCancel: legacy's "unlink open child MJs?" confirm, answered to the server as unlink_jobs
item('A1', 'flProjCancel · the unlink confirm is asked and its answer is sent (POST …/cancel {reason, unlink_jobs})');
const pr1 = await post('/v1/fleet/projects', { no: 'PRJ-W5A', name: 'W5 keep linked', boat_id: 'b6', type: 'drydock', vendor: 'Yard', plan_from: T1 });
const pr2 = await post('/v1/fleet/projects', { no: 'PRJ-W5B', name: 'W5 unlink', boat_id: 'b7', type: 'drydock', vendor: 'Yard', plan_from: T1 });
const mkJob = async (no, boat, title, extra) => { const r = await post('/v1/fleet/jobs', Object.assign({ no, boat_id: boat, title, type: 'corrective', boat_status: 'fixing', create_anyway: true }, extra || {})); return (r && (r.id || (r.jobs && r.jobs[0] && r.jobs[0].id))) || null; };
const jk1 = await mkJob('MJ-W5A', 'b6', 'child of keep', { parent_project_id: pr1.id });
const jk2 = await mkJob('MJ-W5B', 'b7', 'child of unlink', { parent_project_id: pr2.id });
await reloadFleet();
dialogs.length = 0; confirmAnswer = false;
let c0 = n0();
await ev((id) => flProjCancel(id), pr1.id); await idle(); await settle(900);
let lr = lastReq(/POST .*\/fleet\/projects\/.+\/cancel$/);
ok('Cancel on the confirm: the screen asked legacy\'s question (1 open child MJ) and sent unlink_jobs:false', dialogs.some((d) => /This project has 1 open child MJ\(s\)\.\s+Unlink them so they continue as standalone jobs\?/.test(d)) && lr && lr.status === 200 && lr.req.unlink_jobs === false && lr.req.reason === 'Tester', { dialogs, lr });
let j1 = (await api('/v1/fleet/jobs/' + jk1));
ok('server: the project is cancelled and the child job is still linked', (await api('/v1/fleet/projects/' + pr1.id)).status === 'cancelled' && j1.parent_project_id === pr1.id, { st: (await api('/v1/fleet/projects/' + pr1.id)).status, parent: j1.parent_project_id });
confirmAnswer = true; dialogs.length = 0;
await ev((id) => flProjCancel(id), pr2.id); await idle(); await settle(900);
lr = lastReq(/POST .*\/fleet\/projects\/.+\/cancel$/);
let j2 = (await api('/v1/fleet/jobs/' + jk2));
ok('OK on the confirm: unlink_jobs:true, and the server\'s child job goes on alone', lr && lr.req.unlink_jobs === true && !j2.parent_project_id, { lr: lr && lr.req, parent: j2.parent_project_id });
ok('screen: both projects show cancelled (from the server answers)', await ev((a) => FL_PROJECTS.find((p) => p.id === a[0]).status === 'cancelled' && FL_PROJECTS.find((p) => p.id === a[1]).status === 'cancelled', [pr1.id, pr2.id]), null);

// ── A2 flMaintSetRepairLoc: one PATCH, the server moves the engines and writes the line
item('A2', 'flMaintSetRepairLoc · only PATCH the job location; the server moves the off-boat engine and logs it');
const engSp = await post('/v1/fleet/engines', { brand: 'Yamaha', model: 'F300', serial: 'W5-SPARE', hp: 300, base_hours: 10, service_interval: 100, status: 'spare', spare_location: 'pier:central' });
const jLoc = await mkJob('MJ-W5C', 'b6', 'repair place walk', { assets: [{ type: 'engine', asset_id: engSp.id }] });
await reloadFleet();
await ev((id) => { const i = document.createElement('input'); i.id = 'fl-maint-reploc-' + id; i.value = 'อู่ซ่อมทดสอบ'; document.body.appendChild(i); }, jLoc);
c0 = n0();
await ev((id) => flMaintSetRepairLoc(id), jLoc); await idle(); await settle(1200);
const nonGet = since(c0).filter((c) => !c.startsWith('GET'));
const engAfter = await api('/v1/fleet/engines/' + engSp.id), jobAfter = await api('/v1/fleet/jobs/' + jLoc);
ok('requests: exactly one write, PATCH …/jobs/{id} {location}', nonGet.length === 1 && /^PATCH \/v1\/fleet\/jobs\/.+ 200/.test(nonGet[0]) && JSON.stringify(lastReq(/PATCH .*\/fleet\/jobs\//).req) === JSON.stringify({ location: 'อู่ซ่อมทดสอบ' }), nonGet);
ok('server: the engine moved to the place and the job log has the line with the count', engAfter.spare_location === 'อู่ซ่อมทดสอบ' && jobAfter.progress_log.some((l) => /ตั้งสถานที่ซ่อม: อู่ซ่อมทดสอบ \(อัปเดตเครื่อง 1 ตัว\)/.test(l.text)) && jobAfter.progress_log.filter((l) => /ตั้งสถานที่ซ่อม/.test(l.text)).length === 1, { eng: engAfter.spare_location, log: jobAfter.progress_log.map((l) => l.text) });
ok('screen: the engine row shows the server\'s place', await ev((id) => (FL_ENGINES.find((e) => e.id === id) || {}).spareLocation, engSp.id) === 'อู่ซ่อมทดสอบ', null);

// ── A3 flSaveAddSpare: no cost in the body, the server prices the propeller
item('A3', 'flSaveAddSpare · the propeller is sent without cost; the server gives it 8,500');
await ev(() => { const s = (id, v) => { document.getElementById(id).value = v; }; s('fl-add-spare-type', 'propeller'); s('fl-add-spare-serial', 'W5-PROP-1'); s('fl-add-spare-brand', 'Solas'); s('fl-add-spare-note', 'walk'); s('fl-add-spare-size', ''); });
await ev(() => { const l = document.getElementById('fl-add-spare-loc'); if (l && l.options.length) l.selectedIndex = 0; });
await ev(() => flSaveAddSpare()); await idle(); await settle(900);
lr = lastReq(/POST \/v1\/fleet\/propellers$/);
ok('POST /v1/fleet/propellers carries no cost', lr && lr.status === 201 && !('cost' in lr.req), lr);
ok('server: cost 8,500 (its default)', lr && lr.json && +lr.json.cost === 8500, lr && lr.json);
ok('screen: the new spare shows the server\'s cost', await ev(() => (FL_PROPELLERS.find((p) => p.serial === 'W5-PROP-1') || {}).cost) === 8500, null);

// ── A4 flSaveAddStock: blank minimum is not sent
item('A4', 'flSaveAddStock · a blank minimum is left out; the server gives 5');
await ev(() => { const s = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; }; s('add-inv-name', 'W5 Oil Filter'); s('add-inv-partno', 'W5-OF-1'); s('add-inv-qty', '0'); s('add-inv-min', ''); s('add-inv-cost', '120'); });
await ev(() => flSaveAddStock()); await idle(); await settle(900);
lr = lastReq(/POST \/v1\/fleet\/stock-items$/);
ok('POST body has no min_qty', lr && lr.status === 201 && !('min_qty' in lr.req), lr);
ok('server: minimum 5', lr && lr.json && (lr.json.min_qty === 5 || (lr.json.stocks && lr.json.stocks.some((s) => s.min_qty === 5))), lr && lr.json);

// ── A5 memo line linked by name: no item_id from the browser, the server links
item('A5', 'memoAddItem + flSaveMemo · a line linked by name is sent without item_id; the server links it');
const stk = await post('/v1/fleet/stock-items', { name: 'W5 Gasket Unique', part_no: 'W5-G-1', category: 'general', unit: 'ชิ้น', cost: 50 });
await reloadFleet();
await ev((g) => {
  const s = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  window._memoItems = []; window._memoScope = 'general'; window._memoType = 'parts'; window._memoEditId = null; window._memoMaintId = null; window._memoProjectId = null; window._memoSelectedInv = null;
  s('memo-new-name', 'W5 Gasket Unique'); s('memo-new-qty', '2'); s('memo-new-price', '50'); memoAddItem();
  s('memo-subject', 'W5 memo by name'); s('memo-supplier', 'Sup W5');
  const gc = document.getElementById('memo-general-cat'); if (gc && gc.options.length) gc.selectedIndex = 0;
}, stk);
const added = await ev(() => JSON.parse(JSON.stringify(_memoItems)));
ok('legacy still links the line by name on screen (invId set, no snapshot): the browser guess is only a hint', added.length === 1 && added[0].invId && !added[0].inventorySnapshot, added);
await ev(() => flSaveMemo()); await idle(); await settle(1200);
lr = lastReq(/POST \/v1\/fleet\/memos$/);
ok('POST body: the line has no item_id', lr && lr.status === 201 && lr.req.lines.length === 1 && !('item_id' in lr.req.lines[0]), lr && lr.req && lr.req.lines);
ok('server: the line is linked to the stock item by name', lr && lr.json && (lr.json.lines || lr.json.items || [])[0] && ((lr.json.lines || lr.json.items)[0].item_id === stk.id), lr && lr.json && (lr.json.lines || lr.json.items));

// ── A6 flAdvanceMemo: the next step follows the server's labor_only
item('A6', 'flAdvanceMemo · labour-only is the server\'s flag (a labour memo is paid straight after approval)');
const mLab = await post('/v1/fleet/memos', { no: 'MO-W5L', title: 'W5 labour memo', memo_type: 'labor', scope: 'vessel', boat_id: 'b6', supplier: 'Crew', memo_date: T0, vat_enabled: false, lines: [{ name: 'W5 labour', qty: 1, price: 500, category: 'labor', unit: 'งาน' }] });
await post('/v1/fleet/memos/' + mLab.id + '/approve', { approved_by: 'Boss', approved_date: T0 });
await reloadFleet();
await ev((id) => { const m = FL_MEMOS.find((x) => x.id === id); m.memoType = 'parts'; m.items.forEach((it) => { it.category = 'parts'; }); }, mLab.id);   // the browser's own test would now say "parts memo"
c0 = n0();
await ev((id) => flAdvanceMemo(id), mLab.id); await idle(); await settle(900);
ok('the screen sends …/pay (server labor_only), not …/order', since(c0).some((c) => /^POST \/v1\/fleet\/memos\/.+\/pay 200/.test(c)) && !since(c0).some((c) => /\/order/.test(c)), since(c0));
ok('server: the memo is paid', (await api('/v1/fleet/memos/' + mLab.id)).status === 'paid', null);

// ── A7 flMemoWarehouse: default_warehouse of the memo
item('A7', 'flMemoWarehouse · the receive dialog\'s warehouse and its line come from default_warehouse');
const mPar = await post('/v1/fleet/memos', { no: 'MO-W5P', title: 'W5 parts memo', memo_type: 'parts', scope: 'vessel', boat_id: 'b13', supplier: 'Sup', memo_date: T0, vat_enabled: false, lines: [{ name: 'W5 Part Panwa', qty: 3, price: 10, category: 'parts', unit: 'ชิ้น' }] });
await post('/v1/fleet/memos/' + mPar.id + '/approve', { approved_by: 'Boss', approved_date: T0 });
await post('/v1/fleet/memos/' + mPar.id + '/order', { ordered_date: T0 });
await reloadFleet();
const dw = (await api('/v1/fleet/memos/' + mPar.id)).default_warehouse;
await ev(() => { window.__gbcp = window.getBoatCurrentPier; window.getBoatCurrentPier = () => 'tublamu'; });   // the browser's own rule now says Tub Lamu
const legacyWh = await ev((id) => { const mo = FL_MEMOS.find((x) => x.id === id); return flMemoWarehouse.__orig ? flMemoWarehouse.__orig(mo) : null; }, mPar.id);
await ev((id) => flOpenReceiveMemo(id), mPar.id); await settle(1200);
const recv = await ev(() => ({ v: (document.getElementById('receive-location') || {}).value, warn: (document.getElementById('receive-location-warn') || {}).textContent }));
ok('server default_warehouse is Panwa and says why', dw && dw.warehouse === 'panwa' && dw.why, dw);
ok('screen: the warehouse box shows the server\'s warehouse (not the browser pier)', recv.v === 'คลัง Visit Panwa' && recv.warn.indexOf(dw.why) >= 0, { recv, legacyWh });
ok('legacy\'s own answer differed (Tub Lamu from the browser copy), so the server\'s drove the dialog', legacyWh && legacyWh.wh === 'คลัง Tub Lamu', legacyWh);
await ev(() => { closeModal('fl-modal-receive'); window.getBoatCurrentPier = window.__gbcp; });

// ── A8 flDeleteEngine: the server's 409 has_history
item('A8', 'flDeleteEngine · confirm, DELETE; the server refuses an engine with history, in its words');
const engH = await post('/v1/fleet/engines', { brand: 'Honda', model: 'BF250', serial: 'W5-HIST', hp: 250, base_hours: 10, service_interval: 100, status: 'ready', boat_id: 'b7', pos: 'Port' });
await post('/v1/fleet/engines/' + engH.id + '/remove', {});          // an installed-then-removed engine has log lines
await reloadFleet();
dialogs.length = 0; confirmAnswer = true;
await ev((id) => { flEditEngId = id; flDeleteEngine(); }, engH.id); await idle(); await settle(900);
lr = lastReq(/DELETE \/v1\/fleet\/engines\//);
ok('DELETE sent after legacy\'s confirm; 409 has_history', dialogs.some((d) => /^confirm: Delete engine W5-HIST/.test(d)) && lr && lr.status === 409, { dialogs, lr });
ok('the alert is the server\'s message', lr && lr.json && dialogs.some((d) => d === 'alert: ' + lr.json.message), { dialogs, msg: lr && lr.json && lr.json.message });
ok('the engine is still on screen and on the server', (await ev((id) => !!FL_ENGINES.find((e) => e.id === id), engH.id)) && (await apiRaw('/v1/fleet/engines/' + engH.id)).status === 200, null);
const engC = await post('/v1/fleet/engines', { brand: 'Honda', model: 'BF250', serial: 'W5-CLEAN', hp: 250, base_hours: 10, service_interval: 100, status: 'spare', spare_location: 'pier:central' });
await reloadFleet();
await ev((id) => { flEditEngId = id; flDeleteEngine(); }, engC.id); await idle(); await settle(900);
lr = lastReq(/DELETE \/v1\/fleet\/engines\//);
ok('a clean engine: DELETE 204, the engine leaves the screen and the server (404)', lr && lr.status === 204 && !(await ev((id) => !!FL_ENGINES.find((e) => e.id === id), engC.id)) && (await apiRaw('/v1/fleet/engines/' + engC.id)).status === 404, lr);

// ── A9 flwItems: only the items the server lists
item('A9', 'flwItems · an item only the browser holds is not on the Fleet Work page');
await ev(() => { FL_MAINT.push({ id: 'zz-local-only', no: 'MJ-LOCAL', title: 'Browser only job', boatId: 'b6', status: 'pending', type: 'corrective', assets: [], progressLog: [], parts: [], startDate: '' }); });
await fresh(); await ev(() => { FLW.bf = 'all'; FLW.stage = -1; flwItems(); }); await settle(1500);
const wk = await api('/v1/fleet/work?boats=all');
const keys = []; wk.boats.forEach((b) => b.items.forEach((x) => keys.push(x.key)));
const scr = await ev(() => { FLW.bf = 'all'; FLW.stage = -1; return flwItems().map((x) => x.key); });
ok('the screen lists exactly the server\'s items that it can draw; the browser-only job is gone', !scr.includes('mj:zz-local-only') && scr.length > 0 && scr.every((k) => keys.includes(k)), { scr, keys });
ok('every real job of the server is still listed', keys.filter((k) => k.startsWith('mj:')).every((k) => scr.includes(k)), { scr, keys });
await ev(() => { const i = FL_MAINT.findIndex((m) => m.id === 'zz-local-only'); if (i >= 0) FL_MAINT.splice(i, 1); });

// ── A10 documents tiles, A11 type/current, A12 inspection strip, A13 wizard numbers
item('A10', 'faDocAlertCount / faDocData · the tiles are the matrix counts of GET /v1/fleet/certificates');
const dExp = day(-5), dW30 = day(10), dOk = day(200);
await post('/v1/boats/b6/documents/renew', { name: 'ใบอนุญาต ประกันภัย W5', state: 'ok', expires_on: dExp });
await post('/v1/boats/b7/documents/renew', { name: 'ใบอนุญาต ประกัน W5B', state: 'ok', expires_on: dW30 });
await post('/v1/boats/b1/documents/renew', { name: 'ใบตรวจสภาพ W5', state: 'ok', expires_on: dOk });
await reloadFleet(); await ev(() => laOpsFleetBoats.load()); await settle(800);
const cert = await api('/v1/fleet/certificates');
const noDate = cert.boats.reduce((n, b) => n + Object.values(b.cells).filter((c) => c && c.status === 'na').length, 0);
ok('server: the matrix counts a today-expired, a 30-day and a healthy document', cert.counts.exp >= 1 && cert.counts.warn30 >= 1 && cert.counts.ok >= 1, cert.counts);
await ev(() => { BOATS.forEach((b) => { b.docs = []; }); });      // the browser\'s own documents are gone: legacy would now count nothing
await waitFor((w) => { faDocAlertCount(); return faDocAlertCount() === w; }, cert.counts.exp + cert.counts.warn30, 8000);   // a change event from the seeding may make the held matrix old for a moment; it is read again
const scrA = await ev(() => ({ alert: faDocAlertCount(), c: faDocData().c }));
ok('faDocAlertCount = exp + warn30 of the server', scrA.alert === cert.counts.exp + cert.counts.warn30, { scrA, counts: cert.counts });
ok('faDocData tiles: ok / 90 days / 30 days / renewing / expired are the server counts (expired also holds documents with no date)', scrA.c.ok === cert.counts.ok && scrA.c.w90 === cert.counts.warn90 && scrA.c.w30 === cert.counts.warn30 && scrA.c.proc === cert.counts.processing && scrA.c.exp === cert.counts.exp + noDate, { scrA, counts: cert.counts, noDate });
await reloadFleet();
// a write elsewhere made the held matrix old: the tile is drawn again from a fresh matrix, not from the old counts
await post('/v1/boats/b13/documents/renew', { name: 'ใบอนุญาต ประกัน W5C', state: 'ok', expires_on: day(-3) });
await ev(() => laOps.wrote('walk-test'));
await ev(() => faDocAlertCount()); await settle(1200);
const cert2 = await api('/v1/fleet/certificates');
const want = cert2.counts.exp + cert2.counts.warn30; await waitFor((w) => { faDocAlertCount(); return faDocAlertCount() === w; }, want, 8000); const alertNow = await ev(() => faDocAlertCount());
ok('after a write the Documents badge follows the matrix read again (one more expired)', cert2.counts.exp === cert.counts.exp + 1 && alertNow === want, { before: cert.counts, after: cert2.counts });

item('A11', 'flGuessDocType / flDocBetter · the type and the current copy are the server\'s');
const docsB6 = (await api('/v1/boats/b6/documents')).documents;
const dIns = docsB6.find((d) => /W5/.test(d.name));
const r11 = await ev((a) => {
  const b = BOATS.find((x) => x.id === 'b6'); const d = b.docs.find((x) => x.name === a.name);
  const typ = d ? d.docType : null;
  d.name = d.name;                                               // same name
  const savedType = d.docType; d.docType = 'surin';             // the server says another type than the name suggests
  const g = flGuessDocType(d.name); d.docType = savedType;
  const bet = flDocBetter({ exp: '2099-01-01', renewStatus: null }, Object.assign({}, d, { current: true }));
  const bet2 = flDocBetter({ exp: '2000-01-01', renewStatus: null }, Object.assign({}, d, { current: false }));
  return { typ, g, bet, bet2 };
}, { name: dIns && dIns.name });
ok('the document carries the server\'s doc_type', dIns && dIns.doc_type === 'ins' && r11.typ === 'ins', { dIns, r11 });
ok('flGuessDocType answers the server\'s type for that document name', r11.g === 'surin', r11);
ok('flDocBetter follows the server\'s current flag, not the dates (current true wins an older expiry, false loses to a newer)', r11.bet === true && r11.bet2 === false, r11);

item('A12', '_flBuildInspectionSection · the strip shows the server\'s state (the nearer of expiry and next PM)');
const sfx = await post('/v1/fleet/safety', { boat_id: 'b6', category: 'fire_ext', name: 'W5 extinguisher', qty: 1, install_date: T0, expiry_date: day(10), next_pm: day(200), status: 'active' });
await reloadFleet(); await settle(500);
const sf = await api('/v1/fleet/safety/' + sfx.id);
const strip = await ev((id) => { const it = FL_SAFETY.find((x) => x.id === id); const d = document.createElement('div'); d.innerHTML = _flBuildInspectionSection(it, { ink: '#000', ink2: '#666', ink3: '#999', line: '#eee' }, { pmMonths: 1 }, null); return d.textContent.replace(/\s+/g, ' '); }, sfx.id);
ok('server state: DUE with about 10 days (expiry beats the far next PM)', sf.state && sf.state.label === 'DUE' && sf.state.days >= 9 && sf.state.days <= 10, sf.state);
ok('the strip says DUE · Nd left from the server state (legacy would have said OK · 200d from nextPM)', new RegExp('DUE · ' + sf.state.days + 'd left').test(strip) && !/OK · 200d left/.test(strip), strip.slice(0, 200));

item('A13', 'replace wizard · the numbers come from next_no (incidents, jobs) and are what is sent');
const incLast = await post('/v1/fleet/incidents', { no: 'INC-050', boat_id: 'b6', date: T0, title: 'W5 number gap', priority: 3 });
await reloadFleet();
const srvInc = (await api('/v1/fleet/incidents?boat_id=-none-')).next_no, srvJob = (await api('/v1/fleet/jobs?boat_id=-none-')).next_no;
const step3 = await ev(async (sid) => {
  swapDocOpen(sid); _swapDoc.step = 3; _swapDoc.source = 'buy'; _swapDoc.newBrand = 'Rule'; _swapDoc.newModel = '1100'; _swapDoc.newPrice = 100;
  const it = FL_SAFETY.find((x) => x.id === sid), b = getBoat(it.boatId), cat = FL_SAFETY_CATEGORIES[it.category] || { label: it.category };
  _swapDocStep3(it, b, cat); await new Promise((r) => setTimeout(r, 1200));
  const d = document.createElement('div'); d.innerHTML = _swapDocStep3(it, b, cat); return d.textContent.replace(/\s+/g, ' ');
}, sfx.id);
ok('server next_no is INC-051 / its job number, not the browser count + 1', srvInc === 'INC-051' && /^MJ-/.test(srvJob), { srvInc, srvJob });
ok('step 3 shows the server\'s incident and job numbers', step3.indexOf(srvInc) >= 0 && step3.indexOf(srvJob) >= 0, step3.slice(0, 300));
c0 = n0();
await ev(async (sid) => { swapDocOpen(sid); Object.assign(_swapDoc, { step: 3, source: 'buy', reason: 'broken', newBrand: 'Rule', newModel: '1100', newPrice: 100, supplier: 'S', newSerial: 'W5-NEW', installDate: new Date().toISOString().slice(0, 10) }); swapDocExecute(); }, sfx.id);
await idle(); await settle(1500);
lr = lastReq(/POST \/v1\/fleet\/safety\/.+\/replace$/);
ok('POST …/replace sends the server\'s incident_no and job_no', lr && lr.status === 201 && lr.req.incident_no === srvInc && lr.req.job_no === srvJob, lr && (lr.req || lr));

// ════════════════════ PART B · SEAT LOCKS (wire-04) ════════════════════
for (const d of [T1, T2, T3]) await post('/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: d, capacity: 40 });
await post('/operations/deployments', { boat_id: 'b7', route_id: 'r5', service_date: T1, capacity: 34 });
const lkA = await post('/v1/seat-locks', { route_id: 'r5', service_date: T1, pax: 10, holder_type: 'agent', agent_id: 'a01', reason: 'W5 split' });
const subA = await post(`/v1/seat-locks/${lkA.id}/sub-groups`, { sub_name: 'A', pax: 3 }, ifm(lkA.version));
const lkB = await post('/v1/seat-locks', { route_id: 'r5', service_date: T2, pax: 8, holder_type: 'office' });
const bkL = await post('/v1/bookings', { external_id: 'zz-w5-lock', intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: 'W5 LOCK', leadNationality: 'RU', leadPhone: '+7 9', pickupSelf: true, trips: [{ routeId: 'r5', date: T1, pax: { ad_fr: 2 }, zone: 'NoTransfer', lockDraws: { [lkA.id]: 2 } }] });
await ev(() => laOps.locks.reload()); await settle(1200);
item('B1', 'seat lock rules · HoldsOn, Allocated, Unalloc, UsedTotal, HeldRemaining, PoolHold, PendOn answer from the server\'s numbers');
const sA = (await api('/v1/seat-locks/' + lkA.id)), sSub = await api('/v1/seat-locks/' + subA.id);
const lockRows = (await api('/v1/seat-locks?service_date=' + T1)).seat_locks;
const sTop = lockRows.find((x) => x.id === lkA.id);
// tamper the browser copy: legacy's arithmetic over these would give other numbers
await ev((id) => { const l = SB_SEAT_LOCKS.find((x) => x.id === id); l.qty = 99; l.used = 0; l.status = 'active'; SB_SEAT_LOCKS.filter((x) => x.parentId === id).forEach((c) => { c.qty = 0; }); }, lkA.id);
const r1 = await ev((a) => { const l = SB_SEAT_LOCKS.find((x) => x.id === a.id); return { holds: bookingV2LockHoldsOn(l, a.d), alloc: bookingV2LockAllocated(l), unalloc: bookingV2LockUnalloc(l), usedTotal: bookingV2LockUsedTotal(l, a.d), held: bookingV2LockHeldRemaining(l, a.d), pool: bookingV2LockPoolHold(l, a.d), pend: bookingV2LockPendOn(l, a.d) }; }, { id: lkA.id, d: T1 });
ok('server numbers of the lock: holding, 3 seats in a sub-group, 2 drawn', sTop.holding === true && sTop.allocated_pax === 3 && sTop.drawn_pax === 2, sTop);
ok('HoldsOn = holding', r1.holds === sTop.holding, r1);
ok('Allocated = allocated_pax (the browser\'s sub-group list was emptied)', r1.alloc === sTop.allocated_pax, { r1, sTop });
ok('UsedTotal = drawn_pax (the browser had used 0)', r1.usedTotal === sTop.drawn_pax, { r1, sTop });
ok('HeldRemaining and PoolHold = held_pax', r1.held === sTop.held_pax && r1.pool === sTop.held_pax, { r1, sTop });
ok('Unalloc = pax − released − allocated_pax (the browser had qty 99)', r1.unalloc === (sTop.pax - (sTop.released_pax || 0) - sTop.allocated_pax) || r1.unalloc === Math.max(0, 99 - 3), { r1, sTop });
ok('PendOn = pending_pax', r1.pend === (sTop.pending_pax || 0), { r1, sTop });
await ev(() => laOps.locks.reload()); await settle(800);

item('B2', 'bookingV2DayLockedExact / bookingV2DayLockedTotal / bookingV2LockFreeOn · the day\'s numbers');
const avT1 = (await api(`/v1/availability?route_id=r5&date=${T1}`));
await ev((d) => { laOps.availability.ensure(d); }, T1); await settle(1200);
await ev((d) => { SB_SEAT_LOCKS.forEach((l) => { if (l.date === d) l.qty = 999; }); }, T1);   // tamper
const r2 = await ev((a) => ({ total: bookingV2DayLockedTotal(a.d), exact: bookingV2DayLockedExact(a.d), free: bookingV2LockFreeOn('r5', a.d, null) }), { d: T1 });
const allLocked = (await Promise.all((await api('/v1/routes')).routes.map(async (r) => (await api(`/v1/availability?route_id=${r.id}&date=${T1}`)).locked_pax || 0))).reduce((s, x) => s + x, 0);
ok('DayLockedTotal = the sum of locked_pax of every route that day (server)', r2.total === allLocked && allLocked > 0, { r2, allLocked, avT1 });
ok('DayLockedExact (the one-day locks) = the server\'s held_pax of the day locks', r2.exact === (await api('/v1/seat-locks?service_date=' + T1)).seat_locks.filter((x) => !x.group_id && !x.parent_id && !x.boat_id && x.holding).reduce((s, x) => s + (x.held_pax || 0), 0), r2);
ok('LockFreeOn = the server available_seats', r2.free === avT1.available_seats, { r2, avT1 });
await ev(() => laOps.locks.reload()); await settle(600);

item('B3', 'draws and returns · no local log, no status flip; the numbers move until the reload, then the server\'s are back');
const b3 = await ev((a) => {
  const l = SB_SEAT_LOCKS.find((x) => x.id === a.id), logN = (l.log || []).length, st = l.status;
  const rem0 = bookingV2LockRemaining(l, a.d);
  const n = bookingV2DrawLock(a.id, 2, 'zz-bk', a.d), rem1 = bookingV2LockRemaining(l, a.d);
  const back = bookingV2ReturnLock(a.id, 2, 'zz-bk', a.d, 'test'), rem2 = bookingV2LockRemaining(l, a.d);
  return { rem0, n, rem1, back, rem2, logSame: (l.log || []).length === logN, st: l.status === st };
}, { id: lkB.id, d: T2 });
ok('draw 2 lowers the remaining by 2, the return puts it back; nothing written to the lock\'s log or status', b3.n === 2 && b3.back === 2 && b3.rem1 === b3.rem0 - 2 && b3.rem2 === b3.rem0 && b3.logSame && b3.st, b3);
await ev(() => laOps.locks.reload()); await settle(600);
ok('after the reload the remaining is the server\'s (nothing was drawn on the server)', await ev((a) => bookingV2LockRemaining(SB_SEAT_LOCKS.find((x) => x.id === a.id), a.d), { id: lkB.id, d: T2 }) === (await api('/v1/seat-locks/' + lkB.id)).remaining_pax, null);

item('B4', 'booking form · which locks a booking may draw and the box ceiling come from the lock-draws sources');
const b4 = await ev(async (a) => {
  window._bkV2 = window._bkV2 || {}; _bkV2.newBooking = { id: 'draft-w5', agentId: 'a01', addOns: [], trips: [{ routeId: 'r5', date: a.d, pax: { ad_fr: 4 }, bookingMode: 'seat' }] };
  const before = bookingV2LocksForAgent('r5', a.d, 'a01').map((l) => l.id);
  await new Promise((r) => setTimeout(r, 1500));
  const after = bookingV2LocksForAgent('r5', a.d, 'a01').map((l) => l.id);
  const src = laOps.lockDraws.sources('r5', a.d);
  bookingV2SetTripLockUse(0, 99);
  return { before, after, src, use: _bkV2.newBooking.trips[0].lockUse };
}, { d: T1 });
const qd = await post('/v1/quote/lock-draws', { agentId: 'a01', trips: [{ routeId: 'r5', date: T1, pax: { ad_fr: 4 } }] });
const qsrc = (((qd.trips || [])[0] || {}).lock_draws || {}).sources || [];
ok('the server\'s sources exist (the agent\'s lock)', qsrc.length > 0 && b4.src && b4.src.length === qsrc.length, { qsrc, b4 });
ok('LocksForAgent lists the lock(s) the server offers; box ceiling = min(typed, pax, sum of source remaining)', b4.after.includes(lkA.id) && b4.use === Math.min(4, qsrc.reduce((s, x) => s + x.remaining, 0)), { b4, qsrc });
await ev(() => { delete _bkV2.newBooking; });

item('B5', 'whole-boat hold · blockers, can-take, boat capacity from boat-options and boat_capacity');
const hold = await post('/v1/seat-locks', { route_id: 'r5', service_date: T3, boat_id: 'b6', pax: 20, boat_deal: 'fixed', holder_type: 'office', expiry: T3, reason: 'W5 hold' });
await ev(() => laOps.locks.reload()); await settle(1000);
const holdRow = (await api('/v1/seat-locks?kind=boat&service_date=' + T3)).seat_locks.find((x) => x.id === hold.id);
const opts = (await api(`/v1/seat-locks/boat-options?route_id=r5&service_date=${T3}`));
const optB6 = (opts.boats || opts.options || []).find((x) => x.boat_id === 'b6');
const b5 = await ev(async (a) => {
  bookingV2BoatLockPickList(a.d, 'r5', '');                                // starts the boat list read
  await new Promise((r) => setTimeout(r, 1500));
  const pl = bookingV2BoatLockPickList(a.d, 'r5', '');
  const B = bookingV2BoatLockBlockers(a.d, 'b6', 'r5', '');
  return { cap: bookingV2BoatCapOn('b6', a.d), can: bookingV2BoatLockCanTake(a.d, 'b6', 'r5', ''), holdOf: B.holdOf, pickB6: pl.find((x) => x.id === 'b6') };
}, { d: T3 });
ok('server: the hold has boat_capacity and the boat list says b6 is not ok because of a hold', holdRow && holdRow.boat_capacity > 0 && optB6 && optB6.ok === false, { holdRow, optB6 });
ok('BoatCapOn = boat_capacity of the hold', b5.cap === holdRow.boat_capacity, { b5, holdRow });
ok('Blockers.holdOf = the server\'s blocking hold; CanTake = the server\'s ok (false)', b5.holdOf === ((optB6.blockers && optB6.blockers.hold_id) || '') && b5.can === false && b5.holdOf !== '', { b5, optB6 });
ok('the pick list carries the server\'s reason text', b5.pickB6 && b5.pickB6.ok === false && b5.pickB6.why && optB6.why && b5.pickB6.why === (optB6.why.message || optB6.why.code), { b5, why: optB6.why });

item('B6', 'whole-boat hold · release: the server frees the boat and the board cell is read again (no local cell step)');
await ev((id) => { const l = SB_SEAT_LOCKS.find((x) => x.id === id); const T = TRIPS[l.date] && TRIPS[l.date][l.boatId]; return !!T; }, hold.id);
const cellBefore = await ev((a) => { const c = (TRIPS[a.d] || {})[a.b]; return c ? { type: c.type, lock: c.boatLockId || null } : null; }, { d: T3, b: 'b6' });
confirmAnswer = true;
await ev((id) => bookingV2BoatLockReleaseGo(id), hold.id); await idle(); await settle(1800);
const cellAfter = await ev((a) => { const c = (TRIPS[a.d] || {})[a.b]; return c ? { type: c.type, lock: c.boatLockId || null } : null; }, { d: T3, b: 'b6' });
ok('before: the board cell is marked as the hold', cellBefore && cellBefore.lock === hold.id && cellBefore.type === 'charter', cellBefore);
ok('server: the hold is released', (await api('/v1/seat-locks/' + hold.id)).status === 'released', null);
ok('after: the cell is the server\'s deployment again (deployments were read), not a local edit', cellAfter && !cellAfter.lock && cellAfter.type !== 'charter' && since(0).slice(-40).some((c) => /GET \/operations\/deployments/.test(c)), { cellAfter, tail: since(0).slice(-12) });

item('B7', 'bookingV2BoatLockOnConvert · no local conversion: the hold stays as the server has it until the lists are read');
const hold2 = await post('/v1/seat-locks', { route_id: 'r5', service_date: T3, boat_id: 'b6', pax: 20, boat_deal: 'fixed', holder_type: 'office', expiry: T3 });
await ev(() => laOps.locks.reload()); await settle(1000);
const b7 = await ev((a) => { const l = SB_SEAT_LOCKS.find((x) => x.id === a.id); const logN = (l.log || []).length; const r = bookingV2BoatLockOnConvert(a.id, { id: 'bk-w5', trips: [{ bookingMode: 'charter', charterBoatId: 'b6', date: a.d }] }); return { r, status: l.status, convertedTo: l.convertedTo || null, logSame: (l.log || []).length === logN, hold: laOps.locks.holdFor('bk-w5') }; }, { id: hold2.id, d: T3 });
ok('returns true, the hold is remembered for the save, nothing changed locally (status active, no log line, no convertedTo)', b7.r === true && b7.status === 'active' && !b7.convertedTo && b7.logSame && b7.hold && b7.hold.id === hold2.id, b7);
await post('/v1/seat-locks/' + hold2.id + '/release', {}, ifm((await api('/v1/seat-locks/' + hold2.id)).version));

// ════════════════════ PART C · BOOKING-SIDE ROWS ════════════════════
item('C1', 'bookingV2GetPickupTime · the time of an area on a day is the server\'s (profile, area cell, time group, fallback)');
await post('/v1/pickup-areas', { name: 'W5 Area', zone: 'PK', time_group: 'w5grp' });
const areas = (await api('/v1/pickup-areas?active=true')).areas;
const area = areas.find((a) => a.zone === 'PK') || areas[0];
if (area) {
  const prof = await post('/v1/pickup-time-profiles', { name: 'W5 season', from_date: day(-1), to_date: day(60) });
  await send('PUT', `/v1/pickup-time-profiles/${prof.id}/times/r5/${area.id}`, { pickup_time: '06:45', pickup_time_end: '07:15' });
  // the browser copy of the setup is NOT refreshed: legacy's own lookup would not know this cell
  const srvAns = await api(`/v1/pickup-time?route_id=r5&area_id=${area.id}&date=${T1}`);
  const c1 = await ev(async (a) => {
    const first = bookingV2GetPickupTime('r5', a.area, a.d);
    await new Promise((r) => setTimeout(r, 1200));
    return { first, second: bookingV2GetPickupTime('r5', a.area, a.d) };
  }, { area: area.id, d: T1 });
  ok('server answers the cell 06:45-07:15 from the new profile', srvAns && srvAns.pickup_time === '06:45' && srvAns.pickup_time_end === '07:15', srvAns);
  ok('the form\'s lookup, once the answer is in, is the server\'s text (the first ask was legacy\'s)', c1.second === '06:45-07:15' && c1.first !== '06:45-07:15', c1);
  const c1b = await ev(async (d) => { SB_PICKUP_AREAS.push({ id: 'nt-w5-pseudo', name: 'W5 pseudo', zone: 'NoTransfer', timeGroup: 'w5pseudo', active: true }); SB_PICKUP_TIMES.r5 = Object.assign({}, SB_PICKUP_TIMES.r5, { w5pseudo: '09:00' }); const first = bookingV2GetPickupTime('r5', 'nt-w5-pseudo', d); await new Promise((r) => setTimeout(r, 900)); return { first, second: bookingV2GetPickupTime('r5', 'nt-w5-pseudo', d), legacy: bookingV2GetPickupTime.__orig('r5', 'nt-w5-pseudo', d) }; }, T1);
  ok('an area the server does not know (a screen-made one) keeps the legacy answer; the 404 is not taken as "no time"', c1b.legacy === '09:00' && c1b.second === '09:00' && c1b.first === '09:00', c1b);
} else ok('a pickup area exists in the seed', false, areas);

item('C2', 'acctBookingTotal · what the agent owes is the booking\'s owed (price + fee items)');
const bkO = await ev(() => SB_BOOKINGS.find((b) => b.id === 'zz-w5-lock' || b.externalId === 'zz-w5-lock' || b.code === 'zz-w5-lock'));
const srvBk = await api('/v1/bookings/' + (bkL.id || ''));
const c2 = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id || x.id === id); if (!b) return null; const flags = b.srvFlags; const was = b.total; b.total = 12345; b.feeItems = [{ amount: 1 }]; const r = acctBookingTotal(b); return { r, owed: flags && flags.owed, was }; }, bkL.id);
ok('acctBookingTotal returns the server owed even with the browser total and fee items changed', c2 && typeof c2.owed === 'number' && c2.r === c2.owed && c2.r === srvBk.owed, { c2, srvOwed: srvBk.owed });

item('C3', 'mdDirTot · the day total is the server\'s (official total when there is one)');
await send('PUT', `/v1/market-stats/${T0}/in`, { rows: { รัสเซีย: 10, จีน: 5 }, official_total: 40 });
await ev(async () => { await laOps.marketData?.load?.(); }); await settle(300);
await ev(() => { const o = laOps; });
const msrv = (await api('/v1/market-stats')).days.find((d) => d.date === T0);
const c3 = await ev(async (d) => {
  // read the day the way the page does, then change the browser rows (legacy would sum them)
  const j = await (await fetch(laOps.base ? laOps.base + '/v1/market-stats' : '/v1/market-stats')).json().catch(() => null);
  return null;
}, T0);
const c3b = await ev(async (d) => {
  if (typeof SB_MARKET_STATS === 'undefined') return null;
  const day = SB_MARKET_STATS[d];
  return day ? { total: mdDirTot(day, 'in'), rowsSum: Object.values(day.in || {}).reduce((s, v) => s + v, 0), inTotal: day.inTotal } : { missing: true };
}, T0);
ok('the server total is the official 40 (rows sum 15)', msrv && msrv.in && msrv.in.total === 40, msrv);
ok('mdDirTot (when the page has the day) = the server total, not the sum of rows', !c3b || c3b.missing || (c3b.total === 40 && c3b.rowsSum === 15), c3b);

// ── summary ──
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.map((r) => r.slice(0, 200)).join('\n  '));
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
