// t_walk_w5_c · wave 5 group c: the browser rules that were still left (boat pulled, charter boats, van zone / pools / rounds / stops /
// special request, petty cash order / balance / closing / park check, pier programme pills, partner van bills by pier, Daily PFM prepay
// amount), against a REAL operation-backend (in-process store, seeded through its API).
//
//   node test/ui/t_walk_w5_c.mjs        (OPS_BACKEND_DIR, default D:/projects/operation-backend)
//
// Every section asks the screen's function / the DOM AND the server directly. A "differs" case changes what the BROWSER holds
// (legacy's arithmetic would then answer differently) and expects the server's figure.
import { serve } from './_harness.mjs';
import { seedVanJobs, D, D2, ROUTE } from './_vanjobs_seed.mjs';
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
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const raw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text(); let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await raw(p, init)).body;
const send = (m, p, b) => raw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) });
const seed = async (method, p, body) => {
  const r = await send(method, p, body);
  if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
};

// ───────────────────────────── seed ─────────────────────────────
const seeded = await seedVanJobs(send);                // Van Alpha (own, twice), Van Bravo (partner "WalkPartner"), the 2020-11-20 day
const { vanAlpha, vanBravo, bk: vjBk, g1 } = seeded;
// boats day (DB): a seat booking on Zeus, a charter on Oceanus, a self-arrive trip with a clock pick-up time
const DB = '2026-12-15';
await seed('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DB, capacity: 40 });
await seed('POST', '/operations/deployments', { boat_id: 'b13', route_id: 'r10', service_date: DB, capacity: 38, deploy_anyway: true });
const mkBk = (id, extra, trips) => seed('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: id.toUpperCase(), leadNationality: 'RU', leadPhone: '+7 900 1', hotelName: 'Test Hotel', ...extra, trips });
const seatBk = await mkBk('zz-w5c-seat', { pickupSelf: false, pickupZone: 'PK' }, [{ routeId: 'r5', date: DB, pax: { ad_fr: 2 }, zone: 'PK' }]);
{ const v = (await api('/v1/bookings/' + seatBk.id)).version; await seed('PATCH', '/operations/trip-ops/' + seatBk.trips[0].id, { boat_id: 'b6', version: v }); }
const chBk = await seed('POST', '/v1/bookings', { external_id: 'b2c_w5c_ch', total: 9000, leadPax: 'W5C CHARTER', leadNationality: 'RU', leadPhone: '+7 900 1', pickupSelf: true,
  trips: [{ routeId: 'r10', date: DB, pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13' }] });
const selfBk = await mkBk('zz-w5c-self', { pickupSelf: true, pickupZone: 'NoTransfer' }, [{ routeId: 'r5', date: DB, pax: { ad_fr: 1 }, zone: 'NoTransfer', pickupTime: '07:30' }]);
await seed('PUT', '/v1/boats/b6/capacity-overrides/' + DB, { capacity: 44, reason: 'w5c walk' });
// a booking with a separate drop-off and no return van, riding Van Bravo's group on D: the board's return alert
const retBk = await mkBk('zz-w5c-ret', { pickupSelf: false, pickupZone: 'PK', dropoff_same: false, dropoff_hotel_name: 'Kata Palm Resort' }, [{ routeId: ROUTE, date: D, pax: { ad_fr: 2 }, zone: 'PK' }]);
await seed('POST', '/operations/van-groups/' + seeded.g3.id + '/members', { members: [{ trip_id: retBk.trips[0].id }] });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} window.print = function () {}; window.close = function () {}; }, token);
const calls = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url()), hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const body = ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined);
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push({ m: req.method(), p: u.pathname + u.search, status: r.status, req: body, res: buf.toString() });
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
let dialogAnswer = true, promptAnswer = 'transfer';
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); if (d.type() === 'prompt') d.accept(promptAnswer); else if (dialogAnswer) d.accept(); else d.dismiss(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 900))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 12000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const num = (x) => Math.round((+x || 0) * 100) / 100;
const todo = [];
const section = (name, fn) => todo.push([name, fn]);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1000);
const goView = (v) => ev((v) => nav({ dataset: { view: v }, classList: { add() {} } }), v);
const loadDay = (d) => ev(async (d) => { await bookingV2EnsureOpsRange({ from: d, to: d, refresh: true }); }, d);
const clientId = (opsId) => ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); return b ? b.id : null; }, opsId);

// ═════════════════════════════ 1 · boats ═════════════════════════════
section('1', async () => {
  console.log('\n[1] boats: boat pulled, the heals, the charter boats of a day, a boat\'s seats of a day');
  await loadDay(DB);
  const seatId = await clientId(seatBk.id), chId = await clientId(chBk.id), selfId = await clientId(selfBk.id);
  ok('the three bookings of the day are in the browser', !!seatId && !!chId && !!selfId, { seatId, chId, selfId });

  // — bookingV2BoatPulled —
  let srvTrip = (await api('/v1/bookings/' + seatBk.id)).trips[0];
  ok('server: Zeus carries the booking and nothing pulled it', srvTrip.operations.boat_id === 'b6' && srvTrip.operations.boat_pulled === false, srvTrip.operations);
  const t1 = await ev((a) => {
    const b = SB_BOOKINGS.find((x) => x.id === a.id);
    TRIPS[a.d] = TRIPS[a.d] || {}; const cell = TRIPS[a.d].b6; const was = cell && cell.route;
    if (cell) cell.route = 'r4';                       // the browser's own copy of the deployments says Zeus moved: legacy's test would say "pulled"
    const legacy = window.bookingV2BoatPulled.__orig(b, a.d), now = bookingV2BoatPulled(b, a.d);
    if (cell) cell.route = was;
    return { legacy, now, hasCell: !!cell };
  }, { id: seatId, d: DB });
  ok('boat pulled: the trip\'s boat_pulled (false) answers although the browser\'s own deployments would call it pulled', t1.hasCell && t1.legacy === true && t1.now === false, t1);
  // Zeus moves to another route on the server (the bookings on it stay): boat_pulled becomes true on the booking read
  const mv = await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r4', service_date: DB, capacity: 40, remove_anyway: true });
  srvTrip = (await api('/v1/bookings/' + seatBk.id)).trips[0];
  ok('server: after Zeus is moved to another route the booking reads boat_pulled true', mv.status < 300 && srvTrip.operations.boat_pulled === true, { mv: mv.status, ops: srvTrip.operations });
  await loadDay(DB);
  const t2 = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); TRIPS[a.d] = TRIPS[a.d] || {}; if (TRIPS[a.d].b6) TRIPS[a.d].b6.route = 'r5'; return { now: bookingV2BoatPulled(b, a.d), legacy: window.bookingV2BoatPulled.__orig(b, a.d) }; }, { id: seatId, d: DB });
  ok('boat pulled: true from the server although the browser\'s copy of the deployments says Zeus is back on its route (legacy: false)', t2.now === true && t2.legacy === false, t2);
  await seed('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DB, capacity: 40, remove_anyway: true });

  // — the heals do nothing in ops mode —
  const h = await ev((a) => {
    const b = SB_BOOKINGS.find((x) => x.id === a.ch); const o = bkOpsFor(b, a.d); const before = o.boatId || '';
    o.boatId = '';
    const retNow = bookingV2CharterBoatHeal(a.d); const afterNow = bkOpsRead(b, a.d).boatId || '';
    const retLegacy = window.bookingV2CharterBoatHeal.__orig(a.d); const afterLegacy = bkOpsRead(b, a.d).boatId || '';
    o.boatId = before;
    const s = SB_BOOKINGS.find((x) => x.id === a.self); const t = s.trips.find((x) => (x.date || '') === a.d); const pt = t.pickupTime;
    t.pickupTime = '07:30';
    bookingV2HealSelfArrivePickup(a.d); const ptNow = t.pickupTime;
    window.bookingV2HealSelfArrivePickup.__orig(a.d); const ptLegacy = t.pickupTime;
    t.pickupTime = pt;
    return { before, retNow, afterNow, retLegacy, afterLegacy, ptNow, ptLegacy };
  }, { ch: chId, self: selfId, d: DB });
  const chSrv = (await api('/v1/bookings/' + chBk.id)).trips[0], selfSrv = (await api('/v1/bookings/' + selfBk.id)).trips[0];
  ok('server: the charter\'s boat is on the trip (the server did the heal when it saved), the self-arrive trip has no clock pick-up time', chSrv.operations.boat_id === 'b13' && !selfSrv.pickup_time, { op: chSrv.operations, pt: selfSrv.pickup_time });
  ok('bookingV2CharterBoatHeal does nothing in ops mode (legacy would write ops.boatId)', h.afterNow === '' && h.afterLegacy === 'b13' && h.retNow === 0, h);
  ok('bookingV2HealSelfArrivePickup does nothing in ops mode (legacy would rewrite the time)', h.ptNow === '07:30' && h.ptLegacy !== '07:30', h);

  // — baCharterBoatMap —
  await ev((d) => { laOps.boatOperation.ensure([d], function () {}); }, DB);
  await waitFor((d) => laOps.boatOperation.day(d) !== null, DB, 15000);
  const panel = (await api(`/v1/fleet/boat-operation?from=${DB}&to=${DB}&pier=all`)).days[0];
  const asg = panel.assigned.find((a) => a.boat_id === 'b13');
  ok('server: the panel lists Oceanus as a charter boat with the booking\'s id', asg && asg.is_charter === true && asg.charter_booking_id === chBk.id, asg);
  const cm = await ev((a) => {
    const i = SB_BOOKINGS.findIndex((x) => x.id === a.ch); const keep = SB_BOOKINGS.splice(i, 1)[0];   // the booking leaves the browser: legacy's walk finds nothing
    baChMemoClear();
    const legacy = [...window.baCharterBoatMap.__orig(a.d).keys()], now = baCharterBoatMap(a.d); const res = { legacy, now: [...now.keys()], who: now.get('b13') };
    SB_BOOKINGS.splice(i, 0, keep); baChMemoClear();
    return res;
  }, { ch: chId, d: DB });
  ok('baCharterBoatMap: Oceanus is chartered by that booking (the server\'s panel) with no booking in the browser; legacy\'s walk says nothing', cm.legacy.length === 0 && cm.now.includes('b13') && cm.who === chBk.id, cm);   // the booking is not in the browser: the server's id stands in

  // — boatCapInfo —
  await ev(() => laOps.capOverrides.load()); await settle(500);
  const day = (await api(`/v1/boats/b6/capacity-overrides?from=${DB}&to=${DB}`)).overrides[0];
  const ci = await ev((a) => {
    const b = getBoat('b6'); const was = b.cap; b.cap = 99;       // the browser's boat record says 99 seats: legacy's base would be 99
    const now = boatCapInfo('b6', a.d), legacy = window.boatCapInfo.__orig('b6', a.d), cf = boatCapFor('b6', a.d); b.cap = was; return { now, legacy, cf };
  }, { d: DB });
  ok('server: the day object (capacity 44, normal 40, ceiling 47)', day && day.capacity === 44 && day.normal === 40 && day.ceiling === 47 && day.overridden, day);
  ok('boatCapInfo: cap / base / licence / delta are the server\'s day object (legacy, from the boat record, said 99)', ci.now.cap === 44 && ci.now.base === 40 && ci.now.license === 47 && ci.now.delta === 4 && ci.now.overridden === true && ci.legacy.base === 99 && ci.cf === 44, ci);
});

// ═════════════════════════════ 2 · vans ═════════════════════════════
section('2', async () => {
  console.log('\n[2] vans: zone and usable on a day, pools, return alert, mixed vans, special request, rounds, stops');
  await ev(async (d) => { await laOps.vanJobs.loadDay(d); }, D); await settle(1500);
  // a status range makes Bravo unusable on D2 and a day zone moves Alpha to KL on D2: only the server knows (the browser loaded the vans before)
  const lastDay = (await api(`/operations/van-days?from=${D2}&to=${D2}`));
  await seed('POST', `/operations/vans/${vanBravo.id}/status-ranges`, { status: 'maintenance', from_date: D2, to_date: D2, note: 'w5c' });
  await seed('PUT', `/operations/van-days/${D2}/${vanAlpha.id}`, { route_ids: [ROUTE], zone: 'KL' });
  const vdays = await api(`/operations/van-days?from=${D2}&to=${D2}`);
  const cA = vdays.days.find((c) => c.van_id === vanAlpha.id), cB = vdays.days.find((c) => c.van_id === vanBravo.id);
  ok('server: Alpha is in zone KL on D2 (zone_on), Bravo is not usable (maintenance)', cA.zone_on === 'PK' || cA.zone_on === 'KL', { cA, cB });
  const z0 = await ev((a) => { const v = SB_VEHICLES.find((x) => x.id === a.v); return vehEffectiveZone(v, a.d); }, { v: vanAlpha.id, d: D2 });   // first ask: legacy answers, the read goes out
  await settle(1200);
  const z = await ev((a) => {
    const va = SB_VEHICLES.find((x) => x.id === a.a), vb = SB_VEHICLES.find((x) => x.id === a.b);
    const keepZ = va.zoneBase, keepA = vb.active; va.zoneBase = 'RN'; va.dayZone = {}; va.dayRoute = {}; vb.active = true; vb.statusRanges = []; vb.dayStatus = {};
    const out = { zone: vehEffectiveZone(va, a.d), zoneLegacy: window.vehEffectiveZone.__orig(va, a.d), bUsable: _vehUsableOn(vb, a.d), bUsableLegacy: window._vehUsableOn.__orig(vb, a.d),
      forKL: vanVehiclesForZone('KL', a.d).map((v) => v.id), forPK: vanVehiclesForZone('PK', a.d).map((v) => v.id) };
    va.zoneBase = keepZ; vb.active = keepA; return out;
  }, { a: vanAlpha.id, b: vanBravo.id, d: D2 });
  ok('vehEffectiveZone = the matrix cell\'s zone_on although the browser\'s van record says another zone', z.zone === cA.zone_on && z.zoneLegacy !== cA.zone_on, { z, cA });
  ok('_vehUsableOn = the cell\'s usable (false: maintenance) although the browser knows no range (legacy: true)', cB.usable === false && z.bUsable === false && z.bUsableLegacy === true, { z, cB });
  ok('vanVehiclesForZone follows: Bravo is in no pool that day; the pool of the zone Alpha is in has Alpha', !z.forKL.includes(vanBravo.id) && !z.forPK.includes(vanBravo.id) && [...z.forKL, ...z.forPK].includes(vanAlpha.id), z);
  void z0; void lastDay;

  // — pools and the return alert from the van board —
  await ev((d) => { laOpsVanBoardFor(d); }, D); await settle(1500);
  const board = await api('/operations/van-board?date=' + D);
  const rb = board.routes.find((r) => r.route_id === ROUTE);
  const pool = await ev((a) => {
    const va = SB_VEHICLES.find((x) => x.id === a.a); const keep = va.dayRoute[a.d]; delete va.dayRoute[a.d];     // the browser forgets Alpha serves the programme
    const now = vanVehiclesForRoute(a.d, a.r, 'PK').map((v) => v.id), legacy = window.vanVehiclesForRoute.__orig(a.d, a.r, 'PK').map((v) => v.id);
    if (keep) va.dayRoute[a.d] = keep; return { now, legacy };
  }, { a: vanAlpha.id, d: D, r: ROUTE });
  ok('server: the pool of the programme has both vans', eq([...rb.pool.outbound].sort(), [vanAlpha.id, vanBravo.id].sort()), rb.pool);
  ok('vanVehiclesForRoute = the board\'s pool.outbound (Alpha is in it although the browser forgot)', eq([...pool.now].sort(), [...rb.pool.outbound].sort()) && !pool.legacy.includes(vanAlpha.id), pool);
  const ru = board.routes.flatMap((r) => r.return_unarranged || []);
  if (ru.length) {
    const first = ru[0], cid = await clientId(first.booking_id);
    const ri = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); if (!b) return null; const o = bkOpsFor(b, a.d); const k = o.vanReturnId, kk = o.returnSameVan; o.vanReturnId = 'vehXX'; o.returnSameVan = true;
      const now = bookingV2RetInfo(b, a.d).alert, legacy = window.bookingV2RetInfo.__orig(b, a.d).alert; o.vanReturnId = k; o.returnSameVan = kk; return { now, legacy }; }, { id: cid, d: D });
    ok('bookingV2RetInfo.alert = the board lists the booking in return_unarranged (legacy, told "arranged", said no)', ri && ri.now === true && ri.legacy === false, { ri, first });
  } else ok('the board has a return-unarranged booking to test with', false, board.warnings);
  const conf = await ev((a) => {
    const rows = []; SB_BOOKINGS.forEach((b) => { if (b.trips.some((t) => t.date === a.d && t.routeId === a.r)) { const o = bkOpsRead(b, a.d); if (o && o.vanGroup) rows.push(o); } });
    const g = rows[0].vanGroup; const same = rows.filter((o) => o.vanGroup === g); const keep = same.map((o) => o.vanId);
    same.forEach((o, i) => { o.vanId = i % 2 ? 'vehYY' : 'vehXX'; });
    const now = bookingV2VanGroupConflicts(a.d), legacy = window.bookingV2VanGroupConflicts.__orig(a.d); same.forEach((o, i) => { o.vanId = keep[i]; });
    return { now: now.length, legacy: legacy.length, n: same.length };
  }, { d: D, r: ROUTE });
  ok('bookingV2VanGroupConflicts: none in ops mode (a group has one van_id on the server); legacy would flag the mixed copy', conf.n >= 2 && conf.now === 0 && conf.legacy >= 1, conf);

  // — special request —
  const oneId = await clientId(vjBk.one.id);
  const srv = (await api('/v1/bookings/' + vjBk.one.id)).special_request;
  const sr = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); const keepN = b.notes; b.notes = 'typed in the browser only'; const hadKey = a.id in VANJOB_SREQ; delete VANJOB_SREQ[a.id];
    const now = vanJobsSreqFinal(b), legacy = window.vanJobsSreqFinal.__orig(b); b.notes = keepN; return { now, legacy }; }, { id: oneId });
  ok('vanJobsSreqFinal = the booking\'s special_request (job_note else notes, the server\'s); legacy read the browser\'s notes', srv === 'Wait in the lobby' && sr.now === srv && sr.legacy === 'typed in the browser only', { srv, sr });

  // — rounds —
  const day = await api('/operations/van-jobs?date=' + D);
  const aJobs = day.jobs.filter((j) => j.van_id === vanAlpha.id && j.group_id).sort((a, b) => a.round.no - b.round.no);
  await ev((d) => { vjRoundAll(d); }, D); await settle(1500);
  const rr = await ev((a) => {
    // tamper: the browser thinks round 2's pick-up is the earlier one
    const keep = [];
    SB_BOOKINGS.forEach((b) => { b.trips.forEach((t) => { if (t.date === a.d) { const o = bkOpsRead(b, a.d); if (o && o.vanGroup === a.g2 && o.vanId === a.v) { keep.push([o, o.pickupTimeFinal]); o.pickupTimeFinal = '04:00'; } } }); });
    const m = vjRoundAll(a.d), key = a.v + '~' + a.r;
    const out = { now: [a.g1, a.g2].map((g) => vjRoundPick(m[key], g)), legacy: [a.g1, a.g2].map((g) => window.vjRoundPick.__orig(window.vjRoundAll.__orig(a.d)[key], g)), n: vehDayRoundN(a.v, a.d, a.r), keys: Object.keys(m[key] || {}) };
    keep.forEach(([o, p]) => { o.pickupTimeFinal = p; }); return out;
  }, { d: D, v: vanAlpha.id, r: ROUTE, g1: aJobs[0].group_number, g2: aJobs[1].group_number });
  ok('server: Alpha runs the programme twice; round 1 is the 07:00 group', aJobs.length === 2 && aJobs[0].round.of === 2 && aJobs[0].round.time === '07:00' && aJobs[1].round.time === '09:00', aJobs.map((j) => j.round));
  ok('vjRoundPick gives each group the server\'s round {no, of, time} (also when the browser\'s times would swap them)', rr.now[0] && rr.now[0].no === aJobs[0].round.no && rr.now[0].tot === 2 && rr.now[0].tm === '07:00' && rr.now[1].no === 2 && rr.now[1].tm === '09:00' && rr.legacy[0] && rr.legacy[0].no === 2, rr);
  ok('vehDayRoundN = the number of rounds (2) from the same read', rr.n === 2 && rr.keys.length === 2, rr);

  // — stops —
  await seed('POST', '/operations/van-stops', { group_id: g1.id, kind: 'staff', label: 'Guide Early', place: 'Walk Office', pax: 1, time: '05:50', area: 'Patong', leg: 'out' });
  await settle(1500);                                      // the screen's day read after the stop was written
  const stops = (await api(`/operations/van-stops?service_date=${D}`)).stops;
  await ev(async (d) => { await laOps.vanJobs.loadDay(d); }, D); await settle(800);
  const vs = await ev((a) => {
    const S = VAN_STOPS; const ks = Object.keys(S).filter((k) => k.startsWith(a.d + '::'));
    const keep = ks.map((k) => [k, S[k].vanSeq]); ks.forEach((k) => { S[k].vanSeq = 9; });       // the browser's copy of the manual order says something else
    const now = vsFor(a.d, a.r).map((s) => s.label), legacy = window.vsFor.__orig(a.d, a.r).map((s) => s.label); keep.forEach(([k, v]) => { S[k].vanSeq = v; });
    return { now, legacy };
  }, { d: D, r: ROUTE });
  ok('vsFor keeps the order the server sent (pickup order)', eq(vs.now, stops.filter((s) => s.route_id === ROUTE).map((s) => s.label)) && vs.now.length >= 2, { vs, stops: stops.map((s) => [s.label, s.time, s.sequence]) });
  const gs = (await api(`/operations/van-groups?service_date=${D}&route_id=${ROUTE}`)).groups.find((g) => g.id === g1.id);
  const seats = await ev((a) => { const S = VAN_STOPS; const ks = Object.keys(S).filter((k) => k.startsWith(a.d + '::')); const keep = ks.map((k) => [k, S[k].pax]); ks.forEach((k) => { S[k].pax = 7; });
    const now = vsSeatsOfVan(a.d, a.r, a.v, a.n, false), legacy = window.vsSeatsOfVan.__orig(a.d, a.r, a.v, a.n, false); keep.forEach(([k, v]) => { S[k].pax = v; }); return { now, legacy }; }, { d: D, r: ROUTE, v: vanAlpha.id, n: gs.number });
  ok('vsSeatsOfVan = the group\'s stop_seats (2 guides) although the browser\'s stop rows say 7 each', gs.stop_seats === 2 && seats.now === 2 && seats.legacy === 14, { gs: gs.stop_seats, seats });
  // the stop form: no browser seat sum; the server's 409 asks "Add anyway?" and the answer goes back with seats_anyway
  const room = gs.capacity - gs.pax;
  const mark = calls.length; dialogs.length = 0;
  await ev((a) => {
    vsOpen(a.d, a.r, { vanId: a.v, vanGroup: a.n, zone: 'PK' });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('vs-kind', 'staff'); set('vs-label', 'Too many guides'); set('vs-place', 'Walk Office'); set('vs-pax', String(a.pax)); set('vs-time', '05:40'); set('vs-leg', 'out');
    vsSubmit();
  }, { pax: room + 2, d: D, r: ROUTE, v: vanAlpha.id, n: gs.number });
  await idle(); await settle(1500);
  const posts = calls.slice(mark).filter((c) => c.m === 'POST' && /\/operations\/van-stops$/.test(c.p));
  ok('the form sends the stop with no browser seat sum: first POST refused 409 van_over_capacity, the server\'s message is the question, the answer repeats with seats_anyway', posts.length === 2 && posts[0].status === 409 && /van_over_capacity/.test(posts[0].res) && !('seats_anyway' in JSON.parse(posts[0].req)) && posts[1].status === 201 && JSON.parse(posts[1].req).seats_anyway === true
    && dialogs.some((d) => /Add anyway\?/.test(d)) && !dialogs.some((d) => /^confirm: Van .* seats \d+, this would make/.test(d)), { posts: posts.map((p) => [p.status, p.req]), dialogs });
  const gs2 = (await api(`/operations/van-groups?service_date=${D}&route_id=${ROUTE}`)).groups.find((g) => g.id === g1.id);
  await settle(1500);
  const seats2 = await ev((a) => vsSeatsOfVan(a.d, a.r, a.v, a.n, false), { d: D, r: ROUTE, v: vanAlpha.id, n: gs.number });
  ok('and the screen\'s seat count of the group follows the server after the write (the day was read again)', seats2 === gs2.stop_seats && gs2.stop_seats === 2 + room + 2, { seats2, gs2: gs2.stop_seats });
});

// ═════════════════════════════ 3 · pier pills and petty cash ═════════════════════════════
const PIER = 'tublamu';
section('3', async () => {
  console.log('\n[3] pier page pills (programmes) and petty cash (ledger order, running balance, closing, longtail boats, park difference)');
  // — pier programme pills: the server counted who arrived / cleared / boarded; the browser does not know —
  await ev(async (d) => { await laOps.vanJobs.loadDay(d); }, D); await settle(1000);
  const oneT = vjBk.one.trips[0].id, twoT = vjBk.two.trips[0].id, threeT = vjBk.three.trips[0].id;
  await seed('POST', `/operations/trip-ops/${oneT}/checkins/pier/0/stage`, { stage: 'arrived', on: true });
  await seed('POST', `/operations/trip-ops/${twoT}/checkins/pier/0/stage`, { stage: 'arrived', on: true });
  await seed('POST', `/operations/trip-ops/${twoT}/checkins/pier/0/stage`, { stage: 'cleared', on: true });
  await seed('POST', `/operations/trip-ops/${threeT}/checkins/pier/0/check-in`, {});
  const sheet = await api('/v1/pier-checkin?date=' + D);
  const fam = sheet.programmes.find((p) => p.variants.some((v) => v.route_id === ROUTE));
  const variant = fam.variants.find((v) => v.route_id === ROUTE);
  const rowsP = variant.zones.PK.total + variant.zones.KL.total + variant.zones.OWN.total;
  ok('server: heads that arrived / cleared / boarded and the zone boxes of the programme', fam.arr >= 2 && fam.clr >= 1 && fam.brd >= 1 && variant.zones.PK.total > 0, { fam: { arr: fam.arr, clr: fam.clr, brd: fam.brd, due: fam.due }, zones: variant.zones });
  const pills = () => ev((d) => {
    const r = ckRoutePills(d, null, null, 'pckSetFam', 'pckSetRoute', 'pier');
    const box = document.createElement('div'); box.innerHTML = r.html; const t = (box.innerText || box.textContent).replace(/\s+/g, ' ');
    const x = (re) => { const m = re.exec(t); return m ? m.slice(1).map((v) => +String(v).replace(/,/g, '')) : null; };
    const zones = {};
    box.querySelectorAll('span[title]').forEach((sp) => { const m = /^(PK|KL) · เช็คอินแล้ว (\d+) จาก (\d+) pax/.exec(sp.getAttribute('title')); if (m) zones[m[1]] = [+m[2], +m[3]]; });
    return { arr: x(/ถึงท่า (\d+)\/(\d+)/), clr: x(/เคลียร์ (\d+)/), on: x(/ขึ้นเรือ (\d+)/), due: x(/ค้างเก็บ ฿([\d,]+)/), zones, text: t.slice(0, 500) };
  }, D);
  await pills(); await settle(1800);                 // the first draw is the walk's; the read goes out
  const p2 = await pills();
  ok('pill footer: ถึงท่า / เคลียร์ / ขึ้นเรือ are the programme\'s heads from GET /v1/pier-checkin (the browser had not been told)', p2.arr && p2.arr[0] === fam.arr && p2.arr[1] === rowsP && p2.clr && p2.clr[0] === fam.clr && p2.on && p2.on[0] === fam.brd, { p2, want: { arr: fam.arr, rowsP, clr: fam.clr, brd: fam.brd } });
  ok('pill zone boxes: PK done / total are the server\'s', variant.zones.PK.total > 0 && p2.zones.PK && p2.zones.PK[0] === variant.zones.PK.done && p2.zones.PK[1] === variant.zones.PK.total, { z: p2.zones, v: variant.zones });
  ok('the money still to collect is the server\'s due (when there is some)', (fam.due > 0) === !!p2.due && (!p2.due || p2.due[0] === Math.round(fam.due)), { due: fam.due, p2: p2.due });
  const legacyP = await ev((d) => { const f = window.laOpsPierProg; window.laOpsPierProg = null; try { const r = ckRoutePills(d, null, null, 'pckSetFam', 'pckSetRoute', 'pier'); const b = document.createElement('div'); b.innerHTML = r.html; const m = /ถึงท่า (\d+)\/(\d+)/.exec((b.innerText || b.textContent).replace(/\s+/g, ' ')); return m ? [+m[1], +m[2]] : null; } finally { window.laOpsPierProg = f; } }, D);
  ok('(control) the walk over the browser\'s own bookings counted nobody arrived', legacyP && legacyP[0] === 0, legacyP);

  // — petty cash —
  const P = (p) => `/v1/pier-cash/${PIER}${p}`;
  const D0 = '2026-11-19';
  await seed('POST', P(`/days/${D0}/rows`), { kind: 'in', amount: 1000, description: 'opening money', time: '08:00' });
  await seed('POST', P(`/days/${D}/rows`), { kind: 'out', amount: 100, description: 'late out', time: '10:00' });
  await seed('POST', P(`/days/${D}/rows`), { kind: 'out', amount: 70, description: 'out nine', time: '09:00' });
  await seed('POST', P(`/days/${D}/rows`), { kind: 'in', amount: 500, description: 'in nine', time: '09:00' });
  await seed('POST', P(`/days/${D}/rows`), { kind: 'in', amount: 30, description: 'in ten', time: '10:00' });
  await seed('POST', P(`/days/${D}/rows`), { kind: 'out', amount: 25, description: 'no time' });
  await seed('PATCH', P(`/days/${D}/park/b6`), { ad_fr: 2, chd_fr: 1, amount: 1200, dock: 0 });
  await seed('PATCH', P(`/days/${D}/longtail/b6`), { join_boats: 1, charter_boats: 2, amount: 900 });
  await seed('POST', P(`/days/${D}/pull`), {});
  const day = await api(P(`/days/${D}`)), month = await api(P('/months/2026-11'));
  await ev((a) => { window._poPier = a.p; window._poDate = a.d; }, { p: PIER, d: D }); await goView('pop-' + PIER); await settle(2500);
  await ev((d) => pcPickDay(d), D); await idle(); await settle(2500);
  // the browser's own rows are tampered with: legacy would sort and add them differently
  await ev((a) => { const rows = pcRowsArr().filter((r) => r.pier === a.p && r.date === a.d); const inTen = rows.find((r) => r.txt === 'in ten'); if (inTen) inTen.at = '23:59'; const late = rows.find((r) => r.txt === 'late out'); if (late) late.amt = 99999; renderPierCash(a.p); }, { p: PIER, d: D });
  await settle(600);
  const screen = await ev(() => [...document.querySelectorAll('.pc2-lr.rw')].map((r) => { const ms = r.querySelectorAll('.m'); const t = ms[ms.length - 1]; return { txt: (r.querySelector('.tx') || {}).title || '', bal: t ? t.textContent.replace(/[^0-9−-]/g, '').replace('−', '-') : null }; }));
  ok('server: the ledger runs by time, in before out, untimed last; each row has its balance', day.rows.length >= 6 && day.rows.every((r) => typeof r.balance === 'number'), day.rows.map((r) => [r.description, r.time, r.balance]));
  ok('petty cash screen: the rows are in the server\'s order although the browser\'s copy says a row is at 23:59', eq(screen.map((r) => r.txt), day.rows.map((r) => r.description || '')), { screen: screen.map((r) => r.txt), server: day.rows.map((r) => r.description) });
  ok('and every running balance is the server\'s (the browser\'s copy of one amount says 99999)', eq(screen.map((r) => +r.bal), day.rows.map((r) => num(r.balance))), { screen: screen.map((r) => r.bal), server: day.rows.map((r) => r.balance) });
  const kpi = await ev(() => { const k = document.querySelector('.pc2-kpi .k.dk .v'); return k ? k.textContent.replace(/[^0-9−-]/g, '').replace('−', '-') : null; });
  ok('the "คงเหลือในมือ" card = the day\'s closing (opening 1000 + in − out)', +kpi === num(day.closing) && day.opening === 1000, { kpi, day: [day.opening, day.closing] });
  const closeNow = await ev((a) => ({ now: pcClosing(a.p, a.d), legacy: window.pcClosing.__orig(a.p, a.d) }), { p: PIER, d: D });
  ok('pcClosing = the month table\'s closing of the day', closeNow.now === num(month.days.find((x) => x.date === D).closing), { closeNow, srv: month.days.find((x) => x.date === D) });
  const mlist = await ev(() => [...document.querySelectorAll('.pc2-month .pc2-mr')].map((b) => { const sp = b.querySelectorAll(':scope > span'); return { d: (b.querySelector('b') || {}).textContent, bal: sp[sp.length - 1].textContent.replace(/[^0-9−-]/g, '').replace('−', '-') }; }));
  ok('month list: each day\'s carried balance = the server\'s closing of that day', mlist.length >= month.days.length && month.days.every((x, i) => +mlist[i].bal === num(x.closing)), { mlist, srv: month.days.map((x) => [x.date, x.closing]) });
  // longtail boats used and the park cell's difference
  const cells = await ev((a) => { const C = (pcDay(a.p, a.d, false) || {}).lt || {}; const c = C.b6 || null; if (!c) return null; const keep = c.nj; c.nj = 9; const now = pcLtUsed(c), legacy = window.pcLtUsed.__orig(c); c.nj = keep; return { now: now.tot, legacy: legacy.tot }; }, { p: PIER, d: D });
  const lt = (await api(P('/months/2026-11/longtail'))).days.find((x) => x.date === D).boats.find((b) => b.boat_id === 'b6').cell;
  ok('server: the longtail cell says 3 boats used (1 join + 2 charter)', lt && lt.used_boats === 3, lt);
  ok('pcLtUsed.tot = the cell\'s used_boats (3) although the browser\'s join count was changed to 9', cells && cells.now === 3 && cells.legacy !== 3, cells);
  const pk = (await api(P('/months/2026-11/park'))).days.find((x) => x.date === D).boats.find((b) => b.boat_id === 'b6');
  const diff = await ev((a) => ({ now: pcPkDiff(a.p, a.d, 'b6', 123), legacy: window.pcPkDiff.__orig(a.p, a.d, 'b6', 123) }), { p: PIER, d: D });
  ok('pcPkDiff = the park cell\'s check.diff (' + JSON.stringify(pk.check.diff) + '); legacy\'s subtraction would say 123', diff.now === pk.check.diff && diff.legacy === 123, { diff, check: pk.check });
  // the sheets' keyed sums of the day: the server's totals, not the sum of the cells the browser holds
  await ev((a) => { const C = (pcDay(a.p, a.d, false) || {}).lt || {}; if (C.b6) C.b6.amt = 55555; pcTab(1); }, { p: PIER, d: D }); await settle(900);
  const ltRow = await ev(() => { const r = document.querySelector('.pc2-tr.lt.tot'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const ltDay = (await api(P('/months/2026-11/longtail'))).days.find((x) => x.date === D);
  ok('longtail sheet, the day\'s total row: the server\'s keyed sums (3 boats; ' + ltDay.totals.amount + ' baht) although the browser\'s cell says 55555', ltRow.includes(Math.round(ltDay.totals.amount).toLocaleString('en-US')) && !ltRow.includes('55,555'), { ltRow, totals: ltDay.totals });
  await ev((a) => { const C = (pcDay(a.p, a.d, false) || {}).pk || {}; if (C.b6) C.b6.amt = 77777; pcTab(2); }, { p: PIER, d: D }); await settle(900);
  const pkRow = await ev(() => { const r = document.querySelector('.pc2-tr.pk.tot'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const pkDay = (await api(P('/months/2026-11/park'))).days.find((x) => x.date === D);
  ok('park sheet, the day\'s total row: the server\'s keyed amount (' + pkDay.totals.amount + ') although the browser\'s cell says 77777', pkRow.includes(Math.round(pkDay.totals.amount).toLocaleString('en-US')) && !pkRow.includes('77,777'), { pkRow, totals: pkDay.totals });
});

// ═════════════════════════════ 4 · partner van bills by pier ═════════════════════════════
section('4', async () => {
  console.log('\n[4] partner van bills: the overview by pier, the owner\'s sheet of one pier, the sale price of a pier, new rows, extra lines of other piers');
  const M = '2026-11', PER = 2, PN = 'WalkPartner';
  const bill = `/v1/van-bills/${PN}/${M}/${PER}`;
  // an owner with vans and no work this round; a typed extra line at Phuket; the rows seen; then a new run appears on the 21st
  await seed('POST', '/operations/vans', { name: 'Idle Van', capacity: 9, ownership: 'partner', partner_name: 'IdlePartner' });
  await seed('PATCH', bill, { extra_lines: [{ date: D, note: 'panwa extra', vans: 1, pax: 0, rate: 700, ex: 0, cut: 0, per_pax: 0, pier: 'panwa' }], route_rates: { SM: 1500 } });
  await seed('PATCH', bill, { mark_seen: true });
  const D21 = '2026-11-19';   // still in the 11–20 round
  await seed('POST', '/operations/deployments', { boat_id: 'b6', route_id: ROUTE, service_date: D21, capacity: 40 });
  await seed('PUT', `/operations/van-days/${D21}/${vanBravo.id}`, { route_ids: [ROUTE] });
  const nb = await mkBk('zz-w5c-new', { pickupSelf: false, pickupZone: 'PK' }, [{ routeId: ROUTE, date: D21, pax: { ad_fr: 2 }, zone: 'PK' }]);
  await seed('POST', '/operations/van-groups', { service_date: D21, route_id: ROUTE, zone: 'PK', members: [{ trip_id: nb.trips[0].id }], van_id: vanBravo.id });
  const ovSrv = await api(`/v1/van-bills?month=${M}&period=${PER}`), full = await api(bill);
  const pierRows = await api(`${bill}?pier=tublamu`);
  ok('server: the overview has a Tublamu block with the owner, tabs for ทั้งหมด + the piers with work, an idle owner', ovSrv.piers.some((b) => b.pier === 'tublamu' && b.partners.some((p) => p.partner === PN)) && ovSrv.tabs[0].pier === null && ovSrv.idle_partners.length >= 1, { tabs: ovSrv.tabs, idle: ovSrv.idle_partners });
  ok('server: the bill has a new row (the 19th), an extra line at Phuket kept apart from the Tublamu sheet', full.rows.some((r) => r['new']) && full.extra_lines.some((x) => x.pier === 'panwa') && !pierRows.extra_lines.some((x) => x.pier === 'panwa'), { newRows: full.new_rows, piers: full.by_pier.map((p) => p.pier) });

  // — the overview —
  await ev((a) => { _vb.ym = a.m; _vb.per = a.p; _vb.mode = 'ov'; _vb.pier = ''; _vb.sup = a.s; _vb.van = ''; _vb.edit = 0; _vb.open = {}; const el = document.querySelector('.nav-item[data-view="vanbill"]'); if (el) nav(el); renderVanBill(); }, { m: M, p: PER, s: PN });
  await waitFor(() => document.querySelector('#vanbill-host .vbx-pb'), null, 20000); await settle(1500);
  const ovShot = () => ev(() => {
    const h = document.getElementById('vanbill-host');
    return { tabs: [...h.querySelectorAll('.vbx-pt')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
      blocks: [...h.querySelectorAll('.vbx-pb')].map((b) => ({ head: b.querySelector('.vbx-pbh').innerText.replace(/\s+/g, ' ').trim(), rows: [...b.querySelectorAll('tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()), foot: b.querySelector('tfoot').innerText.replace(/\s+/g, ' ').trim() })),
      kpi: [...h.querySelectorAll('.vbx-kp .k')].map((k) => k.innerText.replace(/\s+/g, ' ').trim()), idle: (h.querySelector('.vbx-idle') || {}).innerText || '' };
  });
  let o = await ovShot();
  const B$ = (v) => (Math.round(v) < 0 ? '−฿' : '฿') + Math.abs(Math.round(v)).toLocaleString('en-US');
  const blkSrv = ovSrv.piers.find((b) => b.pier === 'tublamu');
  ok('overview: a tab for ทั้งหมด and one per pier with work, each with owners and money from tabs[]', o.tabs.length === ovSrv.tabs.length && o.tabs[0].includes('ทั้งหมด') && o.tabs[0].includes(ovSrv.tabs[0].owners + ' เจ้า') && o.tabs[0].includes(B$(ovSrv.tabs[0].bill)), { screen: o.tabs, srv: ovSrv.tabs });
  const blkScr = o.blocks.find((b) => b.head.includes('ทับละมุ'));
  ok('overview: the Tublamu block head says the server\'s owners / trips / pax / bill', blkScr && blkScr.head.includes(`${blkSrv.totals.owners} เจ้า · ${blkSrv.totals.trips} เที่ยว · ${blkSrv.totals.pax} คน`) && blkScr.head.includes(B$(blkSrv.totals.bill)), { head: blkScr && blkScr.head, srv: blkSrv.totals });
  const line = blkSrv.partners.find((p) => p.partner === PN);
  ok('overview: the owner\'s line shows trips, pax, bill, sale, profit from piers[].partners[]', blkScr.rows.some((r) => r.includes(PN) && r.includes(B$(line.bill)) && r.includes(B$(line.sale)) && r.includes(String(line.trips))), { rows: blkScr.rows, line: [line.trips, line.pax, line.bill, line.sale, line.pl] });
  ok('overview: the idle owners line is the server\'s idle_partners', ovSrv.idle_partners.every((n) => o.idle.includes(typeof n === 'string' ? n : n.partner)) && o.idle.includes('อีก ' + ovSrv.idle_partners.length + ' เจ้าไม่มีงานรอบนี้'), { idle: o.idle, srv: ovSrv.idle_partners });
  ok('overview: the footer of the block = the block\'s totals', blkScr.foot.includes(B$(blkSrv.totals.bill)) && blkScr.foot.includes(B$(blkSrv.totals.sale)), { foot: blkScr.foot });
  // pick a pier tab: the server narrows (piers, partners, totals); the tabs stay whole
  await ev(() => vbSetPier('tublamu')); await waitFor(() => !!document.querySelector('#vanbill-host .vbx-pt.on'), null, 10000); await settle(1200);
  o = await ovShot();
  const narrowed = await api(`/v1/van-bills?month=${M}&period=${PER}&pier=tublamu`);
  ok('overview, one pier chosen: GET …&pier=tublamu; the pier tab is on, one block, the tabs still list every pier', calls.some((c) => c.m === 'GET' && /\/v1\/van-bills\?month=2026-11&period=2&pier=tublamu/.test(c.p)) && o.blocks.length === 1 && o.tabs.length === ovSrv.tabs.length && o.kpi.some((k) => k.includes('รวมเรียกเก็บ') && k.includes(B$(narrowed.totals.bill))), { blocks: o.blocks.length, tabs: o.tabs, kpi: o.kpi });
  await ev(() => vbSetPier(''));

  // — the owner's sheet of the Tublamu pier —
  await ev((a) => vbOpenSupP(a.s, 'tublamu'), { s: PN });
  await waitFor(() => document.querySelector('#vanbill-host .vbx-xl'), null, 20000); await settle(1500);
  const shShot = () => ev(() => {
    const h = document.getElementById('vanbill-host');
    return { rows: [...h.querySelectorAll('.vbx-xl tbody tr')].filter((tr) => !tr.classList.contains('vbx-day') && !tr.classList.contains('vbx-add') && !tr.classList.contains('vbx-tot')).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()),
      tot: (h.querySelector('.vbx-tot') || { innerText: '' }).innerText.replace(/\s+/g, ' ').trim(), kpi: [...h.querySelectorAll('.vbx-kp .k')].map((k) => k.innerText.replace(/\s+/g, ' ').trim()),
      sheets: [...h.querySelectorAll('.vbx-sheets button')].map((b) => b.innerText.trim()), perInput: (h.querySelector('input[data-vbk="@per:tublamu"]') || {}).value, banner: (h.querySelector('.vb-newrow') || { innerText: '' }).innerText.replace(/\s+/g, ' ').trim(),
      newMarks: h.querySelectorAll('tr[data-new="1"]').length, extras: h.querySelectorAll('.vbx-xr').length };
  });
  let sh = await shShot();
  ok('sheet: the screen asked for the pier\'s sheet (?pier=tublamu) and its rows are the server\'s, one per row', calls.some((c) => c.m === 'GET' && c.p === `${bill}?pier=tublamu`) && sh.rows.length === pierRows.rows.length + pierRows.extra_lines.length, { rows: sh.rows.length, srv: pierRows.rows.length });
  ok('sheet: every row shows the server\'s bill and sale (the "เรียกเก็บ" and "ราคาขาย" columns)', pierRows.rows.every((r, i) => sh.rows[i] && sh.rows[i].includes(Math.round(r.bill).toLocaleString('en-US')) && (r.return_only || sh.rows[i].includes(Math.round(r.sale).toLocaleString('en-US')) || !r.sale)), { sh: sh.rows, srv: pierRows.rows.map((r) => [r.bill, r.sale]) });
  ok('sheet: the totals row is the pier\'s totals from the server (trips and bill)', sh.tot.includes('รวม ' + pierRows.totals.vans + ' เที่ยว') && sh.tot.includes(Math.round(pierRows.totals.bill).toLocaleString('en-US')), { tot: sh.tot, srv: pierRows.totals });
  ok('sheet: the NEW row (the 19th) is marked and the banner counts it, from the server\'s new flag', pierRows.rows.filter((r) => r['new']).length >= 1 && sh.newMarks === pierRows.rows.filter((r) => r['new']).length && /มี \d+ แถวที่เพิ่งโผล่หลังจากกรอกบิลใบนี้ไปแล้ว/.test(sh.banner), { banner: sh.banner, newMarks: sh.newMarks });
  ok('sheet: the extra line at Phuket is not on the Tublamu sheet; the pier buttons list the piers with this owner\'s trips', sh.extras === 0 && sh.sheets.some((t) => t.includes('ทับละมุ')), { extras: sh.extras, sheets: sh.sheets });
  // the sale price of the pier: per_pax_by_pier, sent whole with this pier changed, nothing computed
  const m0 = calls.length;
  await page.fill('#vanbill-host input[data-vbk="@per:tublamu"]', '250'); await page.keyboard.press('Tab'); await idle(); await settle(1800);
  const pPatch = calls.slice(m0).filter((c) => c.m === 'PATCH' && c.p === bill);
  const after = await api(bill);
  ok('the sale price of the pier is a PATCH of per_pax_by_pier only: { tublamu: 250 }, no computed field', pPatch.length === 1 && eq(JSON.parse(pPatch[0].req), { per_pax_by_pier: { tublamu: 250 } }), pPatch.map((c) => c.req));
  ok('server: Tublamu sells at 250 a head; the panwa extra line is still there', after.per_pax_by_pier.tublamu === 250 && after.extra_lines.some((x) => x.pier === 'panwa'), { p: after.per_pax_by_pier, lines: after.extra_lines.map((x) => x.pier) });
  sh = await shShot();
  const pierRows2 = await api(`${bill}?pier=tublamu`);
  ok('sheet: the rows now sell at 250 (server sale = pax × 250), the screen follows the server', pierRows2.rows.every((r) => r.return_only || r.per_pax === 250 || r.override) && sh.rows.some((r, i) => pierRows2.rows[i] && !pierRows2.rows[i].return_only && r.includes(Math.round(pierRows2.rows[i].sale).toLocaleString('en-US'))) && (sh.perInput === undefined || sh.perInput === '250'), { perInput: sh.perInput, sale: pierRows2.rows.map((r) => r.sale) });
  // an extra line added on this sheet belongs to this pier and does not touch the other pier's line
  const m1 = calls.length;
  await ev(() => laOpsVanBills.addExtra()); await idle(); await settle(1800);
  const ePatch = calls.slice(m1).filter((c) => c.m === 'PATCH' && c.p === bill);
  const after2 = await api(bill);
  const sent = ePatch.length ? JSON.parse(ePatch[0].req).extra_lines : [];
  ok('add extra: the whole list is sent back (the Phuket line included), the new line carries pier tublamu, no bill / sale field', ePatch.length === 1 && sent.length === 2 && sent.some((x) => x.pier === 'panwa') && sent.some((x) => x.pier === 'tublamu') && sent.every((x) => !('bill' in x) && !('sale' in x)), sent);
  ok('server: two extra lines, one per pier', after2.extra_lines.length === 2 && after2.extra_lines.map((x) => x.pier).sort().join() === 'panwa,tublamu', after2.extra_lines.map((x) => x.pier));
  sh = await shShot();
  ok('the sheet of Tublamu now has the one new extra line (not the Phuket one)', sh.extras === 1, sh.extras);
  // the Save button marks the rows seen: the banner goes
  await ev(() => vbEdit()); await settle(900);
  const m2 = calls.length;
  await ev(() => vbSave()); await idle(); await settle(1800);
  const sPatch = calls.slice(m2).filter((c) => c.m === 'PATCH' && c.p === bill);
  const seen = await api(bill);
  sh = await shShot();
  ok('✓ บันทึก sends mark_seen only; the server has no new rows any more and the banner is gone', sPatch.length === 1 && eq(JSON.parse(sPatch[0].req), { mark_seen: true }) && seen.rows.every((r) => !r['new']) && sh.banner === '' && sh.newMarks === 0, { req: sPatch.map((c) => c.req), banner: sh.banner });
});

// ═════════════════════════════ 5 · Daily PFM prepay amount ═════════════════════════════
section('5', async () => {
  console.log('\n[5] Daily PFM: the amount of a prepay is the invoice total the server works out (7% on top for an exclude-VAT agent)');
  const DP = '2026-12-20';
  const ag = await seed('POST', '/v1/agents', { name: 'Prepay Agent', market_id: 'ru', pay_type: 'invoice', vat_mode: 'exclude', rate_type_id: 'rt001', company: { legal_name: 'Prepay Agent Co', address: '1 Test Rd' } });
  await seed('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DP, capacity: 40 });
  const pb = await seed('POST', '/v1/bookings', { external_id: 'zz-w5c-prepay', intent: 'confirm', guides: { english: true }, agentId: ag.id, leadPax: 'W5C PREPAY', leadNationality: 'RU', leadPhone: '+7 900 1', hotelName: 'Test Hotel', pickupSelf: false, pickupZone: 'PK',
    trips: [{ routeId: 'r5', date: DP, pax: { ad_fr: 2 }, zone: 'PK' }] });
  const cand = (await api(`/v1/invoices/candidates?agent_id=${ag.id}&kind=prepay`)).candidates.find((c) => c.booking_id === pb.id);
  ok('server: the candidate carries the invoice total (the booking total plus 7%)', cand && cand.invoice_total > 0 && Math.round(cand.invoice_total) === Math.round(cand.total + cand.total * 0.07), cand);
  await loadDay(DP);
  const cid = await clientId(pb.id);
  await goView('dailypfm'); await settle(1500);
  const legacy = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return b ? { legacyTotal: window.pfmPrepayTotal.__orig(b), known: !!sbGetAgent(b.agentId) } : null; }, cid);
  const mark = calls.length;
  await ev((id) => pfmPrepayStart(id), cid);
  await waitFor(() => typeof _pfmRec !== 'undefined' && _pfmRec && _pfmRec.prepay, null, 5000);
  await settle(1800);
  const rec = await ev(() => ({ amount: _pfmRec ? _pfmRec.amount : null, prepay: _pfmRec ? !!_pfmRec.prepay : false }));
  const asked = calls.slice(mark).filter((c) => c.m === 'GET' && c.p.startsWith('/v1/invoices/candidates'));
  ok('the dialog asked GET /v1/invoices/candidates?agent_id=…&kind=prepay for that booking', asked.length === 1 && asked[0].p.includes('agent_id=' + ag.id) && asked[0].p.includes('kind=prepay') && asked[0].p.includes('q='), asked.map((c) => c.p));
  ok('the amount in the "Record payment" dialog is the server\'s invoice_total (legacy\'s own sum, with the agent unknown to the browser, had no VAT)', rec.prepay && rec.amount === Math.round(cand.invoice_total) && legacy && legacy.legacyTotal !== Math.round(cand.invoice_total), { rec, cand: cand.invoice_total, legacy });
  const shown = await ev(() => { const el = document.querySelector('#pfm-rec-modal input[type="number"], #pfm-rec-modal input'); return el ? el.value : null; });
  ok('and the dialog shows it (the figure was redrawn when the answer came)', String(shown).replace(/[^0-9]/g, '') === String(Math.round(cand.invoice_total)), { shown });
  ok('pfmPrepayTotal (the balance line) now answers the same figure', (await ev((id) => pfmPrepayTotal(SB_BOOKINGS.find((x) => x.id === id)), cid)) === Math.round(cand.invoice_total) || (await ev((id) => pfmPrepayTotal(SB_BOOKINGS.find((x) => x.id === id)), cid)) === cand.invoice_total, null);
  await ev(() => pfmRecClose && pfmRecClose());
});

// ═════════════════════════════ 6 · check-in count ceilings ═════════════════════════════
section('6', async () => {
  console.log('\n[6] check-in dialogs: ckCap / ckCeil are the server\'s expected / booked heads (through aboard)');
  await ev(async (d) => { await laOps.vanJobs.loadDay(d); }, D); await settle(1000);
  const sixId = await clientId(vjBk.six.id);
  const srv = (await api('/v1/bookings/' + vjBk.six.id)).trips[0];
  const r = await ev((a) => {
    const b = SB_BOOKINGS.find((x) => x.id === a.id), t = ckTripOn(b, a.d), booked = ckBookedPax(t);
    const o = bkOpsRead(b, a.d); const keep = o.vanCheckin; o.vanCheckin = null;                   // the browser's copy of the van's no-show is gone: legacy would expect everyone
    const now = ckCap(b, a.d, 'pier', booked), ceil = ckCeil(b, a.d, 'pier', booked);
    const ab = t.aboard; t.aboard = null; const legacy = ckCap(b, a.d, 'pier', booked); t.aboard = ab; o.vanCheckin = keep;     // without the server's block legacy's rule answers
    return { booked, now, ceil, legacy };
  }, { id: sixId, d: D });
  ok('server: WALK SIX lost its 2 heads at the van, so 0 are expected at the pier (aboard.expected 0, booked 2)', srv.aboard.expected === 0 && srv.aboard.booked.total === 2, srv.aboard);
  ok('ckCap(pier) = aboard.expected (0) although the browser\'s van record is gone (legacy: 2); ckCeil = the booked heads (2)', r.now === 0 && r.legacy === 2 && r.ceil === 2, r);
});

// ───────────────────────────── run ─────────────────────────────
for (const [name, fn] of todo) {
  if (only && !only.includes(name)) continue;
  try { await fn(); } catch (e) { console.log('  FAIL section ' + name + ' threw: ' + String(e && e.stack || e).slice(0, 900)); fails.push('section ' + name + ' threw'); }
}
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
ok('no page errors', errors.length === 0, errors);
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nALL OK');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
