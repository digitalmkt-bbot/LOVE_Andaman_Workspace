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
await mk('p5', 'W5 FIVE', 4); await mk('p6', 'W5 SIX', 4); await mk('p8', 'W5 EIGHT', 2, { agentId: 'a_b2c', total: 2400, price_mode: 'manual', b2c_channel: 'Line OA' }, { subtotal: 2400 }, 'r10');
const mkGroup = async (members, van_id, route = 'r5', zone = 'PK') => seed('POST', '/operations/van-groups', { service_date: DAY, route_id: route, zone, members: members.map((m) => ({ trip_id: bk[m].trip })), van_id });
await mkGroup(['p1', 'p5'], vanA.id); await mkGroup(['p4'], vanB.id); await mkGroup(['p8'], vanC.id, 'r10');
await seed('PATCH', `/operations/trip-ops/${bk.p5.trip}`, { boat_splits: [{ boat_id: 'b6', ad: 2, chd: 0, inf: 0, foc: 0 }, { boat_id: 'b7', ad: 2, chd: 0, inf: 0, foc: 0 }] });
await seed('POST', `/operations/trip-ops/${bk.p6.trip}/van-split`, { ad: 1 });
await cmd('p1', 'pier', 'stage', { stage: 'arrived', on: true });
await cmd('p2', 'pier', 'stage', { stage: 'arrived', on: true }); await cmd('p2', 'pier', 'stage', { stage: 'cleared', on: true });
await cmd('p3', 'pier', 'check-in');
await cmd('p8', 'pier', 'stage', { stage: 'arrived', on: true });

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
