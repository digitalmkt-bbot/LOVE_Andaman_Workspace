// t_walk_days · browser walk of the days-and-boats wiring (w3-days): split van rows (Q40), Boat Operation's fleet panel (Q48),
// "already on another boat" badges (Q50), licence "covers" chips (Q54), against a real operation-backend (in-process store).
//
//   node test/ui/t_walk_days.mjs        (OPS_BACKEND_DIR, default D:/projects/operation-backend)
//
// Every check reads BOTH sides: the screen (functions / DOM) and the server (asked directly).
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
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 260));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 200)); d.type() === 'prompt' ? d.accept('Tester') : d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 700))); if (!cond) fails.push(name); return cond; };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const todo = [];
const section = (name, fn) => todo.push([name, fn]);

const DAY = '2026-11-10', DAY2 = '2026-11-11';
const addDays = (d, n) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const PIER = 'tublamu';

// ── seed (through the API, before the app boots) ──
for (const [b, r] of [['b6', 'r5'], ['b7', 'r4']]) await seed('POST', '/operations/deployments', { boat_id: b, route_id: r, service_date: DAY, capacity: 40, deploy_anyway: true });
const mkVan = async (name, cap) => seed('POST', '/operations/vans', { name, capacity: cap });
const vanA = await mkVan('Van Alpha', 9), vanB = await mkVan('Van Bravo', 12);
for (const v of [vanA, vanB]) await seed('PUT', `/operations/van-days/${DAY}/${v.id}`, { route_ids: ['r5'] });
const mkBk = async (id, lead, date, pax, extra = {}) => send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: 'r5', date, pax: { ad_fr: pax }, zone: 'PK' }], ...extra });
const bk = {};
for (const [k, lead, pax] of [['s1', 'DAYS SPLIT ONE', 3], ['s2', 'DAYS SPLIT TWO', 2]]) {
  const r = await mkBk('zz-' + k, lead, DAY, pax);
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body)); process.exit(2); }
  bk[k] = { id: r.body.id, trip: r.body.trips[0].id };
}
// Boat Operation facts: a boat that is fixing on DAY+1 (not available), a boat that moves pier on DAY+2
const boatsAll = (await api('/v1/boats')).boats || [];
const fixer = (boatsAll.find((b) => !['b6', 'b7'].includes(b.id) && b.pier === 'tublamu' && !b.retired) || {}).id;
if (fixer) {
  const st = await send('POST', `/v1/boats/${fixer}/status-log`, { status: 'fixing', from_date: addDays(DAY, 1), to_date: addDays(DAY, 1), province: 'Phuket', loc_type: 'pier', note: 'walk days' });
  if (st.status >= 300) console.log('seed: status-log refused', st.status, JSON.stringify(st.body).slice(0, 200));
}
// pier job board: a captain on two boats the same day
const staffId = (await seed('POST', '/v1/pier-office/staff', { pier: PIER, nick: 'Dup', name: 'Dup Captain', role: 'captain' })).id;
await seed('PATCH', `/v1/pier-office/${PIER}/days/${DAY}/boats/b6/job`, { captain_id: staffId });
await seed('PATCH', `/v1/pier-office/${PIER}/days/${DAY}/boats/b7/job`, { captain_id: staffId });
// licences: a class with small limits, and boats b6 (big) and b7 (small)
await seed('PATCH', '/v1/boats/b6', { gt: 60, bhp: 400 });
await seed('PATCH', '/v1/boats/b7', { gt: 5, bhp: 100 });
const types = (await api('/v1/pier-office')).license_types;
const smallClass = await seed('POST', '/v1/pier-office/license-classes', { type_id: types[0].id, name: 'Walk small', max_gt: 10, max_bhp: 150 });
const licence = await seed('POST', `/v1/pier-office/staff/${staffId}/licences`, { class_id: smallClass.id, licence_no: 'WALK-DAYS', expires_on: '2029-01-01' });

// an overnight charter (Q39): b13 out on r10 for 3 days, the nights are not deployed yet
const OV = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];
let ovn = null;
for (const d of [OV[0], OV[3]]) await seed('POST', '/operations/deployments', { boat_id: 'b13', route_id: 'r10', service_date: d, capacity: 38, deploy_anyway: true });
{
  const r = await send('POST', '/v1/bookings', { external_id: 'b2c_days_ovn', total: 9000, leadPax: 'DAYS OVERNIGHT', leadNationality: 'RU', leadPhone: '+7 900 1', pickupSelf: true,
    trips: [{ routeId: 'r10', date: OV[0], pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13', ovn: 'return', ovnReturnDate: OV[3] },
            { routeId: 'r10', date: OV[3], pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13', ovnLeg: true, ovnOf: 0 }] });
  if (r.status === 201) ovn = r.body; else console.log('seed: overnight charter refused', r.status, JSON.stringify(r.body).slice(0, 300));
}

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
const s0 = await ev(() => ({ failed: laOps.state.failed }));
ok('boot: nothing failed to load', s0.failed.length === 0, s0);
const goView = (v) => ev((v) => { const el = document.querySelector('.nav-item[data-view="' + v + '"]'); nav(el || { dataset: { view: v }, classList: { add() {} } }); }, v);
const callsSince = (n) => calls.slice(n);

// ═══ 1 · split van rows ═══
section('1', async () => {
  console.log('\n[1] split van rows (Q40)');
  await ev((d) => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; _bkV2.vanAssignMode = true; _bkV2.detailId = null; _bkV2.newBooking = null; _bkV2.filterRoute = null; const el = document.querySelector('.nav-item[data-view="booking"]'); if (el) nav(el); bookingV2Render(); }, DAY);
  await waitFor((d) => SB_BOOKINGS.filter((b) => b.trips.some((t) => t.date === d)).length >= 2, DAY, 15000);
  await idle(); await settle(1200);
  const split = (id) => ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); const o = bkOpsRead(b, a.date) || {}; return o.vanSplits ? o.vanSplits.map((s) => ({ idx: s.opsIdx, pax: s.pax, ad: s.ad, grp: s.vanGroup, van: s.vanId, main: !!s.main })) : null; }, { id, date: DAY });
  const srvParts = async (id) => ((await api('/v1/bookings/' + bk[id].id)).trips[0].operations.van_parts || []);
  ok('before: an unsplit booking has one part on the server and no vanSplits on the screen', (await srvParts('s1')).length === 1 && (await split('zz-s1')) === null, await split('zz-s1'));

  // open the dialog (legacy's), ask for 1 adult to move, Apply
  await ev((d) => bookingV2VanSplit('zz-s1', d), DAY);
  const modal = await waitFor(() => !!document.getElementById('bk-split-modal'), null, 5000);
  ok('Split opens legacy\'s dialog (no "NOT YET" toast)', modal && !(await ev(() => document.body.innerText)).includes('NOT YET'), modal);
  await ev(() => bookingV2SplitSet('ad', 1));
  const n0 = calls.length;
  await page.locator('#bk-split-modal button[onclick*="bookingV2SplitApply"]').click();
  await idle(); await settle(1400);
  const posts = callsSince(n0).filter((c) => c.startsWith('POST /operations/trip-ops/'));
  ok('Apply -> POST /operations/trip-ops/{trip}/van-split', posts.length === 1 && posts[0].endsWith('/van-split'), posts);
  const parts = await srvParts('s1');
  ok('server: two parts, main keeps 2 adults, the new manual part has 1 and no group', parts.length === 2 && parts[0].ad === 2 && parts[1].ad === 1 && parts[1].source === 'manual' && !parts[1].group, parts);
  const sp = await split('zz-s1');
  ok('screen: vanSplits built from van_parts (opsIdx 0 and 1, pax 2 and 1), dialog closed', sp && sp.length === 2 && sp[0].idx === 0 && sp[0].pax === 2 && sp[0].main && sp[1].idx === 1 && sp[1].pax === 1 && !(await ev(() => !!document.getElementById('bk-split-modal'))), { sp });

  // the split row joins a new group by its idx, then gets a van
  await ev((d) => { _bkV2.vanAssignMode = true; bookingV2RenderKeep(); }, DAY); await settle(500);
  const tickBtn = page.locator('#view-booking span[onclick*="bookingV2VanSelToggle(\'zz-s1@1\')"]');
  const hasRow = (await tickBtn.count()) > 0;
  ok('the split part is a row of its own on By-trip (tick box for zz-s1@1)', hasRow, await ev(() => document.querySelectorAll('#view-booking span[onclick*="VanSelToggle"]').length));
  const n1 = calls.length;
  if (hasRow) { await tickBtn.first().click(); await settle(300); await page.locator('#view-booking button[onclick*="bookingV2VanGroupSelected"][onclick*="\'new\'"]').click(); }
  else { await ev((d) => { window._bkV2VanSel = { 'zz-s1@1': 1 }; bookingV2VanGroupSelected(d, 'r5', 'PK', 'new'); }, DAY); }
  await idle(); await settle(1400);
  const grp = (await api(`/operations/van-groups?service_date=${DAY}&route_id=r5`)).groups;
  const g1 = grp.find((g) => g.members.some((m) => m.booking_id === bk.s1.id));
  ok('server: a group holds the split part only ({trip, idx 1}); the main part is not in it', g1 && g1.members.length === 1 && g1.members[0].idx === 1 && g1.members[0].trip_id === bk.s1.trip, grp);
  const sent = callsSince(n1).filter((c) => c.startsWith('POST /operations/van-groups'));
  ok('POST /operations/van-groups sent for the ticked part', sent.length >= 1, callsSince(n1).filter((c) => !c.startsWith('GET')));
  let sp2 = await split('zz-s1');
  ok('screen: part 1 carries the group, part 0 none', sp2 && sp2[1].grp === g1.number && sp2[0].grp === 0, sp2);
  const sel = page.locator(`#view-booking select[onchange*="bookingV2VanGroupSetVan('${DAY}','r5','PK','${g1.number}'"]`);
  await sel.first().selectOption(vanA.id); await idle(); await settle(1200);
  const g1b = (await api(`/operations/van-groups?service_date=${DAY}&route_id=r5`)).groups.find((g) => g.id === g1.id);
  const parts2 = await srvParts('s1');
  sp2 = await split('zz-s1');
  ok('assign Van Alpha to the group: server group van, part 1 shows it, screen part 1 shows it', g1b.van_id === vanA.id && parts2[1].group && parts2[1].group.van_id === vanA.id && sp2[1].van === vanA.id && !sp2[0].van, { g1b: g1b.van_id, parts2, sp2 });

  // refusal: more heads than the main part has -> the server's message, dialog stays, nothing changes
  const r0 = refusals.length;
  await ev((d) => { _bkSplitM = { bkId: 'zz-s2', date: d, pool: { ad: 6, chd: 0, inf: 0, foc: 0 }, again: false, ad: 5, chd: 0, inf: 0, foc: 0 }; bookingV2SplitApply(); }, DAY);
  await idle(); await settle(900);
  const ref = refusals.slice(r0);
  const bodyText = await ev(() => document.body.innerText);
  ok('refused by the server (400) with its message on screen; nothing changed; dialog state kept', ref.length === 1 && /van-split -> 400/.test(ref[0]) && bodyText.includes('Split not done') && (await srvParts('s2')).length === 1 && (await ev(() => !!_bkSplitM)), { ref, parts: (await srvParts('s2')).length });
  await ev(() => { _bkSplitM = null; });

  // unsplit: one part again, taking the first part's group (none here: the group was on part 1, which leaves it)
  const n2 = calls.length;
  await ev((d) => bookingV2VanUnsplit('zz-s1', d), DAY);
  await idle(); await settle(1400);
  const un = callsSince(n2).filter((c) => c.startsWith('POST /operations/trip-ops/'));
  const parts3 = await srvParts('s1');
  ok('Unsplit -> POST .../van-unsplit; server: one part of 3 adults', un.length === 1 && un[0].endsWith('/van-unsplit') && parts3.length === 1 && parts3[0].ad === 3, { un, parts3 });
  ok('screen: no vanSplits any more', (await split('zz-s1')) === null, await split('zz-s1'));

  // the browser no longer rebuilds splits in ops mode
  const heal = await ev(() => [bookingV2SyncAltPickupSplits(SB_BOOKINGS[0]), bookingV2HealAltSplits('2026-11-10'), bookingV2HealSplitPax(SB_BOOKINGS[0], SB_BOOKINGS[0].ops), bookingV2HealOvnLegs()]);
  ok('ops mode: the four in-browser split/leg rebuilds do nothing', heal.every((x) => x === false), heal);
});

// ═══ 2 · Boat Operation ═══
section('2', async () => {
  console.log('\n[2] Boat Operation fleet panel (Q48)');
  const dates = []; for (let i = 0; i < 7; i++) dates.push(addDays(DAY, i));
  await goView('operation'); await settle(800);
  await ev((a) => { _bop2.viewMode = 'week'; _bop2.pier = 'all'; _bop2.anchor = new Date(a.d + 'T12:00:00'); _bop2.selDate = a.d; renderOp(); }, { d: DAY });
  const fresh = await waitFor((ds) => ds.every((d) => laOps.boatOperation.isFresh(d)), dates, 15000);
  ok('the visible week is read: GET /v1/fleet/boat-operation and /v1/fleet/availability were asked', fresh && calls.some((c) => c.startsWith('GET /v1/fleet/boat-operation')) && calls.some((c) => c.startsWith('GET /v1/fleet/availability')), calls.filter((c) => /fleet/.test(c)));
  const norm = (f) => ({ assigned: f.assigned.map((x) => [x.boat_id, x.route_id, x.seats, !!x.is_charter, x.type]).sort(), available: f.available.map((x) => x.boat_id).sort(),
    unavailable: f.unavailable.map((x) => [x.boat_id, x.reason]).sort(), free: Object.fromEntries(Object.keys(f.free_by_pier).sort().map((p) => [p, f.free_by_pier[p].map((x) => x.boat_id)])) });
  const screen = (pier) => ev((a) => {
    const keep = _bop2.pier, out = {};
    try { _bop2.pier = a.pier; a.dates.forEach((d) => { const f = bop2FleetStatus(d); const fb = bop2FreeByPier(d);
      out[d] = { assigned: f.assigned.map((x) => [x.boat.id, x.route.id, x.seats, !!x.isCharter, x.type]).sort(), available: f.available.map((x) => x.boat.id).sort(),
        unavailable: f.unavailable.map((x) => [x.boat.id, x.reason]).sort(), free: Object.fromEntries(Object.keys(fb).sort().map((p) => [p, fb[p].map((b) => b.id)])) }; }); }
    finally { _bop2.pier = keep; }
    return out;
  }, { dates, pier });
  for (const pier of ['all', 'tublamu', 'panwa']) {
    const srvDays = (await api(`/v1/fleet/boat-operation?from=${dates[0]}&to=${dates[6]}&pier=${pier}`)).days;
    const scr = await screen(pier);
    const bad = srvDays.filter((d) => JSON.stringify(norm(d)) !== JSON.stringify(scr[d.date])).map((d) => [d.date, norm(d), scr[d.date]]);
    ok(`bop2FleetStatus / bop2FreeByPier = the server's lists for 7 days (pier ${pier})`, bad.length === 0, bad[0]);
  }
  const d0 = (await api(`/v1/fleet/boat-operation?from=${DAY}&pier=all`)).days[0];
  ok('the panel has real content to compare (b6 and b7 assigned on the day, a boat fixing on the next)', d0.assigned.length >= 2 && (!fixer || (await api(`/v1/fleet/boat-operation?from=${addDays(DAY, 1)}&pier=all`)).days[0].unavailable.some((u) => u.boat_id === fixer)), { assigned: d0.assigned.length, fixer });

  // status primitives: the server's answer inside Boat Operation, legacy's outside it (the Boats screen keeps legacy: Q3)
  await ev((a) => { const b = BOATS.find((x) => x.id === 'b6'); b.log = (b.log || []).concat([{ from: a.d, to: a.d, s: 'fixing', loc: 'walk-local', note: 'local only' }]); window.__logLen = b.log.length; }, { d: DAY });
  const sc = await ev((a) => { const b = BOATS.find((x) => x.id === 'b6'); return { outside: getCurStatus(b, a.d).s, canPlace: bop2CanPlace(b, 'r5', a.d), optsHasB6: bop2AssignBoatOptsFor('tublamu', a.d).includes('value="b6"') && !/value="b6"[^>]*style="color:#aaa"/.test(bop2AssignBoatOptsFor('tublamu', a.d)) }; }, { d: DAY });
  ok('a status only the browser knows: getCurStatus outside Boat Operation = legacy (fixing)', sc.outside === 'fixing', sc);
  ok('inside Boat Operation the server wins: bop2CanPlace says b6 is free (its answer), the pick list shows it available', sc.canPlace === true && sc.optsHasB6, sc);
  await ev((a) => { const b = BOATS.find((x) => x.id === 'b6'); b.log = b.log.filter((e) => e.loc !== 'walk-local'); }, { d: DAY });

  // a write makes the answers old at once (legacy figures meanwhile), then they are read again and equal the server again
  const n0 = calls.length;
  const staleNow = await ev((a) => { const before = laOps.boatOperation.isFresh(a.d); bop2AssignBoat('r5', a.d, 'b7'); return before && !laOps.boatOperation.isFresh(a.d); }, { d: DAY2 });
  await idle(); await settle(1500);
  const back = await waitFor((d) => laOps.boatOperation.isFresh(d), DAY2, 10000);
  const dep = (await api(`/operations/deployments?from=${DAY2}&to=${DAY2}`)).deployments.filter((d) => d.boat_id === 'b7');
  ok('assign b7 on the next day: the answers were fresh, are old the moment the browser changes TRIPS, the server saved it, the panel is read again', staleNow === true && dep.length === 1 && back && callsSince(n0).some((c) => c.startsWith('GET /v1/fleet/boat-operation')), { staleNow, dep: dep.length, back });
  const srv2 = (await api(`/v1/fleet/boat-operation?from=${DAY2}&pier=all`)).days[0];
  const scr2 = (await screen('all'))[DAY2];
  ok('after the write: screen lists = server lists, b7 is now assigned', JSON.stringify(norm(srv2)) === JSON.stringify(scr2) && scr2.assigned.some((x) => x[0] === 'b7'), { srv: norm(srv2), scr: scr2 });
  ok('no page error while the panel redrew', errors.length === 0, errors);
});

// ═══ 3 · "already on another boat" ═══
section('3', async () => {
  console.log('\n[3] pier job board: already on another boat (Q50)');
  const flags = await api(`/v1/pier-office/${PIER}/days/${DAY}/crew-flags`);
  const job6 = await api(`/v1/pier-office/${PIER}/days/${DAY}/boats/b6/job`);
  ok('server: the captain is on b6 and b7; busy_flags on the job names the other boat; doubled lists him', (job6.busy_flags || []).some((f) => f.staff_id === staffId && f.position === 'captain' && f.elsewhere.some((w) => w.boat_id === 'b7')) && (flags.doubled || []).some((d) => d.staff_id === staffId && d.boats.length === 2), { f: job6.busy_flags, d: flags.doubled });
  await ev((a) => { window._poPier = a.p; window._poDate = a.d; }, { p: PIER, d: DAY });
  await goView('poj-' + PIER);
  await waitFor((a) => !!(laOps.pierJob && laOps.pierJob.state.views[a.d + '::b6']), { d: DAY }, 15000);
  await waitFor((d) => !!laOps.pierDays.flags(d), DAY, 15000);
  await settle(1200);
  const scr = await ev((a) => ({ busyAll: (pjCrewBusyAll(a.d)[a.s] || []).map((x) => x.bid).sort(), els6: pjCrewElsewhere(a.d, 'b6', a.s).map((x) => x.bid), els7: pjCrewElsewhere(a.d, 'b7', a.s).map((x) => x.bid),
    badges: document.querySelectorAll('.pj-dup').length, header: (document.querySelector('.pj-dupw') || {}).innerText || '', fresh: !!laOps.pierDays.flags(a.d) }), { d: DAY, s: staffId });
  const srvAssigned = (flags.assigned[staffId] || { boats: [] }).boats.map((b) => b.boat_id).sort();
  ok('pjCrewBusyAll = the server\'s assigned boats for him (b6, b7) and the flags answer was read', JSON.stringify(scr.busyAll) === JSON.stringify(srvAssigned) && srvAssigned.length === 2 && scr.fresh, { scr, srvAssigned });
  ok('pjCrewElsewhere: on b6 he is also on b7, on b7 also on b6 (busy_flags of the job read)', JSON.stringify(scr.els6) === '["b7"]' && JSON.stringify(scr.els7) === '["b6"]', scr);
  ok('the card shows the red "already on another boat" badge on both cards and the header says "คนซ้ำลำ 1 คน"', scr.badges >= 2 && /คนซ้ำลำ 1 คน/.test(scr.header), scr);
  // a warning, never a refusal: a third card for the same person is accepted by the server
  const r3 = await send('PATCH', `/v1/pier-office/${PIER}/days/${DAY}/boats/b1/job`, { captain_id: staffId });
  ok('a third boat with the same captain is accepted (warning only)', r3.status === 200, r3);
  const after = await api(`/v1/pier-office/${PIER}/days/${DAY}/crew-flags`);
  ok('the server now counts three boats for him', (after.assigned[staffId] || { boats: [] }).boats.length === 3, after.assigned[staffId]);
  await send('PATCH', `/v1/pier-office/${PIER}/days/${DAY}/boats/b1/job`, { captain_id: null });
});

// ═══ 4 · licence covers ═══
section('4', async () => {
  console.log('\n[4] licence chips: covers (Q54)');
  await ev((a) => { window._poPier = a.p; window._poDate = a.d; }, { p: PIER, d: DAY });
  await goView('poa-' + PIER); await ev(() => laOps.pier.load()); await settle(1500);
  const srv6 = (await api(`/v1/pier-office/staff/${staffId}/licences?boat_id=b6`)).licences.find((l) => l.id === licence.id);
  const srv7 = (await api(`/v1/pier-office/staff/${staffId}/licences?boat_id=b7`)).licences.find((l) => l.id === licence.id);
  const pierRead = (await api(`/v1/pier-office/${PIER}/licences?boats=pier`)).licences.find((l) => l.id === licence.id);
  ok('server: the small-class licence covers b7 (5 gt) and not b6 (60 gt); ?boats=pier says the same', srv6.covers_boat === false && srv7.covers_boat === true && pierRead.covers.b6 === false && pierRead.covers.b7 === true, { srv6: srv6.covers_boat, srv7: srv7.covers_boat, covers: pierRead.covers });
  const first = await ev((a) => { const l = PIER_LICENSES.find((x) => x.id === a.id); const b6 = BOATS.find((x) => x.id === 'b6'), b7 = BOATS.find((x) => x.id === 'b7'); return { found: !!l, b6: plCovers(l, b6), b7: plCovers(l, b7) }; }, { id: licence.id });
  await idle(); await settle(1200);
  // make legacy's own table say "covers" for everything: the server's answer must still win
  await ev((a) => { const l = PIER_LICENSES.find((x) => x.id === a.id); const c = plClass(l.classId); window.__oldMax = [c.maxGt, c.maxBhp]; c.maxGt = 9999; c.maxBhp = 9999; }, { id: licence.id });
  const scr = await ev((a) => { const l = PIER_LICENSES.find((x) => x.id === a.id); const b6 = BOATS.find((x) => x.id === 'b6'), b7 = BOATS.find((x) => x.id === 'b7');
    return { b6: plCovers(l, b6), b7: plCovers(l, b7), chip6: plChip(l, b6), chip7: plChip(l, b7), fresh: !!(laOps.pierDays.covers(l, b6) !== null) }; }, { id: licence.id });
  await ev((a) => { const l = PIER_LICENSES.find((x) => x.id === a.id); const c = plClass(l.classId); c.maxGt = window.__oldMax[0]; c.maxBhp = window.__oldMax[1]; }, { id: licence.id });
  ok('plCovers = the server\'s covers_boat for b6 (false) and b7 (true) even with legacy\'s class table loosened', first.found && scr.fresh && scr.b6 === srv6.covers_boat && scr.b7 === srv7.covers_boat, { first, scr });
  ok('plChip draws the red chip for b6 and the ok chip for b7', /pl-bad/.test(scr.chip6) && !/pl-bad/.test(scr.chip7) && /ชั้นไม่ครอบคลุมลำนี้/.test(scr.chip6), { c6: scr.chip6, c7: scr.chip7 });
  const asked = calls.filter((c) => /\/licences\?(boats=pier|boat_id=)/.test(c));
  ok('the covers were read from the licence endpoints (?boats=pier or ?boat_id=)', asked.length >= 1, asked);
});

// ═══ 5 · overnight charter nights ═══
section('5', async () => {
  console.log('\n[5] overnight charter: nights held by the server (Q39)');
  if (!ovn) { ok('seed: the overnight charter booking was created', false, 'see the seed line above'); return; }
  const nights = [OV[1], OV[2]];
  const av = async (d) => (await api(`/v1/fleet/availability?from=${d}&boat_id=b13`)).days[0];
  const panelNight = async (d) => (await api(`/v1/fleet/boat-operation?from=${d}&pier=all`)).days[0];
  const kindOf = (day) => (day.assigned.find((x) => x.boat_id === 'b13') ? 'assigned:' + day.assigned.find((x) => x.boat_id === 'b13').type : (day.unavailable.find((x) => x.boat_id === 'b13') || {}).reason_code || 'none');
  const k0 = kindOf(await panelNight(nights[0]));
  ok('server: b13 is held on both nights (ovn_hold on the availability row); in the panel it is a charter cell or unavailable "ovn_hold", never free', (await av(nights[0])).ovn_hold && (await av(nights[1])).ovn_hold && (k0 === 'assigned:charter' || k0 === 'ovn_hold'), { k0, av: await av(nights[0]) });
  await goView('operation'); await settle(500);
  await ev((a) => { _bop2.viewMode = 'week'; _bop2.pier = 'all'; _bop2.anchor = new Date(a.d + 'T12:00:00'); _bop2.selDate = a.n; renderOp(); }, { d: OV[0], n: nights[0] });
  await waitFor((d) => laOps.boatOperation.isFresh(d), nights[0], 15000);
  const asScreen = await ev((a) => { const f = bop2FleetStatus(a.n); const u = f.unavailable.find((x) => x.boat.id === 'b13'), c = f.assigned.find((x) => x.boat.id === 'b13'); return c ? 'assigned:' + c.type : (u ? (u.ovnHold ? 'ovn_hold' : 'other:' + u.reason) : 'none'); }, { n: nights[0] });
  ok('screen: the night is the same as the server answers (' + k0 + ')', asScreen === k0, { asScreen, k0 });
  // the heal makes the nightly cells; the server accepts them
  const n0 = calls.length, r0 = refusals.length;
  await ev(() => { bkOvnHealSpans(); save('operations'); });
  await idle(); await settle(1800);
  const deps = (await api(`/operations/deployments?from=${OV[0]}&to=${OV[3]}`)).deployments.filter((d) => d.boat_id === 'b13').map((d) => d.service_date).sort();
  ok('bkOvnHealSpans: the nightly cells are saved (b13 deployed on all 4 days), nothing refused', JSON.stringify(deps) === JSON.stringify(OV) && refusals.length === r0, { deps, ref: refusals.slice(r0) });
  // a claimed night cell cannot be removed: the server says 409 charter_boat, the screen shows its message and puts the cell back
  const r1 = refusals.length;
  await ev((a) => { delete TRIPS[a.n]['b13']; save('operations'); }, { n: nights[0] });
  await idle(); await settle(1800);
  const ref = refusals.slice(r1).filter((r) => r.startsWith("DELETE /operations/deployments"));
  const msg = (() => { try { return JSON.parse(ref[0].replace(/^[^{]*/, '')).message; } catch (_) { return null; } })();
  const body = await ev(() => document.body.innerText);
  const still = (await api(`/operations/deployments?from=${nights[0]}&to=${nights[0]}`)).deployments.some((d) => d.boat_id === 'b13');
  const cell = await ev((a) => !!(TRIPS[a.n] && TRIPS[a.n]['b13']), { n: nights[0] });
  ok('removing a claimed night cell: server 409 charter_boat, its message is on screen, the cell is back', ref.length === 1 && /charter_boat/.test(ref[0]) && msg && body.includes(msg.slice(0, 30)) && still && cell, { ref, still, cell });
});

for (const [name, fn] of todo) {
  if (ONLY && !ONLY.includes(name)) continue;
  try { await fn(); } catch (e) { ok('section ' + name + ' ran to the end', false, String(e.stack || e).slice(0, 900)); }
}
console.log('\nbrowser errors:', errors.length ? errors : 'none');
console.log('server refusals:', refusals.length ? refusals : 'none');
console.log('native dialogs:', dialogs);
console.log(fails.length ? '\nFAILED: ' + fails.join(' | ') : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
