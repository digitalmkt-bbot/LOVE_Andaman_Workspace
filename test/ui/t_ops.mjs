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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname);
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: Object.assign({ authorization: req.headers()['authorization'] || '' }, req.headers()['content-type'] ? { 'content-type': req.headers()['content-type'] } : {}), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: r.status === 204 ? '' : Buffer.from(await r.arrayBuffer()) });
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
ok('boats = server catalogue · capacity→cap, license_pax→licensePax', JSON.stringify(s.boats) === '["b1","b6","b7","b13"]' && s.b6.cap === 40 && s.b6.licensePax === 47, s.b6);
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
await ev((d) => { boatCapSet('b7', d, 30, 'test'); boatCapPersist(); }, D1);
await settle(); await idle();
deps = (await api(`/operations/deployments?from=${D1}&to=${D1}`)).deployments;
ok('per-day capacity → deployment capacity 30', deps.find((x) => x.boat_id === 'b7').capacity === 30, deps);
await ev((d) => { delete TRIPS[d].b1; save('operations'); }, D1);
await settle(); await idle();
deps = (await api(`/operations/deployments?from=${D1}&to=${D1}`)).deployments;
ok('unassign → deployment deleted', deps.length === 1 && deps[0].boat_id === 'b7', deps);

console.log('\n[3] seat locks');
await ev((d) => bookingV2CreateLock({ scope: 'day', routeId: 'r5', date: d, holderType: 'agent', holderId: 'a01', qty: 5 }), D1);
await settle(); await idle();
let L = (await api(`/v1/seat-locks?route_id=r5&service_date=${D1}`)).seat_locks;
const dayLock = await ev(() => SB_SEAT_LOCKS[SB_SEAT_LOCKS.length - 1]);
ok('day lock → one server lock (agent a01, 5 seats)', L.length === 1 && L[0].pax === 5 && L[0].agent_id === 'a01' && dayLock.opsIds && dayLock.opsIds[D1] === L[0].id, { L, dayLock });
await ev((d) => bookingV2CreateLock({ scope: 'bulk', routeId: 'r5', dateFrom: d.from, dateTo: d.to, dow: [], holderType: 'office', qty: 3 }), { from: D2, to: D4 });
await settle(); await idle();
const bulk = await ev(() => SB_SEAT_LOCKS[SB_SEAT_LOCKS.length - 1]);
L = (await api('/v1/seat-locks?route_id=r5')).seat_locks.filter((x) => x.status === 'active' && x.pax === 3);
ok('bulk lock D2..D4 → 3 server locks, one per departure, no agent', L.length === 3 && !L[0].agent_id && Object.keys(bulk.opsIds || {}).length === 3, { L, opsIds: bulk.opsIds });
await ev((id) => { const l = SB_SEAT_LOCKS.find((x) => x.id === id); l.qty = 4; sbSeatLocksPersist(); }, bulk.id);
await settle(); await idle();
L = (await api('/v1/seat-locks?route_id=r5')).seat_locks.filter((x) => Object.values(bulk.opsIds).includes(x.id));
ok('edit bulk qty 3 → 4 → PATCH on every departure', L.length === 3 && L.every((x) => x.pax === 4), L.map((x) => x.pax));
await ev((a) => { const l = SB_SEAT_LOCKS.find((x) => x.id === a.id); (l.releasedDates = l.releasedDates || []).push(a.d); sbSeatLocksPersist(); }, { id: bulk.id, d: D3 });
await settle(); await idle();
L = (await api('/v1/seat-locks?route_id=r5')).seat_locks.filter((x) => Object.values(bulk.opsIds).includes(x.id) || x.service_date === D3);
ok('release one round (D3) → only that server lock released', L.filter((x) => x.status === 'released').length === 1 && L.find((x) => x.status === 'released').service_date === D3, L);

console.log('\n[4] booking through the real form');
const mk = async (o) => ev((o) => {
  bookingV2NewBooking();
  const d = _bkV2.newBooking;
  Object.assign(d, { agentId: 'a01', leadPax: o.lead, leadNationality: 'RU', leadPhone: '+7 900 000', pickupSelf: true, pickupZoneFilter: 'NoTransfer', hotelName: '', priceMode: 'manual', manualTotal: 3000 });
  d.guides = { english: true, russian: false, chinese: false, otherLang: '' };
  d.trips = [Object.assign(bookingV2NewTrip(), { routeId: 'r5', date: o.date, pax: { ad_fr: o.pax }, zone: 'NoTransfer' })];
  if(o.lock){ d.trips[0].lockDrawSel = {}; d.trips[0].lockDrawSel[o.lock] = o.pax; }
  bookingV2CommitBooking('confirmed');
}, o);
await mk({ lead: 'ZZ TEST ONE', date: D1, pax: 2, lock: dayLock.id });
await settle(1200); await idle();
let bk = await ev(() => SB_BOOKINGS.find((b) => b.leadPax === 'ZZ TEST ONE'));
let sb = bk && bk.opsId ? await api('/v1/bookings/' + bk.opsId) : null;
ok('saved → POST /v1/bookings · opsId + trip id stored', bk && bk.opsId && bk.trips[0].opsTripId && sb && sb.external_id === bk.id, { bk: bk && { id: bk.id, opsId: bk.opsId, t: bk.trips }, dialogs: dialogs.slice(-4) });
ok('header columns on the server (lead, agent, nationality, total)', sb && sb.lead_pax === 'ZZ TEST ONE' && sb.agent_id === 'a01' && sb.lead_nationality === 'RU', sb);
ok('lock draw sent as the server lock id', sb && JSON.stringify(sb.trips[0].lock_draws) === JSON.stringify({ [dayLock.opsIds[D1]]: 2 }), sb && sb.trips[0]);
L = (await api(`/v1/seat-locks?route_id=r5&service_date=${D1}`)).seat_locks;
ok('server lock now shows drawn_pax 2', L[0] && L[0].drawn_pax === 2, L);
const tripId = bk.trips[0].opsTripId;
await ev((id) => { bookingV2EditBooking(id); _bkV2.newBooking.leadPhone = '+7 900 111'; _bkV2.newBooking.trips[0].pax = { ad_fr: 3 }; bookingV2CommitBooking('confirmed'); }, bk.id);
await settle(1200); await idle();
sb = await api('/v1/bookings/' + bk.opsId);
ok('edit → PATCH · same trip id kept · pax 3 · phone changed', sb.trips[0].id === tripId && sb.trips[0].pax_total === 3 && sb.lead_phone === '+7 900 111', { trips: sb.trips, phone: sb.lead_phone });

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
await mk({ lead: 'ZZ TOO BIG', date: D2, pax: 45 });
await settle(1500); await idle(); await settle(300);
s = await ev(() => ({ n: SB_BOOKINGS.length, found: !!SB_BOOKINGS.find((b) => b.leadPax === 'ZZ TOO BIG'), form: !!(_bkV2.newBooking && _bkV2.newBooking.leadPax === 'ZZ TOO BIG'), locks: JSON.stringify(SB_SEAT_LOCKS) }));
const srvBig = (await api('/v1/bookings?q=ZZ%20TOO%20BIG')).bookings;
ok('server said no (409) and has nothing', srvBig.length === 0, srvBig);
ok('booking taken back off the screen', !s.found && s.n === before6.n, s);
ok('form reopened with what was typed', s.form, s);
ok('locks untouched', s.locks === before6.locks);
await ev(() => { _bkV2.newBooking = null; bookingV2Render(); });

console.log('\n[7] refused lock → rolled back');
const n7 = await ev(() => SB_SEAT_LOCKS.length);
await ev((d) => bookingV2CreateLock({ scope: 'day', routeId: 'r5', date: d, holderType: 'office', qty: 500 }), D2);
await settle(); await idle(); await settle(300);
s = await ev(() => SB_SEAT_LOCKS.length);
L = (await api(`/v1/seat-locks?route_id=r5&service_date=${D2}`)).seat_locks.filter((x) => x.pax === 500);
ok('500-seat lock refused · gone from screen and server', s === n7 && L.length === 0, { s, n7, L });

console.log('\n[8] availability · agents');
await ev(() => laOps.availability.clear());
await ev((d) => getAllotment('r5', d), D2); await settle(1200);
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
ok('no page errors', errors.length === 0, errors);

await browser.close(); srv.close(); backend.kill();
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
