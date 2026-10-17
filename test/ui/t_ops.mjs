// t_ops · the app against a REAL operation-backend (in-process store) · js/ops/*.js
//
//   node test/ui/t_ops.mjs        (needs the operation_backend checkout · OPS_BACKEND_DIR,
//                                   default D:/projects/operation-backend, with its node_modules)
//
// The app's calls to the production operation-backend URL are re-routed to a local one seeded by
// test/helpers/ops-backend-local.mjs. Every check reads BOTH sides: what the screen's state says,
// and what the server now holds (asked directly, not through the app).
//
//   [1] boot      catalogue, route calendar, agents, markets, sales, deployments, locks, bookings
//   [2] deploy    Boat Operation assign / capacity / unassign → /operations/deployments
//   [3] locks     day lock, bulk lock → one server lock per departure, edit, release
//   [4] booking   save through the real form → POST; draws a lock; edit → PATCH keeps trip ids
//   [5] actions   reschedule · partial cancel · cancel · restore · server history
//   [6] refused   a booking over capacity → 409 → rolled back, form reopened
//   [7] refused   a lock bigger than the day → 409 → rolled back
//   [8] avail     getAllotment shows the server's numbers · agent read-only + detail fetch
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
const calls = [], refusals = [];      // refusals: every 4xx/5xx the server answered the app (listed at the end)
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname);
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

// a deployment the app finds on boot
for (const d of [D2, D3, D4]) await api('/operations/deployments', { method: 'POST', body: JSON.stringify({ boat_id: 'b6', route_id: 'r5', service_date: d, capacity: 40 }) });

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1200);

console.log('\n[1] boot');
let s;
s = await ev((d) => ({
  routes: ROUTES.map((r) => r.id), boats: BOATS.map((b) => b.id), b6: BOATS.find((b) => b.id === 'b6'),
  agents: SB_AGENTS.map((a) => a.id), a01: SB_AGENTS.find((a) => a.id === 'a01'), markets: SB_MARKETS.map((m) => m.id), sales: SB_SALES[0],
  closed: getDayStatus(ROUTES.find((r) => r.id === 'r10'), d.D3), open: getDayStatus(ROUTES.find((r) => r.id === 'r10'), d.D2),
  failed: laOps.state.failed, cell: (TRIPS[d.D2] || {}).b6, seedCells: Object.keys(TRIPS).length, locks: SB_SEAT_LOCKS.length, bookings: SB_BOOKINGS.length,
}), { D2, D3 });
ok('nothing failed to load', s.failed.length === 0, s.failed);
ok('routes = server catalogue', JSON.stringify(s.routes) === '["r4","r5","r10"]', s.routes);
// the server lists boats by name, then id, not in seed order (operation-backend src/domain/operations.ts:944
// boatRecords, de5502e; PostgreSQL listBoats ORDER BY name, id) · the screen keeps the server's order
const srvBoats = (await api('/v1/boats')).boats.map((b) => b.id);
ok('boats = server catalogue, in its order · capacity→cap, license_pax→licensePax', JSON.stringify(s.boats) === JSON.stringify(srvBoats) && srvBoats.slice().sort().join() === 'b1,b13,b6,b7' && s.b6.cap === 40 && s.b6.licensePax === 47, { screen: s.boats, server: srvBoats, b6: s.b6 && { cap: s.b6.cap, licensePax: s.b6.licensePax } });
ok('agents · markets · sales from server', s.agents.slice().sort().join() === 'a01,a_b2c' && s.markets.join() === 'ru,th' && s.sales.fullName === 'Tata Test', s);
ok('agent mapped (pay_type bt → bank, market, programs)', s.a01.payType === 'bank' && s.a01.market === 'ru' && s.a01.programs.join() === 'r5', s.a01);
ok('route calendar · server-closed day is closed', s.closed && s.closed.type === 'closed' && s.open && s.open.type === 'open', s);
ok('deployment loaded into TRIPS, seed cells gone', s.cell && s.cell.route === 'r5' && s.seedCells === 3, s);
ok('seed locks and seed bookings replaced (server has none)', s.locks === 0 && s.bookings === 0, s);

console.log('\n[2] Boat Operation → deployments');
await ev((d) => { TRIPS[d] = TRIPS[d] || {}; TRIPS[d].b7 = { route: 'r5', type: 'normal', booked: 0 }; TRIPS[d].b1 = { route: 'r4', type: 'normal', booked: 0 }; save('operations'); }, D1);
await settle(); await idle();
let deps = (await api(`/operations/deployments?from=${D1}&to=${D1}`)).deployments;
ok('assign two boats → 2 server deployments', deps.length === 2 && deps.some((x) => x.boat_id === 'b7' && x.route_id === 'r5' && x.capacity === 34), deps);
// A boat's seats for ONE day is its own record now, not the deployment's capacity (operation-backend
// PUT /v1/boats/{id}/capacity-overrides/{date}, src/routes/operations.ts:905; client ops/49 since a84179d).
// The deployment keeps the boat's normal 34 and /v1/availability resolves the day to 30
// (src/domain/capacity.ts: override_capacity ?? capacity, clamped to the licence).
// Driven through the real modal (Boat Operation / By-trip "ที่นั่ง · เฉพาะวันนี้").
await ev((d) => boatCapModalOpen('b7', d, null), D1);
await page.fill('#bcap-val', '30'); await page.fill('#bcap-reason', 'test');
await page.click('#bcap-host button[onclick^="_bcapSave"]');
await settle(); await idle();
deps = (await api(`/operations/deployments?from=${D1}&to=${D1}`)).deployments;
const ovr = (await api(`/v1/boats/b7/capacity-overrides?from=${D1}&to=${D1}`)).overrides;
let av1 = await api(`/v1/availability?route_id=r5&date=${D1}`);
s = await ev((d) => ({ capFor: boatCapFor('b7', d), modal: !!document.querySelector('#bcap-ov') }), D1);
ok('per-day seats 30 → capacity override on the server · deployment keeps the normal 34', ovr.length === 1 && ovr[0].capacity === 30 && ovr[0].overridden === true && ovr[0].reason === 'test' && deps.find((x) => x.boat_id === 'b7').capacity === 34, { ovr, deps });
ok('the day sells 30 (server availability) and the screen reads 30 · modal closed', av1.deployed_capacity === 30 && s.capFor === 30 && !s.modal, { av1, s });
await ev((d) => { delete TRIPS[d].b1; save('operations'); }, D1);
await settle(); await idle();
deps = (await api(`/operations/deployments?from=${D1}&to=${D1}`)).deployments;
ok('unassign → deployment deleted', deps.length === 1 && deps[0].boat_id === 'b7', deps);

console.log('\n[3] seat locks (through the lock modal)');
// The lock client was rewritten 2026-10-13 (js/ops/30-ops-locks.js): it replaces the form's submit
// handlers (bookingV2LockCreateSubmit / EditSubmit / ReleaseRoundGo …) with one server command each
// and then re-reads GET /v1/seat-locks + /v1/seat-lock-groups. The legacy local mutators
// (bookingV2CreateLock, sbSeatLocksPersist) are no longer a write path, so they are not driven here:
// the suite clicks the modal the Calendar opens (bookingV2LockFromCalendar) and the buttons' handlers.
const lockModal = () => page.locator('div.bkv2-locks').filter({ has: page.locator('button[onclick="bookingV2LockCreateSubmit()"], button[onclick="bookingV2LockEditSubmit()"]') });
const lockQty = () => lockModal().locator('input[type="number"][placeholder]');
const waitScreen = async (fn, arg, ms = 6000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const lockCalls = () => calls.filter((c) => /seat-lock/.test(c) && !/^GET /.test(c));
let n3 = lockCalls().length;
// day lock · agent Sun Tour · 5 seats on r5 D1
await ev((d) => bookingV2LockFromCalendar('r5', d), D1);
await lockModal().locator('select').nth(1).selectOption('agent');
await lockModal().locator('input[list="bkv2-lock-agents"]').fill('Sun Tour');
await lockQty().fill('5');
await lockModal().locator('button[onclick="bookingV2LockCreateSubmit()"]').click();
await idle();
const dayOnScreen = await waitScreen((d) => SB_SEAT_LOCKS.some((l) => l.scope === 'day' && l.routeId === 'r5' && l.date === d && l.holderId === 'a01'), D1);
let L = (await api(`/v1/seat-locks?route_id=r5&service_date=${D1}`)).seat_locks;
const dayLock = await ev((d) => SB_SEAT_LOCKS.find((l) => l.scope === 'day' && l.routeId === 'r5' && l.date === d && l.holderId === 'a01'), D1);
ok('day lock → one POST /v1/seat-locks → one server lock (agent a01, 5 seats)', JSON.stringify(lockCalls().slice(n3)) === '["POST /v1/seat-locks"]' && L.length === 1 && L[0].pax === 5 && L[0].agent_id === 'a01' && L[0].holder_type === 'agent', { calls: lockCalls().slice(n3), L });
ok('screen re-read the server · the lock IS the server lock (id, opsIds) · modal closed', dayOnScreen && dayLock && dayLock.id === L[0].id && dayLock.opsIds[D1] === L[0].id && dayLock.qty === 5 && !(await ev(() => _bkV2LockModalOpen)), { dayLock });

// bulk lock · office · 3 seats a departure D2..D4 → one group, one lock per departure (b6 sails D2, D3, D4)
n3 = lockCalls().length;
await ev((d) => bookingV2LockFromCalendar('r5', d), D2);
await lockModal().locator('button', { hasText: 'Bulk' }).click();
await lockModal().locator('input[type="date"]').nth(0).fill(D2);
await lockModal().locator('input[type="date"]').nth(1).fill(D4);
await lockModal().locator('select').nth(1).selectOption('office');
await lockQty().first().fill('3');
await lockModal().locator('button[onclick="bookingV2LockCreateSubmit()"]').click();
await idle();
await waitScreen(() => SB_SEAT_LOCKS.some((l) => l.isGroup && l.routeId === 'r5'));
const bulk = await ev(() => SB_SEAT_LOCKS.find((l) => l.isGroup && l.routeId === 'r5'));
const groups = (await api('/v1/seat-lock-groups')).seat_lock_groups;
L = bulk ? (await api(`/v1/seat-locks?group_id=${bulk.id}`)).seat_locks : [];
ok('bulk lock D2..D4 → one POST /v1/seat-lock-groups → 3 server locks, one per departure, no agent', JSON.stringify(lockCalls().slice(n3)) === '["POST /v1/seat-lock-groups"]' && groups.length === 1 && bulk && groups[0].id === bulk.id
  && L.length === 3 && L.map((x) => x.service_date).sort().join() === [D2, D3, D4].join() && L.every((x) => x.pax === 3 && !x.agent_id && x.status === 'active'), { calls: lockCalls().slice(n3), groups, L });
ok('screen shows the group with every departure\'s server id', bulk && bulk.scope === 'bulk' && bulk.qty === 3 && [D2, D3, D4].every((d) => L.some((x) => x.id === bulk.opsIds[d] && x.service_date === d)), bulk && { opsIds: bulk.opsIds, qty: bulk.qty });

// edit qty 3 → 4 · on a bulk group it is ONE PATCH on the group and the server moves every departure
// (client: 30-ops-locks.js bookingV2LockEditSubmit → lockPath(group); server: PATCH /v1/seat-lock-groups/:id,
// seat-lock-service.ts editGroup walks the departures). A bulk sub-group instead PATCHes each day (eachDay).
n3 = lockCalls().length;
await ev((id) => bookingV2LockEditOpen(id), bulk.id);
await lockQty().first().fill('4');
await lockModal().locator('button[onclick="bookingV2LockEditSubmit()"]').click();
await idle();
await waitScreen((id) => (SB_SEAT_LOCKS.find((l) => l.id === id) || {}).qty === 4, bulk.id);
L = (await api(`/v1/seat-locks?group_id=${bulk.id}`)).seat_locks;
s = await ev((id) => SB_SEAT_LOCKS.find((l) => l.id === id), bulk.id);
ok('edit bulk qty 3 → 4 → one PATCH on the group · every departure now 4 on the server and on screen', lockCalls().slice(n3).length === 1 && /^PATCH \/v1\/seat-lock-groups\//.test(lockCalls()[n3]) && L.length === 3 && L.every((x) => x.pax === 4) && s.qty === 4, { calls: lockCalls().slice(n3), pax: L.map((x) => x.pax), screen: s && s.qty });

// release one round (D3) · the row's button calls bookingV2LockReleaseRoundGo (confirm → accepted)
n3 = lockCalls().length;
await ev((a) => bookingV2LockReleaseRoundGo(a.id, a.d), { id: bulk.id, d: D3 });
await idle();
await waitScreen((a) => ((SB_SEAT_LOCKS.find((l) => l.id === a.id) || {}).releasedDates || []).includes(a.d), { id: bulk.id, d: D3 });
L = (await api(`/v1/seat-locks?group_id=${bulk.id}`)).seat_locks;
s = await ev((id) => SB_SEAT_LOCKS.find((l) => l.id === id), bulk.id);
ok('release one round (D3) → POST release-departure on that day\'s lock · only it released', JSON.stringify(lockCalls().slice(n3)) === JSON.stringify(['POST /v1/seat-locks/' + bulk.opsIds[D3] + '/release-departure'])
  && L.filter((x) => x.status === 'released').map((x) => x.service_date).join() === D3 && s.releasedDates.join() === D3 && s.status === 'active', { calls: lockCalls().slice(n3), L: L.map((x) => [x.service_date, x.status]), screen: s && s.releasedDates });

console.log('\n[4] booking through the real form');
const mk = async (o) => ev((o) => {
  bookingV2NewBooking();
  const d = _bkV2.newBooking;
  // the agent goes in through the form's own setter, which runs the agent rules (rate type, price mode)
  bookingV2SetBookingField('agentId', 'a01');
  Object.assign(d, { leadPax: o.lead, leadNationality: 'RU', leadPhone: '+7 900 000', pickupSelf: true, pickupZoneFilter: 'NoTransfer', hotelName: '' });
  // an agent booking is priced from its rate: the form forces it (bookingV2ApplyAgentRules) and the server
  // refuses anything else (pricing.ts enforcedPriceMode, 8b1eeaa). o.manual = the refusal test below.
  if(o.manual) Object.assign(d, { priceMode: 'manual', manualTotal: 3000 });
  d.guides = { english: true, russian: false, chinese: false, otherLang: '' };
  d.trips = [Object.assign(bookingV2NewTrip(), { routeId: 'r5', date: o.date, pax: { ad_fr: o.pax }, zone: 'NoTransfer' })];
  if(o.lock){ d.trips[0].lockDrawSel = {}; d.trips[0].lockDrawSel[o.lock] = o.pax; }
  bookingV2CommitBooking('confirmed');
}, o);
await mk({ lead: 'ZZ TEST ONE', date: D1, pax: 2, lock: dayLock.id });
await settle(1200); await idle();
// the save now waits for a quote / voucher check before it queues the POST, so it can finish after 1.2 s
await waitScreen(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ TEST ONE'); return b && b.opsId; }, null, 15000); await idle();
let bk = await ev(() => SB_BOOKINGS.find((b) => b.leadPax === 'ZZ TEST ONE'));
let sb = bk && bk.opsId ? await api('/v1/bookings/' + bk.opsId) : null;
ok('saved → POST /v1/bookings · opsId + trip id stored', bk && bk.opsId && bk.trips[0].opsTripId && sb && sb.external_id === bk.id, { bk: bk && { id: bk.id, opsId: bk.opsId, t: bk.trips }, dialogs: dialogs.slice(-4) });
ok('header columns on the server (lead, agent, nationality)', sb && sb.lead_pax === 'ZZ TEST ONE' && sb.agent_id === 'a01' && sb.lead_nationality === 'RU', sb);
// priced by the server (routes/operations.ts priceFor): 2 × r5 NoTransfer net ad_fr ฿1,200 from the seeded rt001
ok('server priced it from the agent\'s rate · ฿2,400 · the screen shows the server total', sb && sb.price_mode === 'rate' && sb.rate_type_ref === 'rt001' && sb.total === 2400 && bk.total === 2400, { server: sb && { mode: sb.price_mode, rt: sb.rate_type_ref, total: sb.total }, screen: bk && bk.total });
ok('lock draw sent as the server lock id', sb && JSON.stringify(sb.trips[0].lock_draws) === JSON.stringify({ [dayLock.opsIds[D1]]: 2 }), sb && sb.trips[0]);
L = (await api(`/v1/seat-locks?route_id=r5&service_date=${D1}`)).seat_locks;
ok('server lock now shows drawn_pax 2', L[0] && L[0].drawn_pax === 2, L);
const tripId = bk.trips[0].opsTripId;
await ev((id) => { bookingV2EditBooking(id); _bkV2.newBooking.leadPhone = '+7 900 111'; _bkV2.newBooking.trips[0].pax = { ad_fr: 3 }; bookingV2CommitBooking('confirmed'); }, bk.id);
await settle(1200); await idle();
sb = await api('/v1/bookings/' + bk.opsId);
ok('edit → PATCH · same trip id kept · pax 3 · phone changed', sb.trips[0].id === tripId && sb.trips[0].pax_total === 3 && sb.lead_phone === '+7 900 111', { trips: sb.trips, phone: sb.lead_phone });
bk = await ev((id) => SB_BOOKINGS.find((b) => b.id === id), bk.id);
ok('edit re-priced by the server · 3 × ฿1,200 = ฿3,600 on server and screen', sb.total === 3600 && sb.price_mode === 'rate' && bk.total === 3600, { server: sb.total, screen: bk.total });

// An agent booking priced by hand is refused (400) since 8b1eeaa: operation-backend src/domain/pricing.ts:118
// enforcedPriceMode → "price_mode must be rate: only walk-in, company and staff bookings may be priced by hand".
const manualRes = await fetch(OPS + '/v1/bookings', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  body: JSON.stringify({ external_id: 'zz-manual-api', intent: 'confirm', agentId: 'a01', leadPax: 'ZZ MANUAL API', pickupSelf: true, priceMode: 'manual', manualTotal: 3000,
    trips: [{ routeId: 'r5', date: D2, pax: { ad_fr: 1 }, zone: 'NoTransfer' }] }) });
const manualBody = await manualRes.json();
ok('contract · manual-priced agent booking → 400 price_mode must be rate', manualRes.status === 400 && /price_mode must be rate: only walk-in, company and staff bookings may be priced by hand/.test(manualBody.message), { status: manualRes.status, body: manualBody });
// … and through the form: the server's 400 takes the booking back off the screen and reopens the form
const before4 = await ev(() => SB_BOOKINGS.length);
await mk({ lead: 'ZZ MANUAL', date: D2, pax: 1, manual: true });
await settle(1500); await idle(); await settle(300);
s = await ev(() => ({ n: SB_BOOKINGS.length, found: !!SB_BOOKINGS.find((b) => b.leadPax === 'ZZ MANUAL'), form: !!(_bkV2.newBooking && _bkV2.newBooking.leadPax === 'ZZ MANUAL') }));
const srvManual = (await api('/v1/bookings?q=ZZ%20MANUAL')).bookings;
ok('form · manual-priced agent booking refused → nothing on server, off the screen, form reopened', srvManual.length === 0 && !s.found && s.n === before4 && s.form, { s, srvManual });
await ev(() => { _bkV2.newBooking = null; bookingV2Render(); });

console.log('\n[5] actions');
await ev((a) => { document.body.insertAdjacentHTML('beforeend',
  '<div id="zz-r"><input id="bkr-from" value="' + a.from + '"><input id="bkr-newdate" value="' + a.to + '"><input id="bkr-reason" value="customer request"><input type="radio" name="bkr-charge" value="none" checked><input type="radio" name="bkr-collect" value="invoice" checked></div>');
  bookingV2RescheduleConfirm(a.id); document.getElementById('zz-r').remove(); }, { id: bk.id, from: D1, to: D2 });
await settle(1200); await idle();
sb = await api('/v1/bookings/' + bk.opsId);
bk = await ev((id) => SB_BOOKINGS.find((b) => b.id === id), bk.id);
ok('reschedule D1 → D2 · server moved the trip and recorded it', sb.trips[0].service_date === D2 && sb.reschedules.length === 1 && bk.trips[0].date === D2 && bk.reschedules.length === 1, { server: sb.reschedules, local: bk.trips[0].date });
await ev((a) => { document.body.insertAdjacentHTML('beforeend',
  '<div id="zz-p"><select id="bkp-cat"><option value="sick" selected>sick</option></select><input id="bkp-note" value=""><input id="bkp-rm-ad_fr" value="1"><input id="bkp-chg-cnt" value="0"><input id="bkp-chg-amt" value="0"><input id="bkp-waive-amt" value="500"></div>');
  bookingV2PartialConfirm(a, 0); document.getElementById('zz-p').remove(); }, bk.id);
await settle(1200); await idle();
sb = await api('/v1/bookings/' + bk.opsId);
bk = await ev((id) => SB_BOOKINGS.find((b) => b.id === id), bk.id);
ok('partial cancel −1 · server pax 2, refund lowers total', sb.trips[0].pax_total === 2 && sb.partial_cancels.length === 1 && bk.trips[0].pax.ad_fr === 2 && bk.partialCancels.length === 1, { serverPax: sb.trips[0].pax_total, n: sb.partial_cancels.length, localPax: bk.trips[0].pax, localN: bk.partialCancels && bk.partialCancels.length });
await ev((id) => { document.body.insertAdjacentHTML('beforeend',
  '<div id="zz-c"><select id="bkc-cat"><option value="customer_cancel" selected>c</option></select><input id="bkc-reason" value="changed plan"><input type="radio" name="bkc-charge" value="partial" checked><input id="bkc-amt" value="700"></div>');
  bookingV2CancelConfirm(id); document.getElementById('zz-c').remove(); }, bk.id);
await settle(1200); await idle();
sb = await api('/v1/bookings/' + bk.opsId);
bk = await ev((id) => SB_BOOKINGS.find((b) => b.id === id), bk.id);
ok('cancel · server cancelled with category + charge', sb.status === 'cancelled' && sb.cancellation && sb.cancellation.category === 'customer_cancel' && sb.cancellation.charge_amount === 700 && bk.status === 'cancelled', { s: sb.status, c: sb.cancellation });
await ev((id) => bookingV2RestoreBooking(id), bk.id);
await settle(1200); await idle();
sb = await api('/v1/bookings/' + bk.opsId);
ok('restore · server back to confirmed', sb.status === 'confirmed' && !sb.cancellation, { s: sb.status });
await ev((id) => { _bkV2.newBooking = null; _bkV2.detailId = id; bookingV2Render(); }, bk.id);
await settle(1500);
bk = await ev((id) => SB_BOOKINGS.find((b) => b.id === id), bk.id);
ok('detail open → history from the server (create … restore)', bk._historyFromServer && bk.history.length >= 5 && bk.history[0].tag === 'Created', bk.history && bk.history.map((h) => h.tag));
await ev(() => { _bkV2.detailId = null; bookingV2Render(); });

console.log('\n[6] refused booking → rolled back');
const before6 = await ev(() => ({ n: SB_BOOKINGS.length, locks: JSON.stringify(SB_SEAT_LOCKS) }));
await mk({ lead: 'ZZ TOO BIG', date: D2, pax: 50 });
await settle(1500); await idle(); await settle(300);
s = await ev(() => ({ n: SB_BOOKINGS.length, found: !!SB_BOOKINGS.find((b) => b.leadPax === 'ZZ TOO BIG'), form: !!(_bkV2.newBooking && _bkV2.newBooking.leadPax === 'ZZ TOO BIG'), locks: JSON.stringify(SB_SEAT_LOCKS) }));
const srvBig = (await api('/v1/bookings?q=ZZ%20TOO%20BIG')).bookings;
ok('server said no (409) and has nothing', srvBig.length === 0, srvBig);
ok('booking taken back off the screen', !s.found && s.n === before6.n, s);
ok('form reopened with what was typed', s.form, s);
ok('locks untouched', s.locks === before6.locks);
await ev(() => { _bkV2.newBooking = null; bookingV2Render(); });

console.log('\n[7] lock bigger than the free seats → 409 seats_short → legacy\'s split / all question');
// An oversize lock is no longer a plain refusal: the server answers 409 seats_short with the short days
// (operation-backend src/domain/seat-locks.ts:378 refuseShort, body.short) and takes the same request again
// with pending "split" (hold what is free, the rest pending) or "all" (everything pending) (pendingFor :375).
// The client shows legacy's "ที่นั่งว่างไม่พอ" dialog and resends (js/ops/30-ops-locks.js askPending).
const lockDay = async (d, qty) => {
  await ev((dd) => bookingV2LockFromCalendar('r5', dd), d);
  await lockModal().locator('select').nth(1).selectOption('office');
  await lockQty().fill(String(qty));
  await lockModal().locator('button[onclick="bookingV2LockCreateSubmit()"]').click();
  await idle();
};
const pendBtn = (m) => page.locator(`button[onclick="bookingV2LkPendAskGo('${m}')"]`);
const shown = async (m) => { try { await pendBtn(m).waitFor({ state: 'visible', timeout: 6000 }); return true; } catch (_) { return false; } };
const free4 = (await api(`/v1/availability?route_id=r5&date=${D4}`)).available_seats;
const n7 = await ev(() => SB_SEAT_LOCKS.length);
let c7 = lockCalls().length;
await lockDay(D4, 50);
const asked = await shown('split');
await pendBtn('cancel').click(); await settle(300);
L = (await api(`/v1/seat-locks?route_id=r5&service_date=${D4}`)).seat_locks.filter((x) => x.pax === 50);
s = await ev(() => ({ n: SB_SEAT_LOCKS.length, ask: !!_bkV2LkPendAsk }));
ok(`50 seats on a day with ${free4} free → the question, not a lock · cancel leaves nothing on server or screen`, free4 > 0 && free4 < 50 && asked && JSON.stringify(lockCalls().slice(c7)) === '["POST /v1/seat-locks"]' && L.length === 0 && s.n === n7 && !s.ask, { free4, asked, calls: lockCalls().slice(c7), L, s });
c7 = lockCalls().length;
await lockDay(D4, 50);
await shown('split'); await pendBtn('split').click(); await idle();
await waitScreen((d) => SB_SEAT_LOCKS.some((l) => l.scope === 'day' && l.date === d && l.qty === 50), D4);
L = (await api(`/v1/seat-locks?route_id=r5&service_date=${D4}`)).seat_locks.filter((x) => x.pax === 50);
s = await ev((d) => SB_SEAT_LOCKS.find((l) => l.scope === 'day' && l.date === d && l.qty === 50), D4);
ok(`split → same POST resent with pending · server holds ${free4}, ${50 - free4} pending · screen shows it`, JSON.stringify(lockCalls().slice(c7)) === '["POST /v1/seat-locks","POST /v1/seat-locks"]' && L.length === 1 && L[0].pending_pax === 50 - free4 && s && s.id === L[0].id && s.pendQty === 50 - free4, { calls: lockCalls().slice(c7), L, s: s && { id: s.id, qty: s.qty, pendQty: s.pendQty } });
const free3 = (await api(`/v1/availability?route_id=r5&date=${D3}`)).available_seats;
c7 = lockCalls().length;
await lockDay(D3, free3 + 20);
await shown('all'); await pendBtn('all').click(); await idle();
await waitScreen((a) => SB_SEAT_LOCKS.some((l) => l.scope === 'day' && l.date === a.d && l.qty === a.q), { d: D3, q: free3 + 20 });
L = (await api(`/v1/seat-locks?route_id=r5&service_date=${D3}`)).seat_locks.filter((x) => x.pax === free3 + 20 && !x.group_id);
s = await ev(() => ({ open: _bkV2LockModalOpen, ask: !!_bkV2LkPendAsk }));
ok(`all → resent with pending "all" · all ${free3 + 20} seats pending, nothing held · dialog and modal closed`, JSON.stringify(lockCalls().slice(c7)) === '["POST /v1/seat-locks","POST /v1/seat-locks"]' && L.length === 1 && L[0].pending_pax === free3 + 20 && !s.open && !s.ask, { calls: lockCalls().slice(c7), L, s });

console.log('\n[8] availability · agents');
await ev(() => laOps.availability.clear());
await ev((d) => getAllotment('r5', d), D2);
await page.waitForFunction((d) => getAllotment('r5', d).fromServer, D2, { timeout: 10000 });
s = await ev((d) => getAllotment('r5', d), D2);
const av = await api(`/v1/availability?route_id=r5&date=${D2}`);
ok('getAllotment uses the server numbers', s.fromServer && s.seatsAvailable === Math.max(0, av.available_seats) && s.lockedSeats === av.locked_pax && s.seatsConsumed === av.booked_pax, { local: s, server: av });
const editTry = await ev(() => { const n = SB_AGENTS.length; try { agNew(); } catch (_) {} return { n: SB_AGENTS.length, modal: !!document.querySelector('#agnew-modal, .agnew-modal') }; });
ok('agent create is blocked (read-only)', editTry.n === 2 && !editTry.modal, editTry);
await ev(() => { _agSelected = 'a01'; agRenderDetail('a01'); });
await settle(1200);
s = await ev(() => SB_AGENTS.find((a) => a.id === 'a01'));
ok('agent detail → company/signatory/activity from server', s.companyInfo.legalName === 'Sun Tour Co., Ltd.' && s.agentSignatory.name === 'Ivan' && s.activity.length === 1, { c: s.companyInfo, act: s.activity });

console.log('\n[9] Dashboard hydrates its operational KPIs from the server');
await ev((d) => { window._dashDate = d; const el = document.querySelector('.nav-item[data-view="dashboard"]'); if(el) el.click(); }, D2);
await page.waitForFunction((d) => window.laOps.dashboard && window.laOps.dashboard.get(d, 'day'), D2, { timeout: 30000 });
await settle(400);
const dash = await api(`/v1/dashboard?date=${D2}&mode=day`);
s = await ev((d) => ({
  cached: laOps.dashboard.get(d, 'day'),
  state: laOps.dashboard.status(d, 'day'),
  serverNote: document.querySelector('#dash-wrap') && document.querySelector('#dash-wrap').innerText.includes('Server dashboard'),
  header: document.querySelector('#dash-wrap .dv-hd') && document.querySelector('#dash-wrap .dv-hd').innerText,
}), D2);
ok('Dashboard cache equals GET /v1/dashboard summary', s.cached && s.cached.summary.booked_pax === dash.summary.booked_pax && s.cached.summary.total_capacity === dash.summary.total_capacity && s.cached.summary.pending_approval_pax === dash.summary.pending_approval_pax, { cached: s.cached && s.cached.summary, server: dash.summary });
ok('Dashboard identifies the authoritative server snapshot', s.state === 'ready' && s.serverNote && s.header.includes(String(dash.summary.booked_pax)), s);

console.log('\n[10] every page renders with operation-backend on');
const views = await page.$$eval('.nav-item[data-view]', (ns) => [...new Set(ns.map((n) => n.dataset.view))]);
const broken = [];
for (const v of views) {
  const before = errors.length;
  await ev((vv) => { const el = document.querySelector('.nav-item[data-view="' + vv + '"]'); if (el) el.click(); }, v);
  await settle(250);
  if (errors.length > before) broken.push(v + ': ' + errors.slice(before).join(' | ').slice(0, 200));
}
ok(views.length + ' pages, none throws', broken.length === 0, broken);

// ids → {id}: anything with a digit in it (lock_…, trip_…, BK…, a01), dates+boat → {date}/{boat}
const used = [...new Set(calls.map((c) => c
  .replace(/\/\d{4}-\d{2}-\d{2}\/[a-z0-9]+$/, '/{date}/{boat}')
  .split('/').map((seg) => (/\d/.test(seg) && !/^v1$/.test(seg) && !seg.startsWith('{')) ? '{id}' : seg).join('/')))].sort();
console.log('\nendpoints the app called:\n  ' + used.join('\n  '));
// the refusals the suite provokes on purpose ([4] manual price, [6] too big, [7] seats_short) and nothing else
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
ok('no page errors', errors.length === 0, errors);

await browser.close(); srv.close(); backend.kill();
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
