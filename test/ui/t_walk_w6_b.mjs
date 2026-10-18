// t_walk_w6_b · browser walk of wave 6, group b: the screens that used to decide in the browser and now read the server (w5-b MISSING-SERVER-FIELD list)
// against a REAL operation-backend (in-process store, seeded). Each item changes the BROWSER'S OWN COPY so that legacy's answer would differ, then checks that the
// screen shows the SERVER'S figure (and that only user choices are sent).
//   node test/ui/t_walk_w6_b.mjs
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
let rewrite = null;   // (method, pathname, Buffer) => Buffer | null : lets an item doctor ONE server answer (named where it is used)
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  let buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (rewrite && r.status < 300) { const o = rewrite(req.method(), u.pathname, buf); if (o) buf = o; }
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

const R = Date.now().toString(36);
let seqN = 0;
const newBoat = async (extra = {}) => post('/v1/boats', Object.assign({ name: `W6B ${R}-${seqN++}`, pier: 'tublamu', capacity: 30, license_pax: 32 }, extra));
const newEng = async (boatId, pos) => post('/v1/fleet/engines', Object.assign({ brand: 'Honda', model: 'BF250D', serial: `W6E-${R}-${seqN++}` }, boatId ? { boat_id: boatId, pos } : {}));
const newGb = async (extra = {}) => post('/v1/fleet/gearboxes', Object.assign({ brand: 'Honda', serial: `W6G-${R}-${seqN++}` }, extra));
const mjNo = () => `MJ-W6B-${R}-${seqN++}`;
const mkJob = async (boat, title, extra) => { const r = await post('/v1/fleet/jobs', Object.assign({ no: mjNo(), boat_id: boat, title, type: 'corrective', boat_status: 'fixing', create_anyway: true }, extra || {})); return (r && r.jobs && r.jobs[0]) || r; };
const nonGetSince = (n) => since(n).filter((c) => !c.startsWith('GET'));

if (!process.env.ONLY_B) {
// ════════════════════ PART A · FLEET ════════════════════

// ── A1 flProjYoYStats
item('A1', 'flProjYoYStats · year-over-year figures are the server\'s (GET /v1/fleet/projects/stats)');
const yr = +T0.slice(0, 4);
const pjA = await post('/v1/fleet/projects', { no: 'PRJ-W6A-' + R, name: 'W6 year over year', boat_id: 'b6', type: 'drydock', vendor: 'Yard', plan_from: T0 });
await reloadFleet();
await ev(() => { for (let i = 0; i < 4; i++) FL_PROJECTS.push({ id: 'fake' + i, no: 'F' + i, name: 'browser only', boatId: 'b6', type: 'refit', status: 'completed', planFrom: TODAY_STR, planTo: TODAY_STR, actualFrom: TODAY_STR, actualTo: TODAY_STR }); });
const stats = await api('/v1/fleet/projects/stats?year=' + yr);
const legacyTY = await ev((y) => flProjYoYStats.__orig(y).TY.count, yr);
await ev((y) => { flProjYoYStats(y); }, yr); await settle(700);
const gotTY = await ev((y) => { const r = flProjYoYStats(y); return { c: r.TY.count, comp: r.TY.completed, by: r.TY.byType, ly: r.yearLY, ms: r.TY.monthSpend.length }; }, yr);
ok('the browser\'s own copy (4 extra completed projects) would make legacy count more', legacyTY > stats.this_year.count, { legacyTY, srv: stats.this_year.count });
ok('the screen\'s figures are the server\'s (count, completed, by type, last year)', gotTY.c === stats.this_year.count && gotTY.comp === stats.this_year.completed && gotTY.by.drydock === stats.this_year.by_type.drydock && gotTY.by.refit === stats.this_year.by_type.refit && gotTY.ly === stats.previous_year && gotTY.ms === 12, { gotTY, srv: stats.this_year });
await ev(() => { let d = document.getElementById('fl-proj-yoy-body'); if (!d) { d = document.createElement('div'); d.id = 'fl-proj-yoy-body'; document.body.appendChild(d); } flProjRenderYoyModal(); });
const yoyTxt = await ev(() => document.getElementById('fl-proj-yoy-body').textContent.replace(/\s+/g, ' '));
const m1 = /Projects · total\s*(\d+)/.exec(yoyTxt);
ok('the modal draws the server\'s Projects · total', m1 && +m1[1] === stats.this_year.count, { m1: m1 && m1[0], yoyTxt: yoyTxt.slice(0, 300) });

// ── A2 flProjInsight
item('A2', 'flProjInsight · the insight lines and recommendations are the server\'s (insights on GET /v1/fleet/projects/{id})');
const prj = await api('/v1/fleet/projects/' + pjA.id);
await ev((id) => { const p = FL_PROJECTS.find((x) => x.id === id); p.status = 'on_hold'; p.holdReason = 'browser-only reason'; p.holdSince = '2000-01-01'; }, pjA.id);
const legacyIns = await ev((id) => flProjInsight.__orig(FL_PROJECTS.find((x) => x.id === id)), pjA.id);
await ev((id) => { flProjInsight(FL_PROJECTS.find((x) => x.id === id)); }, pjA.id); await settle(600);
const gotIns = await ev((id) => flProjInsight(FL_PROJECTS.find((x) => x.id === id)), pjA.id);
ok('the browser copy (on hold) would make legacy add a hold line', legacyIns.lines.some((l) => /On hold since/.test(l)) && !prj.insights.lines.some((l) => /On hold since/.test(l)), { legacy: legacyIns.lines, srv: prj.insights.lines });
ok('the screen draws the server\'s lines and recs, not legacy\'s', JSON.stringify(gotIns.lines) === JSON.stringify(prj.insights.lines) && JSON.stringify(gotIns.recs) === JSON.stringify(prj.insights.recs), { gotIns, srv: prj.insights });

// ── A3 flMaintStashConfirm
item('A3', 'flMaintStashConfirm · ONE command (POST …/assets/{idx}/stash); the part is found by the server, not the browser');
const bA3 = await newBoat();
const eA3 = await newEng(bA3.id, 'Port');
const gA3 = await newGb({ note: 'Port' });
await post(`/v1/fleet/gearboxes/${gA3.id}/install`, { engine_id: eA3.id });
const pA3 = await post('/v1/fleet/propellers', { serial: `W6P-${R}-${seqN++}`, size: '15.5×17' });
await post(`/v1/fleet/propellers/${pA3.id}/install`, { gearbox_id: gA3.id });
const jA3 = await mkJob(bA3.id, 'stash walk', { assets: [{ type: 'engine', asset_id: eA3.id }, { type: 'gearbox', asset_id: gA3.id }, { type: 'propeller', asset_id: pA3.id }] });
await reloadFleet();
const idxGb = await ev((id) => FL_MAINT.find((x) => x.id === id).assets.findIndex((a) => a.gbId), jA3.id);
await ev((id) => { const i = FL_GEARBOXES.findIndex((g) => g.id === id); FL_GEARBOXES.splice(i, 1); }, gA3.id);   // the browser lost its copy: legacy would alert "part not found" and stop
dialogs.length = 0;
await ev(([jid, ix]) => { flMaintStashOpen(jid, ix); document.getElementById('fl-stash-loc').value = 'pier:panwa'; document.getElementById('fl-stash-note').value = 'walk note'; }, [jA3.id, idxGb]);
let c0 = n0();
await ev(() => flMaintStashConfirm()); await idle(); await settle(1000);
const wr = nonGetSince(c0);
const gbNow = await api('/v1/fleet/gearboxes/' + gA3.id), jobNow = await api('/v1/fleet/jobs/' + jA3.id);
ok('requests: exactly one write, POST …/assets/' + idxGb + '/stash {location, note}', wr.length === 1 && /^POST \/v1\/fleet\/jobs\/.+\/assets\/1\/stash 200/.test(wr[0]) && JSON.stringify(lastReq(/\/stash$/).req) === JSON.stringify({ location: 'pier:panwa', note: 'walk note' }), { wr, req: lastReq(/\/stash$/) });
ok('server: the gearbox is a spare at Panwa and left the job, both logs say so', gbNow.status === 'spare' && gbNow.spare_location === 'pier:panwa' && !gbNow.engine_id && jobNow.assets.length === 2 && jobNow.progress_log.some((l) => /ถอดเกียร์ .* ไปเก็บที่ คลัง Visit Panwa · walk note/.test(l.text)), { gbNow: [gbNow.status, gbNow.spare_location], assets: jobNow.assets.length, log: jobNow.progress_log.map((l) => l.text) });
ok('screen: no "part not found" alert, the job shows 2 assets from the server', !dialogs.some((d) => /ไม่พบข้อมูลชิ้นส่วน/.test(d)) && (await ev((id) => FL_MAINT.find((x) => x.id === id).assets.length, jA3.id)) === 2, dialogs);
const stash409 = await send('POST', `/v1/fleet/jobs/${jA3.id}/assets/0/stash`, { location: 'pier:panwa' });
dialogs.length = 0;
await ev(([jid]) => { flMaintStashOpen(jid, 0); }, [jA3.id]);   // an engine row: legacy's own open already refuses it
ok('(server) an engine is refused 409 not_stashable', stash409.status === 409 && stash409.body.code === 'not_stashable', stash409);

// ── A4 flStartGearSwap (re-entry)
item('A4', 'flStartGearSwap · swapping an engine out of a STARTED job is the server\'s command (POST …/swap-out)');
const bA4 = await newBoat();
const eA4 = await newEng(bA4.id, 'Port');
const gA4 = await newGb({ note: 'Port' });
await post(`/v1/fleet/gearboxes/${gA4.id}/install`, { engine_id: eA4.id });
const jA4 = await mkJob(bA4.id, 'swap out walk', { assets: [{ type: 'engine', asset_id: eA4.id }] });
await post(`/v1/fleet/jobs/${jA4.id}/start`, {});
const donor = await newEng(null);
await reloadFleet();
await ev(([e]) => { const x = FL_ENGINES.find((y) => y.id === e); x.pos = 'Zzz-browser'; }, [eA4.id]);   // the browser copy has the wrong position: legacy would wait for 'Zzz-browser'
const idxEng = await ev((id) => FL_MAINT.find((x) => x.id === id).assets.findIndex((a) => a.engId), jA4.id);
c0 = n0();
await ev(([jid, ix]) => { flMaintSwapEngine(jid, ix); }, [jA4.id, idxEng]); await idle(); await settle(1200);
const so = lastReq(/\/swap-out$/);
const eAfter = await api('/v1/fleet/engines/' + eA4.id), gAfter = await api('/v1/fleet/gearboxes/' + gA4.id);
ok('POST …/swap-out {engine_id} was sent (nothing else is sent)', so && so.status === 200 && JSON.stringify(so.req) === JSON.stringify({ engine_id: eA4.id }), so);
ok('server: the engine is off the boat and fixing, its gearbox waits on the boat at Port', eAfter.boat_id === null && eAfter.status === 'fixing' && gAfter.on_boat_id === bA4.id && gAfter.on_boat_pos === 'Port', { eAfter: [eAfter.boat_id, eAfter.status], gAfter: [gAfter.on_boat_id, gAfter.on_boat_pos] });
const ctxSw = await ev(() => ({ swaps: window._flStartGear && window._flStartGear.swaps, started: window._flStartGear && window._flStartGear.started, stage2: document.getElementById('fl-sg-stage2').style.display, hasDonor: !!document.querySelector('#fl-sg-neweng') }));
ok('screen: the picker is for the server\'s position (Port), not the browser\'s copy', ctxSw.swaps && ctxSw.swaps.length === 1 && ctxSw.swaps[0].pos === 'Port' && ctxSw.swaps[0].oldEngId === eA4.id && ctxSw.started && ctxSw.stage2 !== 'none' && ctxSw.hasDonor, ctxSw);
await ev((d) => { document.getElementById('fl-sg-neweng').value = d; document.getElementById('fl-sg-engloc').value = 'คลังกลาง'; }, donor.id);
await ev(() => flStartSwapInstall()); await idle(); await settle(1000);
const gDone = await api('/v1/fleet/gearboxes/' + gA4.id), ins = lastReq(/\/engines\/.+\/install$/);
ok('the replacement is installed with the job (job_id) and the waiting gearbox follows it', ins && ins.req.job_id === jA4.id && ins.req.pos === 'Port' && gDone.engine_id === donor.id, { ins, gDone: gDone.engine_id });

item('A4b', 'flStartSwapSkip (re-entry) · "not now": the engine stays out as fixing and only its place is written');
const bA4b = await newBoat();
const eA4b = await newEng(bA4b.id, 'Port');
const jA4b = await mkJob(bA4b.id, 'swap skip walk', { assets: [{ type: 'engine', asset_id: eA4b.id }] });
await post(`/v1/fleet/jobs/${jA4b.id}/start`, {});
await reloadFleet();
const idxEng4b = await ev((id) => FL_MAINT.find((x) => x.id === id).assets.findIndex((a) => a.engId), jA4b.id);
await ev(([jid, ix]) => { flMaintSwapEngine(jid, ix); }, [jA4b.id, idxEng4b]); await idle(); await settle(1000);
await ev(() => { document.getElementById('fl-sg-engloc').value = 'คลังกลาง'; });
await ev(() => flStartSwapSkip()); await idle(); await settle(1000);
const e4b = await api('/v1/fleet/engines/' + eA4b.id);
ok('server: the engine is off the boat, fixing, and placed at the chosen place', e4b.boat_id === null && e4b.status === 'fixing' && e4b.spare_location === 'คลังกลาง', [e4b.boat_id, e4b.status, e4b.spare_location]);
ok('screen: the dialog is closed', await ev(() => !window._flStartGear), null);

// ── A5 _flBoatRanOn (flnPreview)
const TU = await ev(() => TODAY_STR);   // legacy's TODAY_STR is the UTC date; it differs from the local date between 00:00 and 07:00 Bangkok
item('A5', 'flnPreview · "already ran a trip today" is the server\'s (GET /v1/boats/{id}/ran-on)');
await send('POST', '/operations/deployments', { boat_id: 'b1', route_id: 'r4', service_date: TU, capacity: 20 });
const ran = await api(`/v1/boats/b1/ran-on?date=${TU}`), notRan = await api(`/v1/boats/b13/ran-on?date=${TU}`);
ok('(server) b1 ran today, b13 did not', ran.ran === true && ran.starts_on > TU && notRan.ran === false, { ran, notRan });
await ev((d) => { if (TRIPS[d]) { delete TRIPS[d].b1; } else TRIPS[d] = {}; TRIPS[d].b13 = { route: 'r10' }; SB_BOOKINGS.forEach((b) => { if (b && (b.trips || []).some((t) => t.date === d)) b.status = 'cancelled'; }); }, TU);   // the browser's copy says the opposite
const preview = async (boat) => {
  await ev(([b, d]) => { let el = document.getElementById('fln-prev'); if (!el) { el = document.createElement('div'); el.id = 'fln-prev'; document.body.appendChild(el); }
    FLN = { kind: 'job', boat: b, date: d, jtype: 'corrective', start: true, jstatus: 'fixing', title: 'W6 preview', parts: false, owner: '', due: '', assets: {}, hull: '' }; flnPreview(); }, [boat, TU]);
  await settle(900);
  return ev(() => document.getElementById('fln-prev').textContent.replace(/\s+/g, ' '));
};
const legacyB1 = await ev(([b, d]) => _flBoatRanOn.__orig(b, d), ['b1', T0]);
const pB1 = await preview('b1'), pB13 = await preview('b13');
ok('legacy (browser copy) would say b1 did not run today', legacyB1 === false, legacyB1);
ok('preview b1: "from tomorrow, because it already ran a trip today"', /from tomorrow, because it already ran a trip today/.test(pB1), pB1.slice(0, 400));
ok('preview b13: "from today" although the browser lists a trip', /from today\./.test(pB13) && !/because it already ran/.test(pB13), pB13.slice(0, 400));
await ev(() => { document.getElementById('fln-prev').remove(); FLN = null; });

// ── A6 flOpenSwapModal
item('A6', 'flOpenSwapModal · the spares offered, their groups and the model warning are the server\'s');
const bA6 = await newBoat({ pier: 'tublamu' });
const eA6 = await newEng(bA6.id, 'Port');
const gA6 = await newGb({ brand: 'Yanmar', model: 'BF-A', note: 'Port' });
await post(`/v1/fleet/gearboxes/${gA6.id}/install`, { engine_id: eA6.id });
const spare = (extra) => post('/v1/fleet/gearboxes', Object.assign({ brand: 'Yanmar', model: 'BF-A', serial: `W6S-${R}-${seqN++}`, status: 'spare' }, extra));
const spHome = await spare({ spare_location: 'pier:tublamu' }), spOther = await spare({ spare_location: 'pier:panwa', model: 'BF-B' }), spShop = await spare({ spare_location: 'shop:honda-phuket' });
const incA6 = await post('/v1/fleet/incidents', { no: `INC-W6B-${R}-${seqN++}`, boat_id: bA6.id, date: T0, title: 'Gearbox noise', damaged_assets: [{ type: 'gearbox', asset_id: gA6.id }] });
await reloadFleet();
const opt = await api(`/v1/fleet/incidents/${incA6.id}/swap-options?asset_type=gearbox&asset_id=${gA6.id}`);
await ev(([a, b]) => { [a, b].forEach((id) => { FL_GEARBOXES.find((g) => g.id === id).spareLocation = 'shop:browser-only'; }); }, [spHome.id, spOther.id]);   // the browser thinks they are at a shop
await ev(([i, g]) => { flOpenSwapModal.__orig(i, 'gearbox', g); }, [incA6.id, gA6.id]);
const legacyBody = await ev(() => document.getElementById('fl-swap-body').textContent);
ok('legacy (browser copy) would offer no spare at all', /ไม่มีสแปร์/.test(legacyBody), legacyBody.slice(0, 200));
await ev(([i, g]) => { flOpenSwapModal(i, 'gearbox', g); }, [incA6.id, gA6.id]); await settle(1000);
const swBody = await ev(() => document.getElementById('fl-swap-body').innerHTML), swTxt = await ev(() => document.getElementById('fl-swap-body').textContent);
ok('(server) two spares offered, the shop one left out', opt.spares.length === 2 && !opt.spares.some((s) => s.id === spShop.id), opt.spares);
ok('screen: the server\'s spares are drawn (both serials), the shop spare is not', swTxt.includes(spHome.serial) && swTxt.includes(spOther.serial) && !swTxt.includes(spShop.serial), swTxt.slice(0, 400));
ok('screen: the other-model spare carries the model warning, the same-model one does not', (swBody.match(/model ต่าง/g) || []).length === 1 && /ท่าอื่น/.test(swTxt) && /onclick="flConfirmSwap\('/.test(swBody), swTxt.slice(0, 400));

// ── A7 invDupScan / invDupMerge
item('A7', 'invDupScan / invDupMerge · duplicates, "need a part number", and which item stays are the server\'s');
const nm = `Dup W6 ${R}`, nn = `NeedPn W6 ${R}`;
const sA = await post('/v1/fleet/stock-items', { name: nm + ' one', part_no: 'PN-' + R, qty: 2, warehouse: 'tublamu' });
const sB = await post('/v1/fleet/stock-items', { name: nm + ' two', part_no: 'PN-' + R + 'b', qty: 5, warehouse: 'tublamu' });
const sC = await post('/v1/fleet/stock-items', { name: nn + ' one', part_no: 'NP1-' + R, qty: 1, warehouse: 'tublamu' });
const sD = await post('/v1/fleet/stock-items', { name: nn + ' two', part_no: 'NP2-' + R, qty: 1, warehouse: 'tublamu' });
await reloadFleet();
// The API refuses to make a real duplicate (409 stock_item_exists) or a nameless-part-number twin (409 part_no_required): those groups only exist in imported
// legacy data. So ONE read of GET /v1/fleet/stock-items/duplicates is doctored here, naming real items as the groups; the server's own rule is tested in
// operation-backend test/w5b-fleet.test.ts. What this item checks is the SCREEN: it draws the server's groups although the browser's names see none,
// and the merge it sends is the server's keep_id / from_ids (the server then really merges them).
const member = (x, q) => ({ id: x.id, name: x.name, part_no: x.part_no || null, total_qty: q, history_count: 0 });
rewrite = (m, p, buf) => {
  if (m !== 'GET' || p !== '/v1/fleet/stock-items/duplicates') return null;
  const j = JSON.parse(buf.toString());
  j.dup = [{ key: 'doctored', name: 'Doctored same part', part_no: 'PN-' + R, keep_id: sB.id, drop_ids: [sA.id], total_qty: 7, members: [member(sB, 5), member(sA, 2)] }];
  j.need_part_no = [{ name: nn, no_part_no: 1, members: [member(sC, 1), member(sD, 1)] }];
  return Buffer.from(JSON.stringify(j));
};
const legacyScan = await ev(() => { const r = invDupScan.__orig(); return r.dup.length + r.needPn.length; });
await ev(() => { invDupOpen(); }); await settle(1000);
rewrite = null;
const dupTxt = await ev(() => (document.getElementById('inv-dup-host') || { textContent: '' }).textContent.replace(/\s+/g, ' '));
ok('legacy (the browser names) would find nothing to complete or merge', legacyScan === 0, legacyScan);
ok('the dialog lists the server "need part number" group and the merge group', dupTxt.includes('ต้องเติม Part Number') && dupTxt.includes('ไม่มีเบอร์ 1') && dupTxt.includes('ซ้ำจริง') && dupTxt.includes('1 กลุ่ม'), dupTxt.slice(0, 500));
const keyEnc = await ev(() => { const m = /invDupMerge\('([^']+)'\)/.exec(document.getElementById('inv-dup-host').innerHTML); return m && m[1]; });
dialogs.length = 0;
await ev((k) => invDupMerge(k), keyEnc); await idle(); await settle(1000);
const mgB = bodies.filter((x) => /merge$/.test(x.k)).pop(), mg = lastReq(/\/stock-items\/.+\/merge$/);
ok('the merge sent is the server keep_id: POST …/stock-items/{keep_id}/merge {from_ids: drop_ids}', mg && mg.status === 400 && mgB.k.includes('/stock-items/' + sB.id + '/merge') && JSON.stringify(mg.req.from_ids) === JSON.stringify([sA.id]), { mgB: mgB && mgB.k, req: mg && mg.req });
ok('the confirm showed the server total (7), not the browser total', dialogs.some((d) => /ยอดรวมหลังรวม 7 /.test(d)), dialogs);
ok('server: these two items are not the same part, so it refused the merge in its own words and merged nothing (both still exist)', /is not the same item/.test(JSON.stringify(mg.json)) && (await apiRaw('/v1/fleet/stock-items/' + sA.id)).status === 200 && (await apiRaw('/v1/fleet/stock-items/' + sB.id)).status === 200, mg);

// ── A8 flwMemoOpen / flwMemoLabel
item('A8', 'flwMemoOpen / flwMemoLabel · which memos of a job are open, and the words, are the server\'s (Fleet Work)');
const bA8 = await newBoat();
const jA8 = await mkJob(bA8.id, 'memo job');
const memoBody = (extra) => Object.assign({ no: `MO-W6B-${R}-${seqN++}`, title: 'Parts', boat_id: bA8.id, job_id: jA8.id, memo_type: 'parts', lines: [{ name: 'Bolt', category: 'parts', qty: 1, price: 10 }] }, extra);
const mParts = await post('/v1/fleet/memos', memoBody({}));
const mLab = await post('/v1/fleet/memos', memoBody({ memo_type: 'labor', lines: [{ name: 'Fitter', category: 'labor', qty: 1, price: 100 }] }));
await post(`/v1/fleet/memos/${mLab.id}/approve`, { approved_by: 'boss' });
await reloadFleet();
await ev((id) => { const m = FL_MEMOS.find((x) => x.id === id); m.status = 'ordered'; m.laborOnly = false; }, mLab.id);   // the browser copy: an ORDERED parts memo
const legacyOpen = await ev((id) => flwMemoOpen.__orig(FL_MEMOS.find((x) => x.id === id)), mLab.id);
await ev((id) => { flwMemoOpen(FL_MEMOS.find((x) => x.id === id)); }, mLab.id); await settle(900);
const gotOpen = await ev(([a, b]) => ({ lab: flwMemoOpen(FL_MEMOS.find((x) => x.id === a)), labLbl: flwMemoLabel(FL_MEMOS.find((x) => x.id === a)), parts: flwMemoOpen(FL_MEMOS.find((x) => x.id === b)), partsLbl: flwMemoLabel(FL_MEMOS.find((x) => x.id === b)) }), [mLab.id, mParts.id]);
ok('legacy (browser copy: ordered parts memo) would call the labour memo open', legacyOpen === true, legacyOpen);
ok('screen: the approved labour memo is NOT open and reads "approved, not paid yet"; the parts memo is open "waiting for approval"', gotOpen.lab === false && gotOpen.labLbl === 'approved, not paid yet' && gotOpen.parts === true && gotOpen.partsLbl === 'waiting for approval', gotOpen);

// ── A9 faDocData grouping
item('A9', 'Documents · the boat\'s group (30 days / expired / 90 days / fine) and "next to do" are the server\'s (GET /v1/fleet/certificates)');
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const bA9 = await newBoat({ documents: [{ name: 'ใบอนุญาตใช้เรือ', expires_on: addDays(T0, 10) }, { name: 'ประกันภัยเรือ', expires_on: addDays(T0, 200) }, { name: 'ใบอนุญาต พีพี', expires_on: null }] });
await ev(async () => { await laOps.fleetBoats.load(); }); await settle(500);
const cert = await api('/v1/fleet/certificates'), certRow = cert.boats.find((b) => b.boat_id === bA9.id);
await ev((id) => { const b = BOATS.find((x) => x.id === id); b.docs = []; }, bA9.id);   // the browser copy holds no documents: legacy would put the boat in the last group
const legacyRow = await ev((id) => faDocData.__orig().rows.find((r) => r.b.id === id), bA9.id).catch(() => null);
const gotRow = await ev((id) => { const D = faDocData(), r = D.rows.find((x) => x.b.id === id); return { grp: r.grp, next: r.next, all: D.c.all, exp: D.c.exp }; }, bA9.id);
ok('(server) the boat is in group 0 (due within 30 days), next in 10 days for the licence', certRow.group === 0 && certRow.next && certRow.next.days === 10 && certRow.next.types[0] === 'lic', certRow);
ok('screen: faDocData gives the server\'s group and next (legacy\'s copy had none)', gotRow.grp === 0 && gotRow.next && gotRow.next.d === 10 && gotRow.next.k[0] === 'lic', { gotRow, legacyRow: legacyRow && legacyRow.grp });
ok('screen: the tiles use the server\'s counts (all; expired includes the document with no date)', gotRow.all === cert.counts.all && gotRow.exp === cert.counts.exp + cert.counts.no_date, { gotRow, counts: cert.counts });
await ev(() => { if (!document.getElementById('fl-docs-pink-wrap')) { const d = document.createElement('div'); d.id = 'fl-docs-pink-wrap'; document.body.appendChild(d); } faRenderDocs(); });
const docsHtml = await ev(() => document.getElementById('fl-docs-pink-wrap').textContent.replace(/\s+/g, ' '));
ok('the page groups the boat under "ภายใน 30 วัน — ต้องยื่นต่ออายุ" with the "อีก 10 วัน" next to do', docsHtml.includes('ภายใน 30 วัน — ต้องยื่นต่ออายุ') && docsHtml.includes('อีก 10 วัน'), docsHtml.slice(0, 500));

// ── A10 _swapDocStep2
item('A10', 'Replace wizard step 2 · the next PM date is the server\'s (GET /v1/fleet/safety/{id}/replace-preview)');
const bA10 = await newBoat();
const sfA10 = await post('/v1/fleet/safety', { boat_id: bA10.id, category: 'bilge_pump', name: 'W6 bilge pump', serial: 'BP-' + R });
await reloadFleet();
await ev(() => { FL_SAFETY_CATEGORIES.bilge_pump.pmMonths = 6; });   // the browser's own category table says six months
await ev((id) => { swapDocOpen(id); _swapDoc.installDate = '2481-01-31'; _swapDoc.step = 2; swapDocRender(); }, sfA10.id); await settle(900);
const modalTxt = await ev(() => document.getElementById('swap-modal').textContent.replace(/\s+/g, ' '));
const prev = await api(`/v1/fleet/safety/${sfA10.id}/replace-preview?install_date=2481-01-31`);
ok('(server) install 2481-01-31 + 1 month = 2481-03-03', prev.next_pm === '2481-03-03' && prev.pm_months === 1, prev);
ok('screen: Next PM 2481-03-03 · 1mo (legacy with six months would say 2481-07-31)', /Next PM 1mo\s*2481-03-03/.test(modalTxt) && !modalTxt.includes('2481-07-31'), modalTxt.slice(modalTxt.indexOf('Next PM') - 20, modalTxt.indexOf('Next PM') + 60));
await ev(() => { FL_SAFETY_CATEGORIES.bilge_pump.pmMonths = 1; _swapDoc = null; document.getElementById('swap-modal').style.display = 'none'; });

// ── A11 memo number in the replace wizard
item('A11', 'Replace wizard · the memo number of a bought part is the server\'s next_no (GET /v1/fleet/memos)');
await post('/v1/fleet/memos', memoBody({ no: 'MO-' + (6000 + (Date.now() % 900)), job_id: undefined, title: 'high number' }));
const memosNow = await api('/v1/fleet/memos');
await reloadFleet();
await ev(() => { for (let i = 0; i < 5; i++) FL_MEMOS.push({ id: 'fakemo' + i, no: 'MO-00' + i, title: 'browser only', status: 'paid', items: [] }); });
await ev((id) => { swapDocOpen(id); _swapDoc.source = 'buy'; _swapDoc.newBrand = 'Rule'; _swapDoc.newModel = '1500'; _swapDoc.newPrice = 100; _swapDoc.newSerial = 'NEW-' + id.slice(-4); _swapDoc.step = 3; swapDocRender(); }, sfA10.id); await settle(1200);
const step3 = await ev(() => document.getElementById('swap-modal').textContent.replace(/\s+/g, ' '));
ok('(server) next_no is above the high number', /^MO-\d{4,}$/.test(memosNow.next_no) && +memosNow.next_no.slice(3) > 6000, memosNow.next_no);
ok('screen: the preview shows the server\'s memo number (not the browser count + 1)', step3.includes(memosNow.next_no), step3.slice(0, 600));
dialogs.length = 0; c0 = n0();
await ev(() => swapDocExecute()); await idle(); await settle(1500);
const rp = lastReq(/\/safety\/.+\/replace$/);
ok('the replace request carries the server\'s memo number', rp && rp.req && rp.req.memo_no === memosNow.next_no, rp && rp.req);
} // end part A

// ════════════════════ PART B · BOOKING SIDE ════════════════════
const loadBk = async (id) => { const ob = await api('/v1/bookings/' + id); await ev((o) => { laOps.bookings.upsert(o); }, ob); return ob; };
const deploy = (boat, route, date, capacity = 40) => send('POST', '/operations/deployments', { boat_id: boat, route_id: route, service_date: date, capacity });
const D1 = day(41), D2 = day(43), D3 = day(45);
for (const d of [D1, D2, D3]) await deploy('b6', 'r5', d);

// ── B1 rtZonesForRoute
item('B1', 'rtZonesForRoute · the zones a route\'s rate shows are the server\'s (rate_zones on GET /v1/routes)');
const rsrv = (await api('/v1/routes')).routes.find((r) => r.id === 'r4');
ok('(server) r4 shows PK, KL, NoTransfer', JSON.stringify(rsrv.rate_zones) === JSON.stringify(['PK', 'KL', 'NoTransfer']), rsrv.rate_zones);
await ev(() => { getRoute('r4').pier = 'ranong'; });   // the browser copy puts the route at Ranong
const legacyZ = await ev(() => rtZonesForRoute.__orig('r4'));
await ev(() => { rtZonesForRoute('r4'); }); await settle(700);
const gotZ = await ev(() => ({ plain: rtZonesForRoute('r4'), withRn: rtZonesForRoute('r4', { RN: {} }) }));
ok('legacy (browser copy at Ranong) would say RN + NoTransfer', JSON.stringify(legacyZ) === JSON.stringify(['RN', 'NoTransfer']), legacyZ);
ok('screen: the server\'s zones; a zone the rate already holds is kept', JSON.stringify(gotZ.plain) === JSON.stringify(['PK', 'KL', 'NoTransfer']) && JSON.stringify(gotZ.withRn) === JSON.stringify(['PK', 'KL', 'NoTransfer', 'RN']), gotZ);
await ev(() => { getRoute('r4').pier = 'tublamu'; });

// ── B2 laInternalRows
item('B2', 'laInternalRows · the company-own report rows (one per trip, money on the first) are the server\'s (GET /v1/reports/internal-trips)');
const coAg = await send('POST', '/v1/agents', { name: 'W6B Company ' + R, code: 'COMPANY', market_id: 'ru', pay_type: 'cot', vat_mode: 'none', rate_type_id: 'rt001', create_anyway: true, company: { legal_name: 'W6B Co', address: '1 Test Rd' } });
console.log('  (info) company agent -> ' + coAg.status + ' ' + JSON.stringify(coAg.body).slice(0, 160));
const comp = await send('POST', '/v1/bookings', { agent_id: coAg.body.id, company_purpose: 'pr_foc', manual_total: 900, foc_reason: 'W6B test', lead_pax: 'W6B Internal ' + R,
  trips: [{ route_id: 'r5', date: D2, pax: { ad_fr: 2 } }, { route_id: 'r5', date: D1, pax: { ad_fr: 2, foc: 1 } }], });
console.log('  (info) company booking -> ' + comp.status + ' ' + JSON.stringify(comp.body).slice(0, 220));
const compB = comp.body;
const yr2 = D1.slice(0, 4);
const rep = await api('/v1/reports/internal-trips?year=' + yr2);
const mineRows = (rep.rows || []).filter((r) => r.booking_id === (compB && compB.id));
ok('(server) two rows for the booking, money on the first trip', mineRows.length === 2 && mineRows[0].money_here === true && mineRows[1].money_here === false && mineRows[0].money === 900 && mineRows[1].money === 0, mineRows);
await ev(() => { SB_BOOKINGS.length = 0; });   // the browser copy has no bookings: legacy would list nothing
const legacyRows = await ev((y) => laInternalRows.__orig(y).length, +yr2);
await ev((y) => { laInternalRows(y); }, +yr2); await settle(900);
const gotRows = await ev((y) => laInternalRows(y).map((r) => [r.bk.id, r.date, r.pax, r.foc, r.money, r.moneyHere, r.free, r.lbl, r.unset]), +yr2);
const mineGot = gotRows.filter((r) => r[0] === (compB && compB.id) || r[0] === (compB && compB.external_id));
ok('legacy (empty browser copy) would list no rows', legacyRows === 0, legacyRows);
ok('screen: the rows are the server\'s (dates, pax, foc, money on the first trip only)', mineGot.length === 2 && mineGot[0][1] === mineRows[0].date && mineGot[0][4] === 900 && mineGot[0][5] === true && mineGot[1][4] === 0 && mineGot[1][5] === false && mineGot[0][2] === mineRows[0].pax && mineGot[0][3] === 1, { mineGot, mineRows });
const rptHtml = await ev((y) => laInternalReport(y), +yr2);
ok('the report page draws the server\'s label for the booking', rptHtml.includes(mineRows[0].label), rptHtml.slice(0, 300));

// ── B3 bookingV2SplitArea
item('B3', 'bookingV2SplitArea · the area of a split row (and whether it only borrows the booking\'s) is the server\'s (van_parts[].area_effective)');
const kataArea = await post('/v1/pickup-areas', { name: 'W6B Kata ' + R, zone: 'PK', time_group: 'T-W6B-' + R });
const splitBk = await send('POST', '/v1/bookings', { pickup_area: 'Patong Area', hotel_name: 'W6B Home Hotel ' + R, lead_pax: 'W6B Split ' + R,
  alt_pickups: [{ who: 'A', ad: 1, area_id: kataArea.id, place: 'Kata Palm' }, { who: 'B', ad: 1, place: 'Elsewhere Inn' }], trips: [{ route_id: 'r5', date: D3, pax: { ad: 4 }, zone: 'PK' }] });
console.log('  (info) split booking -> ' + splitBk.status + ' ' + JSON.stringify(splitBk.body).slice(0, 220));
const sbId = splitBk.body && splitBk.body.id;
const sbSrv = await loadBk(sbId);
const partsSrv = sbSrv.trips[0].operations.van_parts;
const partB = partsSrv.find((p) => p.alt && p.alt.alt_who === 'B'), partA = partsSrv.find((p) => p.alt && p.alt.alt_who === 'A');
ok('(server) part B is picked up elsewhere and only borrows the booking\'s area; part A has its own', partB && partB.area_inherited === true && partB.area_effective && partB.area_effective.name === 'Patong Area' && partA.area_inherited === false && partA.area_effective.id === kataArea.id, partsSrv.map((p) => [p.source, p.area_effective, p.area_inherited]));
const probe = await ev(([id]) => {
  const bk = SB_BOOKINGS.find((b) => b.opsId === id);
  bk.pickupAreaId = ''; bk.pickupArea = '';   // the browser copy lost the booking's own area
  const pick = (who) => { const p = bkOpsRead(bk, bk.trips[0].date).vanSplits.find((s) => s.altWho === who); return { areaId: p.pickAreaId, hotel: p.pickHotel, zone: p.pickZone }; };
  const pb = pick('B'), pa = pick('A');
  const lg = bookingV2SplitArea.__orig(bk, pb, null), sv = bookingV2SplitArea(bk, pb, null), sa = bookingV2SplitArea(bk, pa, null);
  return { legacy: [lg.name, lg.inherited], b: [sv.name, sv.inherited], a: [sa.name, sa.inherited], pb };
}, [sbId]);
ok('legacy (browser copy without the area) would give nothing for part B', probe.legacy[0] === '', probe);
ok('screen: part B = Patong Area, borrowed (faint); part A = its own area, not borrowed', probe.b[0] === 'Patong Area' && probe.b[1] === true && probe.a[0] === 'W6B Kata ' + R && probe.a[1] === false, probe);

// ── B4 psuResolveProfile
item('B4', 'psuResolveProfile · the profile that applies on a date is the server\'s (GET /v1/pickup-time-profiles/active)');
const profW = await send('POST', '/v1/pickup-time-profiles', { name: 'W6B wide ' + R, from_date: '2075-01-01', to_date: '2075-12-31' });
const profP = await send('POST', '/v1/pickup-time-profiles', { name: 'W6B peak ' + R, from_date: '2075-06-01', to_date: '2075-06-30', overlap_anyway: true });
ok('(server) the narrow profile covers 10 June, the wide one September', (await api('/v1/pickup-time-profiles/active?date=2075-06-10')).profile.id === profP.body.id && (await api('/v1/pickup-time-profiles/active?date=2075-09-10')).profile.id === profW.body.id, [profW.status, profP.status]);
await ev(() => { SB_PICKUP_TIME_PROFILES.length = 0; });   // the browser copy has no profile at all
const legacyProf = await ev(() => psuResolveProfile.__orig('2075-06-10'));
await ev(() => { psuResolveProfile('2075-06-10'); psuResolveProfile('2075-09-10'); }); await settle(800);
const gotProf = await ev(() => ({ june: (psuResolveProfile('2075-06-10') || {}).id, sep: (psuResolveProfile('2075-09-10') || {}).name, from: (psuResolveProfile('2075-06-10') || {}).from }));
ok('legacy (empty browser copy) would find no profile for 10 June', !legacyProf || !String(legacyProf.name).includes('W6B'), legacyProf);
ok('screen: 10 June is the narrow profile, 10 September the wide one (the server\'s pick)', gotProf.june === profP.body.id && gotProf.sep === 'W6B wide ' + R && gotProf.from === '2075-06-01', gotProf);

// ── B5 psuSaveProfile · overlap warning
item('B5', 'psuSaveProfile · the overlap warning is the server\'s (409 profile_overlap, then overlap_anyway)');
await ev(async () => { await laOps.pickup.refresh(); });
await ev(() => { SB_PICKUP_TIME_PROFILES.length = 0; });   // the browser can no longer see the overlap itself
const draft = (name) => ev((n) => { _psuProfileDraft = { isNew: true, name: n, from: '2075-03-01', to: '2075-03-10', notes: '', startFrom: 'blank', cloneSourceId: null }; }, name);
dialogs.length = 0; confirmAnswer = false;
await draft('W6B overlap no ' + R);
await ev(() => psuSaveProfile()); await idle(); await settle(900);
const posts1 = bodies.filter((x) => x.k === 'POST /v1/pickup-time-profiles').slice(-1)[0];
ok('declined: the confirm shows the server\'s words (name and dates) and no second save is sent', dialogs.some((d) => d.startsWith('confirm: Validity overlaps with "W6B wide ' + R + '" (2075-01-01 to 2075-12-31)')) && posts1.status === 409 && !(await api('/v1/pickup-time-profiles')).profiles.some((p) => p.name === 'W6B overlap no ' + R), { dialogs, st: posts1 && posts1.status });
dialogs.length = 0; confirmAnswer = true;
await draft('W6B overlap yes ' + R);
await ev(() => psuSaveProfile()); await idle(); await settle(1200);
const sent = bodies.filter((x) => x.k === 'POST /v1/pickup-time-profiles').slice(-2);
ok('accepted: the same save is sent again with overlap_anyway: true and saved (201)', sent.length === 2 && sent[0].status === 409 && sent[1].status === 201 && JSON.parse(sent[1].req).overlap_anyway === true && JSON.parse(sent[0].req).overlap_anyway === undefined, sent.map((x) => [x.status, x.req]));
ok('server: the profile exists', (await api('/v1/pickup-time-profiles')).profiles.some((p) => p.name === 'W6B overlap yes ' + R), null);
const ptest = await send('POST', '/v1/pickup-time-profiles', { name: 'W6B alone ' + R, from_date: '2078-01-01', to_date: '2078-01-10' });
ok('(server) a profile that overlaps nothing is saved at the first try (no confirm)', ptest.status === 201, ptest);

// ── B6 psuHotelGroups
item('B6', 'psuHotelGroups / psuHotelAreaLabel · groups of similar hotel names, the name to keep and the areas are the server\'s (GET /v1/hotel-names/groups)');
const areaH = await post('/v1/pickup-areas', { name: 'W6B Hotel Area ' + R, zone: 'PK', time_group: 'T-W6H-' + R });
const base = `Zqx${R} Palm`;
for (const [hotel, n] of [[`${base} Resort`, 2], [`${base}  resort`, 1], [base, 1]]) for (let i = 0; i < n; i++) { const r = await send('POST', '/v1/bookings', { hotel_name: hotel, pickup_area_id: areaH.id, lead_pax: 'W6B hotel', trips: [{ route_id: 'r5', date: D1, pax: { ad: 1 }, zone: 'PK' }] }); if (r.status >= 300) console.log('  seed hotel booking -> ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200)); }
const hg = await api('/v1/hotel-names/groups'), hgm = hg.groups.find((g) => g.items.some((i) => i.name === `${base} Resort`));
ok('(server) one group with the three spellings, keep = the most used', hgm && hgm.items.length === 3 && hgm.keep === `${base} Resort` && hgm.total === 4, hgm);
await ev(() => { SB_BOOKINGS.length = 0; });   // the browser copy has no bookings: legacy would find no group
const legacyHg = await ev(() => psuHotelGroups.__orig().length);
await ev(() => { psuHotelGroups(); }); await settle(900);
const gotHg = await ev((b) => { const g = psuHotelGroups().find((x) => x.items.some((i) => i.name === b + ' Resort')); return g && { keep: g.keep, tot: g.tot, names: g.items.map((i) => [i.name, i.n]), lbl: psuHotelAreaLabel(g.items[0]), id: g.id }; }, base);
ok('legacy (empty browser copy) would find no group', legacyHg === 0, legacyHg);
ok('screen: the group, its keep name, its counts and the area label are the server\'s', gotHg && gotHg.keep === `${base} Resort` && gotHg.tot === 4 && gotHg.names[0][1] === 2 && gotHg.lbl === 'W6B Hotel Area ' + R, gotHg);
const hotelsHtml = await ev(() => psuRenderHotelsTab());
ok('the "ชื่อโรงแรมซ้ำ" tab draws it, with the merge button for that group', hotelsHtml.includes(base + ' Resort') && hotelsHtml.includes('psuHotelMerge(\'' + hgm.id + '\')'), hotelsHtml.slice(0, 300));

// ── B7 bookingV2LockCoverage
item('B7', 'bookingV2LockCoverage · which holder bookings drew from the lock, another lock, or the pool is the server\'s (GET /v1/seat-locks/{id}/coverage)');
const lkDate = day(47);
await deploy('b6', 'r5', lkDate, 30);
const lkMine = await send('POST', '/v1/seat-locks', { route_id: 'r5', service_date: lkDate, pax: 6, agent_id: 'a01' });
console.log('  (info) seat lock -> ' + lkMine.status + ' ' + JSON.stringify(lkMine.body).slice(0, 200));
const lkOff = await send('POST', '/v1/seat-locks', { route_id: 'r5', service_date: lkDate, pax: 3 });
const bkLk = async (pax, draws, ref) => send('POST', '/v1/bookings', { agent_id: 'a01', voucher_ref: ref, lead_pax: 'Lead ' + ref, trips: [{ route_id: 'r5', date: lkDate, pax: { ad_fr: pax }, zone: 'NoTransfer', lock_draws: draws }] });
const bA = await bkLk(3, { [lkMine.body.id]: 2 }, 'W6LA' + R), bB = await bkLk(2, {}, 'W6LB' + R);
console.log('  (info) lock bookings -> ' + bA.status + ' ' + bB.status + ' ' + JSON.stringify(bB.body).slice(0, 160));
const covSrv = await api(`/v1/seat-locks/${lkMine.body.id}/coverage`);
ok('(server) 2 bookings, 5 heads, 2 drawn from this lock, 3 from the pool', covSrv.bookings === 2 && covSrv.pax === 5 && covSrv.self === 2 && covSrv.pool === 3, covSrv);
await ev(async () => { await laOps.locks.reload(); }); await settle(600);
await ev(() => { SB_BOOKINGS.length = 0; });   // the browser copy has no bookings: legacy would find none
const lkProbe = await ev(([sid, d]) => {
  const l = SB_SEAT_LOCKS.find((x) => x.opsIds && Object.values(x.opsIds).includes(sid));
  if (!l) return { noLock: true };
  const lg = bookingV2LockCoverage.__orig(l, d);
  bookingV2LockCoverage(l, d);
  return { id: l.id, legacy: lg && lg.bookings };
}, [lkMine.body.id, lkDate]);
await settle(900);
const covGot = await ev(([sid, d]) => { const l = SB_SEAT_LOCKS.find((x) => x.opsIds && Object.values(x.opsIds).includes(sid)); const c = bookingV2LockCoverage(l, d); return c && { b: c.bookings, pax: c.pax, self: c.self, other: c.other, pool: c.pool, rows: c.rows.map((r) => [r.vc, r.lead, r.pax, r.self, r.pool]) }; }, [lkMine.body.id, lkDate]);
ok('legacy (empty browser copy) would find no booking on the trip', !lkProbe.noLock && !lkProbe.legacy, lkProbe);
ok('screen: the coverage is the server\'s (rows by most pool first, the voucher and the lead)', covGot && covGot.b === 2 && covGot.pax === 5 && covGot.self === 2 && covGot.pool === 3 && covGot.rows[0][0] === 'W6LB' + R && covGot.rows[0][4] === 2 && covGot.rows[1][3] === 2, covGot);

// ── summary ──
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.map((r) => r.slice(0, 200)).join('\n  '));
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
