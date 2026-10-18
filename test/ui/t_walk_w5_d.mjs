// t_walk_w5_d · browser walk of the "day operations, guide, travel, fleet, costing" wiring (w5-d) against a REAL operation-backend (in-process store, seeded)
//   1 Pier Check-in sheet: arrival, pier, splits, totals, programmes <- GET /v1/pier-checkin
//   (more sections are added below as each part is wired; see docs/walk/w5-d.md)
//
//   node test/ui/t_walk_w5_d.mjs       (OPS_BACKEND_DIR, default D:/projects/operation-backend · WALK_ONLY=1,3 runs sections)
//
// Every check reads BOTH sides: the screen (functions / DOM) and the server (asked directly). "Tamper" checks change what the
// server answers on the wire (the test's proxy) to something legacy's arithmetic would never give, and expect the screen to show
// the server's figure: that is what proves the browser no longer decides.
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
  if (req.method() === 'GET' && r.status === 200) for (const t of tamper) if (t.re.test(u.pathname + u.search)) { try { const j = JSON.parse(buf.toString()); t.fn(j, u); buf = Buffer.from(JSON.stringify(j)); } catch (_) {} }
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

// ── 4 · meals: two bookings on b6 with special meals; an overnight charter on b13 coming back OV[1] ──
await mk('mm1', 'W5 MEAL ONE', 4, { specialMeals: { veg: 1, vegan: 0, halal: 1, allergies: '', allergyList: [{ name: 'Peanut', qty: 2 }] } });
await mk('mm2', 'W5 MEAL TWO', 4, { specialMeals: { veg: 0, vegan: 1, halal: 0, allergies: 'no shellfish', allergyList: [{ name: 'Peanut', qty: 1 }, { name: 'Egg', qty: 1 }] } });
for (const k of ['mm1', 'mm2']) await seed('PATCH', `/operations/trip-ops/${bk[k].trip}`, { boat_id: 'b6' });
const venue = await seed('POST', '/v1/meal-venues', { name: 'W5 Venue' });
for (const r of ['r5', 'r10']) await seed('PUT', `/v1/routes/${r}/meal-venue`, { meal_venue_id: venue.id });
const OV = ['2026-12-12', '2026-12-15'];
for (const d of OV) await seed('POST', '/operations/deployments', { boat_id: 'b13', route_id: 'r10', service_date: d, capacity: 38, deploy_anyway: true });
{
  const r = await send('POST', '/v1/bookings', { external_id: 'b2c_w5_ovn', total: 9000, leadPax: 'W5 OVERNIGHT', leadNationality: 'RU', leadPhone: '+7 900 1', pickupSelf: true,
    trips: [{ routeId: 'r10', date: OV[0], pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13', ovn: 'return', ovnReturnDate: OV[1] },
            { routeId: 'r10', date: OV[1], pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13', ovnLeg: true, ovnOf: 0 }] });
  if (r.status !== 201) { console.log('seed: overnight charter refused', r.status, JSON.stringify(r.body).slice(0, 300)); process.exit(2); }
  bk.ov = { id: r.body.id, ext: 'b2c_w5_ovn', body: r.body };
}

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

// ── 7 · a cancelled booking with a boat (listed in cancelled_rows) ──
await mk('cx1', 'W5 CANCELLED', 2);
await seed('PATCH', `/operations/trip-ops/${bk.cx1.trip}`, { boat_id: 'b6' });
await seedV('POST', `/v1/bookings/${bk.cx1.id}/cancel`, bk.cx1.id, { category: 'sick', charge_type: 'none' });

// ── 8 · auto assign (DAY_A) and the fleet matrix (DAY_F) ──
const DAY_A = '2026-12-20', DAY_F = '2026-12-09';
for (const [b, r, cap] of [['b6', 'r5', 40], ['b7', 'r5', 34]]) await seed('POST', '/operations/deployments', { boat_id: b, route_id: r, service_date: DAY_A, capacity: cap, deploy_anyway: true });
await mk('au1', 'W5 AUTO ONE', 20, {}, {}, 'r5', DAY_A); await mk('au2', 'W5 AUTO TWO', 15, {}, {}, 'r5', DAY_A); await mk('au3', 'W5 AUTO THREE', 10, {}, {}, 'r5', DAY_A);
await seed('POST', `/operations/vans/${vanB.id}/status-ranges`, { status: 'maintenance', from_date: DAY_F, to_date: addDays(DAY_F, 1), note: 'w5 gearbox' });
await seed('PUT', `/operations/van-days/${DAY_F}/${vanC.id}`, { status: 'off' });

//@@SEED
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
const s0 = await ev(() => ({ failed: laOps.state.failed }));
ok('boot: nothing failed to load', s0.failed.length === 0, s0);
const openPier = async (date) => {
  await ev((d) => { _pckDate = d; _pckLand = false; const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); renderPierCheckin(); }, date);
  await waitFor(() => !!document.querySelector('#piercheckin-host'), null, 10000);
  await idle(); await settle(1200);
};

// ═══ 1 · the Pier Check-in sheet's own arithmetic <- GET /v1/pier-checkin ═══
const reread = async () => { await ev(() => laOps.pierService.clear()); await ev((d) => laOps.pierService.ensure(d, true), DAY); await settle(500); };
section('1', async () => {
  console.log('\n[1] Pier Check-in: pckArrivalOf, pckInPier, pckExpand*Splits, pckAgg, pckSheetAgg, pckProgData, pckProgStatus <- GET /v1/pier-checkin');
  const n0 = calls.length;
  await openPier(DAY);
  await waitFor((d) => laOps.pierService && laOps.pierService.day(d), DAY, 15000);
  ok('Pier Check-in asked GET /v1/pier-checkin?date=…', callsSince(n0).some((c) => /^GET \/v1\/pier-checkin\?date=2026-12-08 200/.test(c)), callsSince(n0).filter((c) => /pier-checkin/.test(c)));
  const S = await api('/v1/pier-checkin?date=' + DAY);
  const rowsOf = (k) => S.rows.filter((r) => r.booking_id === bk[k].id);
  const arrOf = (ext) => ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.ext), t = b.trips[0]; return pckArrivalOf({ b, t, O: bkOpsRead(b, a.date), vanId: '' }); }, { ext, date: DAY });
  // arrival
  for (const [k, want] of [['p1', 'PK'], ['p2', 'OWN'], ['p3', 'NOVAN'], ['p4', 'PK']]) {
    const got = await arrOf('zz-' + k);
    ok(`pckArrivalOf ${k}: ${want} = the server row's arrival`, got === want && rowsOf(k)[0].arrival === want, { got, srv: rowsOf(k)[0].arrival });
  }
  tamper = [{ re: /\/v1\/pier-checkin\?date=2026-12-08$/, fn: (j) => { for (const r of j.rows) if (r.booking_id === bk.p2.id) r.arrival = 'KL'; for (const r of j.rows) if (r.booking_id === bk.p1.id) r.arrival = 'NOVAN'; } }];
  await reread();
  ok('tampered answer (p2 KL, p1 NOVAN): pckArrivalOf gives the server\'s arrival, not the zone / van legacy would read', (await arrOf('zz-p2')) === 'KL' && (await arrOf('zz-p1')) === 'NOVAN', [await arrOf('zz-p2'), await arrOf('zz-p1')]);
  await ev(() => renderPierCheckin()); await settle(400);
  const chipsKL = await ev(() => Array.from(document.querySelectorAll('#piercheckin-host [onclick*="pckSetArr"]')).map((b) => b.getAttribute('onclick')));
  ok('the arrival filter chips on the sheet follow the server (a KL chip and a NOVAN chip exist though no booking is in KL by zone)', chipsKL.some((c) => c.includes("'KL'")) && chipsKL.some((c) => c.includes("'NOVAN'")), chipsKL);
  tamper = [];
  await reread();

  // splits
  const bs = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-p5'), t = b.trips[0]; const row = { b, t, O: bkOpsRead(b, a.date), booked: ckBookedPax(t), expect: pckExpected(b, a.date, ckBookedPax(t)), money: { due: 500, got: 0, noSlip: 0, pierFee: 0, pierPaid: 0 } };
    return pckExpandBoatSplits(row, b, a.date, []).map((r) => ({ bid: r.bid, idx: r.bsIdx, n: r.bsN, booked: r.booked, expect: r.expect, due: r.money.due })); }, { date: DAY });
  const sb = rowsOf('p5').filter((r) => r.split && r.split.by === 'boat');
  ok('pckExpandBoatSplits p5: one row per server part (boat b6 / b7, 2 + 2 booked, expected)', sb.length === 2 && bs.length === 2 && bs.every((r, i) => r.bid === sb[i].boat_id && r.booked === sb[i].booked && r.expect === sb[i].expected && r.idx === sb[i].split.index && r.n === 2), { bs, sb });
  ok('...money is the server\'s: the first row keeps the booking\'s due, the second row is 0', bs[0].due === sb[0].money.due && bs[1].due === 0, bs);
  tamper = [{ re: /\/v1\/pier-checkin\?date=2026-12-08$/, fn: (j) => { const p = j.rows.filter((r) => r.booking_id === bk.p5.id); p[0].booked = 3; p[0].expected = 2; p[1].booked = 1; p[1].expected = 1; } }];
  await reread();
  const bs2 = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-p5'), t = b.trips[0]; const row = { b, t, O: bkOpsRead(b, a.date), booked: 4, expect: 4, money: { due: 0 } };
    return pckExpandBoatSplits(row, b, a.date, []).map((r) => [r.booked, r.expect]); }, { date: DAY });
  ok('tampered answer (3+1 booked, 2+1 expected): the split rows show the server\'s heads, not the booking\'s 2 + 2', JSON.stringify(bs2) === JSON.stringify([[3, 2], [1, 1]]), bs2);
  tamper = [];
  await reread();
  const vs = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-p6'), t = b.trips[0]; const O = bkOpsRead(b, a.date); const row = { b, t, O, booked: ckBookedPax(t), expect: ckBookedPax(t), money: { due: 0 } };
    return pckExpandVanSplits(row, b, a.date, []).map((r) => ({ idx: r.vsIdx, n: r.vsN, booked: r.booked, expect: r.expect, arr: r.arr })); }, { date: DAY });
  const sv = rowsOf('p6').filter((r) => r.split && r.split.by === 'van');
  ok('pckExpandVanSplits p6: one row per server van part (3 + 1), arrival from the server', sv.length === 2 && vs.length === 2 && vs.every((r, i) => r.booked === sv[i].booked && r.expect === sv[i].expected && r.arr === sv[i].arrival && r.n === 2), { vs, sv });

  // totals (the rows' server figures)
  const aggOf = (exts) => ev((a) => { const date = a.date; const rows = a.exts.map((e) => { const b = SB_BOOKINGS.find((x) => x.id === e), t = b.trips[0]; return { b, t, O: bkOpsRead(b, date), booked: ckBookedPax(t), expect: ckBookedPax(t), ck: null, money: { due: 0 } }; }); return pckAgg(rows); }, { exts, date: DAY });
  const A1 = await aggOf(['zz-p1', 'zz-p2', 'zz-p3', 'zz-p4']);
  const want = S.rows.filter((r) => [bk.p1.id, bk.p2.id, bk.p3.id, bk.p4.id].includes(r.booking_id));
  ok('pckAgg(p1..p4): n, pax, arr / clr / on rows and heads = the sum of the server rows (p1 arrived, p2 cleared, p3 boarded)', A1.n === 4 && A1.pax === want.reduce((s, r) => s + r.expected, 0) && A1.arr === 3 && A1.clr === 2 && A1.on === 1 && A1.arrP === 7 && A1.clrP === 5 && A1.onP === 2, A1);
  tamper = [{ re: /\/v1\/pier-checkin\?date=2026-12-08$/, fn: (j) => { for (const r of j.rows) if (r.booking_id === bk.p4.id) { r.stage = 'on'; r.expected = 9; r.money.due = 700; } } }];
  await reread();
  const A2 = await aggOf(['zz-p1', 'zz-p2', 'zz-p3', 'zz-p4']);
  ok('tampered answer (p4 boarded, 9 expected): pckAgg counts the server\'s stage and heads (on 2, onP 11, pax 16)', A2.on === 2 && A2.onP === 11 && A2.pax === 16, A2);
  const sh = await ev((a) => { const rows = a.exts.map((e) => { const b = SB_BOOKINGS.find((x) => x.id === e), t = b.trips[0]; return { b, t, O: bkOpsRead(b, a.date), booked: 2, expect: 2, ck: null, van: null, money: { due: 0 } }; }); return pckSheetAgg(rows); }, { exts: ['zz-p1', 'zz-p4'], date: DAY });
  ok('pckSheetAgg(p1, p4): arrived rows 2, boarded 1 (p4 tampered), pax 2 + 9, due 700 = the server rows', sh.n === 2 && sh.arr === 2 && sh.on === 1 && sh.pax === 11 && sh.due === 700, sh);
  tamper = [];
  await reread();

  // programmes
  const progs = await ev((d) => pckProgData(d).map((A) => ({ fam: A.f.id, pax: A.pax, booked: A.booked, arr: A.arr, clr: A.clr, brd: A.brd, due: A.due, rows: A.rows, v: A.vord.map((r) => [r, A.v[r].pax, A.v[r].PK.t, A.v[r].PK.d, A.v[r].KL.t, A.v[r].OWN.t]), st: pckProgStatus(A)[0] })), DAY);
  ok('pckProgData: one card per server programme with its pax / arrived / cleared / boarded / due', S.programmes.every((p) => progs.some((A) => A.fam === p.family_id && A.pax === p.pax && A.arr === p.arr && A.clr === p.clr && A.brd === p.brd && A.rows === p.rows)) && progs.length >= S.programmes.length, { progs, srv: S.programmes.map((p) => [p.family_id, p.pax, p.arr]) });
  const simi = S.programmes.find((p) => p.family_id === 'similan'), vr5 = simi.variants.find((v) => v.route_id === 'r5');
  const pr5 = progs.find((A) => A.fam === 'similan').v.find((v) => v[0] === 'r5');
  ok('...the PK / KL / OWN boxes of the r5 variant are the server\'s (PK total, PK done, KL total, OWN total)', pr5[2] === vr5.zones.PK.total && pr5[3] === vr5.zones.PK.done && pr5[4] === vr5.zones.KL.total && pr5[5] === vr5.zones.OWN.total, { pr5, z: vr5.zones });
  const stTxt = { missing: `ขาด ${simi.status.missing} คน`, ready: 'ออกได้', not_arrived: 'ยังไม่ถึงท่า', no_booking: 'ยังไม่มี booking' }[simi.status.code];
  ok('pckProgStatus: the label of the server\'s status code (' + simi.status.code + ')', progs.find((A) => A.fam === 'similan').st === stTxt, { st: progs.map((A) => A.st), srv: S.programmes.map((p) => p.status) });
  const txt = await ev(() => document.querySelector('#piercheckin-host').innerText);
  ok('the programme card on the sheet says it', txt.includes(stTxt), txt.slice(0, 400));
  tamper = [{ re: /\/v1\/pier-checkin\?date=2026-12-08$/, fn: (j) => { const p = j.programmes.find((x) => x.family_id === 'similan'); p.pax = 77; p.brd = 70; p.status = { code: 'missing', missing: 7 }; p.variants[0].pax = 77; p.variants[0].zones.PK.total = 55; } }];
  await reread();
  const tp = await ev((d) => { const A = pckProgData(d).find((x) => x.f.id === 'similan'); return { pax: A.pax, brd: A.brd, st: pckProgStatus(A)[0], pk: A.v[A.vord[0]].PK.t }; }, DAY);
  ok('tampered programme (77 pax, 70 boarded, missing 7, PK 55): pckProgData and pckProgStatus give the server\'s', tp.pax === 77 && tp.brd === 70 && tp.st === 'ขาด 7 คน' && tp.pk === 55, tp);
  const txt2 = await ev(() => document.querySelector('#piercheckin-host').innerText);
  ok('...and the programme card on the screen shows ขาด 7 คน', /ขาด 7 คน/.test(txt2), txt2.slice(0, 300));
  tamper = [];
  await reread();

  // pier filter: pckInPier asks ?pier=
  const n1 = calls.length;
  await ev(() => pckSetPier('panwa')); await settle(1800);
  ok('picking a pier asks GET /v1/pier-checkin?date=…&pier=panwa', callsSince(n1).some((c) => /GET \/v1\/pier-checkin\?date=2026-12-08&pier=panwa 200/.test(c)), callsSince(n1).filter((c) => /pier-checkin/.test(c)));
  const inP = await ev(() => ({ r10: pckInPier({ routeId: 'r10' }), r5: pckInPier({ routeId: 'r5' }) }));
  ok('pckInPier: r10 (Panwa) is in the pier, r5 (Tublamu) is not = the pier answer\'s routes', inP.r10 === true && inP.r5 === false, inP);
  tamper = [{ re: /pier=panwa/, fn: (j) => { j.rows = j.rows.concat([{ ...j.rows[0], route_id: 'r5' }]); } }];
  await ev(() => laOps.pierService.clear()); await ev((d) => laOps.pierService.ensure(d, true), DAY); await settle(300);
  await ev(() => pckSetPier('panwa')); await settle(1800);
  const inP2 = await ev(() => ({ r5: pckInPier({ routeId: 'r5' }) }));
  ok('tampered pier answer lists r5: pckInPier says r5 is in Panwa (the server decides which pier a trip belongs to)', inP2.r5 === true, inP2);
  tamper = [];
  await ev(() => pckSetPier(null)); await settle(500);
});

// ═══ 2 · Van Check-in rows: status and order <- GET /v1/van-checkin ═══
section('2', async () => {
  console.log('\n[2] Van Check-in: vckRowSt (row status) and ckRowCmp (row order in a van) <- GET /v1/van-checkin');
  const openVan = async () => {
    await ev((d) => { _vanCkDate = d; const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el); renderVanCheckin(); }, DAY);
    await waitFor(() => !!document.querySelector('#vancheckin-host .vck-arr'), null, 15000);
    await waitFor(() => !!document.querySelector('#vancheckin-host[data-ops-vck]'), null, 15000);
    await idle(); await settle(1000);
  };
  const n0 = calls.length;
  await openVan();
  ok('Van Check-in asked GET /v1/van-checkin?date=…', callsSince(n0).some((c) => /^GET \/v1\/van-checkin\?date=2026-12-08 200/.test(c)), callsSince(n0).filter((c) => /van-checkin/.test(c)));
  const V = await api('/v1/van-checkin?date=' + DAY);
  const st = (k, slot = 0) => ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.ext); const ck = ckRead(b, a.date, 'van'); return ck ? vckRowSt(ck) : 'none'; }, { ext: 'zz-' + k, date: DAY });
  const srvSt = (k) => (V.rows.find((r) => r.booking_id === bk[k].id) || {}).status;
  ok('vckRowSt p1 = checkin, p4 = noshow: the server rows\' status', (await st('p1')) === 'checkin' && srvSt('p1') === 'checkin' && (await st('p4')) === 'noshow' && srvSt('p4') === 'noshow', [await st('p1'), srvSt('p1'), await st('p4'), srvSt('p4')]);
  tamper = [{ re: /\/v1\/van-checkin\?date=2026-12-08$/, fn: (j) => { for (const r of j.rows) { if (r.booking_id === bk.p4.id) r.status = 'pier'; if (r.booking_id === bk.p1.id) r.status = 'pending'; } } }];
  await ev(() => laOps.vanCheckin.clear()); await ev(() => renderVanCheckin()); await waitFor((id) => { const e = document.querySelector('#vancheckin-host'); return !!e; }, null, 5000); await settle(1500);
  ok('tampered answer (p1 pending, p4 pier): vckRowSt gives the server\'s status, not what the record says', (await st('p1')) === 'pending' && (await st('p4')) === 'pier', [await st('p1'), await st('p4')]);
  const sty = await ev(() => Array.from(document.querySelectorAll('#vancheckin-host tr.ck-row')).map((tr) => ({ lead: (tr.querySelector('.ck-lead') || {}).innerText, style: tr.getAttribute('style') || '' })));
  const want4 = await ev(() => vckStVars('pier')), want1 = await ev(() => vckStVars('pending'));
  ok('...and the drawn rows carry the colours of the server\'s status (p4 row = pier colours, p1 row = pending colours)', sty.some((r) => /W5 FOUR/.test(r.lead) && r.style.includes(want4)) && sty.some((r) => /W5 ONE/.test(r.lead) && r.style.includes(want1)), sty);
  tamper = [];
  // order of the rows in a van: the server's position
  const leads = () => ev(() => Array.from(document.querySelectorAll('#vancheckin-host tr.ck-row')).map((tr) => ((tr.querySelector('.ck-lead') || {}).innerText || '').trim()));
  await ev(() => laOps.vanCheckin.clear()); await ev(() => renderVanCheckin()); await settle(1500);
  const l0 = await leads();
  const A = V.rows.filter((r) => r.van_id === V.vans.find((v) => v.rows >= 3).van_id);
  ok('seed: a van holds three rows (W5 ONE, W5 FIVE, W5 NINE)', A.length === 3, A.map((r) => r.lead_pax));
  const srvOrder = A.map((r) => r.lead_pax);
  const slice = (arr) => arr.filter((x) => srvOrder.includes(x));
  ok('rows inside the van are drawn in the server\'s order', JSON.stringify(slice(l0)) === JSON.stringify(srvOrder), { drawn: slice(l0), srv: srvOrder });
  tamper = [{ re: /\/v1\/van-checkin\?date=2026-12-08$/, fn: (j) => { const ids = A.map((r) => r.trip_id); const idxs = j.rows.map((r, i) => ids.includes(r.trip_id) ? i : -1).filter((i) => i >= 0); const pick = idxs.map((i) => j.rows[i]).reverse(); idxs.forEach((i, n) => { j.rows[i] = pick[n]; }); } }];
  await ev(() => laOps.vanCheckin.clear()); await ev(() => renderVanCheckin()); await settle(1800);
  const l1 = await leads();
  ok('tampered answer (the three rows in the opposite order): the van draws them in the server\'s order', JSON.stringify(slice(l1)) === JSON.stringify(srvOrder.slice().reverse()), { drawn: slice(l1) });
  tamper = [];
  // the Pier sheet sorts with the same function but keeps its own order (the van answer's order is not applied there)
  await ev(() => laOps.vanCheckin.clear()); await ev(() => renderVanCheckin()); await settle(1200);
  const cmpOutside = await ev((a) => { const f = (e) => { const b = SB_BOOKINGS.find((x) => x.id === e); return { b, t: b.trips[0], O: bkOpsRead(b, a.date) }; }; return [ckRowCmp(f('zz-p1'), f('zz-p9')) < 0, ckRowCmp(f('zz-p9'), f('zz-p1')) > 0]; }, { date: DAY });
  ok('outside the Van sheet ckRowCmp is legacy\'s (sequence, time, voucher): p1 before p9', cmpOutside[0] && cmpOutside[1], cmpOutside);
});

// ═══ 3 · pier "ย้ายลำ" <- GET / POST /operations/trip-ops/{trip}/pier-move ═══
section('3', async () => {
  console.log('\n[3] Pier move boat: pckMoveCan, pckMoveCtx, pckMoveSave <- /operations/trip-ops/{trip}/pier-move');
  await openPier(DAY);
  const dlg = () => ev(() => { const o = document.getElementById('pck-move'); return o ? { text: o.innerText.replace(/\s+/g, ' '), opts: Array.from(o.querySelectorAll('.pmv-o')).map((l) => ({ name: l.querySelector('b').innerText, info: l.querySelector('.pmv-l').innerText.replace(/\s+/g, ' '), off: l.classList.contains('off') })), err: (document.getElementById('pmverr') || {}).textContent } : null; });
  const closeDlg = () => ev(() => { if (document.getElementById('pck-move')) pckMoveClose(); });
  const open = async (ext) => { const d0 = dialogs.length; await ev((e) => pckMoveOpen(e), ext); await waitFor(() => !!document.getElementById('pck-move'), null, 4000); await settle(300); return { dlg: await dlg(), alerts: dialogs.slice(d0) }; };
  const G = await api(`/operations/trip-ops/${bk.m1.trip}/pier-move`);
  ok('seed: the server lists b7 as the one other boat of r5 (m1 sits on b6)', G.may_move === true && G.options.length === 1 && G.options[0].boat_id === 'b7' && G.current_boat_id === 'b6', G);
  const n0 = calls.length;
  let r = await open('zz-m1');
  ok('pckMoveOpen asks GET /operations/trip-ops/{trip}/pier-move before the dialog opens', callsSince(n0).some((c) => new RegExp(`GET /operations/trip-ops/${bk.m1.trip}/pier-move 200`).test(c)) && !!r.dlg, callsSince(n0).filter((c) => /pier-move/.test(c)));
  const o = G.options[0];
  ok('the dialog lists the server\'s boats with its numbers: "load → next / cap"', r.dlg.opts.length === 1 && r.dlg.opts[0].name === o.name && r.dlg.opts[0].info.startsWith(`${o.load} → ${o.next} / ${o.capacity}`) && r.dlg.opts[0].off === o.block, { dlg: r.dlg.opts, o });
  await closeDlg();
  // the server's numbers differ from what legacy would compute
  tamper = [{ re: /pier-move$/, fn: (j) => { if (j.options) { j.options[0].load = 30; j.options[0].next = 33; j.options[0].capacity = 34; j.options[0].over = false; j.options[0].block = false; } } }];
  await ev(() => { for (const k of Object.keys(window.__x || {})) delete window.__x[k]; });
  r = await open('zz-m1');
  ok('tampered answer (load 30, next 33, cap 34): the dialog shows "30 → 33 / 34"', r.dlg && r.dlg.opts[0] && r.dlg.opts[0].info.startsWith('30 → 33 / 34'), r.dlg);
  await closeDlg();
  // a refusal by the server is shown in the dialog as it words it
  tamper = [{ re: /pier-move$/, fn: (j) => { if (j.options) j.options.push({ boat_id: 'b1', name: 'Aluminous1', capacity: 64, load: 0, next: 3, over: false, block: false }); } }];
  r = await open('zz-m1');
  await ev(() => { document.querySelector('#pck-move input[value="b1"]').checked = true; document.getElementById('pmvwhy').value = 'guest'; });
  const n1 = calls.length, b1 = bodies.length;
  await ev(() => pckMoveSave('zz-m1')); await idle(); await settle(800);
  const refused = (await dlg());
  ok('a boat the server does not accept (b1 does not run r5): 409 boat_not_deployed, its message in the dialog, nothing moved', refusals.some((x) => /pier-move -> 409.*boat_not_deployed/.test(x)) && refused && /does not run this route/.test(refused.err) && (await api(`/operations/trip-ops/${bk.m1.trip}/pier-move`)).current_boat_id === 'b6', { err: refused && refused.err, ref: refusals.slice(-1) });
  tamper = [];
  await closeDlg();
  // legacy\'s pre-checks (same words), then the real move
  r = await open('zz-m1');
  await ev(() => pckMoveSave('zz-m1'));
  ok('no boat picked: legacy\'s words "เลือกลำที่จะย้ายไป" at once, nothing sent', (await dlg()).err === 'เลือกลำที่จะย้ายไป' && !bodies.slice(b1).some((x) => /pier-move/.test(x.k) && x.status === 200), await dlg());
  await ev(() => { document.querySelector('#pck-move input[name=pmvb]').checked = true; });
  await ev(() => pckMoveSave('zz-m1'));
  ok('no reason: "เลือกเหตุผล"', (await dlg()).err === 'เลือกเหตุผล', await dlg());
  await ev(() => { document.getElementById('pmvwhy').value = 'other'; });
  await ev(() => pckMoveSave('zz-m1'));
  ok('"other" without a note: legacy\'s words', /ต้องพิมพ์รายละเอียด/.test((await dlg()).err), await dlg());
  await ev(() => { document.getElementById('pmvwhy').value = 'breakdown'; });
  const n2 = calls.length, b2 = bodies.length;
  await ev(() => pckMoveSave('zz-m1')); await idle(); await settle(1500);
  const post = lastBody(/POST \/operations\/trip-ops\/.*\/pier-move$/);
  ok('Save: POST …/pier-move with exactly {boat_id, reason} (no history, no boat written by the browser)', post && post.status === 200 && JSON.stringify(post.req) === '{"boat_id":"b7","reason":"breakdown"}' && noComputed(post.req), post);
  ok('the old PATCH of the trip\'s boat is not sent', !bodies.slice(b2).some((x) => /^PATCH \/operations\/trip-ops\//.test(x.k)), bodies.slice(b2).map((x) => x.k));
  const G2 = await api(`/operations/trip-ops/${bk.m1.trip}/pier-move`);
  const hist = (await api(`/v1/bookings/${bk.m1.id}/history`)).history || [];
  ok('server: m1 is on b7 now, the history line is the server\'s ("ย้ายลำหน้าท่า … เรือเสีย")', G2.current_boat_id === 'b7' && hist.some((h) => /ย้ายลำหน้าท่า/.test(h.text) && /เรือเสีย/.test(h.text)), { cur: G2.current_boat_id, hist: hist.map((h) => h.text).slice(0, 3) });
  const scr = await ev(() => ({ closed: !document.getElementById('pck-move'), boat: bkOpsRead(SB_BOOKINGS.find((x) => x.id === 'zz-m1'), '2026-12-08').boatId }));
  ok('screen: the dialog closed and the booking shows b7', scr.closed && scr.boat === 'b7', scr);
  // not movable: split across boats (p5) -> the server's alert
  const d0 = dialogs.length;
  await ev(() => pckMoveOpen('zz-p5')); await settle(1200);
  ok('a booking split across boats: 409 not_movable, the server\'s message is the alert, no dialog', dialogs.slice(d0).some((x) => /split across boats/.test(x)) && !(await dlg()), { d: dialogs.slice(d0) });
  // no right: may_move false -> legacy\'s alert text
  tamper = [{ re: /pier-move$/, fn: (j) => { if (j.options) j.may_move = false; } }];
  const d1 = dialogs.length;
  await ev(() => pckMoveOpen('zz-m1')); await settle(1200);
  ok('may_move false: legacy\'s alert "No permission to move boats here…", no dialog', dialogs.slice(d1).some((x) => /No permission to move boats here/.test(x)) && !(await dlg()), { d: dialogs.slice(d1) });
  tamper = [];
});

// ═══ 4 · kitchen band, lunch slip rows, overnight meal rows <- meal_preview ═══
section('4', async () => {
  console.log('\n[4] Pier meals: pckMealCount, pckAllergyList, mvLunchRows, pckMealOvnRows, pckMealOvnNeed <- GET /v1/trip-actuals/{date}/{boat} meal_preview');
  await openPier(DAY);
  const held = (d, b) => waitFor((a) => !!laOps.mealPreview.of(a.d, a.b), { d, b }, 9000);
  const prev = async (date, bid) => (await api(`/v1/trip-actuals/${date}/${bid}`)).meal_preview;
  const P = await prev(DAY, 'b6');
  ok('seed: the server counts veg 1, vegan 1, halal 1 and the named allergies for b6', P.veg === 1 && P.vegan === 1 && P.halal === 1 && P.allergies.length === 2 && P.requests.length >= 2, { veg: P.veg, vegan: P.vegan, halal: P.halal, al: P.allergies, req: P.requests.length });
  const count = () => ev(() => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-mm1'); const rows = [{ b, t: b.trips[0], bid: 'b6', booked: 4, expect: 4, ck: null }]; return { c: pckMealCount(rows), al: pckAllergyList(rows) }; });
  const n0 = calls.length;
  await ev(() => laOps.mealPreview.clear()); await count(); await held(DAY, 'b6'); await settle(300);
  ok('pckMealCount asks GET /v1/trip-actuals/{date}/b6 (meal_preview) the first time it is needed', callsSince(n0).some((c) => new RegExp(`GET /v1/trip-actuals/${DAY}/b6 200`).test(c)), callsSince(n0).filter((c) => /trip-actuals/.test(c)));
  let r = await count();
  ok('pckMealCount = the server\'s counts (ad, chd, inf, book, veg, vegan, halal, allergy)', r.c.ad === P.adults && r.c.chd === P.children && r.c.inf === P.infants && r.c.tot === P.adults + P.children + P.infants && r.c.book === P.booked && r.c.veg === P.veg && r.c.vegan === P.vegan && r.c.halal === P.halal && r.c.allergy === P.allergy, { c: r.c, P: { a: P.adults, c: P.children, i: P.infants, b: P.booked } });
  ok('pckAllergyList = the server\'s named list (Peanut ×3, Egg ×1)', JSON.stringify(r.al) === JSON.stringify(P.allergies) && r.al.some((x) => x.name === 'Peanut' && x.qty === 3), r.al);
  tamper = [{ re: /trip-actuals\/2026-12-08\/b6$/, fn: (j) => { const p = j.meal_preview; p.adults = 99; p.children = 3; p.infants = 2; p.booked = 105; p.veg = 7; p.allergy = 9; p.allergies = [{ name: 'Kiwi', qty: 4 }]; p.requests = [{ booking_id: 'x', lead: 'SERVER LEAD', adults: 5, children: 1, infants: 0, foc: 1, request: 'ฮาลาล 5', overnight: false, include: null }]; } }];
  await ev(() => laOps.mealPreview.clear()); await count(); await held(DAY, 'b6'); await settle(300);
  r = await count();
  ok('tampered preview (99 adults, 3 children, veg 7, Kiwi ×4): the kitchen counts and the allergy list are the server\'s', r.c.ad === 99 && r.c.chd === 3 && r.c.inf === 2 && r.c.tot === 104 && r.c.veg === 7 && r.c.allergy === 9 && JSON.stringify(r.al) === JSON.stringify([{ name: 'Kiwi', qty: 4 }]), r);
  const lines = await ev((a) => mvLunchRows(a.d, 'b6'), { d: DAY });
  ok('mvLunchRows = the server\'s requests (SERVER LEAD, 5 adults incl. foc, 1 child, request ฮาลาล 5)', lines.length === 1 && lines[0].lead === 'SERVER LEAD' && lines[0].ad === 5 && lines[0].chd === 1 && lines[0].foc === 1 && lines[0].sr === 'ฮาลาล 5' && lines[0].inc === 'in', lines);
  await ev(() => { renderPierCheckin(); pckKitchenOpen(); }); await settle(600);
  const txt = await ev(() => (document.getElementById('pck-kit-host') || {}).innerText || '');
  ok('the kitchen pop-up shows the server\'s 99 adults', /99/.test(txt) && /W5 Venue|Zeus/.test(txt), txt.slice(0, 400));
  await ev(() => pckKitchenClose());
  tamper = [];
  await ev(() => laOps.mealPreview.clear()); await count(); await held(DAY, 'b6'); await settle(300);
  const lines2 = await ev((a) => mvLunchRows(a.d, 'b6'), { d: DAY });
  ok('real answer: one line per booking with the merged Thai request (halal / veg / named allergies)', lines2.length === P.requests.length && lines2.some((x) => x.lead === 'W5 MEAL ONE' && /ฮาลาล 1/.test(x.sr) && /มังสวิรัติ 1/.test(x.sr) && /แพ้ Peanut ×2/.test(x.sr)) && JSON.stringify(lines2.map((x) => x.lead)) === JSON.stringify(P.requests.map((x) => x.lead)), { lines2, req: P.requests.map((x) => x.lead) });

  // a filter on the sheet: the rows shown are counted, as legacy does
  await ev(() => { _pckQ = 'MEAL ONE'; });
  const rf = await count();
  ok('with a filter on the sheet the count is legacy\'s, of the rows given (one booking: 4 heads, not the whole boat)', rf.c.tot === 4, rf.c);
  await ev(() => { _pckQ = ''; });

  // overnight returns
  const OVP = await prev(OV[1], 'b13');
  ok('seed: the server lists the overnight return, undecided', OVP.overnight.length === 1 && OVP.undecided_overnight.length === 1 && OVP.overnight[0].include === null, OVP);
  await ev((d) => { _pckDate = d; }, OV[1]);
  await ev(() => laOps.mealPreview.clear());
  await ev((a) => pckMealOvnRows(a.d, 'b13'), { d: OV[1] }); await held(OV[1], 'b13'); await settle(300);
  const ovr = await ev((a) => ({ rows: pckMealOvnRows(a.d, 'b13').map((x) => [x.b.id, x.pax, x.inc]), need: pckMealOvnNeed(a.d, 'b13').map((x) => x.b.id) }), { d: OV[1] });
  ok('pckMealOvnRows / pckMealOvnNeed: the one return, 2 pax, undecided = the server\'s lists', ovr.rows.length === 1 && ovr.rows[0][1] === OVP.overnight[0].pax && ovr.rows[0][2] === '' && ovr.need.length === 1, ovr);
  tamper = [{ re: /trip-actuals\/2026-12-15\/b13$/, fn: (j) => { j.meal_preview.overnight[0].include = 'in'; j.meal_preview.overnight[0].pax = 7; j.meal_preview.undecided_overnight = []; } }];
  await ev(() => laOps.mealPreview.clear());
  await ev((a) => pckMealOvnRows(a.d, 'b13'), { d: OV[1] }); await held(OV[1], 'b13'); await settle(300);
  const ovr2 = await ev((a) => ({ rows: pckMealOvnRows(a.d, 'b13').map((x) => [x.b.id, x.pax, x.inc]), need: pckMealOvnNeed(a.d, 'b13').length }), { d: OV[1] });
  ok('tampered preview (decided "in", 7 pax, nothing undecided): rows show include in and 7 pax, nothing is left to decide', ovr2.rows[0][1] === 7 && ovr2.rows[0][2] === 'in' && ovr2.need === 0, ovr2);
  tamper = [];
  // the server refuses a send while a return is undecided (its message shows)
  const sendBody = await send('POST', `/v1/trip-actuals/${OV[1]}/b13/meal-order`, {});
  ok('server: meal-order is 409 overnight_meal_undecided while a return is undecided', sendBody.status === 409 && /overnight_meal_undecided/.test(JSON.stringify(sendBody.body)), sendBody);
  // pckMealStep stays a hint; the server refuses more than the heads and the screen shows its words
  await ev(() => { _pckDate = '2026-12-08'; });
  const d0 = refusals.length;
  await ev(() => { _pckMeal = { bkId: 'zz-mm1', date: '2026-12-08', veg: 9, vegan: 0, halal: 0, allergies: '' }; });
  await ev(() => { pckMealSave(); }); await idle(); await settle(1000);
  ok('more meals than heads: the server refuses (4xx), its message is the toast', refusals.slice(d0).some((x) => /PUT \/v1\/bookings\/.*\/meals -> 4\d\d/.test(x)), refusals.slice(d0));
});

// ═══ 5 · on-tour sales covered by the pier cash <- tour-sales covered_by_pier ═══
section('5', async () => {
  console.log('\n[5] bkxExCovered / bkxExGot <- GET /v1/bookings/{id}/tour-sales covered_by_pier');
  await openPier(DAY);
  const srv = async (k) => (await api(`/v1/bookings/${bk[k].id}/tour-sales`)).tour_sales[0];
  const s1 = await srv('cs1'), s2 = await srv('cs2');
  ok('seed: the server says the sale of cs1 is covered by the pier cash (settle done), the sale of cs2 is not', s1.covered_by_pier === true && s1.settle === 'done' && s2.covered_by_pier === false && s2.settle !== 'done', { s1: [s1.covered_by_pier, s1.settle], s2: [s2.covered_by_pier, s2.settle] });
  const read = (ext) => ev(async (a) => { await laOpsDayActions.loadTourSales(a.ext); const x = bookingV2ExtrasFor(a.ext)[0]; return x ? { cov: bkxExCovered(x), got: bkxExGot(x), cover: x.coveredByPier, settle: x.settle } : null; }, { ext });
  const r1 = await read('zz-cs1'), r2 = await read('zz-cs2');
  ok('bkxExCovered / bkxExGot: cs1 covered and got, cs2 neither = the server\'s flag', r1 && r1.cov === true && r1.got === true && r2 && r2.cov === false && r2.got === false, { r1, r2 });
  tamper = [{ re: /tour-sales$/, fn: (j) => { for (const s of j.tour_sales) { s.covered_by_pier = !s.covered_by_pier; s.settle = s.covered_by_pier ? 'done' : 'pending'; } } }];
  const t1 = await read('zz-cs1'), t2 = await read('zz-cs2');
  ok('tampered answer (flags flipped): cs1 is not covered and not got, cs2 is covered and got - the screen follows the server, not the pier sums legacy would redo', t1.cov === false && t1.got === false && t2.cov === true && t2.got === true, { t1, t2 });
  tamper = [];
  // a pier payment re-reads the sales that are held
  await read('zz-cs1');
  const n0 = calls.length;
  await ev(() => laOps.wrote('pier'));
  await settle(1500);
  ok('a pier write reads the sales that are held again (GET …/tour-sales)', callsSince(n0).some((c) => /GET \/v1\/bookings\/.*\/tour-sales 200/.test(c)), callsSince(n0).filter((c) => /tour-sales/.test(c)));
});

// ═══ 6 · guide order and travel register <- /v1/guide-orders/{date}/{boat}/sheet and /v1/travel-register ═══
section('6', async () => {
  console.log('\n[6] Guide order (goCounts, goCrewN, goRouteOf, goIsGuide, goSheet) and travel register (pckTravelCrew, pckTravelRows, pckTravelSheet)');
  await openPier(DAY);
  const S = await api(`/v1/guide-orders/${DAY}/b6/sheet`), R = await api(`/v1/travel-register/${DAY}/b6`);
  ok('seed: the server counts 2 licensed guides (one + a trainee), 1 intern + 1 blank + 1 island guide = 3 others, a 3-person crew', S.guides.length === 2 && S.others === 3 && S.crew === 3 && S.total === S.counts.ad + S.counts.chd + S.counts.inf + 2 + 3 + 3, S);
  const held = () => waitFor((a) => !!laOps.guidePapers.sheet(a.d, 'b6') && !!laOps.guidePapers.register(a.d, 'b6'), { d: DAY }, 9000);
  const prefetch = async () => { await ev((d) => Promise.all([laOps.guidePapers.readSheet(d, 'b6'), laOps.guidePapers.readRegister(d, 'b6')]), DAY); await held(); };
  const nums = (html) => { const out = []; String(html).replace(/<td class="n">(\d+)<\/td>/g, (m, n) => { out.push(+n); return m; }); return out; };
  await ev(() => laOps.guidePapers.clear()); await prefetch();
  const fn = () => ev((d) => ({ cnt: goCounts(d, 'b6'), crew: goCrewN(d, 'b6'), route: goRouteOf(d, 'b6').id || '', html: goSheet(d, 'b6', false) }), DAY);
  let F = await fn();
  ok('goCounts / goCrewN / goRouteOf = the sheet (counts, crew, route_id)', F.cnt.ad === S.counts.ad && F.cnt.chd === S.counts.chd && F.cnt.inf === S.counts.inf && F.crew === S.crew && F.route === S.route_id, { F: [F.cnt, F.crew, F.route], S: [S.counts, S.crew, S.route_id] });
  ok('goSheet: the seven figures are adults, children, infants, guides, crew, others, total = the sheet\'s', JSON.stringify(nums(F.html)) === JSON.stringify([S.counts.ad, S.counts.chd, S.counts.inf, S.guides.length, S.crew, S.others, S.total]), { n: nums(F.html), S });
  ok('goSheet: the lead guide is the server\'s (name and licence), the intern is in "others" not a guide', F.html.includes('W5 Guide One') && F.html.includes('11-1111') && /W5 Intern Two/.test(F.html), F.html.slice(0, 200));
  tamper = [{ re: /guide-orders\/2026-12-08\/b6\/sheet$/, fn: (j) => { j.counts = { ad: 40, chd: 6, inf: 2 }; j.crew = 9; j.others = 4; j.guides = j.guides.slice(0, 1); j.total = 99; j.seats = 12; } }];
  await ev(() => laOps.guidePapers.clear()); await prefetch();
  F = await fn();
  ok('tampered sheet (40 / 6 / 2, crew 9, others 4, 1 guide, total 99, 12 seats): the page prints the server\'s figures, not the sum of the bookings', JSON.stringify(nums(F.html)) === JSON.stringify([40, 6, 2, 1, 9, 4, 99]) && /12 ที่นั่ง/.test(F.html) && F.cnt.ad === 40 && F.crew === 9, { n: nums(F.html), cnt: F.cnt });
  tamper = [];

  // register
  await ev(() => laOps.guidePapers.clear()); await prefetch();
  const T = await ev((d) => { const c = pckTravelCrew('b6', d); return { crew: c.slice(), blank: c.blank, rows: pckTravelRows('b6', d), html: pckTravelSheet('b6', d) }; }, DAY);
  ok('pckTravelCrew = the register\'s crew (captain, engineer, deck, island guide, guides, others) with the position words', JSON.stringify(T.crew.map((c) => [c.name, c.pos, c.grp])) === JSON.stringify(R.crew.map((c) => [c.name, c.position, c.group])) && T.blank === R.totals.unnamed_crew, { crew: T.crew, R: R.crew });
  ok('pckTravelRows = the register\'s passengers and totals (pax, Thai, foreign, names over, no name)', T.rows.pax === R.totals.passengers && T.rows.th === R.totals.thai && T.rows.fr + R.totals.unspecified_nationality === R.totals.foreign && T.rows.over === R.totals.names_over && T.rows.noname === R.totals.unnamed && T.rows.people.length === R.passengers.length && T.rows.people.some((p) => p.name === 'Ivan Petrov' && p.nat === 'RUS'), { rows: T.rows, tot: R.totals });
  const sumNums = (html) => { const tail = html.slice(html.indexOf('<div class="sum">')); return nums(tail).slice(0, 9); };
  ok('pckTravelSheet: the summary figures are the register\'s totals (captain, engineer, crew, guides, staff, Thai, foreign, everyone)', JSON.stringify(sumNums(T.html)) === JSON.stringify([R.totals.captain, R.totals.engineer, R.totals.crew, R.totals.guides, R.totals.staff, R.totals.thai, R.totals.foreign, R.totals.people, R.totals.people]), { sum: sumNums(T.html), tot: R.totals });
  tamper = [{ re: /travel-register\/2026-12-08\/b6$/, fn: (j) => { j.totals.captain = 2; j.totals.thai = 11; j.totals.foreign = 22; j.totals.people = 55; j.passengers = [{ name: 'Server Name', nationality: 'FRA', phone: '123' }]; j.crew = [{ name: 'Server Captain', position: 'กัปตัน', group: 'cap' }]; } }];
  await ev(() => laOps.guidePapers.clear()); await prefetch();
  const T2 = await ev((d) => ({ crew: pckTravelCrew('b6', d), rows: pckTravelRows('b6', d), html: pckTravelSheet('b6', d) }), DAY);
  ok('tampered register (captain 2, Thai 11, foreign 22, people 55, one name): rows and crew are the server\'s and the summary prints its totals', T2.crew.length === 1 && T2.crew[0].name === 'Server Captain' && T2.rows.people[0].name === 'Server Name' && JSON.stringify(sumNums(T2.html).slice(0, 1).concat(sumNums(T2.html).slice(5, 8))) === JSON.stringify([2, 11, 22, 55]) && T2.html.includes('Server Name'), { sum: sumNums(T2.html), crew: T2.crew });
  tamper = [];

  // the print waits for the answers: the combined window gets the server's figures
  tamper = [{ re: /guide-orders\/2026-12-08\/b6\/sheet$/, fn: (j) => { j.counts.ad = 31; j.total = j.counts.ad + j.counts.chd + j.counts.inf + j.guides.length + j.crew + j.others; } }];
  await ev(() => laOps.guidePapers.clear());
  const n0 = calls.length;
  const printed = await ev(async (d) => { window.__w = { html: '', document: { write(h) { window.__w.html += h; }, close() { window.__w.done = true; } }, focus() {} }; goPrintOpen('b6', d, ['b6'], window.__w); for (let i = 0; i < 60 && !window.__w.done; i++) await new Promise((r) => setTimeout(r, 100)); return window.__w.html; }, DAY);
  ok('goPrintOpen waits for GET …/sheet and GET /v1/travel-register, then writes the pages with the server\'s 31 adults', callsSince(n0).some((c) => /guide-orders\/2026-12-08\/b6\/sheet 200/.test(c)) && callsSince(n0).some((c) => /travel-register\/2026-12-08\/b6 200/.test(c)) && /<td class="n">31<\/td>/.test(printed), { calls: callsSince(n0).filter((c) => /sheet|register/.test(c)), has31: /<td class="n">31<\/td>/.test(printed), len: printed.length });
  tamper = [];
  // the dialog: counts line from the sheet
  await ev(() => laOps.guidePapers.clear());
  await ev((d) => { goSetupOpen('b6'); }, DAY); await waitFor(() => !!document.querySelector('#acct-modal .go-s'), null, 6000);
  const sub = await ev(() => (document.querySelector('#acct-modal .go-s') || {}).innerText || '');
  ok('goSetupOpen shows "ผู้ใหญ่ n · เด็กโต n · เด็กเล็ก n · กัปตัน/นายท้าย n" from the sheet', sub.includes(`ผู้ใหญ่ ${S.counts.ad} · เด็กโต ${S.counts.chd} · เด็กเล็ก ${S.counts.inf}`) && sub.includes(`กัปตัน/นายท้าย ${S.crew}`), sub);
  await ev(() => acctModalClose());
});

// ═══ 7 · Travel Summary cancelled rows <- cancelled_rows ═══
section('7', async () => {
  console.log('\n[7] Travel Summary: tsCxlRows draws the server\'s cancelled_rows, also for a booking this browser does not hold');
  const open = async () => {
    await ev((d) => { _tsDate = d; _tsPier = ''; _tsRoute = ''; _tsVatF = ''; const el = document.querySelector('.nav-item[data-view="travelsum"]'); if (el) nav(el); renderTravelSum(); }, DAY);
    await waitFor(() => !!document.querySelector('[data-ops-ts-view]') && document.querySelectorAll('[data-ops-ts-man]').length > 0, null, 25000);
    await idle(); await settle(1200);
  };
  const reset = () => ev(() => { laOps.moneyReports.clear(); laOps.travelRows.clear(); laOps.travelServer.clear(); laOps.travelView.clear(); });
  await open();
  const Sx = await api('/v1/reports/travel-summary?date=' + DAY);
  ok('seed: the server lists the cancelled booking cx1 in cancelled_rows', Sx.cancelled_rows.some((r) => r.booking_id === bk.cx1.id), Sx.cancelled_rows.map((r) => r.booking_id));
  const rowsFn = () => ev((d) => tsCxlRows(d).map((r) => ({ id: r.b.id, lead: r.b.leadPax, stub: !!r.b._stub, routeId: r.routeId, booked: r.booked, amount: r.amount })), DAY);
  let r0 = await rowsFn();
  ok('tsCxlRows lists the server\'s cancelled rows (cx1), from the held booking', r0.length === Sx.cancelled_rows.length && r0.some((r) => r.lead === 'W5 CANCELLED' && !r.stub), r0);
  tamper = [{ re: /travel-summary\?date=2026-12-08$/, fn: (j) => { j.cancelled_rows.push({ booking_id: 'ghost-booking-1', code: 'GH-1', voucher_ref: 'GHOST-V1', lead_pax: 'GHOST LEAD', agent_id: null, status: 'cancelled', route_id: 'r5', zone_group: 'PK', booked: 5, travelled: 0, ovn_back: false, ovn_out: null, boat_id: 'b6', van_ids: [], trip_amount: 4321 }); } }];
  await reset(); await open();
  r0 = await rowsFn();
  const ghost = r0.find((r) => r.id === 'ghost-booking-1');
  ok('tampered answer (a cancelled booking this browser has never loaded): tsCxlRows still lists it, from the server\'s row (lead, 5 booked, 4,321)', ghost && ghost.lead === 'GHOST LEAD' && ghost.stub && ghost.booked === 5 && ghost.amount === 4321 && r0.length === Sx.cancelled_rows.length + 1, r0);
  // (the Travel Summary page itself draws the day's roster read from /v1/bookings; tsCxlRows serves the callers that still ask it, such as drData)
  tamper = [];
  await reset(); await open();
});

// ═══ 8 · Auto assign boats (baAutoAssign) and Transfer Fleet (vehStatusOn, vehJobsFor) ═══
section('8', async () => {
  console.log('\n[8a] baAutoAssign <- POST /operations/deployments/{date}/auto-assign');
  await goView('boatassign'); await settle(800);
  const boatOf = (k) => ev((e) => bkOpsRead(SB_BOOKINGS.find((x) => x.id === e), '2026-12-20').boatId || '', 'zz-' + k);
  const srvBoat = async (k) => (await api('/v1/bookings/' + bk[k].id)).trips[0].operations.boat_id || '';
  ok('seed: three seat bookings, no boat yet', (await boatOf('au1')) === '' && (await srvBoat('au1')) === '', [await boatOf('au1'), await srvBoat('au1')]);
  const b0 = bodies.length;
  await ev(() => baAutoAssign('2026-12-20', 'r5')); await idle(); await settle(1500);
  const post = lastBody(/POST \/operations\/deployments\/2026-12-20\/auto-assign$/);
  ok('POST …/auto-assign with exactly {route_id} (the server picks the boats)', post && post.status === 200 && JSON.stringify(post.req) === '{"route_id":"r5"}', post);
  const S = {}; for (const k of ['au1', 'au2', 'au3']) S[k] = await srvBoat(k);
  ok('the server placed every trip (au1 and au2 on the first boat with room, au3 where it still fits)', Object.values(S).every(Boolean) && post.json.assigned.length === 3 && post.json.unassigned.length === 0, { S, post: post.json });
  const scr = { au1: await boatOf('au1'), au2: await boatOf('au2'), au3: await boatOf('au3') };
  ok('screen: each booking shows the boat the server gave it', JSON.stringify(scr) === JSON.stringify(S), { scr, S });
  ok('legacy\'s "NOT YET" toast is gone', !(await ev(() => document.body.innerText)).includes('Auto-assign is not on operation-backend'), '');
  // no boat deployed on the route: the server's message is the alert
  const d0 = dialogs.length;
  await ev(() => baAutoAssign('2026-12-21', 'r5')); await idle(); await settle(800);
  ok('409 no_boats: the server\'s own words are the alert', refusals.some((r) => /auto-assign -> 409.*no_boats/.test(r)) && dialogs.slice(d0).some((x) => /alert:/.test(x) && /boat/i.test(x)), { d: dialogs.slice(d0), r: refusals.slice(-1) });

  console.log('\n[8b] Transfer Fleet: vehStatusOn <- van-days status_on · vehJobsFor <- van-jobs');
  await ev((d) => { _vehDate = d; _vehMonth = d.slice(0, 7); _vehCalMonth = d.slice(0, 7); const el = document.querySelector('.nav-item[data-view="vehicles"]'); if (el) nav(el); renderVehicles(); }, DAY_F);
  await waitFor((a) => !!laOps.vanJobs.cellOf(a.v, a.d), { v: vanB.id, d: DAY_F }, 15000); await idle(); await settle(1200);
  const stOf = (vid, d) => ev((a) => vehStatusOn(vehGet(a.v), a.d), { v: vid, d });
  const days = await api(`/operations/van-days?from=${DAY_F}&to=${DAY_F}`);
  const cell = (vid) => days.days.find((c) => c.van_id === vid);
  ok('vehStatusOn = status_on: Bravo maintenance (range), Charlie off (the day\'s own mark), Alpha none', (await stOf(vanB.id, DAY_F)) === 'maintenance' && cell(vanB.id).status_on === 'maintenance' && (await stOf(vanC.id, DAY_F)) === 'off' && (await stOf(vanA.id, DAY_F)) === '' && cell(vanA.id).status_on === null, [await stOf(vanB.id, DAY_F), await stOf(vanC.id, DAY_F), await stOf(vanA.id, DAY_F)]);
  tamper = [{ re: /operations\/van-days\?/, fn: (j) => { for (const c of j.days) { if (c.van_id === vanA.id && c.service_date === DAY_F) c.status_on = 'off'; if (c.van_id === vanB.id && c.service_date === DAY_F) c.status_on = null; } } }];
  await ev(() => laOps.fleetServer.refresh('2026-12-09')); await settle(600);
  ok('tampered answer (Alpha off, Bravo none): vehStatusOn gives the server\'s status, not what the ranges say', (await stOf(vanA.id, DAY_F)) === 'off' && (await stOf(vanB.id, DAY_F)) === '', [await stOf(vanA.id, DAY_F), await stOf(vanB.id, DAY_F)]);
  const cellTxt = await ev((a) => _vehDayCellInner(vehGet(a.v), a.d), { v: vanA.id, d: DAY_F });
  ok('...and the matrix cell of Alpha is drawn as off (the stop sign)', cellTxt.includes('9941'), cellTxt.slice(0, 160));
  tamper = [];
  // a range write makes the days stale: the cells are read again
  const n0 = calls.length;
  await ev((id) => vehStatusAdd(id), vanA.id); await idle(); await settle(1500);
  ok('a status-range write is followed by GET /operations/van-days (the days it covers changed)', callsSince(n0).some((c) => /^POST \/operations\/vans\/.*\/status-ranges 201/.test(c)) && callsSince(n0).some((c) => /^GET \/operations\/van-days\?/.test(c)), callsSince(n0).filter((c) => /van-days|status-ranges/.test(c)));
  // jobs of the day
  const J = await api('/operations/van-jobs?date=' + DAY);
  const mine = J.jobs.filter((j) => j.van_id === vanA.id);
  const jobsFn = () => ev((a) => { const j = vehJobsFor(a.d)[a.v]; return j ? { bk: j.bk, pax: j.pax, n: j.list.length } : null; }, { d: DAY, v: vanA.id });
  await ev((d) => { vehJobsFor(d); }, DAY); await waitFor((d) => !!laOps.fleetServer.jobs(d), DAY, 8000); await settle(500);
  const j0 = await jobsFn();
  ok('vehJobsFor: Alpha\'s "N job · M pax" = the server\'s jobs (bookings and pax)', mine.length >= 1 && j0.bk === mine.reduce((s, j) => s + j.bookings, 0) && j0.pax === mine.reduce((s, j) => s + (j.pax != null ? j.pax : j.out_pax), 0), { j0, mine: mine.map((j) => [j.bookings, j.pax]) });
  tamper = [{ re: /operations\/van-jobs\?date=2026-12-08$/, fn: (j) => { for (const x of j.jobs) if (x.van_id === vanA.id) { x.bookings = 9; x.pax = 77; } } }];
  await ev(() => laOps.fleetServer.clear()); await ev((d) => { vehJobsFor(d); }, DAY); await waitFor((d) => !!laOps.fleetServer.jobs(d), DAY, 8000); await settle(500);
  const j1 = await jobsFn();
  ok('tampered answer (9 bookings, 77 pax per Alpha job): vehJobsFor shows the server\'s', mine.length === 1 ? (j1.bk === 9 && j1.pax === 77) : (j1.bk >= 9 && j1.pax >= 77), { j1, n: mine.length });
  tamper = [];
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
