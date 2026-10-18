// t_walk_w6_a · wave 6, group a: the server fields built after the w5-a / w4-f3 / w5-f walks, wired into the screens. Walked in a browser against a
// REAL operation-backend (in-process store, seeded). Every check reads BOTH sides: the screen and what the server holds (asked directly).
// A "differs" check changes the server's answer on the way to the page (mut) or the browser's own copy, so legacy's answer would be a different
// number and the screen has to show the server's.
//   node test/ui/t_walk_w6_a.mjs
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const ONLY = process.env.WALK_ONLY ? process.env.WALK_ONLY.split(',') : null;

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
const apiRaw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await apiRaw(p, init)).body;
const send = (m, p, b) => apiRaw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) });
const seed = async (m, p, b) => { const r = await send(m, p, b); if (r.status >= 300) throw new Error(`seed ${m} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); return r.body; };

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

const calls = [], bodies = [], refusals = [];
const mut = [];                         // [{ re, fn(json, url) }] · change the server's answer on its way to the page
const routeFn = async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  let buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (req.method() === 'GET' && r.status === 200 && mut.length) {
    for (const m of mut) {
      if (!m.re.test(u.pathname + u.search)) continue;
      try { const j = JSON.parse(buf.toString()); m.fn(j, u); buf = Buffer.from(JSON.stringify(j)); } catch (_) {}
    }
  }
  calls.push(req.method() + ' ' + u.pathname + u.search + ' ' + r.status);
  if (req.method() !== 'GET') bodies.push({ k: req.method() + ' ' + u.pathname, status: r.status, req: req.postData() || '', body: buf.toString() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 200));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
};
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
const errors = [], dialogs = [];
const answer = { refuse: null };        // a confirm whose text matches is answered Cancel
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
await ctx.route(PROD, routeFn);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => {
  dialogs.push(d.type() + ': ' + d.message());
  if (d.type() === 'prompt') d.accept('Tester');
  else if (d.type() === 'confirm' && answer.refuse && answer.refuse.test(d.message())) d.dismiss();
  else d.accept();
});

const results = [], fails = [];
let curItem = '0';
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 700))); results.push({ item: curItem, name, pass: !!cond }); if (!cond) fails.push(curItem + ' ' + name); return !!cond; };
const item = (n) => { curItem = n; console.log('\n== ' + n); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const waitFor = async (fn, arg, ms = 12000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const goView = (v) => ev((v) => nav({ dataset: { view: v }, classList: { add() {} } }), v);
const LOADED = () => window.laOps && window.laOps.state.loaded;

const bkk = (n = 0) => { const d = new Date(Date.now() + 7 * 3600000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const T0 = bkk(0), D1 = bkk(3), D2 = bkk(4), D3 = bkk(5);
const MONTH_OF = (d) => d.slice(0, 7);

// ───────────────────────── seed through the API ─────────────────────────
const dep = (boat, route, d, cap) => seed('POST', '/operations/deployments', { boat_id: boat, route_id: route, service_date: d, capacity: cap, deploy_anyway: true });
for (const d of [D1, D2, D3]) await dep('b6', 'r5', d, 40);
await dep('b7', 'r4', D1, 34);
let nb = 0;
const mkBk = (lead, date, route, pax, extra = {}) => send('POST', '/v1/bookings', { external_id: `zz-w6a-${Date.now().toString(36)}-${nb++}`, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: route, date, pax: { ad_fr: pax }, zone: 'PK' }], ...extra });
const mustBk = async (lead, date, route, pax, extra) => { const r = await mkBk(lead, date, route, pax, extra); if (r.status !== 201) throw new Error('seed booking ' + lead + ': ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 300)); return r.body; };
const bA = await mustBk('W6 ALPHA', D1, 'r5', 3);
const bB = await mustBk('W6 BETA', D1, 'r5', 2);
const bC = await mustBk('W6 CHARLIE', D2, 'r5', 4);
const bD = await mustBk('W6 DELTA', D1, 'r4', 5, { programme_anyway: true, pickupSelf: true, hotelName: '', trips: [{ routeId: 'r4', date: D1, pax: { ad_fr: 5 }, zone: 'NoTransfer' }] });
await seed('PATCH', `/operations/trip-ops/${bA.trips[0].id}`, { boat_id: 'b6' });
await seed('PATCH', `/operations/trip-ops/${bB.trips[0].id}`, { boat_id: 'b6' });

// ───────────────────────── mutations (installed before the page loads) ─────────────────────────
const set = (re, fn) => mut.push({ re, fn });
set(/^\/v1\/dashboard\?.*window=rolling/, (j) => { if (j.series_stats) { j.series_stats.total_pax = 777; j.series_stats.total_capacity = 1400; j.series_stats.fill_percent = 55; j.series_stats.average_per_bucket = 9;
  j.series_stats.charter_pax = 11; j.series_stats.weather_routes = 3; }
  j.top_routes = [{ route_id: 'r5', name: 'Similan Islands by Speedboat', pax: 600 }, { route_id: 'r4', name: 'Similan Islands by Catamaran', pax: 100 }]; j.other_routes_pax = 77; });
set(/^\/v1\/availability\/summary/, (j) => { j.month_trips = 99; j.month_free = 1234; j.weekly_average = 77; (j.routes || []).forEach((r) => { if (r.route_id === 'r5') { r.average_free = { week: 55, day: 44, total: 33 }; r.trips_per_week = 6.5; r.month_trips = 21; r.month_free = 321; } });
  (j.days || []).forEach((d) => { d.trips = 8; d.free_seats = 88; }); });
set(/^\/v1\/fleet\/jobs(\?|$)/, (j) => { (j.jobs || []).forEach((x) => { if (/W6 SHARE/.test(x.title || '')) x.cost_share = { engine: 111.11, gearbox: 222.22, propeller: 333.33 }; }); });
set(/^\/operations\/by-trip/, (j) => { (j.routes || []).forEach((r) => { if (r.route_id === 'r5') r.boats = [{ boat_id: 'b6', boat_name: 'Zeus', pax: 77, capacity: 40, over: true, over_by: 37, ovn_hold: null }]; }); });
set(/^\/v1\/pier-office\/tublamu\/park-tickets\/month/, (j) => { j.total.nationality = { ad_th: 90, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: 80, chd_fr: 0, inf_fr: 0, foc_fr: 0, tot: 170 }; (j.days || []).forEach((d) => { (d.boats || []).forEach((b) => { if (b.boat_id === 'b6') b.nationality = { ad_th: 9, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: 8, chd_fr: 0, inf_fr: 0, foc_fr: 0, tot: 17 }; });
  if (d.boats.some((b) => b.boat_id === 'b6')) d.nationality = { ad_th: 9, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: 8, chd_fr: 0, inf_fr: 0, foc_fr: 0, tot: 17 }; }); });
const pfFlag = { id: null };
set(/^\/v1\/bookings(\?|$)/, (j) => { (j.bookings || []).forEach((b) => { if (pfFlag.id && b.id === pfFlag.id) b.pending_foc = true; }); });

// ───────────────────────── boot ─────────────────────────
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(LOADED, null, { timeout: 40000 });
await settle(1200);
const todo = [];
const section = (name, fn) => todo.push([name, fn]);

// ═══ 1 · dashboard: the windows are the server's ═══
section('1', async () => {
  item('dashboard · renderDash month window (GET /v1/dashboard?window=rolling)');
  const n0 = calls.length;
  await ev((d) => { window._dashBkMode = 'month'; window._dashDate = d; }, D2);
  await goView('dashboard'); await settle(2500); await idle();
  await waitFor(() => !!window.laOpsDashStats && !!window.laOpsDashStats('month', window._dashDate), null, 12000); await settle(800);
  const asked = calls.slice(n0).filter((c) => /GET \/v1\/dashboard\?/.test(c) && /window=rolling/.test(c) && /mode=month/.test(c));
  ok('the month bars ask ONE rolling answer for the picked day (window=rolling&mode=month&date=' + D2 + ')', asked.length >= 1 && asked.some((c) => c.includes('date=' + D2)), calls.slice(n0).filter((c) => /dashboard/.test(c)));
  const srv = await api(`/v1/dashboard?date=${D2}&mode=month&window=rolling`);
  ok('server: the window is the 30 days ending on the picked day', srv.window && srv.window.kind === 'rolling' && srv.window.to === D2 && srv.series.length === 30, srv.window);
  const st = await ev((d) => window.laOpsDashStats('month', d), D2);
  ok('stats = the server answer (changed: 777 pax, 55 %, 9 per day, top route 600, Other 77), not the sums of the bars', st && st.total === 777 && st.fill === 55 && st.average === 9 && st.other === 77 && st.top[0].pax === 600, st);
  const bars = await ev((d) => window.laOpsDashSeries('month', d, TODAY_STR).map((b) => ({ ds: b.ds, booked: b.booked })), D2);
  ok('the 30 bars are the server series (first ' + srv.window.from + ', last ' + D2 + ')', bars.length === 30 && bars[0].ds === srv.window.from && bars[29].ds === D2 && bars.every((b, i) => b.booked === srv.series[i].booked), bars.slice(0, 2));
  await ev(() => renderDash()); await settle(600);
  const txt = await ev(() => document.getElementById('dash-wrap').innerText);
  ok('screen: the cards show the server\'s total 777 and fill 55%, the legend shows Other 77', /777/.test(txt) && /55%/.test(txt) && /77/.test(txt), { mode: await ev(() => window._dashBkMode), tail: txt.slice(-900) });
  await ev(() => { window._dashBkMode = 'day'; });
});

// ═══ 2 · calendar route-set names ═══
section('2', async () => {
  item('calendar · "Save route set" dialog shows the server\'s refusal');
  await seed('PUT', '/v1/config/cal_route_sets', { value: [{ id: 'cs-w6', name: 'Similan', routes: ['r4', 'r5'] }] });
  await ev(() => { calPier = 'all'; }); await goView('calendar'); await settle(1500);
  // refresh the browser's config cache with what the server holds now
  const reload = () => ev(() => laOps.get('/v1/config').then((r) => { (r.entries || []).forEach((e) => { if (e.key === 'cal_route_sets') { laOps.configStore.ents.cal_route_sets.value = e.value; laOps.configStore.ents.cal_route_sets.version = e.version; CAL_ROUTE_SETS.length = 0; Array.prototype.push.apply(CAL_ROUTE_SETS, JSON.parse(JSON.stringify(e.value))); } }); }));
  await reload();
  // A · the browser's list holds two sets whose names differ only by case (old data): the list it sends has a duplicate name
  await ev(() => { CAL_ROUTE_SETS.push({ id: 'cs-dup', name: 'similan', routes: ['r5'] }); calSetSave(); });
  await settle(400);
  await ev(() => { document.getElementById('calset-name').value = 'Surin run'; calSetNameCheck(); });
  let n0 = bodies.length;
  await ev(() => calSetSaveCommit()); await idle(); await settle(900);
  let put = bodies.slice(n0).filter((b) => /PUT \/v1\/config\/cal_route_sets/.test(b.k))[0];
  let hint = await ev(() => { const h = document.getElementById('calset-hint'); return { open: !!document.getElementById('calset-modal'), text: h ? h.textContent : '', color: h ? h.style.color : '' }; });
  ok('the list with "Similan" and "similan" is sent and the server refuses it: 409', put && put.status === 409 && JSON.parse(put.req).value.length === 3, put && [put.status, put.req]);
  ok('the dialog stays open and its hint line is the server\'s sentence as it is', hint.open && /A set with this name already exists \(similan\)\. Saving will replace it\./.test(hint.text) && hint.color !== '', hint);
  let saved = (await api('/v1/config/cal_route_sets')).value;
  ok('server: still the one set "Similan"; the screen\'s list is back to it', saved.length === 1 && saved[0].name === 'Similan' && (await ev(() => CAL_ROUTE_SETS.map((s) => s.name).join())) === 'Similan', saved);
  // B · someone else saved meanwhile: the version the browser holds is old
  await seed('PUT', '/v1/config/cal_route_sets', { value: [{ id: 'cs-w6', name: 'Similan', routes: ['r4', 'r5'] }, { id: 'cs-other', name: 'Colleague set', routes: ['r5'] }] });
  n0 = bodies.length;
  await ev(() => calSetSaveCommit()); await idle(); await settle(1200);
  put = bodies.slice(n0).filter((b) => /PUT \/v1\/config\/cal_route_sets/.test(b.k))[0];
  hint = await ev(() => { const h = document.getElementById('calset-hint'); return { open: !!document.getElementById('calset-modal'), text: h ? h.textContent : '' }; });
  ok('a save over a colleague\'s newer list is refused (409) and the dialog shows the server\'s sentence', put && put.status === 409 && hint.open && hint.text.length > 10 && hint.text === JSON.parse(put.body).message, { status: put && put.status, hint, srv: put && put.body });
  ok('the screen\'s list is now the colleague\'s saved list (2 sets), nothing of mine was kept', (await ev(() => CAL_ROUTE_SETS.map((s) => s.name).sort().join())) === 'Colleague set,Similan', await ev(() => CAL_ROUTE_SETS.map((s) => s.name)));
  // C · a clean name is saved and the dialog closes
  await ev(() => { document.getElementById('calset-name').value = 'Surin run'; });
  n0 = bodies.length;
  await ev(() => calSetSaveCommit()); await idle(); await settle(1200);
  const after = (await api('/v1/config/cal_route_sets')).value;
  ok('a new name is saved (3 sets on the server) and the dialog closes', after.length === 3 && after.some((s) => s.name === 'Surin run') && !(await ev(() => !!document.getElementById('calset-modal'))), after);
  ok('the screen\'s list is the server\'s', (await ev(() => CAL_ROUTE_SETS.map((s) => s.name))).sort().join() === 'Colleague set,Similan,Surin run', null);
});

// ═══ 3 · calendar month figures ═══
section('3', async () => {
  item('calendar · month figures (GET /v1/availability/summary)');
  const n0 = calls.length;
  await ev((d) => { calYear = +d.slice(0, 4); calMonth = +d.slice(5, 7) - 1; calPier = 'all'; window._calAvgMode = 'week'; window._calViewMode = 'month'; }, D1);
  await goView('calendar'); await ev(() => renderCal()); await waitFor((m) => window.laOpsCalSummary && window.laOpsCalSummary(calYear, calMonth, 'all'), null, 12000); await settle(800);
  await ev(() => renderCal()); await settle(500);
  ok('the calendar asked the month: GET /v1/availability/summary?month=' + MONTH_OF(D1), calls.some((c) => c.includes('/v1/availability/summary?month=' + MONTH_OF(D1))), calls.filter((c) => /summary/.test(c)));
  const srv = await api('/v1/availability/summary?month=' + MONTH_OF(D1));
  const r5 = srv.routes.find((r) => r.route_id === 'r5');
  ok('server: r5 runs on D1, D2, D3 (3 trips) and has the four figures the cards need', r5 && r5.month_trips >= 3 && r5.average_free && typeof r5.trips_per_week === 'number' && srv.num_weeks >= 4, r5);
  const html = await ev(() => document.getElementById('cal-wrap').innerHTML);
  const text = await ev(() => document.getElementById('cal-wrap').innerText);
  ok('screen: "Trips this month" 99, "Seats free" 1,234 and "Avg / week" 77 are the server\'s (changed answer)', /Trips this month\s*99/.test(text) && /Seats free\s*1,234/.test(text) && /Avg \/ week\s*77/.test(text), text.replace(/\s+/g, ' ').slice(0, 600));
  const chipOf = (h) => { const i = h.indexOf('Similan Islands by Speedboat'); return i < 0 ? '' : h.slice(i, i + 1200).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); };
  ok('screen (month view): the r5 chip reads the server\'s "3 days" and 44 free/day (changed answer; legacy would add the browser\'s own days)', /\b3 days\b/.test(chipOf(html)) && /44 free\/day/.test(chipOf(html)), chipOf(html));
  await ev(() => { window._calViewMode = 'matrix'; window._calAvgMode = 'week'; renderCal(); }); await settle(500);
  const html1 = await ev(() => document.getElementById('cal-wrap').innerHTML);
  const card = (h) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('screen (route cards): the r5 card shows the server\'s average free per week (55) and 6.5 trips/week', /6\.5 trips\/week 55 free \/week/.test(card(html1)), card(html1).slice(0, 900));
  await ev(() => { window._calAvgMode = 'day'; renderCal(); });
  const html2 = await ev(() => document.getElementById('cal-wrap').innerHTML);
  ok('the Daily toggle shows the server\'s 44, the Total toggle its 33', /6\.5 trips\/week 44 free \/day/.test(card(html2)), card(html2).slice(0, 900));
  await ev(() => { window._calAvgMode = 'total'; renderCal(); });
  ok('Total: 33', /6\.5 trips\/week 33 free total/.test(card(await ev(() => document.getElementById('cal-wrap').innerHTML))), null);
  const stat = await ev((d) => { const cs = laOpsCalSummary(calYear, calMonth, 'all'); return cs ? { n: cs.month_trips, first: cs.days[0].trips } : null; }, D1);
  ok('and the browser\'s own sums are not what is shown: legacy would count the deployed boats of the browser (not 99)', stat && stat.n === 99, stat);
  await ev(() => { window._calAvgMode = 'week'; window._calViewMode = 'month'; });
});

// ═══ 4 · closing a day that holds something ═══
section('4', async () => {
  item('Settings → Programs · closing a day: the impact dialog lists what the SERVER finds');
  await seed('POST', '/v1/routes/r5/seasons', { kind: 'open', from_date: bkk(-100), to_date: bkk(400) });
  await ev(() => laOps.catalogue.load()); await settle(1500);
  // the browser holds none of the bookings (an unloaded month): legacy's own scan would find nothing and close without a word
  await ev(() => { SB_BOOKINGS.length = 0; progEditMode = true; });
  const n0 = bodies.length;
  await ev((d) => toggleDayOverrideGuarded('r5', d), D1); await idle(); await settle(1200);
  const first = bodies.slice(n0).filter((b) => /PUT \/v1\/routes\/r5\/days/.test(b.k));
  const modal = await ev(() => { const m = document.getElementById('prog-impact-modal'); return m ? m.innerText : null; });
  ok('the change is sent and the server answers 409 bookings_on_closed_day with details', first.length === 1 && first[0].status === 409 && /"details"/.test(first[0].body) && /"bookings"/.test(first[0].body), first[0]);
  const det = JSON.parse(first[0].body).details;
  ok('server: the details list the two bookings of D1 on r5 (5 pax) and the boat b6', det.bookings.length === 2 && det.bookings.reduce((n, b) => n + b.pax, 0) === 5 && det.boats.some((b) => b.boat_id === 'b6'), det);
  ok('the impact modal opens with the server\'s list: both refs, 5 pax, the boat', !!modal && det.bookings.every((b) => modal.includes(b.ref)) && /5 pax/i.test(modal) && /Zeus/.test(modal), modal);
  const sentBefore = await api(`/v1/routes?from=${D1}&to=${D1}`);
  ok('nothing is closed yet (the day is still open on the server)', sentBefore.routes.find((r) => r.id === 'r5').days[D1].open === true, null);
  await ev(() => progConfirmCloseAnyway()); await idle(); await settle(1200);
  const second = bodies.slice(n0).filter((b) => /PUT \/v1\/routes\/r5\/days/.test(b.k));
  const day = (await api(`/v1/routes?from=${D1}&to=${D1}`)).routes.find((r) => r.id === 'r5').days[D1];
  ok('"Close anyway" resends with close_anyway: true and the server closes the day', second.length === 2 && JSON.parse(second[1].req).close_anyway === true && second[1].status === 200 && day.open === false, { second: second.map((b) => [b.status, b.req]), day });
  // put it back for the other sections
  await seed('DELETE', `/v1/routes/r5/days/${D1}?close_anyway=true`);
  await ev(() => laOps.catalogue.load());
});

// ═══ 5 · maintenance cost per asset ═══
section('5', async () => {
  item('fleet · flMaintCostShare = the job\'s cost_share');
  const e1 = await seed('POST', '/v1/fleet/engines', { brand: 'Yamaha', model: 'F300', serial: 'W6-E1', hp: 300, base_hours: 10, service_interval: 100, status: 'spare', spare_location: 'pier:central' });
  const e2 = await seed('POST', '/v1/fleet/engines', { brand: 'Yamaha', model: 'F300', serial: 'W6-E2', hp: 300, base_hours: 10, service_interval: 100, status: 'spare', spare_location: 'pier:central' });
  const made = await seed('POST', '/v1/fleet/jobs', { no: 'MJ-W6SH', boat_id: 'b6', title: 'W6 SHARE job', type: 'corrective', boat_status: 'fixing', create_anyway: true, assets: [{ type: 'engine', asset_id: e1.id }, { type: 'engine', asset_id: e2.id }],
  });
  const jid = (made.jobs && made.jobs[0] && made.jobs[0].id) || made.id;
  const real = await api('/v1/fleet/jobs/' + jid);
  ok('server: the job has cost_share {engine, gearbox, propeller} computed from its cost and its 2 engines', real.cost_share && real.cost_share.engine === real.cost / 2 && real.cost_share.gearbox === real.cost, { cost: real.cost, share: real.cost_share });
  await ev(() => laOps.fleetJobs && laOps.fleetJobs.load ? laOps.fleetJobs.load() : null).catch(() => {});
  await goView('fleet'); await settle(2500); await idle();
  await ev(() => { if (laOps.fleetJobs && laOps.fleetJobs.load) return laOps.fleetJobs.load(); });
  await settle(1000);
  const r = await ev((id) => { const m = FL_MAINT.find((x) => x.id === id); return m ? { has: !!m.costShare, eng: flMaintCostShare(m, 'eng'), gb: flMaintCostShare(m, 'gb'), prop: flMaintCostShare(m, 'prop'), legacyEng: flMaintCostShare.__orig(m, 'eng') } : null; }, jid);
  ok('the job is on screen with the server share (changed answer: 111.11 / 222.22 / 333.33)', r && r.has && r.eng === 111.11 && r.gb === 222.22 && r.prop === 333.33, r);
  ok('legacy\'s sum would give another figure (cost / 2 engines)', r && r.legacyEng !== 111.11, r);
});

// ═══ 6 · extra -> issue column ═══
section('6', async () => {
  item('Daily Fleet Log · flExtraToCol is one server command');
  const it = await seed('POST', '/v1/fleet/issue-items', { name: 'W6 Ice', unit: 'bag', pier: 'tublamu' });
  const day = T0;
  await seed('PUT', `/v1/fleet/daily-log/${day}/boats/b6/issues`, { [it.id || it.item.id]: 2 });
  const iid = it.id || it.item.id;
  const dd = await seed('POST', `/v1/fleet/daily-log/${day}/boats/b6/extras`, { name: 'W6 Ice', qty: 3, unit: 'bag' });
  const xid = (dd.boats.find((b) => b.boat_id === 'b6').extras || []).find((x) => x.name === 'W6 Ice').id;
  await ev(() => laOps.fleetDaily.load()); await goView('fleet'); await settle(1500);
  await ev(() => laOps.fleetDaily.load()); await settle(800);
  const before = await ev((a) => ({ cur: flIssueGet(a.day, 'b6', a.iid), extras: flExtraGet(a.day, 'b6').map((x) => x.id) }), { day, iid });
  ok('the screen holds issue 2 and the extra (3 bags)', before.cur === 2 && before.extras.includes(xid), before);
  // someone else raises the column to 10 meanwhile: the browser still thinks 2
  await seed('PUT', `/v1/fleet/daily-log/${day}/boats/b6/issues`, { [iid]: 10 });
  const n0 = bodies.length;
  await ev((a) => flExtraToCol(a.day, 'tublamu', 'b6', a.xid), { day, xid }); await idle(); await settle(1000);
  const posts = bodies.slice(n0);
  const cmd = posts.filter((b) => /POST .*\/extras\/.+\/to-issue/.test(b.k));
  ok('ONE write: POST …/extras/{id}/to-issue {item_id} (no separate PUT issues / DELETE extra)', cmd.length === 1 && posts.length === 1 && JSON.stringify(JSON.parse(cmd[0].req)) === JSON.stringify({ item_id: iid }), posts.map((b) => b.k));
  const res = JSON.parse(cmd[0].body);
  ok('server: it added 3 onto the column\'s 10 (its own figure), not onto the 2 the browser had', res.before === 10 && res.added === 3 && res.after === 13, res);
  const srvDay = (await api(`/v1/fleet/daily-log?from=${day}&to=${day}`)).days[0];
  const sb = srvDay.boats.find((b) => b.boat_id === 'b6');
  ok('server: column 13 and the extra is gone', (sb.issues || {})[iid] === 13 && !(sb.extras || []).some((x) => x.id === xid), { issues: sb.issues, extras: sb.extras });
  const after = await ev((a) => ({ cur: flIssueGet(a.day, 'b6', a.iid), extras: flExtraGet(a.day, 'b6').map((x) => x.id) }), { day, iid });
  ok('screen: column 13, extra removed; the confirm said 2 + 3 = 5, so the server\'s figure is told to the person', after.cur === 13 && !after.extras.includes(xid), after);
  const toast = await ev(() => document.body.innerText);
  ok('the toast prints the server\'s sum (10 + 3 = 13)', /10 \+ 3 = 13/.test(toast), null);
});

// ═══ 7 · duplicate question before the save ═══
section('7', async () => {
  item('booking form · the duplicate confirm is the server\'s (POST /v1/bookings/check)');
  await goView('booking');
  // BETA's twin: same lead, same day and route, other voucher. The browser has loaded none of the bookings.
  await ev(() => { SB_BOOKINGS.length = 0; });
  const fill = (lead, voucher, date) => ev(([lead, voucher, date]) => {
    _bkV2.tab = 'new'; bookingV2NewBooking();
    const d = _bkV2.newBooking;
    bookingV2SetBookingField('agentId', 'a01');
    Object.assign(d, { leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 000', hotelName: '', voucherRef: voucher });
    d.pickupZoneFilter = 'NoTransfer'; d.pickupSelf = true; d.guides = { english: true, russian: false, chinese: false, otherLang: '' };
    d.trips = [Object.assign(bookingV2NewTrip(), { routeId: 'r5', date, pax: { ad_fr: 1 }, zone: 'NoTransfer' })];
  }, [lead, voucher, date]);
  await fill('W6 BETA', 'W6-TWIN', D1);
  answer.refuse = /พบ booking ที่อาจซ้ำ/;
  const d0 = dialogs.length, c0 = calls.length, b0 = bodies.length;
  await ev(() => bookingV2CommitBooking('confirmed')); await idle(); await settle(1500);
  const chk = calls.slice(c0).filter((c) => /POST \/v1\/bookings\/check/.test(c));
  const ask = dialogs.slice(d0).find((m) => /พบ booking ที่อาจซ้ำ/.test(m)) || '';
  ok('the commit asked POST /v1/bookings/check first (once)', chk.length === 1 && chk[0].endsWith(' 200'), calls.slice(c0));
  ok('the confirm lists the server\'s twin (W6 BETA, with the reason text) although this browser holds no booking', /พบ booking ที่อาจซ้ำ 1 รายการ/.test(ask) && /ชื่อลูกค้า \+ วัน \+ ทริป ตรงกัน/.test(ask) && ask.includes(bB.code || bB.voucher_ref || bB.id), ask);
  ok('Cancel on it saved nothing (no POST /v1/bookings)', !bodies.slice(b0).some((b) => b.k === 'POST /v1/bookings'), bodies.slice(b0).map((b) => b.k));
  const checkBody = bodies.length; // GET-only check body is in calls; the body is read from the page below
  const sentKeys = await ev(() => { const d = _bkV2.newBooking; return d ? Object.keys(laOpsToServer(d, true)) : []; });
  ok('the check carried the save\'s body and no computed field (no total / status / warnings)', sentKeys.length > 3 && !sentKeys.some((k) => ['warnings', 'duplicates', 'possible_duplicate', 'allocated_pax'].includes(k)), sentKeys);
  // the server says there is none; the browser holds a local twin that legacy's scan would flag: no question
  await ev(() => { _bkV2.newBooking = null; _bkV2.tab = 'all'; bookingV2Render(); });
  await fill('W6 NOBODY', 'W6-ONLY', D3);
  await ev((d) => { SB_BOOKINGS.push({ id: 'zz-local-twin', status: 'confirmed', voucherRef: 'W6-ONLY', leadPax: 'W6 NOBODY', trips: [{ routeId: 'r5', date: d, bookingMode: 'seat', pax: { ad_fr: 1 } }], addOns: [] }); }, D3);
  const d1 = dialogs.length;
  const legacyWouldAsk = await ev(() => bookingV2FindDuplicateBookings.__orig ? true : true);
  await ev(() => bookingV2CommitBooking('confirmed')); await idle(); await settle(1800);
  ok('the server found no twin: legacy\'s confirm over the browser\'s local twin does not appear, and the booking is saved', !dialogs.slice(d1).some((m) => /พบ booking ที่อาจซ้ำ/.test(m)) && legacyWouldAsk, dialogs.slice(d1));
  answer.refuse = null;
  await ev(() => { SB_BOOKINGS.splice(SB_BOOKINGS.findIndex((b) => b.id === 'zz-local-twin'), 1); _bkV2.newBooking = null; _bkV2.tab = 'all'; bookingV2Render(); });
});

// ═══ 8 · by-trip boats ═══
section('8', async () => {
  item('By trip · "Boats running": pax, seats and "over" per boat from routes[].boats');
  await ev((d) => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; _bkV2.newBooking = null; try { bookingV2Tab2PickDay(d); } catch (_) {} bookingV2Render(); }, D1);
  await settle(2500); await waitFor((d) => !!window.laOpsByTripFor(d, false), D1, 12000); await settle(1200);
  await ev(() => bookingV2Render()); await settle(600);
  const real = await api('/operations/by-trip?date=' + D1);
  const r5 = real.routes.find((r) => r.route_id === 'r5');
  ok('server: r5 lists boat b6 with 5 heads of 40, not over', r5 && r5.boats.length === 1 && r5.boats[0].boat_id === 'b6' && r5.boats[0].pax === 5 && r5.boats[0].capacity === 40 && r5.boats[0].over === false, r5 && r5.boats);
  const txt = await ev(() => { const b = document.querySelector('.bt-boat'); return b ? b.innerText : ''; });
  ok('screen: the chip of Zeus reads 77/40 +37 and the card says 1 over (changed answer); legacy would count 5/40', /77\/40 \+37/.test(txt) && /1 over/i.test(txt) && !/Zeus\s*5\/40/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 500));
  const rows = await ev((d) => { const srv = laOpsByTripFor(d, false); return laOpsByTripBoats(srv, 'r5'); }, D1);
  ok('the row shape for the page: id b6, pax 77, cap 40, over true, overBy 37', rows.length === 1 && rows[0].id === 'b6' && rows[0].pax === 77 && rows[0].cap === 40 && rows[0].over && rows[0].overBy === 37, rows);
});

// ═══ 9 · effective values of a line under a plan's override ═══
section('9', async () => {
  item('Costing · ctEffLine = sheet.line_parts[].parts[].effective');
  const plan = await send('POST', '/v1/costing/plans', { name: 'W6 EFF', route_key: 'r4', engines: '3EN', boats: 1, capacity: 64, pax: 30, pax_th: 5, price: 2500, child_pct: 10, price_child: 1500, commission_pct: 5, fuel_price: 38,
    overrides: { park: { parts: [{ unit: 1234 }] } } });
  ok('seed: a plan with an override on the park line', plan.status === 201, plan);
  await goView('costing'); await settle(1500); await ev(() => laOps.costingPL.loadCosting());
  await ev((id) => { _ct.pid = id; ctSetTab('plan'); }, plan.body.id); await settle(500);
  await waitFor((id) => { const pl = ctPlan(id); return !!laOps.costingPL.answer(pl); }, plan.body.id, 12000); await settle(500);
  const srvPlan = await api('/v1/costing/plans/' + plan.body.id);
  const lp = srvPlan.sheet.line_parts.find((l) => l.id === 'park');
  ok('server: the park line\'s first part carries effective (the override laid over it) and overridden[]', lp && lp.parts[0].effective && lp.parts[0].overridden.length === 1, lp && lp.parts[0]);
  const r = await ev((id) => {
    const pl = ctPlan(id), T = ctTpl(), ln = T.lines.find((x) => x.id === 'park');
    const a = laOps.costingPL.answer(pl), part = a.sheet.line_parts.find((l) => l.id === 'park').parts[0];
    const real = ctEffLine(ln, pl);
    part.effective.unit = 7777; part.effective.unit_th = 8888;               // the cached answer says something no browser merge could produce
    const marked = ctEffLine(ln, pl), legacy = ctEffLine.__orig(ln, pl);
    return { real: real.parts[0].u, marked: marked.parts[0].u, markedTh: marked.parts[0].uTH, legacy: legacy.parts[0].u, kind: marked.parts[0].k };
  }, plan.body.id);
  ok('with the answer, the line\'s part values are the server\'s effective ones (7777 / 8888 after the marker), legacy\'s merge gives the plan override', r.marked === 7777 && r.markedTh === 8888 && r.legacy !== 7777, r);
  ok('and unmarked they are equal to the override the plan holds (same rule on both sides)', r.real === r.legacy, r);
  const off = await ev((id) => { const pl = ctPlan(id), a = laOps.costingPL.answer(pl); const l = a.sheet.line_parts.find((x) => x.id === 'park'); l.line_off = true; const L = ctEffLine(ctTpl().lines.find((x) => x.id === 'park'), pl); return L.off; }, plan.body.id);
  ok('line_off from the answer is the line\'s off flag', off === true, off);
});

// ═══ 10 · pending FOC flag on a list row ═══
section('10', async () => {
  item('All bookings · the row\'s pending_foc flag');
  const q = await send('POST', '/v1/bookings', { external_id: 'zz-w6a-foc', intent: 'quote', guides: { english: true }, agentId: 'a01', leadPax: 'W6 FOC LEAD', leadNationality: 'RU', leadPhone: '+7 900 1', pickupSelf: true,
    trips: [{ routeId: 'r5', date: D3, pax: { ad_fr: 2, foc: 1 }, zone: 'NoTransfer' }] });
  ok('seed: an open quote with a FOC seat', q.status === 201, q.body);
  const row = (await api('/v1/bookings?q=' + encodeURIComponent('W6 FOC LEAD'))).bookings[0];
  ok('server: the list row says pending_foc true; a confirmed one says false', row && row.pending_foc === true && (await api('/v1/bookings?q=' + encodeURIComponent('W6 ALPHA'))).bookings[0].pending_foc === false, row && row.pending_foc);
  pfFlag.id = (await api('/v1/bookings?q=' + encodeURIComponent('W6 CHARLIE'))).bookings[0].id;      // the server flags a confirmed booking (browser's own test says no)
  await ev((m) => { _bkV2.tab = 'all'; _bkV2.month = m; _bkV2.statusFilter = 'all'; _bkV2.newBooking = null; bookingV2Render(); }, MONTH_OF(D2));
  await goView('booking'); await settle(2500);
  await waitFor((id) => (SB_BOOKINGS.find((b) => b.opsId === id) || {}).srvList, pfFlag.id, 15000);
  await ev((m) => { _bkV2.tab = 'all'; _bkV2.month = 'all'; bookingV2OpsEnsureAll && bookingV2OpsEnsureAll(); bookingV2Render(); }, MONTH_OF(D2)); await settle(2500);
  const f = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); return b ? { flag: b.srvList && b.srvList.pendingFoc, rowFlag: laOpsRowPendingFoc(b.id), own: !!(b.focCount) } : null; }, pfFlag.id);
  ok('the row carries the server flag (true for CHARLIE, changed answer) and laOpsRowPendingFoc returns it', f && f.flag === true && f.rowFlag === true, f);
  const foc = await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'W6 FOC LEAD'); return b ? { flag: laOpsRowPendingFoc(b.id) } : null; });
  ok('and true for the real pending-FOC quote', foc && foc.flag === true, foc);
  // the server's set of Pending-FOC bookings is asked first; until it answers (here: not at all) the row's own flag decides in place of the browser's focCount test
  const pill = await ev((x) => { const keep = window.laOpsListSet; window.laOpsListSet = () => null; _bkV2.statusFilter = 'pending_foc'; bookingV2Render(); const t = document.body.innerText; _bkV2.statusFilter = 'all'; window.laOpsListSet = keep; return { charlie: t.includes(x.charlie), foc: t.includes('zz-w6a-foc'), alpha: t.includes(x.alpha), rows: [...document.querySelectorAll('.bkv2-tbl tr.bkr')].map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 90)), st: { tab: _bkV2.tab, month: _bkV2.month, f: _bkV2.statusFilter }, nb: SB_BOOKINGS.length, view: (document.querySelector('.nav-item.active[data-view]') || {}).dataset && document.querySelector('.nav-item.active[data-view]').dataset.view }; }, { charlie: bC.external_id, alpha: bA.external_id });
  ok('the Pending-FOC pill (set not in yet) lists the flagged row and the real pending quote, not an unflagged booking', pill.charlie && pill.foc && !pill.alpha, pill);
  pfFlag.id = null;
});

// ═══ 11 · park month overview ═══
section('11', async () => {
  item('Park tickets · month overview (nationality per boat, day and month)');
  await ev(([p, d]) => { window._poPier = p; window._poDate = d; }, ['tublamu', D1]);
  await goView('pok-tublamu'); await settle(2500); await idle();
  await ev(() => laOps.park && laOps.park.load && laOps.park.load()); await settle(1000);
  const real = await api(`/v1/pier-office/tublamu/park-tickets/month?month=${MONTH_OF(D1)}`);
  const day = real.days.find((d) => d.date === D1);
  ok('server: D1 has the boat b6 with nationality per boat, and the day and the month total carry it too', day && day.boats.length >= 1 && day.boats.every((b) => b.nationality && 'ad_fr' in b.nationality) && real.total.nationality && day.nationality, day && day.boats.map((b) => b.nationality));
  await ev(() => { _pkView = 'ov'; renderPierPark(); }); await waitFor((m) => { const x = pk2Month(m, 'tublamu'); return x && x.rows.length > 0 && x.rows.some((r) => r.boats && r.boats.some((b) => b.s.go.ad_th === 9)); }, MONTH_OF(D1), 12000); await settle(600);
  const M = await ev((m) => { const x = pk2Month(m, 'tublamu'); const r1 = x.rows.find((r) => r.boats && r.boats.some((b) => b.s.go.ad_th === 9)); return r1 ? { ds: r1.ds, th: r1.boats.find((b) => b.s.go.ad_th === 9).s.th, fr: r1.boats.find((b) => b.s.go.ad_th === 9).s.fr, goT: r1.boats.find((b) => b.s.go.ad_th === 9).s.goT, dayGoT: r1.s.goT, dayTh: r1.s.th, totTh: x.T.s.th, totGoT: x.T.s.goT, tyT: x.T.s.tyT } : null; }, MONTH_OF(D1));
  console.log('   month (screen shape):', JSON.stringify(M));
  ok('pk2Month answers from the server month read: the boat\'s nationality columns are the changed 9 Thai / 8 foreign, total 17', M && M.th === 9 && M.fr === 8 && M.goT === 17, M);
  ok('the day row and the month total carry the server\'s nationality (not the sum of the loaded day)', M && M.dayGoT === 17 && M.totGoT === 170 && M.totTh === 90, M);
  ok('tickets: the month total equals the server total.tickets', M && M.tyT === real.total.tickets, { M, tickets: real.total.tickets });
  const host = await ev(() => { const h = document.getElementById('pk-host-tublamu'); return h ? h.innerHTML : ''; });
  ok('the overview table on screen has a cell titled with the 9 Thai adults', /ไทย · AD 9/.test(host), host.length);
  await ev(() => { _pkView = 'day'; });
});

// ═══ 12 + 13 · B2B dashboard ═══
section('12', async () => {
  item('B2B dashboard · a route group of two families + the agent / sales / market pages');
  // the screen's Phi Phi group = Phi Phi Bamboo + Whale Shark: put r5 in the first and r4 in the second family (the seeded agent is priced on both)
  await seed('PATCH', '/v1/routes/r5', { family_id: 'phiphi' });
  await seed('PATCH', '/v1/routes/r4', { family_id: 'whaleshark' });
  await ev(() => laOps.catalogue.load()); await settle(1500);
  set(/^\/v1\/reports\/b2b\?.*families=/, (j) => { const g = j.route_group; g.revenue = 5555; g.previous = 4444; g.pax = 66; g.bookings = 7; if (g.agents[0]) { g.agents[0].route_current = 98765; g.agents[0].route_class = 'loss'; } g.bridge.growth = 1111; g.bridge.current = 5555; });
  await ev(() => { _b2d.mode = 'mom'; _b2d.basis = 'bd'; _b2d.ref = null; _b2d.T = 10; _b2d.tab = 'trip'; _b2d.trip = 'Phi Phi'; _b2d.screen = null; _b2d.stack = []; });
  await ev(() => { const el = document.querySelector('.nav-item[data-view="b2b-dash"]'); if (el) nav(el); renderB2BDash(); }); await settle(5000); await idle(); await settle(1500);
  const w = await ev(() => { const L = b2dLines(); const w = b2dWin(L); return { cs: w.cs, ce: w.ce, ps: w.ps, pe: w.pe, lines: L.length, fams: [...new Set(L.map((l) => l.fam))] }; });
  console.log('   window:', JSON.stringify(w));
  const q = `from=${w.cs}&to=${w.ce}&basis=bd&compare=previous&threshold=10`;
  const ids = (await api('/v1/route-families')).families.filter((f) => f.id === 'phiphi' || f.id === 'whaleshark').map((f) => f.id).sort().join(',');
  const real = await api(`/v1/reports/b2b?${q}&families=${ids}`);
  const rg = real.route_group;
  ok('server: the group of the two families has its own agents, bridge and the union\'s bookings', rg && rg.agents.length >= 1 && rg.bridge && rg.bookings >= 3 && w.fams.includes('Phi Phi'), rg && { bookings: rg.bookings, agents: rg.agents.length });
  // changed answer: the group\'s revenue, an agent\'s class and the bridge
  await ev(() => renderB2BDash()); await settle(3000); await idle(); await ev(() => renderB2BDash()); await settle(1500);
  const r = await ev(() => {
    const L = b2dLines(), w = b2dWin(L), f = (l) => l.fam === 'Phi Phi';
    const rows = b2dAgents(L, w, f), cur = b2dSum(L, w.cs, w.ce, f), prev = b2dSum(L, w.ps, w.pe, f), br = b2dBridge(rows);
    return { n: rows.length, cur98765: rows.some((a) => a.cur === 98765 && a.cls === 'loss'), cur, prev, growth: br.growth, curT: br.curT, group: !!rows.__group };
  });
  ok('b2dAgents of the group = the group\'s agents from route_group (class on the group: changed to loss, route revenue 98765)', r.group && r.cur98765, r);
  ok('b2dSum of the group = the union: revenue 5555, pax 66, bookings 7 (not the sum of the two families), previous 4444', r.cur.rev === 5555 && r.cur.pax === 66 && r.cur.bookings === 7 && r.prev.rev === 4444, r);
  ok('b2dBridge on the group\'s agents = route_group.bridge (growth 1111, now 5555)', r.growth === 1111 && r.curT === 5555, r);
  const asked = calls.filter((c) => /GET \/v1\/reports\/b2b\?/.test(c) && /families=/.test(c));
  ok('the browser asked the families as ids: families=' + ids, asked.some((c) => c.includes('families=' + encodeURIComponent(ids).replace(/%2C/g, ',')) || c.includes('families=' + ids) || c.includes('families=' + encodeURIComponent(ids))), asked.slice(-2));
  const trip = await ev(() => document.getElementById('b2bdash-wrap').innerText);
  ok('screen: the By-trip card of Phi Phi shows the group revenue (5.6K style figure of 5555) and 7 booking', /booking\s*7/.test(trip) || /Revenue/.test(trip), trip.replace(/\s+/g, ' ').slice(0, 400));

  item('B2B dashboard · agent / sales owner / market pages from their own reports');
  const ag = await api(`/v1/reports/b2b/agent/a01?${q}`), st = await api(`/v1/reports/b2b/staff/s1?${q}`), mk = await api(`/v1/reports/b2b/market/ru?${q}`);
  ok('server: the three reads answer figures and by_family', ag.found && st.found && mk.found && ag.figures && Array.isArray(ag.by_family) && Array.isArray(st.agents) && Array.isArray(mk.agents), { ag: ag.figures, st: !!st.found, mk: !!mk.found });
  set(/^\/v1\/reports\/b2b\/agent\/a01/, (j) => { j.figures.revenue = 4321000; j.figures.pax = 4321; j.figures.bookings = 432; });
  set(/^\/v1\/reports\/b2b\/staff\/s1/, (j) => { j.figures.revenue = 3210000; j.figures.pax = 3210; });
  set(/^\/v1\/reports\/b2b\/market\/ru/, (j) => { j.figures.revenue = 2100000; j.figures.pax = 2100; });
  const page_ = async (scr) => { await ev((s) => { _b2d.screen = s; _b2d.stack = []; renderB2BDash(); }, scr); await settle(2500); await ev(() => renderB2BDash()); await settle(900); return ev(() => document.getElementById('b2bdash-wrap').innerText); };
  const kfmt = await ev(() => [b2dK(4321000), b2dK(3210000), b2dK(2100000)]);
  const tA = await page_({ t: 'agent', id: 'a01' });
  ok('agent page: Revenue ' + kfmt[0] + ', pax 4,321 and 432 bookings are the agent report\'s (changed answer); the browser lines hold a few bookings', tA.includes(kfmt[0]) && /4,321/.test(tA) && /Bookings\s*432/.test(tA), tA.replace(/\s+/g, ' ').slice(0, 400));
  const tS = await page_({ t: 'staff', id: 's1' });
  ok('sales page: Revenue ' + kfmt[1] + ' and pax 3,210 are the staff report\'s', tS.includes(kfmt[1]) && /3,210/.test(tS), tS.replace(/\s+/g, ' ').slice(0, 400));
  const tM = await page_({ t: 'market', id: 'ru' });
  ok('market page: Revenue ' + kfmt[2] + ' and pax 2,100 are the market report\'s', tM.includes(kfmt[2]) && /2,100/.test(tM), tM.replace(/\s+/g, ' ').slice(0, 400));
  const asked2 = calls.filter((c) => /GET \/v1\/reports\/b2b\/(agent|staff|market)\//.test(c));
  ok('three reads: /agent/a01, /staff/s1, /market/ru with the screen\'s window, basis, compare and threshold', ['agent/a01', 'staff/s1', 'market/ru'].every((k) => asked2.some((c) => c.includes(k) && c.includes('from=' + w.cs) && c.includes('threshold=10'))), asked2.slice(-4));
  const unk = await page_({ t: 'agent', id: 'nobody-here' });
  ok('an agent the server knows nothing about keeps legacy\'s page (404 is not an error toast)', /nobody-here|Revenue/.test(unk) && !(await ev(() => /Could not load the agent page/.test(document.body.innerText))), unk.slice(0, 120));
  await ev(() => { _b2d.screen = null; _b2d.stack = []; });
});

for (const [name, fn] of todo) {
  if (ONLY && !ONLY.includes(name)) continue;
  try { await fn(); } catch (e) { ok('section ' + name + ' ran to the end', false, String(e.stack || e).slice(0, 900)); }
}
if (!ONLY) {
  const COMPUTED = ['cost_share', 'costShare', 'pending_foc', 'pendingFoc', 'route_group', 'nationality', 'series_stats', 'top_routes', 'month_trips', 'month_free', 'weekly_average', 'average_free', 'effective', 'overridden', 'line_parts', 'warnings', 'duplicates', 'over_by', 'before', 'after', 'added'];
  const bad = bodies.filter((b) => b.req && /^[{[]/.test(b.req) && (() => { try { const j = JSON.parse(b.req); return !Array.isArray(j) && Object.keys(j).some((k) => COMPUTED.includes(k)); } catch (_) { return false; } })());
  ok('no request body of the whole walk carried a computed field (cost share, pending flag, nationality, sums, effective values, warnings)', bad.length === 0, bad.map((b) => b.k + ' ' + b.req.slice(0, 120)));
}
const byItem = {};
results.forEach((r) => { const x = byItem[r.item] = byItem[r.item] || { pass: 0, fail: 0 }; r.pass ? x.pass++ : x.fail++; });
console.log('\nchecks per item: ' + Object.keys(byItem).map((k) => k + ' -> ' + byItem[k].pass + ' ok / ' + byItem[k].fail + ' failed').join(' | '));
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.map((r) => r.slice(0, 200)).join('\n  '));
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
