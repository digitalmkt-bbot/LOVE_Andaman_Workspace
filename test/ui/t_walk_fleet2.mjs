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
let s; const pat = (p, b) => api(p, { method: "PATCH", body: JSON.stringify(b) });
const clickText = async (sel) => { await page.click(sel); };
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b) });

// ── r2-fleet · the fleet rules the server now decides (operation-backend rules-fleet-model.md, fleet-fields-model.md) ──
const jobId = (r) => (r && (r.id || (r.jobs && r.jobs[0] && r.jobs[0].id))) || null;
let jobSeq = 700; const mkJob = async (boat, title, engId, extra) => { const r = await post('/v1/fleet/jobs', Object.assign({ no: 'MJ-' + (++jobSeq), boat_id: boat, title, type: 'corrective', boat_status: 'fixing', assets: engId ? [{ type: 'engine', asset_id: engId }] : [] }, extra || {})); if (!jobId(r)) console.log('   MKJOB FAILED', JSON.stringify(r).slice(0, 300)); return r; };
const reloadFleet = async () => { await ev(async () => { await laOps.fleetJobs.load(); await laOps.fleetAssets.load(true); if (laOps.fleetDaily && laOps.fleetDaily.load) await laOps.fleetDaily.load(); if (laOps.fleetBoats) await laOps.fleetBoats.load(); }); await settle(400); };
const TD = day(0);
let c1, b1;
// the app's own writes mark the saved server answers stale; these checks write straight to the server, so say so
const fresh = async () => { await ev(() => laOps.wrote('walk-test')); };

item(1, 'engine service · the list rule (next multiple) and the detail rule (service_last)');
const eng = await post('/v1/fleet/engines', { brand: 'Yamaha', model: 'F300', serial: 'E2-SVC', hp: 300, base_hours: 230, service_interval: 100, status: 'ready', boat_id: 'b7', pos: 'Port' });
const engDue = await post('/v1/fleet/engines', { brand: 'Yamaha', model: 'F300', serial: 'E2-DUE', hp: 300, base_hours: 480, service_interval: 100, status: 'ready', boat_id: 'b1', pos: 'Port' });
await reloadFleet();
let esv = await api('/v1/fleet/engines/' + eng.id);
s = await ev((id) => { const e = FL_ENGINES.find((x) => x.id === id); return { list: flEngListService(e), detail: flEngServiceState(e) }; }, eng.id);
chk('list rule: next 300, left 70 = the server engine.service', s.list && esv.service && s.list.next === esv.service.next && s.list.left === esv.service.left && esv.service.next === 300 && esv.service.left === 70, { list: s.list, srv: esv.service });
chk('detail rule counts from the last service: base / since / next = engine.service_last', s.detail && esv.service_last && s.detail.base === esv.service_last.base && s.detail.since === esv.service_last.since && s.detail.next === esv.service_last.next, { detail: s.detail, srv: esv.service_last });
s = await ev((id) => { const e = FL_ENGINES.find((x) => x.id === id); const d = document.createElement('div'); d.innerHTML = faRow(faPart('eng', e), null, 'x'); return d.textContent; }, eng.id);
chk('Fleet Assets engine row counts from the last service: "100h to svc" (service_last)', /100h to svc/.test(s), { text: s });
s = await ev((id) => { const sel = document.getElementById('fl-assign-eng-sel'), info = document.getElementById('fl-assign-eng-info'); sel.innerHTML = '<option value="' + id + '"></option>'; sel.value = id; flUpdateAssignEngInfo(); return info.textContent; }, eng.id);
chk('assign-engine info shows the engine hours (230 h; 70 h to the next multiple is not under 30, so no warning mark)', /230/.test(s) && !/⚠/.test(s), { s });

item(2, 'job days_blocked and parked_reason · flBoardBoatDown, flwParked');
const jBlk = jobId(await mkJob('b7', 'Walk blocked', eng.id, { start_date: day(-5) }));
await post('/v1/fleet/jobs/' + jBlk + '/start', {});
const jDon = jobId(await mkJob('b13', 'Donor engine walk', null, { create_anyway: true }));
await reloadFleet();
const jsrv = (await api('/v1/fleet/jobs')).jobs;
const sb = jsrv.find((j) => j.id === jBlk), sd = jsrv.find((j) => j.id === jDon);
s = await ev((a) => { const m = FL_MAINT.find((x) => x.id === a.b), d = FL_MAINT.find((x) => x.id === a.d); return { down: flBoardBoatDown([m]), park: flwParked(d), parkNone: flwParked(m) }; }, { b: jBlk, d: jDon });
chk('flBoardBoatDown = the job days_blocked (5)', sb && sb.days_blocked === 5 && s.down === 5, { srv: sb && sb.days_blocked, scr: s.down });
chk('flwParked = the parked_reason label of the server; a plain job is not parked', sd && sd.parked_reason && s.park === sd.parked_reason.label && !s.parkNone, { srv: sd && sd.parked_reason, scr: s });

item(3, 'Fleet Work · flwItems / flwBoats / flRenderWork from GET /v1/fleet/work');
await fresh(); await ev(() => { FLW.bf = 'work'; FLW.stage = -1; flwItems(); }); await settle(1500);
const wk = await api('/v1/fleet/work?boats=work');
s = await ev(() => { FLW.bf = 'work'; FLW.stage = -1; const it = flwItems(); const bs = flwBoats(it); return { stages: Object.fromEntries(it.map((x) => [x.key, x.stage])), boats: bs.map((o) => [o.id, o.isDown, o.down]) }; });
const wItems = {}; wk.boats.forEach((b) => b.items.forEach((x) => { wItems[x.key] = x.stage; }));
chk('every item stage on screen = the server stage', Object.keys(wItems).length > 0 && Object.keys(wItems).every((k) => s.stages[k] === wItems[k]), { srv: wItems, scr: s.stages });
chk('boat rows (order, is_down, days down) = the server boats', JSON.stringify(s.boats) === JSON.stringify(wk.boats.map((b) => [b.boat_id, b.is_down, b.days_blocked])), { srv: wk.boats.map((b) => [b.boat_id, b.is_down, b.days_blocked]), scr: s.boats });
const down7 = wk.boats.find((b) => b.boat_id === 'b7');
await ev(() => { nav(document.querySelector('[data-view="fl-work"]')); }); await settle(1500);
s = await ev(() => { const w = document.getElementById('fl-work-wrap'); return w ? w.innerText : ''; });
chk('Fleet Work page draws and says how long b7 is down', down7 && down7.is_down && /down 5 days/i.test(s), { down7: down7 && [down7.is_down, down7.days_blocked], text: s.slice(0, 200) });

item(4, 'Fleet Assets headline · faStages and the overview tiles from GET /v1/fleet/assets/summary');
const sm = await api('/v1/fleet/assets/summary');
await fresh();
await ev(() => { faStages('eng', faAllParts().filter((r) => r.kind === 'eng')); }); await settle(1500);
s = await ev(() => { const P = faAllParts(); return { eng: faStages('eng', P.filter((r) => r.kind === 'eng')).map((x) => x.v), gb: faStages('gb', P.filter((r) => r.kind === 'gb')).map((x) => x.v), prop: faStages('prop', P.filter((r) => r.kind === 'prop')).map((x) => x.v) }; });
const E = sm.engines, G = sm.gearboxes, R = sm.propellers;
chk('engine stage counts = summary.engines', JSON.stringify(s.eng) === JSON.stringify([E.total, E.ready, E.fixing, E.broken, E.not_on_boat, E.no_hours]), { scr: s.eng, srv: E });
chk('gearbox and propeller stage counts = the summary', JSON.stringify(s.gb) === JSON.stringify([G.total, G.ready, G.fixing, G.spare, G.not_on_boat, G.no_engine]) && JSON.stringify(s.prop) === JSON.stringify([R.total, R.active, R.spare, R.fixing, R.damaged_broken, R.data_to_fix]), { gb: s.gb, prop: s.prop, srvG: G, srvR: R });
s = await ev(() => { FA.st.overview = -1; var info; var o = window.faShell; window.faShell = function (i) { info = i; return o.apply(this, arguments); }; faRenderOverview(); window.faShell = o; return info ? { stages: info.stages.map((x) => [x.t, x.v]), chips: info.chips } : null; });
const fixV = s && s.stages.find((x) => x[0] === 'Data to fix');
chk('overview "Data to fix" tile = summary.data_to_fix', fixV && fixV[1] === sm.data_to_fix, { scr: fixV, srv: sm.data_to_fix });

item(5, 'engine detail · repair_cost, repair_jobs_done / total on the asset');
await post('/v1/fleet/jobs/' + jBlk + '/close', { outcome: 'success', note: 'walk done' });
await reloadFleet();
esv = await api('/v1/fleet/engines/' + eng.id);
s = await ev((id) => { const e = FL_ENGINES.find((x) => x.id === id); return { c: e.repairCost, d: e.repairJobsDone, t: e.repairJobsTotal, html: faPartDetail(faPart('eng', e)).indexOf('ค่าซ่อมสะสม') >= 0 }; }, eng.id);
chk('engine carries repair_cost / jobs done / total from the server and the detail panel draws', s.c === esv.repair_cost && s.d === esv.repair_jobs_done && s.t === esv.repair_jobs_total && esv.repair_jobs_total >= 1 && s.html, { scr: s, srv: [esv.repair_cost, esv.repair_jobs_done, esv.repair_jobs_total] });

item(6, 'Fleet Dashboard · service due (fixed 500 h) and the cost trend');
const dsrv = await api('/v1/fleet/dashboard?date=' + TD);
await fresh();
await ev((d) => { flDashServiceDue(d); }, TD); await settle(1500);
s = await ev((d) => ({ rows: (flDashServiceDue(d) || []).map((r) => r.e.id), trend: flDashCostTrend(d) }), TD);
const sdIds = dsrv.service_due.engines.map((r) => r.engine_id);
chk('service due rows on screen = the server rows (E2-DUE at 480 h is 96 % of 500)', sdIds.includes(engDue.id) && JSON.stringify(s.rows.slice(0, sdIds.length)) === JSON.stringify(sdIds), { scr: s.rows, srv: sdIds });
chk('cost trend per month = the server cost_trend', s.trend && dsrv.cost_trend.months.every((m) => s.trend[m.month] && s.trend[m.month].cost === m.cost && s.trend[m.month].jobs === m.jobs), { scr: s.trend, srv: dsrv.cost_trend.months });
await ev(() => { nav(document.querySelector('[data-view="fl-dashboard"]')); }); await settle(1500);
s = await ev(() => { const v = document.getElementById('view-fl-dashboard'); return v ? v.innerText : ''; });
chk('dashboard card says "interval 500h" and lists E2-DUE', /interval 500h/.test(s) && /E2-DUE/.test(s), { text: s.slice(0, 120) });

item(7, 'Cost Analytics · costAggregate from GET /v1/fleet/reports/cost');
await fresh();
await ev(() => { costSetFilter('all'); }); await settle(1500);
const cr = await api('/v1/fleet/reports/cost?period=all');
s = await ev(() => { const A = costAggregate(); return { total: A.total, nJobs: A.nJobs, done: A.done, proc: A.proc, rows: A.rows.length, boats: A.boatList.length, central: A.central.n }; });
chk('totals, jobs, rows, boats and central memos = the server report', s.total === cr.total && s.nJobs === cr.n_jobs && s.done === cr.done && s.proc === cr.proc && s.rows === cr.rows.length && s.boats === cr.boats.length && s.central === cr.central.n, { scr: s, srv: { total: cr.total, n: cr.n_jobs, rows: cr.rows.length, boats: cr.boats.length, central: cr.central.n } });
await ev(() => { nav(document.querySelector('[data-view="fl-cost"]')); }); await settle(1500);
s = await ev(() => { const w = document.getElementById('fl-cost-wrap'); return w ? w.innerText.length : 0; });
chk('Cost Analytics page draws from the report', s > 200, { len: s });

item(8, 'Insights · flInsightsServer from GET /v1/fleet/insights');
await fresh();
await ev(() => { flInsightsServer('month'); }); await settle(1500);
const isv = await api('/v1/fleet/insights?period=month');
s = await ev(() => { const x = flInsightsServer('month'); return x && x.kpis; });
chk('insights kpis on screen = the server kpis (jobs started this month, spent)', s && s.jobs === isv.kpis.jobs && s.spent === isv.kpis.spent && isv.kpis.jobs >= 1, { scr: s, srv: isv.kpis });
await ev(() => { _insightsTimeFilter = 'month'; nav(document.querySelector('[data-view="fl-insights"]')); }); await settle(1500);
s = await ev(() => { const w = document.getElementById('fl-insights-wrap'); return w ? w.innerText : ''; });
chk('Insights page shows the server job count', new RegExp(isv.kpis.jobs + ' jobs').test(s), { text: s.slice(0, 300) });

item(9, 'stock line minimum · faInvRows / faSpInvBlock');
const inv = await post('/v1/fleet/stock-items', { name: 'Walk line oil', category: 'general', unit: 'L', min_qty: 5, cost: 40, qty: 3, warehouse: 'tublamu', line_mins: { panwa: 2 } });
await ev(() => laOps.fleetStock.refetch()); await settle(600);
const isrv = await api('/v1/fleet/stock-items/' + inv.id);
s = await ev((id) => faInvRows().filter((r) => r.it.id === id).map((r) => [r.wh, r.qty, r.min, r.below]), inv.id);
const srvLines = (isrv.stocks || []).map((l) => [l.warehouse, l.qty, l.min_qty, l.below_min]);
chk('each stock line carries the server minimum and below_min (tublamu 3 < 5; panwa 0 < 2)', JSON.stringify(s.sort()) === JSON.stringify(srvLines.sort()) && srvLines.length === 2 && srvLines.every((l) => l[3] === true), { scr: s, srv: srvLines });
s = await ev(() => faSpInvBlock(faInvAt('pier:panwa'), true));
chk('warehouse block counts the line under its minimum', /ต่ำกว่าขั้นต่ำ/.test(s), { s: s.slice(0, 200) });

item(10, 'project cost_breakdown · flProjCostBreakdown / flProjMJCostBreakdown');
const pj = await post('/v1/fleet/projects', { no: 'PRJ-902', name: 'Walk cost split', boat_id: 'b6', type: 'drydock', vendor: 'Walk Yard', plan_from: day(1), plan_to: day(9), planned_budget: 50000, notes: '' });
const jC = jobId(await mkJob('b6', 'Walk child job', null, { parent_project_id: pj.id, create_anyway: true }));
await post('/v1/fleet/jobs/' + jC + '/start', {});
const part = await post('/v1/fleet/jobs/' + jC + '/parts', { item_id: inv.id, warehouse: 'tublamu', qty: 2 });
await reloadFleet();
const psrv = await api('/v1/fleet/projects/' + pj.id);
s = await ev((a) => ({ proj: flProjCostBreakdown(a.p), job: flProjMJCostBreakdown(a.j) }), { p: pj.id, j: jC });
const cj = psrv.cost_breakdown && (psrv.cost_breakdown.child_jobs || []).find((c) => c.job_id === jC);
chk('project split (parts / labour / memos / total) = cost_breakdown; the job split = its child_jobs line', psrv.cost_breakdown && s.proj.parts === psrv.cost_breakdown.parts && s.proj.total === psrv.cost_breakdown.total && cj && s.job.parts === cj.parts && s.job.total === cj.total && cj.parts === 80, { scr: s, srv: psrv.cost_breakdown, part: part.message || 'ok' });

item(11, 'Daily Fleet Log · status / operated / ran_despite / pax_effective per boat, piers[] and closed_piers per day');
await pat('/v1/fleet/daily-log/' + TD + '/boats/b7', { fuel_litres: 100 });
await ev(() => laOps.fleetDaily.loadDailyWindow()); await settle(800);
const dl = await api('/v1/fleet/daily-log?from=' + TD + '&to=' + TD);
const dday = (dl.days || [])[0] || { boats: [], piers: [] };
const b7row = dday.boats.find((b) => b.boat_id === 'b7');
s = await ev((d) => ({ boat: flDrServerBoat(d, 'b7'), pier: flDrServerPier(d, 'tublamu'), closed: flDrPierClosed(d, 'tublamu') }), TD);
chk('flDrServerBoat = the boat row (status, operated, ran_despite, pax_effective)', b7row && s.boat && s.boat.status === b7row.status && s.boat.operated === b7row.operated && s.boat.ranDespite === b7row.ran_despite && s.boat.paxEffective === b7row.pax_effective, { scr: s.boat, srv: b7row && [b7row.status, b7row.operated, b7row.ran_despite, b7row.pax_effective] });
const tlp = (dday.piers || []).find((p) => p.pier === 'tublamu');
chk('flDrServerPier = the day pier totals; flDrPierClosed = closed_piers', tlp && s.pier && s.pier.pax === tlp.pax && s.pier.fuelLitres === tlp.fuel_litres && s.closed === !!(dl.closed_piers && (dl.closed_piers[TD] || []).includes('tublamu')), { scr: s, srv: tlp, closed: dl.closed_piers });
s = await ev((d) => { document.getElementById('fl-dr-date').value = d; flRenderDR(); const v = document.getElementById('view-fl-dailyreport'); return v ? v.innerText.length : 0; }, TD);
chk('flRenderDR draws with the server fields', s > 100, { len: s });

item(12, 'charter boat · saveCharterBoat -> POST /v1/boats period · an overlap asks "Save anyway?"');
await ev(() => { openCharterModal(); });
await page.fill('#ch-name', 'Walk Charter'); await page.fill('#ch-cap', '12'); await page.fill('#ch-from', day(10)); await page.fill('#ch-to', day(12)); await page.fill('#ch-note', 'walk period');
c1 = calls.length; b1 = bodies.length;
await ev(() => saveCharterBoat()); await idle(); await settle(900);
const cbPost = bodies.slice(b1).find((x) => x[0] === 'POST /v1/boats');
const cb = ((await api('/v1/boats')).boats || []).find((b) => b.name === 'Walk Charter');
const cbFull = cb && await api('/v1/boats/' + cb.id);
const cbLog = cbFull && (cbFull.status_log || [])[0];
chk('POST /v1/boats with ownership charter and period; the boat has one window, no province / loc type', cbPost && JSON.parse(cbPost[1]).period && JSON.parse(cbPost[1]).period.from_date === day(10) && cbFull && cbFull.ownership === 'charter' && cbLog && cbLog.from_date === day(10) && cbLog.to_date === day(12) && cbLog.note === 'walk period' && !cbLog.province, { post: cbPost && cbPost[1], log: cbLog });
s = await ev((n) => { const b = BOATS.find((x) => x.name === n); return b && { id: b.id, own: b.ownership, log: (b.log || []).length }; }, 'Walk Charter');
chk('screen has the charter boat with the server id and its window', s && cb && s.id === cb.id && s.own === 'charter' && s.log === 1, { s, cb: cb && cb.id });
await post('/v1/boats/' + cb.id + '/status-log', { status: 'available', from_date: day(14), to_date: day(16), loc: 'Tub Lamu Pier' });
await ev(() => laOps.fleetBoats.load()); await settle(700);
await ev((id) => openBoatEdit(id), cb.id);
const logId = await ev(() => window._chEditLogId);
await page.fill('#ch-from', day(10)); await page.fill('#ch-to', day(15));
const dn = dialogs.length; b1 = bodies.length;
await ev(() => saveCharterBoat()); await idle(); await settle(1200);
const sent = bodies.slice(b1).filter((x) => /status-log/.test(x[0]));
chk('overlap: refused 409 charter_overlap, "Save anyway?" asked, sent again with overlap_anyway', sent.length === 2 && !JSON.parse(sent[0][1]).overlap_anyway && JSON.parse(sent[1][1]).overlap_anyway === true && dialogs.slice(dn).some((d) => /overlaps another charter period|Save anyway\?/.test(d)), { sent, dialogs: dialogs.slice(dn), logId });
const cbAfter = await api('/v1/boats/' + cb.id);
const first = (cbAfter.status_log || []).find((e) => e.id === logId);
chk('the window was saved in place (to_date moved)', first && first.to_date === day(15), { first });

item(13, 'safety inspection · an untouched next-due is left to the server');
const sfi = await post('/v1/fleet/safety', { boat_id: 'b7', qty: 1, status: 'active', install_date: day(-100), brand: 'Acme', model: 'A1', serial: null, next_pm: null, last_inspect: null, location: null, note: null, category: 'flare', name: 'Walk flare insp', expiry_date: day(300) });
await reloadFleet();
await ev((id) => flOpenLogInspectionModal(id), sfi.id); await settle(300);
const prefill = await ev(() => document.getElementById('fl-insp-nextdue').value);
await page.fill('#fl-insp-inspector', 'Walk'); b1 = bodies.length;
await ev(() => document.querySelector('#fl-modal-insp button[onclick="flSaveInspection()"]').click()); await idle(); await settle(900);
const ib = bodies.slice(b1).find((x) => /inspections/.test(x[0]));
const sfa = await api('/v1/fleet/safety/' + sfi.id);
const insp = (sfa.inspections || [])[0];
chk('the body carries no next_due; the server filled one that equals the prefilled hint', ib && JSON.parse(ib[1]).next_due == null && insp && insp.next_due && insp.next_due === prefill, { body: ib && ib[1], insp, prefill });

item(14, 'repairs · the lost-stock panel and the duplicate tools go to the server');
c1 = calls.length;
await ev(() => invDupOpen()); await settle(1200);
chk('invDupOpen reads GET /v1/fleet/stock-repair/lost first', calls.slice(c1).includes('GET /v1/fleet/stock-repair/lost'), { calls: calls.slice(c1) });
await ev(() => { if (typeof invDupClose === 'function') invDupClose(); });
c1 = calls.length; const dn2 = dialogs.length;
await ev(() => { costDupCleanAll(); }); await idle(); await settle(900);
chk('costDupCleanAll -> POST /v1/fleet/duplicates/clean-all; legacy confirm and "nothing to clean" message', calls.slice(c1).includes('POST /v1/fleet/duplicates/clean-all') && dialogs.slice(dn2).some((d) => /ล้างรายการซ้ำทุกกลุ่ม/.test(d)) && dialogs.slice(dn2).some((d) => /ไม่พบรายการซ้ำที่ล้างได้/.test(d)), { calls: calls.slice(c1), dialogs: dialogs.slice(dn2) });
c1 = calls.length;
await ev(() => { costDupClean('memo'); }); await idle(); await settle(900);
chk('costDupClean(memo) -> POST /v1/fleet/duplicates/clean {kind: memo}', calls.slice(c1).includes('POST /v1/fleet/duplicates/clean'), { calls: calls.slice(c1) });

console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
console.log('\npage errors: ' + errors.length + '\n  ' + errors.slice(0, 10).join('\n  '));
console.log('\nSUMMARY');
for (const n of Object.keys(findings)) { const f = findings[n]; console.log(` item ${n}: ${f.filter((x) => x[1]).length}/${f.length} ok` + f.filter((x) => !x[1]).map((x) => '\n     FAIL ' + x[0]).join('')); }
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length || errors.length ? 1 : 0);
