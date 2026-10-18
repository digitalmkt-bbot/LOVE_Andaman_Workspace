// t_walk_w6_d · browser walk of the w6-d wiring: the server fields the backend built for the w5-d / w5-e walks (docs/walk/w6-d.md)
//   a pier / guide / travel (fee preview, group stats, return leg, service lines, licensed guide, packs) · b trend, upgrade targets, Transfer Fleet
//   c costing what-ifs, Trip P&L, money (candidate agents, PFM chip) · d agents (summary, promo coverage, bulk fill, chips) · e booking form, hotels, reports
//
//   node test/ui/t_walk_w6_d.mjs       (OPS_BACKEND_DIR, default D:/projects/operation-backend · WALK_ONLY=1,3 runs sections)
//
// Every check reads the screen (functions / DOM) and, where it matters, the server asked directly. "Tamper" checks change what the server
// answers on the wire (the test's proxy) to a figure the browser's own arithmetic would never give, and expect the screen to show the server's.
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
const raw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text(); let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await raw(p, init)).body;
const send = (m, p, b) => raw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) });
// a booking write names the version it read (If-Match)
const sendV = async (method, p, id, body) => { const v = (await api('/v1/bookings/' + id)).version; return raw(p, { method, body: JSON.stringify(body), headers: { 'if-match': '"' + v + '"' } }); };
const seedV = async (method, p, id, body) => { const r = await sendV(method, p, id, body); if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); return r.body; };
const seed = async (method, p, body) => {
  const r = await send(method, p, body);
  if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
};

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], bodies = [];
let tamper = [];       // [{ re: /path/, fn(json) }]: what the server answers on the wire is changed before the page reads it
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  let buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push(req.method() + ' ' + u.pathname + u.search + ' ' + r.status);
  if (req.method() !== 'GET') bodies.push({ k: req.method() + ' ' + u.pathname, status: r.status, req: req.postData() || '', body: buf.toString() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 260));
  if (r.status < 300) for (const t of tamper) if ((t.method ? t.method === req.method() : req.method() === 'GET') && t.re.test(u.pathname + u.search)) { try { const j = JSON.parse(buf.toString()); t.fn(j, u); buf = Buffer.from(JSON.stringify(j)); } catch (_) {} }
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 300)); d.type() === 'prompt' ? d.accept('Tester') : d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 900))); if (!cond) fails.push(name); return cond; };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const todo = [];
const section = (name, fn) => todo.push([name, fn]);
const callsSince = (n) => calls.slice(n);
const waitCalls = async (re, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (calls.some((c) => re.test(c))) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
const lastBody = (re) => { const b = bodies.filter((x) => re.test(x.k)).pop(); return b ? { status: b.status, req: b.req ? JSON.parse(b.req) : null, json: (() => { try { return JSON.parse(b.body); } catch (_) { return null; } })() } : null; };
const goView = (v) => ev((v) => { const el = document.querySelector('.nav-item[data-view="' + v + '"]'); nav(el || { dataset: { view: v }, classList: { add() {} } }); }, v);
const COMPUTED = ['actual_pax', 'expected', 'no_show', 'self_add', 'reinstate', 'checked_in_at', 'arrived_at', 'cleared_at', 'booked', 'arrival', 'stage', 'totals', 'counts', 'programmes', 'status', 'covered_by_pier', 'may_move', 'options', 'meal_preview', 'load', 'over', 'block'];
const noComputed = (req) => !req || !Object.keys(req).some((x) => COMPUTED.includes(x));
const addDays = (d, n) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);

const DAY = '2026-12-08';
const bk = {};
const mkBk = async (id, lead, pax, extra = {}, tripExtra = {}, route = 'r5', day = DAY) => send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: route, date: day, pax: { ad_fr: pax }, zone: 'PK', ...tripExtra }], ...extra });
const mk = async (k, lead, pax, extra, tripExtra, route, day) => {
  const r = await mkBk('zz-' + k, lead, pax, extra, tripExtra, route, day);
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body)); process.exit(2); }
  bk[k] = { id: r.body.id, trip: r.body.trips[0].id, ext: 'zz-' + k, body: r.body };
};
const cmd = (k, side, action, body = {}) => seed('POST', `/operations/trip-ops/${bk[k].trip}/checkins/${side}/0/${action}`, body);

// ══════════ seed (through the API, before the app boots) ══════════
// ── 1 · pier sheet ──
for (const [b, r, cap] of [['b6', 'r5', 40], ['b7', 'r5', 34], ['b1', 'r4', 64], ['b13', 'r10', 38]]) await seed('POST', '/operations/deployments', { boat_id: b, route_id: r, service_date: DAY, capacity: cap, deploy_anyway: true });
const mkVan = async (name, cap) => seed('POST', '/operations/vans', { name, capacity: cap });
const vanA = await mkVan('W5 Van Alpha', 12), vanB = await mkVan('W5 Van Bravo', 12), vanC = await mkVan('W5 Van Charlie', 12);
for (const v of [vanA, vanB, vanC]) await seed('PUT', `/operations/van-days/${DAY}/${v.id}`, { route_ids: ['r5', 'r10'] });
await mk('p1', 'W5 ONE', 2); await mk('p2', 'W5 TWO', 3, { pickupSelf: true, hotelName: '', pickupZone: 'NoTransfer' }, { zone: 'NoTransfer' });
await mk('p3', 'W5 THREE', 2); await mk('p4', 'W5 FOUR', 2);
await mk('p5', 'W5 FIVE', 4); await mk('p9', 'W5 NINE', 2); await mk('p6', 'W5 SIX', 4); await mk('p8', 'W5 EIGHT', 2, { agentId: 'a_b2c', total: 2400, price_mode: 'manual', b2c_channel: 'Line OA' }, { subtotal: 2400 }, 'r10');
const mkGroup = async (members, van_id, route = 'r5', zone = 'PK') => seed('POST', '/operations/van-groups', { service_date: DAY, route_id: route, zone, members: members.map((m) => ({ trip_id: bk[m].trip })), van_id });
await mkGroup(['p1', 'p5', 'p9'], vanA.id); await mkGroup(['p4'], vanB.id); await mkGroup(['p8'], vanC.id, 'r10');
await seed('PATCH', `/operations/trip-ops/${bk.p5.trip}`, { boat_splits: [{ boat_id: 'b6', ad: 2, chd: 0, inf: 0, foc: 0 }, { boat_id: 'b7', ad: 2, chd: 0, inf: 0, foc: 0 }] });
await seed('POST', `/operations/trip-ops/${bk.p6.trip}/van-split`, { ad: 1 });
await cmd('p1', 'pier', 'stage', { stage: 'arrived', on: true });
await cmd('p2', 'pier', 'stage', { stage: 'arrived', on: true }); await cmd('p2', 'pier', 'stage', { stage: 'cleared', on: true });
await cmd('p3', 'pier', 'check-in');
await mk('m1', 'W5 MOVE', 3); await seed('PATCH', `/operations/trip-ops/${bk.m1.trip}`, { boat_id: 'b6' });
await cmd('p8', 'pier', 'stage', { stage: 'arrived', on: true });
await cmd('p1', 'van', 'check-in'); await cmd('p4', 'van', 'events', { type: 'no_show', reason_code: 'no_contact', ad: 1 });


// ── 5 · on-tour sales: one covered by the pier's cash, one still to collect ──
await mk('cs1', 'W5 COVERED', 2); await mk('cs2', 'W5 OPEN', 2);
for (const k of ['cs1', 'cs2']) await seedV('POST', `/v1/bookings/${bk[k].id}/tour-sales`, bk[k].id, { service: 'Longtail Join', qty: 2, unit_price: 500, method: 'cot' });
await seedV('POST', `/v1/bookings/${bk.cs1.id}/pier-payments`, bk.cs1.id, { service_date: DAY, lines: [{ method: 'cash', amount: 1000 }], overpay_anyway: true });
// ── 6 · guide order and travel register of b6 ──
await seed('PUT', '/v1/config/guides', { value: [{ id: 'g1', name: 'W5 Guide One', nick: 'One', license: '11-1111', lang: ['EN'], role: 'guide' }, { id: 'g2', name: 'W5 Intern Two', role: 'intern' }, { id: 'g3', name: 'W5 Guide Three', license: '33-3333', role: 'trainee' }] });
await seed('PUT', `/v1/guide-orders/${DAY}/b6`, { guide_ids: ['g1', 'g2', 'g3'], other_count: 1 });
await seed('PATCH', `/v1/pier-office/tublamu/days/${DAY}/boats/b6/job`, { captain_name: 'W5 Captain', assistant_name: 'W5 Engineer', crew: [], crew_names: ['W5 Deck'], island: [], island_names: ['W5 Island Guide'] });
await mk('tg1', 'W5 REG ONE', 3, { passengers: [{ name: 'Ivan Petrov', nationality: 'RU' }, { name: 'Olga Petrova', nationality: 'RU' }] });
await seed('PATCH', `/operations/trip-ops/${bk.tg1.trip}`, { boat_id: 'b6' });
// ── 8 · auto assign (DAY_A) and the fleet matrix (DAY_F) ──
const DAY_A = '2026-12-20', DAY_F = '2026-12-09';
for (const [b, r, cap] of [['b6', 'r5', 40], ['b7', 'r5', 34]]) await seed('POST', '/operations/deployments', { boat_id: b, route_id: r, service_date: DAY_A, capacity: cap, deploy_anyway: true });
await mk('au1', 'W5 AUTO ONE', 20, {}, {}, 'r5', DAY_A); await mk('au2', 'W5 AUTO TWO', 15, {}, {}, 'r5', DAY_A); await mk('au3', 'W5 AUTO THREE', 10, {}, {}, 'r5', DAY_A);
await seed('POST', `/operations/vans/${vanB.id}/status-ranges`, { status: 'maintenance', from_date: DAY_F, to_date: addDays(DAY_F, 1), note: 'w5 gearbox' });
await seed('PUT', `/operations/van-days/${DAY_F}/${vanC.id}`, { status: 'off' });

// ── 9 · costing: two plans, a rented boat for the month's idle rent ──
const planA = await seed('POST', '/v1/costing/plans', { name: 'W5 Plan A', route_key: 'r4', engines: '3EN', boats: 1, capacity: 64, pax: 30, pax_th: 5, price: 2500, child_pct: 10, price_child: 1500, commission_pct: 5, fuel_price: 38 });
const planB = await seed('POST', '/v1/costing/plans', { name: 'W5 Plan B', engines: '4EN', boats: 2, capacity: 40, pax: 22, price: 3100, fuel_price: 40 });
const RENT_FROM = '2026-10-01', RENT_TO = '2026-10-30';
await seed('PUT', '/v1/costing/boat-rents/b7', { rented: true, mode: 'lump', amount: 300000, days: 30, days_off: 4, trips_per_day: 1, vat: false, from: RENT_FROM, to: RENT_TO });

// ── w6 seeds: a booking with a separate drop-off (the way back); cs2 (money due on tour) is the booking of the fee preview ──
await mk('rt1', 'W6 RETURN', 2, { dropoffSame: false, dropoffHotelName: 'W6 Drop Hotel' });
const TODAY = new Date().toISOString().slice(0, 10);

//@@SEED
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
const s0 = await ev(() => ({ failed: laOps.state.failed }));
ok('boot: nothing failed to load', s0.failed.length === 0, s0);
const reboot = async () => {
  await page.reload();
  await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
  await settle(1500);
};
const openPier = async (date) => {
  await ev((d) => { _pckDate = d; _pckLand = false; const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); renderPierCheckin(); }, date);
  await waitFor(() => !!document.querySelector('#piercheckin-host'), null, 10000);
  await idle(); await settle(1200);
};
const reread = async () => { await ev(() => laOps.pierService.clear()); await ev((d) => laOps.pierService.ensure(d, true), DAY); await settle(500); };
const reqOf = (re, n0 = 0) => bodies.slice(n0).filter((b) => re.test(b.k)).map((b) => ({ status: b.status, req: b.req ? JSON.parse(b.req) : null }));
const callsMatch = (re, n0 = 0) => calls.slice(n0).filter((c) => re.test(c));

// ═══ 0 · boot-time answers: the licensed guide, the route's zone, the agent chips and alerts (the page is reloaded with the answers changed) ═══
section('0', async () => {
  console.log('\n[0] goIsGuide <- guides[].licensed · _vehRouteZone <- routes[].zone · agGapCounts / agTblRows <- gap_counts, gaps · agAlerts <- rate_not_started');
  tamper = [
    { re: /\/v1\/config$/, fn: (j) => { for (const e of j.entries || []) if (e.key === 'guides') for (const g of e.value) { if (g.id === 'g2') g.licensed = true; if (g.id === 'g1') g.licensed = false; } } },
    { re: /\/v1\/routes\?/, fn: (j) => { for (const r of j.routes || []) if (r.id === 'r5') r.zone = 'PK'; } },
    { re: /\/v1\/agents\?active=all$/, fn: (j) => {
      j.gap_counts = { all: j.agents.length, programs: 0, rate: 0, vat: 1, docs: 0 };
      for (const a of j.agents) { a.gaps = a.id === 'a01' ? ['vat'] : []; if (a.id === 'a01') a.alerts = [...(a.alerts || []), { code: 'rate_not_started', tone: 'blue', severity: 'review', valid_from: '2031-01-01', days: 9, message: 'W6 RATE starts 1 Jan 2031' }]; }
    } },
  ];
  await reboot();
  const gl = await ev(() => ({ g1: goIsGuide(goGuide('g1')), g2: goIsGuide(goGuide('g2')), g3: goIsGuide(goGuide('g3')) }));
  ok('goIsGuide follows the register entry\'s `licensed` (tampered: g1 role guide -> false, g2 role intern -> true; g3 untouched trainee -> true)', gl.g1 === false && gl.g2 === true && gl.g3 === true, gl);
  const zn = await ev(() => ({ shown: _vehRouteZone('r5'), legacy: _vehRouteZone.__orig('r5') }));
  ok('_vehRouteZone(r5) is the route\'s server zone (tampered PK; legacy reads the pier: KL)', zn.shown === 'PK' && zn.legacy === 'KL', zn);
  const gc = await ev(() => agGapCounts());
  ok('agGapCounts = the list answer\'s gap_counts (vat 1 though both agents have a VAT mode)', gc.vat === 1 && gc.all === 2 && gc.docs === 0, gc);
  const rows = await ev(() => { _agGap = 'vat'; try { return agTblRows().map((a) => a.id); } finally { _agGap = 'all'; } });
  ok('agTblRows with the "vat" chip lists the agents whose server `gaps` hold vat (a01 only)', JSON.stringify(rows) === '["a01"]', rows);
  const al = await ev(() => { const a = sbGetAgent('a01'); return agAlerts(a).filter((x) => x.t === 'Rate not started').map((x) => ({ d: x.d, day: x.day, tone: x.tone })); });
  ok('agAlerts: "Rate not started" is the server\'s alert (its message, "in 9 days")', al.length === 1 && /W6 RATE starts/.test(al[0].d) && al[0].day === 'in 9 days' && al[0].tone === 'blue', al);
  // the register's save never sends the computed flag
  const n1 = bodies.length;
  await ev(() => { const L = goGuides().map((g) => Object.assign({}, g)); L.find((g) => g.id === 'g2').role = 'guide'; goGuidesSet(L); });
  await waitCalls(/^PUT \/v1\/config\/guides/, 6000); await idle();
  const put = reqOf(/PUT \/v1\/config\/guides/, n1).pop();
  ok('saving the register sends no `licensed` (a stale flag would be refused when a role changes)', put && put.status === 200 && Array.isArray(put.req.value) && put.req.value.every((g) => !('licensed' in g)), put);
  const srvG = (await api('/v1/config/guides')).value;
  ok('server after the role change: g2 is licensed (role guide), worked out by the server', srvG.find((g) => g.id === 'g2').licensed === true, srvG);
  tamper = [];
  await reboot();
});

// ═══ 1 · pier: card fee preview, group stats, the way back, the Service column ═══
section('1', async () => {
  console.log('\n[1] pckLineFee <- pier-payments/preview · pckTripStats <- groups · ckRetVan / pckJobDrop / tsSendBack <- rows[].return · pckJobService <- service.lines');
  await openPier(DAY);
  await waitFor((d) => laOps.pierService && laOps.pierService.day(d), DAY, 15000);
  // ── fee preview
  const n0 = calls.length, b0 = bodies.length;
  await ev(() => pckPayOpen('zz-cs2'));
  ok('the payment dialog opened', await waitFor(() => !!window._pckPay && !!document.getElementById('acct-modal'), null, 10000), null);
  await ev(() => { const L = _pckPay.lines[0]; L.m = 'card'; L.feeMode = 'pct'; L.feePct = 3; L.amt = 1000; pckPayRender(); });
  ok('typing a card line asks POST /v1/bookings/{id}/pier-payments/preview', await waitCalls(/^POST \/v1\/bookings\/[^/]+\/pier-payments\/preview 200/, 8000), callsMatch(/preview/, n0));
  const pv = reqOf(/POST \/v1\/bookings\/[^/]+\/pier-payments\/preview/, b0).pop();
  ok('...with the cashier\'s choices only: method, amount, fee_pct (no fee figure)', pv && JSON.stringify(pv.req.lines) === '[{"method":"card","amount":1000,"fee_pct":3}]', pv);
  const fee1 = await ev(() => pckLineFee(_pckPay.lines[0]));
  ok('pckLineFee = the server\'s fee (3% of 1000 = 30)', fee1 === 30, fee1);
  tamper = [{ method: 'POST', re: /pier-payments\/preview$/, fn: (j) => { for (const l of j.lines) l.fee = 77; j.fees = 77; } }];
  await ev(() => { _pckPay.lines[0].feePct = 4; pckPayRender(); });
  await waitFor(() => pckLineFee(_pckPay.lines[0]) === 77, null, 8000);
  const sh = await ev(() => ({ fee: pckLineFee(_pckPay.lines[0]), legacy: pckLineFee.__legacy(_pckPay.lines[0]), dom: (document.querySelector('#acct-modal .pckp-lnhd .amt') || {}).innerText || '' }));
  ok('tampered preview (4% -> 77): the line shows 77 where legacy\'s arithmetic gives 40', sh.fee === 77 && sh.legacy === 40 && /77/.test(sh.dom), sh);
  tamper = [];
  await ev(() => acctModalClose());
  // ── group stats
  const S = await api('/v1/pier-checkin?date=' + DAY);
  const G7 = S.groups.boat.b7;
  const stOf = () => ev((d) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-p5'), t = b.trips[0]; const rows = [{ b, t, O: bkOpsRead(b, d), bsIdx: 1, bsN: 2, booked: 2, expect: 2 }]; return { s: pckTripStats(rows, d), legacy: pckTripStats.__orig(rows, d) }; }, DAY);
  const st = await stOf();
  ok('pckTripStats(boat b7\'s rows) = the server group (2 heads travelling, EN 2); legacy counts the whole booking (4)', st.s.real.all === G7.real.total && st.s.book === G7.booked && st.s.lang.EN === G7.languages.EN && st.legacy.real.all === 4, { st, G7 });
  tamper = [{ re: /\/v1\/pier-checkin\?date=2026-12-08$/, fn: (j) => { const g = j.groups.boat.b7; g.real = { ad: 9, chd: 1, inf: 0, foc: 0, total: 10 }; g.booked = 11; g.lost = 1; g.languages = { FR: 10 }; g.meals = { veg: 3, vegan: 2, halal: 1, allergy: 4 }; g.lt_join = 5; g.lt_charter = 2; } }];
  await reread();
  const st2 = (await stOf()).s;
  ok('tampered group: real 9 + 1, booked 11, lost 1, FR 10, meals 3/2/1/4, longtail join 5 charter 2', st2.real.ad === 9 && st2.real.chd === 1 && st2.real.all === 10 && st2.book === 11 && st2.lost === 1 && st2.lang.FR === 10 && !st2.lang.EN && st2.meal.veg === 3 && st2.meal.vegan === 2 && st2.meal.halal === 1 && st2.meal.allergy === 4 && st2.ltJoin === 5 && st2.ltChtr === 2, st2);
  const part = await ev((d) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-p1'), t = b.trips[0]; const rows = [{ b, t, O: bkOpsRead(b, d), booked: 2, expect: 2 }]; return { s: pckTripStats(rows, d).real.all, legacy: pckTripStats.__orig(rows, d).real.all }; }, DAY);
  ok('a set of rows that is not a whole server group (one booking of a van of three) keeps legacy\'s count', part.s === part.legacy, part);
  tamper = [];
  await reread();
  // ── the way back
  const rt1 = bk.rt1.id;
  const backOf = () => ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-rt1'); const d = '2026-12-08'; return { van: ckRetVan(b, d), drop: pckJobDrop(b, d), back: tsSendBack(b, d), name: vehGet('veh02') ? vehGet('veh02').name : '' }; });
  const r0 = await backOf();
  ok('seed: a separate drop-off with no return van is "pending" (server and legacy agree)', r0.van && r0.van.kind === 'pending' && r0.drop && r0.drop.t === 'W6 Drop Hotel' && r0.back && r0.back.cls === 'r', r0);
  tamper = [{ re: /\/v1\/pier-checkin\?date=2026-12-08$/, fn: (j) => { for (const r of j.rows) if (r.booking_id === rt1) r.return = { kind: 'van', van_id: 'veh02', drop_off: 'W6 Drop Hotel' }; } }];
  await reread();
  const r1 = await backOf();
  ok('tampered return (van veh02): ckRetVan names the van, pckJobDrop carries drop-off + van, tsSendBack tag "back on <van>" in the green class',
    r1.van.kind === 'van' && r1.van.t === r1.name && r1.drop.t === 'W6 Drop Hotel' && r1.drop.van && r1.drop.van.kind === 'van' && r1.back.cls === 'g' && r1.back.tag === '↩ ' + r1.name, r1);
  tamper = [{ re: /\/v1\/pier-checkin\?date=2026-12-08$/, fn: (j) => { for (const r of j.rows) if (r.booking_id === rt1) r.return = { kind: 'self', van_id: null, drop_off: 'Airport (self-arrive)' }; } }];
  await reread();
  const r2 = await backOf();
  ok('tampered return (self): "back on their own", the drop-off text without "(self-arrive)", class n', r2.van.kind === 'self' && r2.drop.self === true && r2.back.t === 'Airport' && r2.back.tag === 'กลับเอง' && r2.back.cls === 'n', r2);
  tamper = []; await reread();
  // ── the Service column
  const svOf = () => ev((d) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-cs1'), t = b.trips[0]; const r = { b, t, O: bkOpsRead(b, d) }; return { s: pckJobService(r, d).map((x) => x.t), legacy: pckJobService.__orig(r, d).map((x) => x.t) }; }, DAY);
  const sv0 = await svOf();
  ok('pckJobService: the sold Longtail Join shows as legacy shows it ("Longtail Join +2")', JSON.stringify(sv0.s) === '["Longtail Join +2"]' && JSON.stringify(sv0.legacy) === JSON.stringify(sv0.s), sv0);
  tamper = [{ re: /\/v1\/pier-checkin\?date=2026-12-08$/, fn: (j) => { for (const r of j.rows) if (r.booking_id === bk.cs1.id) { r.service.kind = 'charter'; r.service.upgrades = 1; r.service.upgrade_due = 500;
    r.service.lines = [{ kind: 'longtail', label: 'Longtail Charter · 2 ลำ', qty: 2, amount: null, done: false }, { kind: 'addon', label: 'W6 Snorkel (kids)', qty: 1, amount: null, done: true }, { kind: 'ex', label: 'W6 Kayak', qty: 3, amount: 900, done: false }, { kind: 'upg', label: 'W6 Upgrade', qty: 1, amount: 500, done: false }]; } } }];
  await reread();
  const sv1 = await svOf();
  ok('tampered lines: charter with an upgrade owed, an add-on, a sold extra x3, an upgrade owed', JSON.stringify(sv1.s) === JSON.stringify(['Longtail Charter · 2 ลำ ⬆ *', 'W6 Snorkel (kids)', '+ W6 Kayak ×3', '⬆ W6 Upgrade *']), sv1);
  tamper = []; await reread();
});

// ═══ 2 · Travel Summary packs, the booked-heads trend by market, the Upgrade dialog's targets ═══
section('2', async () => {
  console.log('\n[2] reference_pack / slip_pack (tsRefPackList, tsSlipPackList, tsInvSlips) · drTrendBooked <- daily-counts?markets=1 · bookingV2UpgTargets <- upgrade-targets');
  const openTs = async () => { await ev((d) => { _tsDate = d; _tsPier = ''; _tsRoute = ''; _tsVatF = ''; laOps.travelRows.clear(); laOps.travelServer.clear(); if (laOps.moneyReports && laOps.moneyReports.clear) laOps.moneyReports.clear(); if (laOps.travelView && laOps.travelView.clear) laOps.travelView.clear(); const el = document.querySelector('.nav-item[data-view="travelsum"]'); if (el) nav(el); }, DAY); await waitFor(() => /data-ops-ts-refpack/.test((document.getElementById('travelsum-host') || {}).innerHTML || ''), null, 20000); await idle(); await settle(900); };
  const n0 = calls.length;
  await openTs();
  const T = await api('/v1/reports/travel-summary?date=' + DAY);
  ok('the Travel Summary read carries the packs', Array.isArray(T.reference_pack) && Array.isArray(T.slip_pack), Object.keys(T));
  const btn = () => ev(() => { const r = document.querySelector('[data-ops-ts-refpack]'), s = document.querySelector('[data-ops-ts-slippack]'); return { refTitle: r && r.title, ref: r && r.innerText, slipTitle: s && s.title, slip: s && s.innerText }; });
  const b1 = await btn();
  ok('the reference-pack button counts the bookings of the server\'s reference_pack', new RegExp('· ' + T.reference_pack.length + ' ใบ').test(b1.refTitle || ''), { b1, n: T.reference_pack.length });
  ok('the slip-pack button is the server\'s pack (no per-booking pier-money read)', !callsMatch(/pier-money/, n0).length && /สลิป/.test(b1.slip || '') && !/โหลดสลิป/.test(b1.slip || ''), { b1, calls: callsMatch(/pier-money/, n0) });
  tamper = [{ re: /\/v1\/reports\/travel-summary\?date=2026-12-08$/, fn: (j) => {
    j.reference_pack = [{ booking_id: bk.p1.id, ord: 0 }, { booking_id: bk.p2.id, ord: 1 }];
    j.slip_pack = [{ booking_id: bk.p1.id, ord: 0, paid: 1000, invoice_paid: 400, invoice_number: 'INV-W6-1', missing: 1,
      slips: [{ attachment_id: 'att_w6_a', source: 'pier', method: 'card', amount: 1000, fee: 30, by: 'tester', note: null, label: 'pier', invoice_number: null, paid_on: null },
              { attachment_id: 'att_w6_b', source: 'invoice', method: 'transfer', amount: 400, fee: null, by: 'tester', note: null, label: null, invoice_number: 'INV-W6-1', paid_on: '2026-12-08' }] }];
  } }];
  await openTs();
  const b2 = await btn();
  ok('tampered packs: 2 bookings in the reference pack, 2 slip files in the slip pack', /· 2 ใบ/.test(b2.refTitle || '') && /สลิป\s*2/.test(b2.slip || ''), b2);
  const inv = await ev((d) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-p1'); return { s: tsInvSlips(b), none: tsInvSlips(SB_BOOKINGS.find((x) => x.id === 'zz-p2')) }; }, DAY);
  ok('tsInvSlips(p1) = the invoice slips of the slip pack (paid 400, bill INV-W6-1, caption names the bill, method and date)', inv.s.paid === 400 && inv.s.no === 'INV-W6-1' && inv.s.list.length === 1 && inv.s.list[0].f.id === 'att_w6_b' && /จ่ายผ่านบิล INV-W6-1/.test(inv.s.list[0].cap) && /08\/12\/2026/.test(inv.s.list[0].cap), inv);
  ok('...a booking on the sheet with no slip gets an empty answer', inv.none.list.length === 0 && inv.none.paid === 0, inv.none);
  tamper = [];
  await ev(() => { laOps.travelRows.clear(); laOps.travelServer.clear(); if (laOps.moneyReports && laOps.moneyReports.clear) laOps.moneyReports.clear(); if (laOps.travelView && laOps.travelView.clear) laOps.travelView.clear(); });

  // ── booked-heads trend
  const n1 = calls.length;
  const series = await ev((t) => laOps.dailyTrend.bookedSeries(t).then((s) => ({ keys: s.keys, last: s.pts[s.pts.length - 1].by, tot: s.pts[s.pts.length - 1].tot, one: !!s.bookedOneSeries, names: Object.keys(s.mkt).map((k) => s.mkt[k].name) })), TODAY);
  const srvC = await api('/v1/bookings/daily-counts?markets=1&from=' + addDays(TODAY, -13) + '&to=' + TODAY);
  const lastSrv = srvC.days[srvC.days.length - 1];
  ok('bookedSeries asked daily-counts with markets=1', callsMatch(/daily-counts\?[^ ]*markets=1/, n1).length >= 1, callsMatch(/daily-counts/, n1));
  ok('the trend is stacked by market from the server: the last day\'s heads per market = the server\'s', !series.one && Object.keys(lastSrv.markets).every((m) => series.last[m] === lastSrv.markets[m].pax) && series.tot === lastSrv.pax, { series, lastSrv });
  tamper = [{ re: /daily-counts/, fn: (j) => { const d = j.days[j.days.length - 1]; d.markets = { ru: { bookings: 3, pax: 99 }, b2c: { bookings: 1, pax: 5 } }; d.pax = 104; } }];
  await ev(() => laOps.dailyTrend.clear());
  const s2 = await ev((t) => laOps.dailyTrend.bookedSeries(t).then((s) => ({ last: s.pts[s.pts.length - 1].by, tot: s.pts[s.pts.length - 1].tot, names: Object.keys(s.mkt).map((k) => s.mkt[k].name) })), TODAY);
  ok('tampered markets (ru 99, b2c 5): the last point stacks 99 + 5 = 104, the legend names the markets', s2.last.ru === 99 && s2.last.b2c === 5 && s2.tot === 104 && s2.names.includes('Russia') && s2.names.includes('B2C'), s2);
  tamper = [];
  await ev(() => laOps.dailyTrend.clear());

  // ── upgrade targets
  await ev((d) => bookingV2EnsureOpsRange({ from: d, to: d, refresh: true }), DAY); await idle(); await settle(800);
  const targetsOf = () => ev((d) => bookingV2UpgTargets(d, 'r5', 'zz-p1').map((x) => ({ rid: x.rid, name: x.name, pier: x.pier, free: x.free })), DAY);
  const n2 = calls.length;
  await targetsOf();
  ok('the Upgrade dialog\'s list asks GET /v1/bookings/{id}/upgrade-targets?trip_id=&date=', await waitCalls(/^GET \/v1\/bookings\/[^/]+\/upgrade-targets\?trip_id=[^&]+&date=2026-12-08 200/, 8000), callsMatch(/upgrade-targets/, n2));
  await settle(300);
  const srvU = await api(`/v1/bookings/${bk.p1.id}/upgrade-targets?trip_id=${bk.p1.trip}&date=${DAY}`);
  const u1 = await targetsOf();
  ok('targets = the server\'s routes (not the booking\'s own, one boat sails each, free seats as served)', JSON.stringify(u1.map((x) => x.rid).sort()) === JSON.stringify(srvU.targets.map((x) => x.route_id).sort()) && u1.length >= 2 && u1.every((x) => srvU.targets.find((s) => s.route_id === x.rid).free_seats === x.free), { u1, srvU });
  tamper = [{ re: /\/upgrade-targets/, fn: (j) => { j.targets[0].route_name = 'W6 RENAMED ROUTE'; j.targets[0].free_seats = 1; } }];
  await ev(() => laOps.srv.clear());
  await targetsOf(); await settle(1200);
  const u2 = await targetsOf();
  ok('tampered target (renamed, 1 seat free): the list shows it', u2.some((x) => x.name === 'W6 RENAMED ROUTE' && x.free === 1), u2);
  await ev((d) => { window._bkUpg = { bkId: 'zz-p1', date: d, from: 'r5', to: '', reason: '', charge: '' }; bookingV2UpgModal(); }, DAY);
  const dom = await ev(() => { const ov = document.getElementById('bkv2-upg-ov'); const full = ov && Array.from(ov.querySelectorAll('input[type=radio][disabled]')).length; return { text: ov ? ov.innerText : '', full }; });
  ok('the dialog draws the server\'s row: its name, "1 free", and a booking of 2 heads cannot pick it (disabled)', /W6 RENAMED ROUTE/.test(dom.text) && /1 free/.test(dom.text) && dom.full >= 1, dom);
  await ev(() => { const ov = document.getElementById('bkv2-upg-ov'); if (ov) ov.remove(); window._bkUpg = null; });
  tamper = [];
  await ev(() => laOps.srv.clear());
});

// ═══ 3 · Transfer Fleet: jobs of a cell, demand and groups of a route, a van's cost ═══
section('3', async () => {
  console.log('\n[3] _vehDayJobN <- van-days jobs · _vehRouteDemand / _vehGroupsForDay <- van-board · vanCostSet <- vans.cost_per_day');
  await ev((d) => { _vehDate = d; const el = document.querySelector('.nav-item[data-view="vehicles"]'); if (el) nav(el); renderVehicles(); }, DAY);
  await waitFor((a) => { const c = laOps.vanJobs.cellOf(a.v, a.d); return !!c; }, { v: vanA.id, d: DAY }, 20000);
  await idle(); await settle(800);
  const srvDays = (await api(`/operations/van-days?from=${DAY}&to=${DAY}`)).days;
  const cellA = srvDays.find((c) => c.van_id === vanA.id);
  ok('server: the van-day cell carries jobs, bookings and pax', cellA && Number.isInteger(cellA.jobs) && Number.isInteger(cellA.bookings) && Number.isInteger(cellA.pax), cellA);
  const j0 = await ev((a) => ({ shown: _vehDayJobN(a.v, a.d), legacy: _vehDayJobN.__orig(a.v, a.d) }), { v: vanA.id, d: DAY });
  ok('_vehDayJobN = the cell\'s server job count', j0.shown === cellA.jobs, { j0, cellA });
  tamper = [{ re: /\/operations\/van-days\?/, fn: (j) => { for (const c of j.days) if (c.van_id === vanA.id && c.service_date === DAY) c.jobs = 42; } }];
  await ev(() => laOps.fleetServer.refresh(window._vehDate)); await settle(1200);
  const j1 = await ev((a) => ({ shown: _vehDayJobN(a.v, a.d), legacy: _vehDayJobN.__orig(a.v, a.d) }), { v: vanA.id, d: DAY });
  ok('tampered cell (42 jobs): the matrix cell shows 42 where legacy counts the bookings it holds', j1.shown === 42 && j1.legacy !== 42, j1);
  tamper = [];
  await ev(() => laOps.fleetServer.refresh(window._vehDate)); await settle(800);

  // ── the van board: demand and groups
  const boardOf = (r) => ev((a) => { const d = _vehRouteDemand(a.r, a.d), g = _vehGroupsForDay(a.r, a.d); return { d, g, ld: _vehRouteDemand.__orig(a.r, a.d), lg: _vehGroupsForDay.__orig(a.r, a.d) }; }, { r, d: DAY });
  await ev(() => laOps.fleetW6.clear());
  await boardOf('r5');
  ok('the board is read once for the day: GET /operations/van-board?date=', await waitCalls(/^GET \/operations\/van-board\?date=2026-12-08 200/, 8000), callsMatch(/van-board/));
  await settle(400);
  const srvB = (await api('/operations/van-board?date=' + DAY)).routes.find((r) => r.route_id === 'r5');
  const bo = await boardOf('r5');
  ok('_vehRouteDemand / _vehGroupsForDay = the board\'s demand and group counts', bo.d.pax === srvB.demand.pax && bo.d.pickup === srvB.demand.pickup && bo.g.withVan === srvB.groups_with_van && bo.g.woVan === srvB.groups_without_van && bo.g.total === srvB.groups_with_van + srvB.groups_without_van, { bo, srvB });
  tamper = [{ re: /\/operations\/van-board\?/, fn: (j) => { for (const r of j.routes) if (r.route_id === 'r5') { r.demand = { pax: 999, pickup: 321 }; r.groups_with_van = 5; r.groups_without_van = 4; } } }];
  await ev(() => laOps.fleetW6.clear());
  await boardOf('r5'); await settle(1500);
  const bo2 = await boardOf('r5');
  ok('tampered board (demand 999 / 321, groups 5 with a van + 4 without): the figures follow it, not the bookings the browser holds', bo2.d.pax === 999 && bo2.d.pickup === 321 && bo2.g.total === 9 && bo2.g.withVan === 5 && bo2.g.woVan === 4 && bo2.ld.pax !== 999, bo2);
  tamper = [];
  await ev(() => laOps.fleetW6.clear());

  // ── a van's cost per day
  const n0 = bodies.length;
  await ev((id) => vanCostSet(id, '1234.5'), vanA.id);
  await waitCalls(/^PATCH \/operations\/vans\//, 6000); await idle();
  const patch = reqOf(/PATCH \/operations\/vans\//, n0).pop();
  ok('vanCostSet sends the typed cost only: PATCH /operations/vans/{id} { cost_per_day }', patch && patch.status === 200 && JSON.stringify(patch.req) === '{"cost_per_day":1234.5}', patch);
  const vs = await api('/operations/vans');
  ok('server: the van holds the cost; the screen\'s van has it from the answer', Number((vs.vans.find((v) => v.id === vanA.id) || {}).cost_per_day) === 1234.5 && (await ev((id) => vehGet(id).costPerDay, vanA.id)) === 1234.5, vs.vans.find((v) => v.id === vanA.id));
  await ev((id) => vanCostSet(id, ''), vanA.id);
  await waitCalls(/^PATCH \/operations\/vans\/.* 200/, 6000); await idle(); await settle(300);
  const cleared = (await api('/operations/vans')).vans.find((v) => v.id === vanA.id).cost_per_day;
  ok('an empty box clears the rate (null)', cleared === null && (await ev((id) => vehGet(id).costPerDay, vanA.id)) === null, cleared);
  tamper = [{ re: /\/operations\/van-days\?/, fn: (j) => { for (const v of j.vans || []) if (v.id === vanB.id) v.cost_per_day = 777; } }];
  await reboot();
  await ev((d) => { _vehDate = d; const el = document.querySelector('.nav-item[data-view="vehicles"]'); if (el) nav(el); renderVehicles(); }, DAY);
  await waitFor((id) => typeof vehGet === 'function' && vehGet(id) && vehGet(id).costPerDay === 777, vanB.id, 15000);
  const cb = await ev((id) => vehGet(id).costPerDay, vanB.id);
  ok('tampered van list (cost 777): the van carries the server\'s cost (the Daily Report reads it from there)', cb === 777, cb);
  tamper = [];
  await reboot();
});

// ═══ 4 · costing what-ifs (calc-batch), the override editor's placeholders, Trip P&L day aggregates and agents ═══
section('4', async () => {
  console.log('\n[4] ctProfitAt / ctChdAt / ctStepCount / ctBreakEven <- calc-batch · ctEffLine <- line_parts · pxDayAgg / pxAgents <- trip-pl bands, best, agents');
  await goView('costing'); await waitFor(() => !!document.querySelector('#ct-body') && typeof ctPlans === 'function' && ctPlans().some((p) => p.name === 'W5 Plan A'), null, 20000);
  await idle(); await settle(1200);
  const planOf = () => ev(() => { const p = ctPlans().find((x) => x.name === 'W5 Plan A'); window._ct.pid = p.id; return { id: p.id, pax: p.pax }; });
  const P = await planOf();
  const figsOf = (a) => ev((a) => { const pl = Object.assign({}, ctPlan(a.id), a.change || {}); const pr = ctProfitAt(pl, a.n); return { p: pr.p, rev: pr.rev, ch: ctChdAt(pl, a.n), steps: ctStepCount(pl, a.n) }; }, a);
  const batchSrv = async (n, change) => (await api('/v1/costing/calc-batch', { method: 'POST', body: JSON.stringify({ plan_id: P.id, scenarios: [Object.assign({ pax: n }, change || {})] }) })).scenarios[0];
  // a STORED plan's head counts are the sheet's curve already: no what-if is asked for them
  const c0 = calls.length;
  const f37 = await figsOf({ id: P.id, n: 37 }); await settle(700);
  const s37 = await batchSrv(37);
  ok('a stored plan at 37 heads: the curve point = the server\'s scenario (profit, revenue, children, steps), and no calc-batch is asked', Math.abs(f37.p - s37.calc.profit) < 0.01 && Math.abs(f37.rev - s37.calc.revenue) < 0.01 && f37.ch === s37.children && f37.steps === s37.step_count && !callsMatch(/calc-batch/, c0).length, { f37, s37: { p: s37.calc.profit, ch: s37.children, st: s37.step_count }, calls: callsMatch(/calc-batch/, c0) });
  // a plan changed on the screen (a tier price tried) is a what-if
  const n0 = bodies.length, c1 = calls.length;
  const legacy1 = await figsOf({ id: P.id, n: 39, change: { price: 4321 } });
  ok('a plan changed on the screen asks POST /v1/costing/calc-batch', await waitCalls(/^POST \/v1\/costing\/calc-batch 200/, 8000), callsMatch(/calc-batch/, c1));
  await settle(700);
  const batch = reqOf(/POST \/v1\/costing\/calc-batch/, n0);
  ok('...the plan\'s fields and the template, with the head counts as the only scenario figures (no profit, no revenue)', batch.length >= 1 && batch[0].req.plan && batch[0].req.template && batch[0].req.scenarios.every((s) => Number.isInteger(s.pax)) && !JSON.stringify(batch[0].req).includes('profit') && !JSON.stringify(batch[0].req).includes('revenue'), batch[0] && Object.keys(batch[0].req));
  const s39 = await batchSrv(39, { price: 4321 });
  const f39 = await figsOf({ id: P.id, n: 39, change: { price: 4321 } });
  ok('ctProfitAt / ctChdAt / ctStepCount of the changed plan = the server\'s scenario', Math.abs(f39.p - s39.calc.profit) < 0.01 && Math.abs(f39.rev - s39.calc.revenue) < 0.01 && f39.ch === s39.children && f39.steps === s39.step_count, { f39, s39: { p: s39.calc.profit, rev: s39.calc.revenue } });
  tamper = [{ method: 'POST', re: /\/v1\/costing\/calc-batch$/, fn: (j) => { for (const s of j.scenarios) { s.calc.profit = 12345.67; s.calc.revenue = 55555; s.children = 7; s.step_count = 9; s.break_even = 11; } } }];
  await figsOf({ id: P.id, n: 41, change: { price: 4999 } }); await settle(1500);
  const f41 = await figsOf({ id: P.id, n: 41, change: { price: 4999 } });
  ok('tampered scenario (profit 12345.67, revenue 55555, 7 children, 9 steps): the sheet shows them', f41.p === 12345.67 && f41.rev === 55555 && f41.ch === 7 && f41.steps === 9, f41);
  const beOf = () => ev((a) => { const pl = Object.assign({}, ctPlan(a.id), { price: 4999 }); return ctBreakEven(pl, ctPlanSeats(pl) * Math.max(1, +pl.boats || 1)); }, { id: P.id });
  await beOf(); await settle(1500);
  const be = await beOf();
  ok("ctBreakEven of the changed plan = the scenario's break-even (tampered 11) for the plan's own seats", be === 11, be);
  tamper = [];
  // ── the override editor's placeholders
  tamper = [{ method: 'POST', re: /\/v1\/costing\/calc$/, fn: (j) => { const lp = j.sheet.line_parts; lp[0].line_off = true; lp[0].parts[0].effective.unit = 4242; } }];
  const pc = calls.filter((c) => /^POST \/v1\/costing\/calc 200/.test(c)).length;
  await ev((a) => { laOps.wrote('w6test'); const pl = ctPlan(a.id); ctProfitAt(pl, pl.pax); window._ct.tab = 'ovr'; ctRender(); }, { id: P.id });
  await waitFor((n) => false, pc, 1800); await settle(1500);
  const eff = await ev((a) => { const pl = ctPlan(a.id), T = ctTpl(), ln = T.lines[0]; const L = ctEffLine(ln, pl); return { off: L.off, u: L.parts[0].u, id: ln.id }; }, { id: P.id });
  const srvSheet = (await api('/v1/costing/plans/' + P.id)).sheet.line_parts[0];
  ok('ctEffLine: the first line\'s first part shows the server\'s effective unit (tampered 4242, line switched off)', eff.u === 4242 && eff.off === true, { eff, srv: srvSheet.parts[0].effective });
  tamper = [];
  await ev((a) => { laOps.wrote('w6test'); const pl = ctPlan(a.id); ctProfitAt(pl, pl.pax); window._ct.tab = 'plan'; ctRender(); }, { id: P.id });
  await settle(2000);
  const eff2 = await ev((a) => { const pl = ctPlan(a.id), T = ctTpl(), ln = T.lines[0]; const L = ctEffLine(ln, pl); return { off: L.off, u: L.parts[0].u }; }, { id: P.id });
  ok('(untampered, after a new answer) the placeholder is the template\'s unit as the plan prices it', eff2.u === srvSheet.parts[0].effective.unit && eff2.off === srvSheet.line_off, { eff2, srv: srvSheet.parts[0].effective });

  // ── Trip P&L: bands, best boat, agents
  await goView('trippl'); await settle(400);
  await ev((d) => { _px.date = d; _px.tab = 'd'; _px.pier = ''; _px.mon = d.slice(0, 7); laOps.costingPL.clear(); renderTripPL(); }, DAY);
  await waitFor((d) => { try { return pxTrip(d, 'b6').px.tot > 0; } catch (_) { return false; } }, DAY, 20000); await idle(); await settle(600);
  const srvD = await api('/v1/reports/trip-pl?date=' + DAY);
  const agg = await ev((d) => { const a = pxDayAgg(d, ''); return { bandN: a.bandN, bandNet: a.bandNet, bandPax: a.bandPax, best: a.best, agents: Object.keys(a.agents).map((k) => [k, a.agents[k].n, a.agents[k].pax, a.agents[k].rev, a.agents[k].expPax, Object.keys(a.agents[k].routes || {})]) }; }, DAY);
  ok('pxDayAgg: the four load-factor bands are the day answer\'s (trips, net, heads), the best boat its best', JSON.stringify(agg.bandN) === JSON.stringify(srvD.bands.map((b) => b.n)) && JSON.stringify(agg.bandNet) === JSON.stringify(srvD.bands.map((b) => b.net)) && JSON.stringify(agg.bandPax) === JSON.stringify(srvD.bands.map((b) => b.pax)) && (srvD.best ? agg.best.name === srvD.best.name : !agg.best), { agg, bands: srvD.bands, best: srvD.best });
  const sa = srvD.agents[0];
  ok('...and the agent sums: bookings, heads, revenue (ex VAT), the rate-card heads, per programme', agg.agents.length === srvD.agents.length && agg.agents[0][0] === sa.name && agg.agents[0][1] === sa.bookings && agg.agents[0][2] === sa.heads && Math.abs(agg.agents[0][3] - sa.revenue) < 0.01 && agg.agents[0][4] === sa.expected_pax && agg.agents[0][5].join() === Object.keys(sa.routes).join(), { agg: agg.agents, sa });
  tamper = [{ re: /\/v1\/reports\/trip-pl\?date=2026-12-08/, fn: (j) => {
    j.bands[0].n = 7; j.bands[0].net = -777; j.bands[0].pax = 70; j.best = { boat_id: 'b6', name: 'W6 BEST BOAT', profit: 99999 };
    j.agents[0].heads = 99; j.agents[0].bookings = 11; j.agents[0].routes.r5.heads = 99;
    const t = j.trips.find((x) => x.boat_id === 'b6'); t.agents = [{ agent_id: 'a01', key: 'a01', name: 'W6 AGENT', b2c: false, market_id: 'ru', bookings: 3, heads: 12, children: 2, amount: 12345, revenue: 11000, expected_total: 13000, expected_pax: 12, expected_missing: 0, zones: { PK: 12 }, rates: { 'W6 card': 12 } }];
  } }];
  await ev((d) => { laOps.costingPL.clear(); renderTripPL(); }, DAY);
  await waitFor(() => pxDayAgg('2026-12-08', '').bandN[0] === 7, null, 20000); await idle(); await settle(600);
  const agg2 = await ev((d) => { const a = pxDayAgg(d, ''); const ag = pxAgents(d, 'b6'); return { bandN: a.bandN, bandNet: a.bandNet[0], bandPax: a.bandPax[0], best: a.best, pax: a.agents['Sun Tour'].pax, n: a.agents['Sun Tour'].n, rpax: a.agents['Sun Tour'].routes.r5.pax, ag }; }, DAY);
  ok('tampered day (band 7 trips / -777 / 70 heads, best "W6 BEST BOAT", Sun Tour 99 heads): pxDayAgg shows them', agg2.bandN[0] === 7 && agg2.bandNet === -777 && agg2.bandPax === 70 && agg2.best.name === 'W6 BEST BOAT' && agg2.best.profit === 99999 && agg2.pax === 99 && agg2.n === 11 && agg2.rpax === 99, agg2);
  ok('tampered trip agents: pxAgents(b6) lists the server\'s split (12 heads of which 2 children, amount 12345, rate-card total 13000, rate "W6 card")', agg2.ag.length === 1 && agg2.ag[0].name === 'W6 AGENT' && agg2.ag[0].head === 12 && agg2.ag[0].chd === 2 && agg2.ag[0].ad === 10 && agg2.ag[0].amt === 12345 && agg2.ag[0].exp === 13000 && agg2.ag[0].rtn['W6 card'] === 12 && agg2.ag[0].zn.PK === 12, agg2.ag);
  const html = await ev(() => (document.getElementById('trippl-host') || {}).innerHTML || '');
  tamper = [];
  await ev((d) => { laOps.costingPL.clear(); renderTripPL(); }, DAY); await settle(1500);
});

// ═══ 5 · money: the agents with something to invoice, the By-trip payment chip ═══
section('5', async () => {
  console.log('\n[5] acctNewInvoiceRender <- invoices/candidate-agents · bookingV2PayChip <- pfm_status, past_cutoff, internal_free');
  await goView('accounting'); await settle(600);
  const n0 = calls.length;
  await ev(() => acctNewInvoiceOpen());
  ok('the New invoice dialog asks GET /v1/invoices/candidate-agents?kind=booking', await waitCalls(/^GET \/v1\/invoices\/candidate-agents\?kind=booking 200/, 8000), callsMatch(/candidate-agents/, n0));
  await settle(500);
  const srvC = (await api('/v1/invoices/candidate-agents?kind=booking')).agents;
  const opts = () => ev(() => Array.from(document.querySelectorAll('#acct-modal select option')).map((o) => [o.value, o.textContent.trim()]));
  const o1 = await opts();
  ok('the Agent drop-down lists the agents the server would list candidates for', JSON.stringify(o1.slice(1).map((x) => x[0]).sort()) === JSON.stringify(srvC.map((a) => a.agent_id).sort()) && o1.length - 1 === srvC.length && srvC.length >= 1, { o1, srvC });
  await ev(() => acctModalClose());
  tamper = [{ re: /\/v1\/invoices\/candidate-agents/, fn: (j) => { j.agents = [{ agent_id: 'a01', code: 'W6', name: 'W6 AGENT ONE', bookings: 1, total: 1 }]; } }];
  await ev(() => acctNewInvoiceOpen()); await waitCalls(/candidate-agents/, 6000); await settle(900);
  const o2 = await opts();
  ok('tampered list (one agent, "W6 · W6 AGENT ONE"): the drop-down has just that agent', o2.length === 2 && o2[1][0] === 'a01' && /W6 · W6 AGENT ONE/.test(o2[1][1]), o2);
  tamper = [];
  await ev(() => acctModalClose());

  // ── the payment chip: the server's PFM status instead of the browser's reading of the invoice, the cutoff and the total
  const chip = (o) => ev((o) => { const bk = Object.assign({ id: 'w6chip', agentId: 'a01', trips: [{ date: '2031-01-01' }], ops: {}, total: 1000 }, o); const a = sbGetAgent('a01'); const was = a.payType; a.payType = 'proforma'; try { const h = bookingV2PayChip(bk); const m = />([^<]+)</.exec(h); return { text: m ? m[1] : h, legacy: />([^<]+)</.exec(bookingV2PayChip.__orig(bk))[1] }; } finally { a.payType = was; } }, o);
  const c1 = await chip({ pfmStatus: 'hold', pastCutoff: false, ops: { pfm: { decision: 'approved' } } });
  ok('PFM hold from the server beats the local decision (legacy would say "Extended")', c1.text === 'On hold' && c1.legacy === 'Extended', c1);
  const c2 = await chip({ pfmStatus: 'alert', pastCutoff: true });
  ok('server status alert (unpaid past the cutoff): the "เลย cutoff" label although the browser sees a date in 2031', /เลย cutoff/.test(c2.text) && !/เลย cutoff/.test(c2.legacy), c2);
  const c3 = await chip({ pfmStatus: 'paid' });
  const c4 = await chip({ pfmStatus: 'awaiting' });
  const c5 = await chip({ pfmStatus: 'no_invoice' });
  const c6 = await chip({ pfmStatus: 'approved' });
  ok('server statuses paid / awaiting / no_invoice / approved: "Paid" / "Awaiting" / "Pro Forma" / "Extended"', c3.text === 'Paid' && c4.text === 'Awaiting' && c5.text === 'Pro Forma' && c6.text === 'Extended', [c3.text, c4.text, c5.text, c6.text]);
  const c7 = await chip({});
  ok('a booking with no server status keeps legacy\'s chip', c7.text === c7.legacy, c7);
  const staff = (o) => ev((o) => { const bk = Object.assign({ id: 'w6staff', agentId: 'a01', purpose: 'staff_welfare', staffId: 's1', trips: [{ date: '2031-01-01' }], ops: {}, total: 0 }, o); return { text: /([^<>]+)<\/span>$/.exec(bookingV2PayChip(bk))[1], legacy: /([^<>]+)<\/span>$/.exec(bookingV2PayChip.__orig(bk))[1] }; }, o);
  const s1 = await staff({ srvFlags: { internalFree: false } });
  ok('a staff trip the server says is owed (internal_free false): not the FREE label though the local total is 0', s1.legacy === 'FOC · Welfare' && s1.text !== 'FOC · Welfare', s1);
  const s2 = await staff({ total: 500, srvFlags: { internalFree: true } });
  ok('a staff trip the server says is free (internal_free true): the label stays, though the local total is 500', s2.text === 'FOC · Welfare' && s2.legacy !== 'FOC · Welfare', s2);
});

//@@SECTIONS

for (const [name, fn] of todo) {
  if (ONLY && !ONLY.includes(name)) continue;
  try { await fn(); } catch (e) { ok('section ' + name + ' ran to the end', false, String(e.stack || e).slice(0, 900)); }
}
console.log('\nbrowser errors:', errors.length ? errors : 'none');
console.log('server refusals:', refusals.length ? refusals : 'none');
console.log('native dialogs:', dialogs);
console.log(fails.length ? '\nFAILED: ' + fails.join(' | ') : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
