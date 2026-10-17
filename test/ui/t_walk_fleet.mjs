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
let s;
const clickText = async (sel) => { await page.click(sel); };
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b) });

item(1, 'saveBoat · add / edit boat modal');
let c1 = calls.length;
await ev(() => { openBoatModal(); openModal('boat-modal'); });
await page.fill('#fm-boat-name', 'Walk Boat'); await page.fill('#fm-boat-licensepax', '20'); await page.fill('#fm-boat-crew', '2'); await page.fill('#fm-boat-cap', '18');
await page.selectOption('#fm-boat-type', 'Speedboat');
await page.click('#boat-modal button[onclick="saveBoat()"]');
await idle(); await settle(800);
let sb = (await api('/v1/boats')).boats.find((b) => b.name === 'Walk Boat');
chk('add → POST /v1/boats, boat on server (capacity 18, license 20, crew 2)', calls.slice(c1).includes('POST /v1/boats') && sb && sb.capacity === 18 && sb.license_pax === 20 && sb.crew === 2, { calls: calls.slice(c1), sb });
s = await ev((id) => ({ b: BOATS.find((x) => x.name === 'Walk Boat'), open: document.getElementById('boat-modal').classList.contains('open') }), 0);
chk('screen has the boat with the server id · modal closed', s.b && sb && s.b.id === sb.id && !s.open, s);
const wid = sb && sb.id;
await ev((id) => flOpenEditBoatModal(id), wid);
await page.fill('#fm-boat-name', 'Walk Boat 2'); await page.fill('#fm-boat-cap', '16');
c1 = calls.length;
await page.click('#boat-modal button[onclick="saveBoat()"]');
await idle(); await settle(800);
sb = await api('/v1/boats/' + wid);
chk('edit → PATCH /v1/boats/{id}: name + capacity 16 on server', calls.slice(c1).includes('PATCH /v1/boats/{id}'.replace('{id}', wid)) && sb.name === 'Walk Boat 2' && sb.capacity === 16, { calls: calls.slice(c1), sb });
await page.reload(); await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 }); await settle(1500);
s = await ev((id) => BOATS.find((x) => x.id === id), wid);
chk('survives reload (name + cap)', s && s.name === 'Walk Boat 2' && s.cap === 16, s && { name: s.name, cap: s.cap });
// oversell: deploy Walk Boat on D5 r5, book 14 pax, then edit seats to 8 → 409 seats_sold → asks → capacity_anyway
const D5 = D(5);
await post('/operations/deployments', { boat_id: wid, route_id: 'r5', service_date: D5, capacity: 16 });
const bkr = await post('/v1/bookings', { external_id: 'zz-walk-1', intent: 'confirm', agentId: 'a01', leadPax: 'ZZ WALK', pickupSelf: true, trips: [{ routeId: 'r5', date: D5, pax: { ad_fr: 14 }, zone: 'NoTransfer' }] });
const aa = await post('/operations/deployments/' + D5 + '/auto-assign', { route_id: 'r5' });
await ev((id) => flOpenEditBoatModal(id), wid);
await page.fill('#fm-boat-cap', '8');
const dn = dialogs.length; c1 = calls.length;
await page.click('#boat-modal button[onclick="saveBoat()"]');
await idle(); await settle(1000);
const sent = calls.slice(c1).filter((c) => /PATCH \/v1\/boats/.test(c));
sb = await api('/v1/boats/' + wid);
chk('oversell edit: refused 409 seats_sold, asked, resent (2 PATCH) and server now 8', refusals.some((r) => /409/.test(r) && /seats_sold|sold/i.test(r)) && sent.length === 2 && sb.capacity === 8, { aa, sent, cap: sb.capacity, dialogs: dialogs.slice(dn), ref: refusals.slice(-2), bk: bkr && bkr.id });
console.log('   dialogs:', dialogs.slice(dn));

item(2, 'saveRoute · Programs form');
await ev(() => { openRouteModal(); });
await page.fill('#fm-route-name', 'Walk Route'); await page.fill('#fm-route-islands', 'Koh Walk');
await page.click('#loc-panwa');
await page.selectOption('#fm-route-family', 'similan');
c1 = calls.length; let b1 = bodies.length;
await page.click('#route-modal button[onclick="saveRoute()"]');
await idle(); await settle(800);
let rts = (await api('/v1/routes')).routes || [];
let wr = rts.find((r) => r.name === 'Walk Route');
chk('add → POST /v1/routes; server holds name, islands, pier panwa, family similan', calls.slice(c1).includes('POST /v1/routes') && wr && wr.islands === 'Koh Walk' && wr.pier === 'panwa' && wr.family_id === 'similan', { calls: calls.slice(c1), wr, n: rts.length });
chk('body has no daily_cap', !bodies.slice(b1).some((b) => /daily_cap|dailyCap/.test(b[1])), bodies.slice(b1));
s = await ev((n) => ({ r: ROUTES.find((x) => x.name === n), open: document.getElementById('route-modal').classList.contains('open') }), 'Walk Route');
chk('screen: route in ROUTES with the server id · modal closed', s.r && wr && s.r.id === wr.id && !s.open, s);
await ev((id) => openRouteModal(id), wr && wr.id);
await page.fill('#fm-route-name', 'Walk Route Edited'); await page.click('#loc-tublamu');
c1 = calls.length;
await page.click('#route-modal button[onclick="saveRoute()"]');
await idle(); await settle(800);
wr = ((await api('/v1/routes')).routes || []).find((r) => r.id === wr.id);
chk('edit → PATCH /v1/routes/{id}; name + pier tublamu on server', calls.slice(c1).includes('PATCH /v1/routes/' + wr.id) && wr.name === 'Walk Route Edited' && wr.pier === 'tublamu', { calls: calls.slice(c1), wr });

item(3, 'bsCleanupLog · boat status-log clean-up');
// the server keeps a log without overlaps, so the overlap is made on the SCREEN's copy (a stale screen): the
// clean-up is the real function; what it removes / moves must reach the server
const E = (status, from, to, extra) => post('/v1/boats/b13/status-log', Object.assign({ status, from_date: from, to_date: to, province: 'Phuket', loc_type: 'pier', loc: 'Panwa', reason: status === 'unavailable' ? 'test' : undefined }, extra || {}));
const eA = await E('unavailable', '2026-12-01', '2026-12-05');
const eB = await E('available', '2026-12-10', '2026-12-12');
const eC = await E('unavailable', '2026-12-20', '2026-12-22');
await ev(() => laOps.fleetBoats.refetchBoat('b13'));
chk('server holds the 3 entries', eA && eB && eC && eA.id && eB.id && eC.id, { eA, eB, eC });
// screen copy: A runs on to 12-15 (overlaps B) · C is covered by B starting before it (B.from = C.from)
await ev((a) => { const b = BOATS.find((x) => x.id === 'b13'); b.log.find((e) => e.id === a.A).to = '2026-12-15'; b.log.find((e) => e.id === a.C).from = '2026-12-10'; b.log.find((e) => e.id === a.C).to = '2026-12-10'; }, { A: eA.id, C: eC.id });
c1 = calls.length; const dn3 = dialogs.length;
await ev(() => bsCleanupLog('b13'));
await idle(); await settle(900);
const sc = calls.slice(c1).filter((c) => /status-log/.test(c));
const srvBoat = await api('/v1/boats/b13');
const sl = srvBoat.status_log || [];
chk('clean-up asked (confirm) and sent writes: ' + sc.join(' | '), dialogs.slice(dn3).some((d) => /confirm/.test(d)) && sc.length >= 1, { sc, dialogs: dialogs.slice(dn3) });
chk('server: A end date moved to the day before B (2026-12-09) [PATCH to_date]', (sl.find((e) => e.id === eA.id) || {}).to_date === '2026-12-09', sl.map((e) => [e.id, e.from_date, e.to_date]));
s = await ev((id) => (BOATS.find((x) => x.id === 'b13').log || []).map((e) => [e.id, e.from, e.to]), 0);
console.log('   server log:', JSON.stringify(sl.map((e) => [e.from_date, e.to_date])), ' screen log:', JSON.stringify(s));

item(4, 'purchase memos · flSaveMemo create / edit · receive state');
const put = (p, b) => api(p, { method: 'PUT', body: JSON.stringify(b) });
const pat = (p, b) => api(p, { method: 'PATCH', body: JSON.stringify(b) });
const hasMemoSave = await ev(() => /flSaveMemo/.test(String(window.flSaveMemo)) && String(window.flSaveMemo).indexOf('fleet/memos') >= 0 || (window.flSaveMemo && window.flSaveMemo.__opsFleetStock === true));
console.log('   flSaveMemo wired in this build:', hasMemoSave);
await ev(() => { flOpenMemoFromInventory(); memoSelectScope('general'); });
await page.fill('#memo-subject', 'Walk memo'); await page.fill('#memo-supplier', 'Walk Supplier');
await page.fill('#memo-new-name', 'Walk Rope'); await page.fill('#memo-new-qty', '4'); await page.fill('#memo-new-price', '250');
await ev(() => memoAddItem());
c1 = calls.length;
await page.click('#memo-save-btn');
await idle(); await settle(1000);
let memos = (await api('/v1/fleet/memos')).memos;
let mm = memos.find((m) => m.title === 'Walk memo');
chk('create → POST /v1/fleet/memos; server memo pending_approval, subtotal 1000, VAT 7% → total 1070 (server totals)', calls.slice(c1).includes('POST /v1/fleet/memos') && mm && mm.status === 'pending_approval' && mm.subtotal === 1000 && mm.amount === 1070, { calls: calls.slice(c1), mm: mm && { status: mm.status, sub: mm.subtotal, amount: mm.amount } });
s = await ev((id) => (FL_MEMOS || []).find((m) => m.id === id) || (FL_MEMOS || []).find((m) => m.title === 'Walk memo'), mm && mm.id);
chk('screen memo carries the server id and total', s && mm && s.id === mm.id && s.amount === 1070, s && { id: s.id, amount: s.amount });
// edit through the real form: new subject + a second line
await ev((id) => flEditMemo(id), mm.id);
await page.fill('#memo-subject', 'Walk memo edited');
await page.fill('#memo-new-name', 'Walk Shackle'); await page.fill('#memo-new-qty', '2'); await page.fill('#memo-new-price', '100');
await ev(() => memoAddItem());
c1 = calls.length;
await page.click('#memo-save-btn');
await idle(); await settle(1000);
mm = await api('/v1/fleet/memos/' + mm.id);
chk('edit → PATCH /v1/fleet/memos/{id}; title + 2 lines, subtotal 1200, total 1284', calls.slice(c1).includes('PATCH /v1/fleet/memos/' + mm.id) && mm.title === 'Walk memo edited' && mm.lines.length === 2 && mm.subtotal === 1200 && mm.amount === 1284, { calls: calls.slice(c1), t: mm.title, n: mm.lines.length, sub: mm.subtotal, amt: mm.amount });
// approve + order (server commands), then receive part of it, and read what the screen derives
await post('/v1/fleet/memos/' + mm.id + '/approve', { approved_by: 'Boss', approved_date: D(1) });
await post('/v1/fleet/memos/' + mm.id + '/order', { ordered_date: D(1) });
const l1 = mm.lines[0];
const rc = await post('/v1/fleet/memos/' + mm.id + '/receive', { warehouse: 'tublamu', date: D(2), lines: [{ line_id: l1.id, qty: 1 }] });
await ev(() => laOps.fleetStock.refetch());
const sm = await ev((id) => { const m = FL_MEMOS.find((x) => x.id === id); return m && { status: m.status, rs: memoRecvState(m), labour: flwMemoLabour(m) }; }, mm.id);
const smSrv = await api('/v1/fleet/memos/' + mm.id);
chk('memo receive state on screen equals the server receive_state, labour flag equal', sm && smSrv.receive_state && JSON.stringify(sm.rs) === JSON.stringify(smSrv.receive_state) && sm.labour === !!smSrv.labor_only, { screen: sm, server: { rs: smSrv.receive_state, lab: smSrv.labor_only, status: smSrv.status } });
console.log('   receive_state server:', JSON.stringify(smSrv.receive_state), ' screen:', JSON.stringify(sm));

item(5, 'issue items · daily log raw readers · water · previous meter · fuel price');
const TD = day(0), Y1 = day(-2), Y2 = day(-1);
await ev(() => { closeModal('fl-modal-memoview'); closeModal('fl-modal-memo'); flIssueQuickOpen('tublamu'); });
await page.fill('#flx-nm', 'Walk Ice'); await page.fill('#flx-un', 'bag');
c1 = calls.length;
await ev(() => document.querySelector('.flx-ok').click());
await idle(); await settle(900);
let its = (await api('/v1/fleet/issue-items')).items;
let it1 = its.find((x) => x.name === 'Walk Ice');
chk('flIssueQuickAdd → POST /v1/fleet/issue-items; item on server (unit bag, pier tublamu)', calls.slice(c1).includes('POST /v1/fleet/issue-items') && it1 && it1.unit === 'bag' && it1.pier === 'tublamu', { calls: calls.slice(c1), its });
s = await ev(() => flIssueItems().map((x) => [x.id, x.name]));
chk('screen item list holds the server id', it1 && s.some((x) => x[0] === it1.id), s);
await ev((id) => flIssueSetItem(id, 'off', 1), it1.id); await idle(); await settle(500);
its = (await api('/v1/fleet/issue-items')).items; it1 = its.find((x) => x.name === 'Walk Ice');
const offNow = it1 && (it1.off === true || it1.off === 1);
await ev(() => flIssueAddItem('Walk Ice', 'bag', 'tublamu')); await idle(); await settle(500);
its = (await api('/v1/fleet/issue-items')).items;
const same = its.filter((x) => x.name === 'Walk Ice');
chk('switched off, then the same name added again → one item, turned back on (no duplicate)', offNow && same.length === 1 && !same[0].off, { offNow, same });
// daily log writes
const IT = same[0].id;
c1 = calls.length;
await ev((a) => { flWaterSet(a.d, 'b6', 'o', 100); }, { d: TD }); await idle();
await ev((a) => { flWaterSet(a.d, 'b6', 'c', 140); }, { d: TD }); await idle();
await ev((a) => { flIssueSet(a.d, 'b6', a.it, 5); }, { d: TD, it: IT }); await idle();
await ev((a) => { flSaveFuelPrice(a.d, 'tublamu', 38.5); }, { d: TD }); await idle();
await ev((a) => { flSaveFuel(a.d, 'b6', 200); }, { d: TD }); await idle(); await settle(600);
const dl = await api('/v1/fleet/daily-log?from=' + TD + '&to=' + TD);
console.log('   daily-log keys:', JSON.stringify(dl).slice(0, 600));
s = await ev((a) => ({ used: flWaterUsed(a.d, 'b6'), get: flWaterGet(a.d, 'b6'), iss: flIssueGet(a.d, 'b6', a.it), all: flIssueAll()[Object.keys(flIssueAll())[0]], price: flFuelPriceEff(a.d, getBoat('b6')), fuelPrice: flFuelPrice(a.d, 'tublamu') }), { d: TD, it: IT });
console.log('   screen:', JSON.stringify(s), ' calls:', calls.slice(c1).join(' | '));
chk('water: PUT …/water ×2, screen used = 40 and raw reader holds open/close', s.used === 40 && s.get && s.get.o === 100 && s.get.c === 140 && calls.slice(c1).filter((c) => /PUT .*water/.test(c)).length === 2, { s, calls: calls.slice(c1) });
chk('issued qty 5 on the server and read back by flIssueGet / flIssueAll', s.iss === 5 && JSON.stringify(dl).includes(IT), { iss: s.iss });
chk('fuel price 38.5 PUT …/fuel-prices · screen flFuelPriceEff 38.5', s.price && s.price.price === 38.5 && s.price.src === 'pier' && calls.slice(c1).some((c) => /PUT .*fuel-prices/.test(c)), s);
// previous meter: an engine with two readings on two earlier days
const eng = await post('/v1/fleet/engines', { brand: 'Yamaha', model: 'F300', serial: 'E-WALK-1', hp: 300, base_hours: 100, service_interval: 100, status: 'ready', boat_id: 'b6', pos: 'Port' });
await ev(() => laOps.fleetAssets.load && laOps.fleetAssets.load(true));
await ev((a) => { flSaveMeter(a.d, 'b6', 'normal', a.e, 120); }, { d: Y1, e: eng.id }); await idle();
await ev((a) => { flSaveMeter(a.d, 'b6', 'normal', a.e, 150); }, { d: Y2, e: eng.id }); await idle(); await settle(600);
const pm = await ev((a) => ({ prev: flPrevMeter(a.e, a.d), prev1: flPrevMeter(a.e, a.d1) }), { e: eng.id, d: Y2, d1: Y1 });
chk('previous meter for the later day = 120 (the earlier reading), none before the first', pm.prev === 120 && pm.prev1 == null, { pm, eng: eng && eng.id, err: eng && eng.message });

// ── fleet seed for items 7–11: a rig (engine + gearbox + propeller) on four boats, spares, and jobs ──
const rig = async (boat, tag, pos = 'Port') => {
  const e = await post('/v1/fleet/engines', { brand: 'Yamaha', model: 'F300', serial: 'E-' + tag, hp: 300, base_hours: 100, service_interval: 100, status: 'ready', boat_id: boat, pos });
  const g = await post('/v1/fleet/gearboxes', { brand: 'ZF', model: 'ZF-' + tag, serial: 'G-' + tag, base_hours: 10, service_interval: 100, status: 'ready', engine_id: e.id });
  const p = await post('/v1/fleet/propellers', { brand: 'Michigan', serial: 'P-' + tag, diameter: 20, pitch: 24, blades: 3, material: 'Stainless', rotation: 'Standard', cupping: 'no', status: 'active', gearbox_id: g.id });
  return { e, g, p };
};
let jobSeq = 900; const mkJob = async (boat, title, engId, extra) => { const r = await post('/v1/fleet/jobs', Object.assign({ no: 'MJ-' + (++jobSeq), boat_id: boat, title, type: 'corrective', boat_status: 'fixing', assets: engId ? [{ type: 'engine', asset_id: engId }] : [] }, extra || {})); if (!jobId(r)) console.log('   MKJOB FAILED', JSON.stringify(r).slice(0, 300)); return r; };
const RK = await rig('b7', 'KEEP'), RS = await rig('b1', 'STASH'), RW = await rig('b13', 'SWAP');
const spareEng = await post('/v1/fleet/engines', { brand: 'Yamaha', model: 'F300', serial: 'E-SPARE', hp: 300, base_hours: 50, service_interval: 100, status: 'spare', spare_location: 'pier:tublamu' });
console.log('   seed:', JSON.stringify({ k: RK.e.id || RK.e, s: RS.e.id || RS.e.message, w: RW.e.id || RW.e.message, spare: spareEng.id || spareEng.message, g: RK.g.id || RK.g.message, p: RK.p.id || RK.p.message }));
const reloadFleet = async () => { await ev(async () => { await laOps.fleetJobs.load(); await laOps.fleetAssets.load(true); if (laOps.fleetDaily && laOps.fleetDaily.load) await laOps.fleetDaily.load(); if (laOps.fleetBoats) await laOps.fleetBoats.load(); }); await settle(400); };
var jobId = (r) => (r && (r.id || (r.jobs && r.jobs[0] && r.jobs[0].id))) || null;

item(6, 'Fuel Intelligence panel from GET /v1/fleet/reports/fuel');
const fuelWired = await ev(() => !!(window._fuelAgg && window._fuelAgg.__opsFleetDaily));
const fuelRep = await api('/v1/fleet/reports/fuel?month=' + day(0).slice(0, 7));
console.log('   _fuelAgg wrapped by ops:', fuelWired, ' server report fuel:', fuelRep.fuel, ' boats:', (fuelRep.boats || []).length);
chk('_fuelAgg / _fuelWkAgg are served from the report (wrapped by js/ops)', fuelWired, { fuelWired, srv: fuelRep.fuel });

item(7, 'projects · phases · health · bill gate · close asks the bill dialog · work-done');
const pr = await post('/v1/fleet/projects', { no: 'PRJ-901', name: 'Walk drydock', boat_id: 'b6', type: 'drydock', vendor: 'Walk Yard', plan_from: D(1), plan_to: D(9), planned_budget: 50000, notes: '' });
console.log('   project:', pr && (pr.id || pr.message), 'phases:', JSON.stringify((pr.phases || []).map((x) => x.k)).slice(0, 200));
await reloadFleet();
await ev((id) => flProjStart(id), pr.id); await idle(); await settle(700);
let ps = await api('/v1/fleet/projects/' + pr.id);
chk('flProjStart -> POST .../start; server status no longer planned', ps.status && ps.status !== 'planned', { status: ps.status });
await reloadFleet();
s = await ev((id) => { const p = FL_PROJECTS.find((x) => x.id === id); return p && { phases: flProjPhasesFor(p).map((x) => x.k), idx: flProjCurrentPhaseIdx(p), health: flProjHealth(p), gate: flProjBillGate(p), cost: flProjCalcCost(id), days: flProjBillDays(p) }; }, pr.id);
ps = await api('/v1/fleet/projects/' + pr.id);
chk('screen phases / current phase / health / bill gate / cost equal the server', s && JSON.stringify(s.phases) === JSON.stringify(ps.phases.map((x) => x.k))  && s.idx === ps.phase_index && s.health && s.health.key === ps.health.key && s.health.score === ps.health.score && s.gate.ok === ps.bill_gate.ok && s.gate.cost === ps.bill_gate.cost && s.cost === ps.cost, { s, srv: { ph: ps.phase_index, health: ps.health, gate: ps.bill_gate, cost: ps.cost } });
const ph2 = (ps.phases || [])[Math.min(1, (ps.phases || []).length - 1)];
c1 = calls.length;
if (ph2) { await ev((a) => flProjSetPhase(a.id, a.k), { id: pr.id, k: ph2.k }); await idle(); await settle(500); }
ps = await api('/v1/fleet/projects/' + pr.id);
chk('flProjSetPhase -> PATCH .../projects/{id} {phase}; server phase = ' + (ph2 && (ph2.key || ph2.id)), ph2 && calls.slice(c1).includes('PATCH /v1/fleet/projects/' + pr.id) && ps.phase === ph2.k, { calls: calls.slice(c1), phase: ps.phase });
// close asks the bill dialog first (gate not ok: no invoice, no cost)
c1 = calls.length;
await ev((id) => flProjMarkComplete(id), pr.id); await settle(900);
let dlg = await ev(() => ({ host: document.getElementById('prj-bill-host').innerHTML.length, note: !!document.getElementById('prj-bill-note') }));
ps = await api('/v1/fleet/projects/' + pr.id);
chk('flProjMarkComplete with an open bill gate -> the legacy "close how?" dialog, no complete sent, project not completed', dlg.host > 0 && dlg.note && !calls.slice(c1).some((c) => /\/complete/.test(c)) && ps.status !== 'completed', { dlg, calls: calls.slice(c1), status: ps.status, gate: ps.bill_gate });
await ev(() => { flProjBillPick('wait'); document.getElementById('prj-bill-note').value = 'yard will invoice'; });
c1 = calls.length;
await ev(() => document.getElementById('prj-bill-go').click()); await idle(); await settle(900);
ps = await api('/v1/fleet/projects/' + pr.id);
chk('wait -> POST .../work-done; server status awaiting_bill, work_done_on set, bill_note kept', calls.slice(c1).includes('POST /v1/fleet/projects/' + pr.id + '/work-done') && ps.status === 'awaiting_bill' && ps.work_done_on && ps.bill_note === 'yard will invoice', { calls: calls.slice(c1), status: ps.status, wd: ps.work_done_on, note: ps.bill_note });
await reloadFleet();
await ev((id) => flProjBillClose(id), pr.id); await settle(900);
dlg = await ev(() => !!document.getElementById('prj-bill-note'));
await ev(() => { flProjBillPick('nocost'); document.getElementById('prj-bill-note').value = ''; });
const dn7 = dialogs.length; c1 = calls.length;
await ev(() => document.getElementById('prj-bill-go').click()); await settle(400);
const noReason = dialogs.slice(dn7).some((d) => /alert/.test(d)) && !calls.slice(c1).some((c) => /\/complete/.test(c));
await ev(() => { document.getElementById('prj-bill-note').value = 'covered by insurance'; });
await ev(() => document.getElementById('prj-bill-go').click()); await idle(); await settle(1000);
ps = await api('/v1/fleet/projects/' + pr.id);
chk('close dialog again from awaiting_bill; 0 baht without a reason refused on screen; with a reason -> POST complete {no_cost_reason}; server completed', dlg && noReason && ps.status === 'completed' && bodies.some((b) => b[0] === 'POST /v1/fleet/projects/' + pr.id + '/complete' && /covered by insurance/.test(b[1])), { dlg, noReason, status: ps.status, noCost: ps.no_cost, bodies: bodies.slice(-3) });

item(8, 'job start · gear dialog keep / stash / swap');
const gearDlg = async (jid) => {
  await reloadFleet();
  c1 = calls.length; b1 = bodies.length;
  await ev((id) => flMaintStart(id), jid); await settle(500);
  return await ev(() => document.getElementById('fl-modal-start-gear').classList.contains('open'));
};
const startBody = (jid) => { const b = bodies.slice(b1).find((x) => x[0] === 'POST /v1/fleet/jobs/' + jid + '/start'); return b ? JSON.parse(b[1] || '{}') : null; };
const gbtn = (name) => `#fl-modal-start-gear button[onclick="${name}"]`;
const jK = jobId(await mkJob('b7', 'Walk keep', RK.e.id));
let open = await gearDlg(jK);
await ev((q) => document.querySelector(q).click(), gbtn("flStartGearChoice('keep')")); await idle(); await settle(900);
let gk = await api('/v1/fleet/gearboxes/' + RK.g.id), jk = await api('/v1/fleet/jobs/' + jK);
chk('keep: dialog asked; POST .../start {gear:keep}; job in progress; gearbox still on its engine', open && (startBody(jK) || {}).gear === 'keep' && jk.status === 'inprogress' && gk.engine_id === RK.e.id, { open, body: startBody(jK), st: jk.status, gk: gk.engine_id, jk: jk.message });
const jS = jobId(await mkJob('b1', 'Walk stash', RS.e.id));
open = await gearDlg(jS);
await ev((q) => { document.getElementById('fl-sg-loc').selectedIndex = 1; document.querySelector(q).click(); }, gbtn("flStartGearChoice('stash')")); await idle(); await settle(900);
let gs = await api('/v1/fleet/gearboxes/' + RS.g.id), ps2 = await api('/v1/fleet/propellers/' + RS.p.id);
const sb8 = startBody(jS) || {};
chk('stash: POST .../start {gear:stash, stash_location}; gearbox and propeller are spares, off the engine', open && sb8.gear === 'stash' && !!sb8.stash_location && gs.status === 'spare' && !gs.engine_id && ps2.status === 'spare', { open, sb8, gs: gs && { st: gs.status, eng: gs.engine_id, loc: gs.spare_location }, p: ps2 && ps2.status });
const jW = jobId(await mkJob('b13', 'Walk swap', RW.e.id));
open = await gearDlg(jW);
await ev((q) => document.querySelector(q).click(), gbtn('flStartGearSwap()')); await idle(); await settle(900);
const pick = await ev(() => { const s = document.getElementById('fl-sg-neweng'); return s ? [...s.options].map((o) => o.value) : null; });
await ev((id) => { const s = document.getElementById('fl-sg-neweng'); if (s) s.value = id; }, spareEng.id);
let jw = await api('/v1/fleet/jobs/' + jW), ew = await api('/v1/fleet/engines/' + RW.e.id);
chk('swap: POST .../start {gear:swap}; old engine off the boat; picker shown', open && (startBody(jW) || {}).gear === 'swap' && jw.status === 'inprogress' && !ew.boat_id && !!pick, { open, body: startBody(jW), st: jw.status, oldBoat: ew.boat_id, pick });
c1 = calls.length;
await ev(() => document.querySelector('#fl-sg-stage2 button[onclick="flStartSwapInstall()"]').click()); await idle(); await settle(900);
let es = await api('/v1/fleet/engines/' + spareEng.id), gw = await api('/v1/fleet/gearboxes/' + RW.g.id);
chk('swap install: POST engines/{spare}/install; spare engine is now on b13', calls.slice(c1).some((c) => c === 'POST /v1/fleet/engines/' + spareEng.id + '/install') && es.boat_id === 'b13', { calls: calls.slice(c1), es: es && { boat: es.boat_id, pos: es.pos }, gw: gw && { eng: gw.engine_id } });
const RX = await rig('b6', 'SKIP', 'Std');
const jX = jobId(await mkJob('b6', 'Walk swap skip', RX.e.id));
open = await gearDlg(jX);
await ev((q) => document.querySelector(q).click(), gbtn('flStartGearSwap()')); await idle(); await settle(900);
c1 = calls.length;
await ev(() => { const l = document.getElementById('fl-sg-engloc'); if (l) l.selectedIndex = 1; document.querySelector('#fl-sg-stage2 button[onclick="flStartSwapSkip()"]').click(); }); await idle(); await settle(900);
let ex = await api('/v1/fleet/engines/' + RX.e.id);
chk('swap skip: no install; PATCH engines/{old} spare_location; dialog closed', !calls.slice(c1).some((c) => /install/.test(c)) && calls.slice(c1).some((c) => c === 'PATCH /v1/fleet/engines/' + RX.e.id) && !!ex.spare_location && !(await ev(() => document.getElementById('fl-modal-start-gear').classList.contains('open'))), { calls: calls.slice(c1), loc: ex.spare_location, boat: ex.boat_id });

item(9, 'quick swap on an incident · propeller cascade');
const RQ = await rig('b6', 'QSW', 'Center');
const spareGb = await post('/v1/fleet/gearboxes', { brand: 'ZF', model: 'ZF-QSW', serial: 'G-QSW-SPARE', base_hours: 5, service_interval: 100, status: 'spare', spare_location: 'pier:tublamu' });
const sparePr = await post('/v1/fleet/propellers', { brand: 'Michigan', serial: 'P-SPARE', diameter: 20, pitch: 24, blades: 3, material: 'Stainless', rotation: 'Standard', cupping: 'no', status: 'spare', spare_location: 'pier:tublamu' });
const inc1 = await post('/v1/fleet/incidents', { no: 'INC-901', boat_id: 'b6', date: day(0), title: 'Walk gearbox', priority: 3, damaged_assets: [{ type: 'gearbox', asset_id: RQ.g.id }] });
console.log('   seeds:', JSON.stringify({ spareGb: spareGb.id || spareGb.message, sparePr: sparePr.id || sparePr.message, inc1: inc1.id || inc1.message }));
await reloadFleet();
c1 = calls.length; b1 = bodies.length;
await ev((a) => flOpenSwapModal(a.i, 'gearbox', a.g), { i: inc1.id, g: RQ.g.id }); await settle(400);
await ev((id) => flConfirmSwap(id), spareGb.id); await settle(700);
const casc = await ev(() => document.getElementById('fl-modal-prop-cascade').classList.contains('open'));
const radios = await ev(() => [...document.querySelectorAll('input[name^="cascade-"]')].map((r) => r.name + '=' + r.value));
await ev((pid) => { const r = document.querySelector('input[name="cascade-' + pid + '"][value="stock"]'); if (r) r.checked = true; flConfirmPropCascade(); }, RQ.p.id); await idle(); await settle(1000);
const swb = bodies.slice(b1).find((x) => x[0] === 'POST /v1/fleet/incidents/' + inc1.id + '/swap');
const sw = swb ? JSON.parse(swb[1]) : null;
let g1 = await api('/v1/fleet/gearboxes/' + RQ.g.id), g2 = await api('/v1/fleet/gearboxes/' + spareGb.id), p1 = await api('/v1/fleet/propellers/' + RQ.p.id);
chk('gearbox swap: cascade dialog asked; ONE POST .../swap {spare_id, propellers:[..]}; spare gearbox on the engine, old one out', casc && sw && sw.spare_id === spareGb.id && Array.isArray(sw.propellers) && sw.propellers.length === 1 && g2.engine_id === RQ.e.id && g1.engine_id !== RQ.e.id, { casc, radios, sw, g2: g2 && g2.engine_id, g1: g1 && g1.engine_id, p1: p1 && { st: p1.status, gb: p1.gearbox_id } });
chk('propeller chosen "stock" is a spare off the gearbox on the server', p1 && p1.status === 'spare' && !p1.gearbox_id, p1 && { st: p1.status, gb: p1.gearbox_id, loc: p1.spare_location });
const RQ2 = await rig('b6', 'QSW2', 'C.Port');
const inc2 = await post('/v1/fleet/incidents', { no: 'INC-902', boat_id: 'b6', date: day(0), title: 'Walk propeller', priority: 3, damaged_assets: [{ type: 'propeller', asset_id: RQ2.p.id }] });
await reloadFleet();
c1 = calls.length;
await ev((a) => flOpenSwapModal(a.i, 'propeller', a.p), { i: inc2.id, p: RQ2.p.id }); await settle(400);
await ev((id) => flConfirmSwap(id), sparePr.id); await idle(); await settle(1000);
let pa = await api('/v1/fleet/propellers/' + sparePr.id), pb = await api('/v1/fleet/propellers/' + RQ2.p.id);
chk('quick propeller swap: ONE POST .../swap; spare propeller now on the gearbox', calls.slice(c1).filter((c) => /incidents\/.*\/swap/.test(c)).length === 1 && pa.gearbox_id === RQ2.g.id && pb.gearbox_id !== RQ2.g.id, { calls: calls.slice(c1), pa: pa && pa.gearbox_id, pb: pb && pb.gearbox_id });

item(10, 'safety replace wizard (labour) · safety state / shortfall · boat documents · inventory by pier · assign-engine info');
const cats = (await api('/v1/fleet/safety-categories')).categories.map((c) => c.id);
const sfBody = (o) => Object.assign({ boat_id: 'b7', qty: 1, status: 'active', install_date: D(-100), brand: 'Acme', model: 'A1', serial: null, next_pm: null, last_inspect: null, location: null, note: null }, o);
const sfExp = await post('/v1/fleet/safety', sfBody({ category: 'fire_ext', name: 'Walk extinguisher', expiry_date: D(-10) }));
const sfOk = await post('/v1/fleet/safety', sfBody({ category: 'flare', name: 'Walk flare', expiry_date: D(300) }));
const sfLj = await post('/v1/fleet/safety', sfBody({ category: 'life_jacket', name: 'Walk lifejackets', qty: 5, expiry_date: D(300) }));
await reloadFleet();
const sfSrv = (await api('/v1/fleet/safety?boat_id=b7')).items || (await api('/v1/fleet/safety?boat_id=b7')).safety || [];
s = await ev((ids) => ids.map((id) => { const it = FL_SAFETY.find((x) => x.id === id); return it && { id, label: _flSafetyStatus(it).label, sf: it.lifeJacketShortfall }; }), [sfExp.id, sfOk.id, sfLj.id]);
const one = async (id) => api('/v1/fleet/safety/' + id);
const sv = [await one(sfExp.id), await one(sfOk.id), await one(sfLj.id)];
console.log('   safety screen:', JSON.stringify(s), ' server state:', JSON.stringify(sv.map((x) => x.state)), ' lj shortfall:', JSON.stringify(sv[2].life_jacket_shortfall));
chk('safety state on screen = the server\'s state (EXPIRED / OK)', s[0] && s[0].label === 'EXPIRED' && sv[0].state && sv[0].state.label === 'EXPIRED' && s[1] && /^OK/.test(s[1].label) && /^OK/.test(sv[1].state.label), { s, srv: sv.map((x) => x.state) });
chk('life-jacket shortfall on screen = the server\'s (5 jackets vs licence 45 + crew 3)', JSON.stringify(s[2] && s[2].sf) === JSON.stringify(sv[2].life_jacket_shortfall || null), { screen: s[2], srv: sv[2].life_jacket_shortfall });
// replace wizard: buy, with labour 300
await ev((id) => { swapDocOpen(id); swapDocSet('reason', 'broken'); swapDocSet('description', 'walk test'); swapDocSet('source', 'buy'); swapDocSet('newBrand', 'NewCo'); swapDocSet('newModel', 'N2'); swapDocSet('newPrice', 500); swapDocSet('supplier', 'Walk Supplier'); swapDocSet('newSerial', 'SER-WALK'); swapDocSet('newLabour', 300); swapDocSet('installer', 'Tech'); }, sfExp.id);
b1 = bodies.length; c1 = calls.length;
await ev(() => { const b = document.querySelector('button[onclick="swapDocExecute()"]'); if (!b) swapDocSetStep(3); }); await settle(300);
await ev(() => document.querySelector('button[onclick="swapDocExecute()"]').click()); await idle(); await settle(1200);
const rb = bodies.slice(b1).find((x) => /\/safety\/.*\/replace/.test(x[0]));
const rbody = rb ? JSON.parse(rb[1]) : null;
const sfAfter = await one(sfExp.id);
const memosNow = (await api('/v1/fleet/memos')).memos;
const rm = memosNow.find((m) => /SER-WALK|Walk extinguisher|NewCo/.test(JSON.stringify(m)));
console.log('   replace body:', JSON.stringify(rbody), ' memo:', rm && JSON.stringify({ no: rm.no, amount: rm.amount, lines: (rm.lines || []).map((l) => [l.name, l.qty, l.price, l.category]) }));
chk('safety replace wizard sends the labour cost typed (labour: 300) and the old item is replaced on the server', rbody && rbody.labour === 300 && sfAfter.status === 'replaced', { rbody, status: sfAfter.status, calls: calls.slice(c1).filter((c) => /safety/.test(c)) });
const rjob = ((await api('/v1/fleet/jobs')).jobs || []).find((j) => j.no === 'MJ-905'); const lab = rjob && (rjob.parts || []).find((p) => p.name === 'ค่าแรง');
chk('server job MJ-905 carries the labour as a part (ค่าแรง 300), memo only the 500 part', lab && Number(lab.cost) === 300 && rm && rm.amount === 535, { lab, job: rjob && { no: rjob.no, cost: rjob.cost, parts: rjob.parts }, memo: rm && rm.amount });
// boat documents: status from the server
await pat('/v1/boats/b7', { documents: [{ name: 'Walk cert soon', expires_on: D(20) }, { name: 'Walk cert gone', expires_on: D(-5) }, { name: 'Walk cert fine', expires_on: D(400) }] });
await ev(() => laOps.fleetBoats.refetchBoat('b7').then(() => laOps.fleetBoats.load())); await settle(600);
const docsSrv = (await api('/v1/boats/b7/documents'));
const dlist = docsSrv.documents || docsSrv.docs || [];
s = await ev(() => (getBoat('b7').docs || []).map((d) => ({ name: d.name, st: flDocStatus(d) })));
const byName = (arr, f) => Object.fromEntries(arr.map((d) => [d.name, f(d)]));
const srvSt = byName(dlist, (d) => d.status), scrSt = byName(s, (d) => d.st);
console.log('   docs server:', JSON.stringify(srvSt), ' screen:', JSON.stringify(scrSt));
chk('boat documents: screen status per document = the server\'s (warn / exp / ok)', dlist.length >= 3 && Object.keys(srvSt).every((k) => scrSt[k] === srvSt[k]) && srvSt['Walk cert gone'] === 'exp', { srvSt, scrSt });
// inventory by pier warehouse (wiring commit ac6c596b) and assign-engine info (547529ff): are they on this build?
const invMark = await ev(() => String(window.faInvAt || '').indexOf('s.warehouse') >= 0 || String(window.faInvRows || '').indexOf('warehouse') >= 0);
const asnMark = await ev(() => String(window.flAssignEngInfo || window.flOpenAssignEng || '').indexOf('_fromOpsBackend') >= 0);
console.log('   inventory-by-pier wiring present:', invMark, ' assign-engine wiring present:', asnMark);
chk('inventory by pier uses the server warehouse key (faInvRows / faInvAt)', invMark, { invMark });
chk('assign-engine info shows the server\'s next service (flEngServiceState)', asnMark, { asnMark });

item(11, 'job board silent / blocks / lane · consumable cost · repair cost per month · boat bookings pax');
await reloadFleet();
const jobsSrv = (await api('/v1/fleet/jobs')).jobs;
await pat('/v1/fleet/jobs/' + jK, { board_lane: 'wait' });
await reloadFleet();
const jobsSrv2 = (await api('/v1/fleet/jobs')).jobs;
s = await ev(() => FL_MAINT.filter((m) => m._fromOpsBackend).map((m) => ({ id: m.id, silent: flBoardSilent(m), blocks: flBoardBlocks(m), lane: flBoardLane(m) })));
const cmp = s.map((x) => { const j = jobsSrv2.find((y) => y.id === x.id); return j && x.silent === j.silent_days && x.blocks === !!j.blocks_boat && x.lane === j.lane; });
console.log('   board rows:', s.length, ' server sample:', JSON.stringify(jobsSrv2.slice(0, 3).map((j) => [j.no, j.silent_days, j.blocks_boat, j.lane, j.board_lane])));
chk('job board: silent days / blocks boat / lane on screen = the server\'s for every job (' + s.length + ')', s.length >= 4 && cmp.every(Boolean), { s: s.slice(0, 6), srv: jobsSrv2.slice(0, 6).map((j) => [j.id, j.silent_days, j.blocks_boat, j.lane]) });
const laneJ = s.find((x) => x.id === jK);
chk('a lane set on the server (board_lane wait) is the lane shown', laneJ && jobsSrv2.find((y) => y.id === jK).lane === laneJ.lane, { laneJ, srv: jobsSrv2.find((y) => y.id === jK).lane });
const inv = await post('/v1/fleet/stock-items', { name: 'Walk oil', category: 'general', unit: 'L', min_qty: 0, cost: 50, qty: 20, warehouse: 'tublamu' });
const cons = await post('/v1/fleet/consumables', { item_id: inv.id, warehouse: 'tublamu', qty: 3, boat_id: 'b7', date: day(0) });
await ev(() => laOps.fleetStock.refetch()); await settle(500);
const invPier = await ev(() => ({ tub: faInvAt('pier:tublamu').filter((r) => r.it.name === 'Walk oil').length, pan: faInvAt('pier:panwa').filter((r) => r.it.name === 'Walk oil').length }));
chk('inventory by pier: stock held in warehouse tublamu is listed under pier:tublamu and not pier:panwa', invPier.tub >= 1 && invPier.pan === 0, invPier);
s = await ev(() => FL_CONSUMABLE_LOGS.map((r) => ({ id: r.id, cost: flConsumeCostOf(r) })));
const cr = s.find((x) => x.id === cons.id);
chk('consumable cost on screen = the server\'s cost (3 x 50 = 150)', cons.id && cr && cr.cost === Math.round(cons.cost) && cons.cost === 150, { cons: cons.cost || cons.message, cr, n: s.length });
// repair cost per month: a part on a job, then close it
jobSeq = 950; const jRep = jobId(await mkJob('b7', 'Walk repair cost', null, { create_anyway: true }));
await post('/v1/fleet/jobs/' + jRep + '/start', {});
const part = await post('/v1/fleet/jobs/' + jRep + '/parts', { item_id: inv.id, warehouse: 'tublamu', qty: 2 });
const closed = await post('/v1/fleet/jobs/' + jRep + '/close', { outcome: 'success', note: 'done' });
const ym = day(0).slice(0, 7);
const up = await api('/v1/fleet/reports/upkeep?month=' + ym);
const upRow = (up.boats || []).find((b) => b.boat_id === 'b7');
await ev(() => laOps.wrote('walk-test')); await ev((m) => { flBoatRepairCostMonth('b7', m); }, ym); const first7 = await ev((m) => flBoatRepairCostMonth('b7', m), ym);
await waitFor((a) => flBoatRepairCostMonth('b7', a.m) === a.v, { m: ym, v: Math.round(upRow.repairs) }, 8000);
const rc7 = await ev((m) => flBoatRepairCostMonth('b7', m), ym); console.log('   first draw (browser figure):', first7);
console.log('   upkeep b7:', JSON.stringify(upRow && { repairs: upRow.repairs }), ' screen:', rc7, ' part:', part.message || 'ok', ' close:', closed.message || closed.status);
chk('repair cost for the month on screen = the server\'s upkeep report (b7 repairs)', upRow && rc7 === Math.round(upRow.repairs), { upRow: upRow && upRow.repairs, rc7 });
// pax booked on a boat that day
const dep2 = await post('/operations/deployments', { boat_id: wid, route_id: 'r5', service_date: TD, capacity: 8 }); console.log('   deployment today:', JSON.stringify(dep2).slice(0, 250));
const bk2 = await post('/v1/bookings', { external_id: 'zz-walk-2', intent: 'confirm', agentId: 'a01', leadPax: 'ZZ WALK PAX', pickupSelf: true, trips: [{ routeId: 'r5', date: TD, pax: { ad_fr: 3 }, zone: 'NoTransfer' }] });
const aa2 = await post('/operations/deployments/' + TD + '/auto-assign', { route_id: 'r5' }); console.log('   auto-assign:', JSON.stringify(aa2).slice(0, 300));
await ev(() => { if (laOps.fleetDaily && laOps.fleetDaily.loadWindow) return laOps.fleetDaily.loadWindow(); return laOps.fleetDaily.load(true); }); await reloadFleet();
const dlg2 = await api('/v1/fleet/daily-log?from=' + TD + '&to=' + TD);
const brow = ((dlg2.days || [])[0] || { boats: [] }).boats.find((b) => b.boat_id === wid);
s = await ev((a) => { const r = flBoatBookingsFor(a.b, a.d); return r && r.pax; }, { b: wid, d: TD });
console.log('   booking:', JSON.stringify(bk2).slice(0, 200)); console.log('   pax booked server:', brow && brow.pax_booked, ' screen:', s, ' booking:', bk2.id || bk2.message);
chk('flBoatBookingsFor pax = the server\'s pax_booked for that boat-day (3)', brow && brow.pax_booked === 3 && s === 3, { server: brow && brow.pax_booked, screen: s });
//__END__
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
console.log('\npage errors: ' + errors.length + '\n  ' + errors.slice(0, 10).join('\n  '));
console.log('\nSUMMARY');
for (const n of Object.keys(findings)) { const f = findings[n]; console.log(` item ${n}: ${f.filter((x) => x[1]).length}/${f.length} ok` + f.filter((x) => !x[1]).map((x) => '\n     FAIL ' + x[0]).join('')); }
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
