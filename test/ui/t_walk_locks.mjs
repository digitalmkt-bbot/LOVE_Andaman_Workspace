// t_walk_locks · browser walk of the wired screens: seat locks · availability · dashboard · Boat Operation
//
//   node test/ui/t_walk_locks.mjs     (same setup as t_ops.mjs: in-process operation-backend, seeded)
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

const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = '';
const opsPort = await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 30000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const api = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (_) { j = { raw: txt }; }
  if (r.status >= 400 && j && typeof j === 'object') j.__status = r.status;
  return j;
};
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b || {}) });
const put = (p, b) => api(p, { method: 'PUT', body: JSON.stringify(b || {}) });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [];
const proxy = async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + (u.search || ''));
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' → ' + r.status + ' ' + buf.toString().slice(0, 220));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
};
await ctx.route(PROD, proxy);
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 200)); d.type() === 'prompt' ? d.accept('Tester') : d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got).slice(0, 600))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitScreen = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const lastCalls = (n0) => calls.slice(n0);

// ── fixed dates (today is 2026-10-17) ──
const T0 = '2026-10-20', T1 = '2026-10-21', T2 = '2026-10-22';          // locks / boat holds
const SRC = ['2026-10-26', '2026-10-27', '2026-10-28'];                 // Boat Operation copy-week source (Mon-Wed)
const CLOSED = '2026-11-03';                                            // r10 closed: the target of SRC[1]

// ── seed, before the app boots ──
for (const d of [T0, T1, T2]) await post('/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: d, capacity: 40 });
await post('/operations/deployments', { boat_id: 'b7', route_id: 'r4', service_date: T0, capacity: 34 });     // b7 busy on another route that day
// a bulk lock whose release cutoff is already behind us (6 days before 18:00): overdue on all three departures
const bulk = await post('/v1/seat-lock-groups', { route_id: 'r5', date_from: T0, date_to: T2, pax: 10, holder_type: 'office', release_days_before: 6, release_time: '18:00' });
// an agent day lock with a sub-group
const dayLock = await post('/v1/seat-locks', { route_id: 'r5', service_date: T1, pax: 8, holder_type: 'agent', agent_id: 'a01' });
const sub = await api(`/v1/seat-locks/${dayLock.id}/sub-groups`, { method: 'POST', headers: { 'if-match': '"' + dayLock.version + '"' }, body: JSON.stringify({ sub_name: 'A', pax: 3 }) });
// a lock bigger than the free seats of T2: 'split' keeps what is free, the rest is pending
const pendLock = await post('/v1/seat-locks', { route_id: 'r5', service_date: T2, pax: 45, holder_type: 'office', pending: 'split' });
// a credit agent (pay type invoice) with a confirmed booking on a boat, a prepay invoice, 1,000 of it paid
await api('/v1/agents/a01', { method: 'PATCH', body: JSON.stringify({ pay_type: 'invoice' }) });
const bkC = await post('/v1/bookings', { external_id: 'zz-credit', intent: 'confirm', agentId: 'a01', leadPax: 'ZZ CREDIT', pickupSelf: true, trips: [{ routeId: 'r5', date: T0, pax: { ad_fr: 2 }, zone: 'NoTransfer' }] });
await api('/operations/trip-ops/' + bkC.trips[0].id, { method: 'PATCH', body: JSON.stringify({ boat_id: 'b6' }) });
const invC = await post('/v1/invoices', { agent_id: 'a01', booking_ids: [bkC.id], kind: 'prepay' });
await post('/v1/invoices/' + invC.id + '/payments', { method: 'cash', amount: 1000 });
// the Daily Fleet Log reads today and the days before it: one booking today, on b6
const TODAY = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);       // Asia/Bangkok
await post('/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: TODAY, capacity: 40 });
const bkD = await post('/v1/bookings', { external_id: 'zz-daily', intent: 'confirm', agentId: 'a01', leadPax: 'ZZ DAILY', pickupSelf: true, trips: [{ routeId: 'r5', date: TODAY, pax: { ad_fr: 2, chd_fr: 1 }, zone: 'NoTransfer' }] });
if (bkD.__status) console.log('seed: ZZ DAILY refused', bkD.__status, JSON.stringify(bkD).slice(0, 200));
else await api('/operations/trip-ops/' + bkD.trips[0].id, { method: 'PATCH', body: JSON.stringify({ boat_id: 'b6' }) });
await put(`/v1/routes/r10/days/${CLOSED}`, { kind: 'closed' });
for (const d of SRC) await post('/operations/deployments', { boat_id: 'b13', route_id: 'r10', service_date: d, capacity: 38 });
console.log('seed: bulk', bulk.id, bulk.__status || '', '| day', dayLock.id, dayLock.__status || '', '| sub', sub && sub.id, sub && sub.__status || '', '| pend', pendLock.id, pendLock.__status || '', pendLock.pending_pax);

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
const s0 = await ev(() => ({ failed: laOps.state.failed, locks: SB_SEAT_LOCKS.length, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }));
ok('boot: nothing failed, locks loaded', s0.failed.length === 0 && s0.locks >= 4, s0);
console.log('   browser tz', s0.tz);

if (process.env.PROBEJS) {      // debugging aid: run a JS expression (file) in the page after boot and print it
  const fs = await import('node:fs');
  console.log(await page.evaluate(fs.readFileSync(process.env.PROBEJS, 'utf8')));
  await browser.close(); srv.close(); backend.kill(); process.exit(0);
}
let s, L;
const iso = (x) => (x ? new Date(x).toISOString() : null);

console.log('\n[1] seat-lock rules read the server numbers');
const srvRows = (await api('/v1/seat-locks')).seat_locks;
const srvGroup = (await api('/v1/seat-lock-groups')).seat_lock_groups.find((g) => g.id === bulk.id);
const byId = Object.fromEntries(srvRows.map((r) => [r.id, r]));
// every lock on screen, every date it holds: what the bookingV2Lock* rules answer vs what the server sent
const scr = await ev(() => {
  const out = [];
  SB_SEAT_LOCKS.forEach((l) => {
    Object.keys(l.opsIds || {}).forEach((d) => {
      const c = bookingV2LockReleaseCutoff(l, d);
      out.push({ id: l.id, sid: l.opsIds[d], d, parent: l.parentId || null, group: !!l.isGroup, rem: bookingV2LockRemaining(l, d), drawable: bookingV2LockDrawable(l, d),
        overdue: bookingV2LockOverdue(l, d), cut: c ? c.toISOString() : null, legacyRem: Math.max(0, (l.qty || 0) - bookingV2LockUsedOn(l, d) - bookingV2LockPendOn(l, d)) });
    });
  });
  return out;
});
const bad = [];
scr.forEach((x) => {
  const r = byId[x.sid]; if (!r) { bad.push(['no server row', x.sid]); return; }
  if (x.rem !== r.remaining_pax) bad.push(['remaining', x.sid, x.rem, r.remaining_pax]);
  if (x.overdue !== r.overdue) bad.push(['overdue', x.sid, x.overdue, r.overdue]);
  if (iso(r.release_at) !== x.cut) bad.push(['release_at', x.sid, x.cut, r.release_at]);
});
ok(`remaining / overdue / release time on screen = server for all ${scr.length} lock-days (day, bulk x3, sub-group, pending)`, scr.length >= 6 && bad.length === 0, bad);
const parentRow = scr.find((x) => x.sid === dayLock.id), subRow = scr.find((x) => x.parent === dayLock.id);
ok('parent of a sub-group: server\'s unallocated remainder (not legacy qty minus used)', parentRow && byId[dayLock.id].remaining_pax === parentRow.rem && parentRow.rem !== parentRow.legacyRem, { parentRow, srv: byId[dayLock.id].remaining_pax });
ok('sub-group draws its own remaining · drawable = server remaining', subRow && subRow.drawable === byId[subRow.sid].remaining_pax && subRow.drawable === 3, subRow);
const pendRow = scr.find((x) => x.sid === pendLock.id);
ok('pending lock (45 asked, 30 free): remaining 30 on screen = server', pendRow && pendRow.rem === 30 && byId[pendLock.id].pending_pax === 15, pendRow);
// sub-group room
s = await ev((a) => ({ day: bookingV2LockSubRoom(SB_SEAT_LOCKS.find((l) => l.id === a.day)), bulk: bookingV2LockSubRoom(SB_SEAT_LOCKS.find((l) => l.id === a.bulk)),
  rounds: bookingV2LockRounds(SB_SEAT_LOCKS.find((l) => l.id === a.bulk)) }), { day: dayLock.id, bulk: bulk.id });
ok('sub-group room: day lock = server sub_group_room · bulk = tightest day', s.day === byId[dayLock.id].sub_group_room && s.bulk === 10, { s, srv: byId[dayLock.id].sub_group_room });
ok('rounds {total, past} = group departures / departures_past', s.rounds.total === srvGroup.departures && s.rounds.past === srvGroup.departures_past && s.rounds.total === 3, { rounds: s.rounds, srv: [srvGroup.departures, srvGroup.departures_past] });
// locked total: GET /v1/availability locked_pax
await ev((d) => laOps.availability.ensure(d), T0); await ev((d) => laOps.availability.ensure(d), T2);
await settle(1200);
const av0 = await api(`/v1/availability?route_id=r5&date=${T0}`), av2 = await api(`/v1/availability?route_id=r5&date=${T2}`);
s = await ev((a) => ({ t0: bookingV2LockedTotal('r5', a.T0), t2: bookingV2LockedTotal('r5', a.T2) }), { T0, T2 });
ok('locked total of a route-day = availability.locked_pax (T0 10 · T2 10 held + 30 held of the pending lock)', s.t0 === av0.locked_pax && s.t2 === av2.locked_pax && s.t0 === 10 && s.t2 === 40, { s, av0: av0.locked_pax, av2: av2.locked_pax });

// the Seat Locks tab: the day table, the overdue button, the cards
const showLocksDay = (d) => ev((dd) => {
  const base = bookingV2LocalYMD(new Date());
  _bkV2.tab = 'locks'; _bkV2LockUI.dayOff = Math.round((new Date(dd + 'T00:00:00') - new Date(base + 'T00:00:00')) / 864e5);
  bookingV2Render();
}, d);
await showLocksDay(T0); await settle(600);
s = await ev(() => { const b = document.querySelector('button[onclick^="bookingV2LockReleaseOverdueGo"]'); return { btn: b ? b.innerText : null, onclick: b ? b.getAttribute('onclick') : null, day: bookingV2LockDayStr() }; });
ok('Seat Locks tab: the day\'s overdue lock shows the Release overdue button for T0 (server overdue flag)', s.btn && s.onclick.includes(T0) && s.day === T0, s);

// the booking form's draw choices (agent a01, T1): sub-group A + the parent's unallocated rest
await ev((a) => {
  bookingV2NewBooking(); bookingV2SetBookingField('agentId', 'a01');
  const d = _bkV2.newBooking; d.trips = [Object.assign(bookingV2NewTrip(), { routeId: 'r5', date: a.T1, pax: { ad_fr: 2 }, zone: 'NoTransfer' })];
  bookingV2Render();
}, { T1 });
await settle(800);
const srcs = await ev((a) => bookingV2DrawSources('r5', a.T1, 'a01'), { T1 });
const formText = await ev(() => document.body.innerText);
const subSrv = srvRows.find((r) => r.parent_id === dayLock.id);
const rems = [...formText.matchAll(/เหลือ (\d+)/g)].map((m) => +m[1]);
ok('booking form draw sources = server remaining (A: 3, rest: 5, office hold: 10)', srcs.length === 3 && srcs.find((x) => /Office/.test(x.label)).remaining === 10 && srcs.find((x) => /A$/.test(x.label)).remaining === subSrv.remaining_pax && srcs.find((x) => /ยังไม่จัด/.test(x.label)).remaining === byId[dayLock.id].remaining_pax, { srcs, subSrv: subSrv.remaining_pax });
ok('booking form shows those numbers on its draw rows (เหลือ 3 and เหลือ 5)', rems.includes(3) && rems.includes(5), { rems });
await ev(() => { _bkV2.newBooking = null; bookingV2Render(); });

console.log('\n[3] audit / sweep · release overdue');
s = await ev(() => {
  const all = SB_SEAT_LOCKS.map((l) => { const a = bookingV2LockAudit(l); return a ? a.diff : 0; });
  const sw = bookingV2LockSweep();
  _bkV2.tab = 'locks'; bookingV2Render();
  return { diffs: all, sw: { nBad: sw.nBad, nOver: sw.nOver, seats: sw.seats, seatsOver: sw.seatsOver }, bar: document.body.innerText.includes('มีที่นั่งกันไว้เปล่า') };
});
ok('audit diff 0 on every lock · sweep empty · no ghost-seat bar', s.diffs.every((x) => x === 0) && s.sw.nBad === 0 && s.sw.seats === 0 && !s.bar, s);
// now release overdue for T0 through the button
await showLocksDay(T0); await settle(500);
const nBefore = calls.length;
await page.locator('button[onclick^="bookingV2LockReleaseOverdueGo"]').click();
await idle(); await settle(900);
const rel = lastCalls(nBefore).filter((c) => /^POST/.test(c));
const after = (await api(`/v1/seat-locks?route_id=r5&service_date=${T0}`)).seat_locks;
const after1 = (await api(`/v1/seat-locks?route_id=r5&service_date=${T1}`)).seat_locks.find((r) => r.group_id === bulk.id);
s = await ev((a) => ({ od0: bookingV2LockOverdueOn(a.T0).length, od1: bookingV2LockOverdueOn(a.T1).length, btn: !!document.querySelector('button[onclick^="bookingV2LockReleaseOverdueGo"]') }), { T0, T1 });
ok('Release overdue → POST /v1/seat-locks/release-overdue · T0 departure released on the server, T1 untouched', rel.join() === 'POST /v1/seat-locks/release-overdue' && after.every((r) => r.status === 'released') && after1.status === 'active', { rel, after: after.map((r) => r.status), t1: after1.status });
ok('screen after: nothing overdue on T0, button gone, T1 still overdue', s.od0 === 0 && !s.btn && s.od1 >= 1, s);

console.log('\n[2] whole-boat hold: boat list + CanTake (GET /v1/seat-locks/boat-options)');
const optsUrl = (d, rid, lock) => `/v1/seat-locks/boat-options?route_id=${rid}&service_date=${d}` + (lock ? `&lock_id=${lock}` : '');
let opts = (await api(optsUrl(T0, 'r5'))).boats;
const nOpt = calls.length;
await ev((a) => { bookingV2BoatLockOpen({ routeId: 'r5', date: a.T0, holderType: 'office' }); }, { T0 });
await page.waitForSelector('[data-bklk-boat]', { timeout: 8000 }).catch(() => {});
await waitScreen((a) => document.querySelectorAll('[data-bklk-boat]').length > 0 && laOps && true, {}, 4000);
await settle(1500);
const optCalls = lastCalls(nOpt).filter((c) => /boat-options/.test(c));
const rows = await ev(() => [...document.querySelectorAll('[data-bklk-boat]')].map((e) => ({ id: e.dataset.bklkBoat, ok: e.dataset.bklkOk === '1', text: e.innerText.replace(/\s+/g, ' ') })));
const can = await ev((a) => ['b1', 'b6', 'b7', 'b13'].map((b) => [b, bookingV2BoatLockCanTake(a.T0, b, 'r5')]), { T0 });
console.log('   server:', JSON.stringify(opts.map((b) => [b.boat_id, b.ok, b.why && b.why.message])));
console.log('   screen:', JSON.stringify(rows.map((b) => [b.id, b.ok, b.text])));
ok('the form asked GET /v1/seat-locks/boat-options once for route+date', optCalls.length >= 1 && optCalls.every((c) => c.includes('route_id=r5') && c.includes('service_date=' + T0)), optCalls);
ok('pick list: every boat the server lists is on screen with the server ok flag', opts.filter((b) => rows.some((r) => r.id === b.boat_id)).length === rows.length && rows.every((r) => r.ok === opts.find((b) => b.boat_id === r.id).ok) && rows.length >= 2, { rows, opts: opts.map((b) => [b.boat_id, b.ok]) });
ok('b7 (placed on r4) and b6 (2 pax already booked on it) cannot be held, b1 can · each row carries the server\'s own message', rows.filter((r) => !r.ok).map((r) => r.id).join() === 'b6,b7' && rows.find((r) => r.id === 'b1').ok &&rows.filter((r) => !r.ok).every((r) => { const w = opts.find((b) => b.boat_id === r.id).why; return w && r.text.replace(/\s+/g, ' ').includes(w.message.replace(/\s+/g, ' ')); }), { rows });
ok('CanTake = server ok for every boat', can.every(([b, v]) => { const o = opts.find((x) => x.boat_id === b); return !o || v === o.ok; }), { can, opts: opts.map((b) => [b.boat_id, b.ok]) });
// hold b1 through the form: pick the row, seats, expiry (already past: the server flags it overdue)
const EXP = '2026-10-16';
const nHold = calls.length;
await page.locator('[data-bklk-boat="b1"]').click();
await page.locator('input[oninput*="minCap"]').fill('50');
await page.locator('input[onchange*="expiry"]').fill(EXP);
await page.locator('button[onclick="bookingV2BoatLockSubmit()"]').click();
await idle(); await settle(1200);
const holds = (await api(`/v1/seat-locks?route_id=r5&service_date=${T0}`)).seat_locks.filter((r) => r.boat_id);
ok('submit → one POST /v1/seat-locks · the server holds b1 whole (pax 50, expiry as typed)', lastCalls(nHold).filter((c) => /^POST/.test(c)).join() === 'POST /v1/seat-locks' && holds.length === 1 && holds[0].boat_id === 'b1' && holds[0].pax === 50 && holds[0].expiry === EXP, { calls: lastCalls(nHold), holds });
opts = (await api(optsUrl(T0, 'r5'))).boats;
await ev((a) => { bookingV2BoatLockOpen({ routeId: 'r5', date: a.T0, holderType: 'office' }); }, { T0 });
await settle(1500);
s = await ev((a) => { const h = SB_SEAT_LOCKS.find((l) => l.scope === 'boat'); const row = document.querySelector('[data-bklk-boat="b1"]');
  return { h: h && { id: h.id, boatId: h.boatId, od: bookingV2BoatLockOverdue(h, bookingV2LocalYMD(new Date())) }, can: bookingV2BoatLockCanTake(a.T0, 'b1', 'r5'), rowOk: row && row.dataset.bklkOk }; }, { T0 });
ok('after the hold: server boat-options says b1 taken · the form row and CanTake(b1) say the same', opts.find((b) => b.boat_id === 'b1').ok === false && s.can === false && s.rowOk === '0', { s, opts: opts.map((b) => [b.boat_id, b.ok, b.why && b.why.code]) });
ok('hold with a past expiry: screen overdue = server overdue flag', s.h && s.h.od === holds[0].overdue && holds[0].overdue === true, { s, srvOverdue: holds[0] && holds[0].overdue });
await ev(() => { _bkBoatForm = null; bookingV2Render(); });

console.log('\n[4] agent credit · PFM cutoff and prepay kind');
await ev(() => { agCreditState('a01'); });           // asks the server in the background
await settle(1200);
const credit = (await api('/v1/agents/a01')).credit;
s = await ev(() => ({ c: agCreditState('a01'), pay: sbGetAgent('a01').payType, limit: sbGetAgent('a01').creditLimit }));
ok('agCreditState(a01) = the server\'s credit (limit, used = the two open bookings, available, pct)', s.c.limit === credit.limit && s.c.used === credit.used && s.c.available === credit.available && s.c.pct === credit.pct && credit.used === bkC.total + bkD.total && s.c.over === credit.over, { screen: s.c, server: credit, pay: s.pay });
s = await ev(() => { const saved = SB_BOOKINGS.splice(0); const c = agCreditState('a01'); SB_BOOKINGS.push(...saved); return c; });
ok('with the browser\'s own booking rows taken away the figure stays the server\'s (legacy sum would be 0)', s.used === credit.used, s);
// PFM: open the screen for the booking's travel day
await ev((d) => { const el = document.querySelector('.nav-item[data-view="dailypfm"]'); _pfmDate = d; _pfmMode = 'daily'; el.click(); }, T0);
await waitScreen(() => window.laOpsPfm && document.getElementById('dailypfm-host') && document.getElementById('dailypfm-host').innerText.length > 50, null, 8000);
await settle(1500);
const pfm = await api(`/v1/pfm?from=${T0}&to=${T0}`);
const prow = pfm.rows.find((r) => r.booking_id === bkC.id);
s = await ev((a) => { const bk = SB_BOOKINGS.find((b) => b.leadPax === 'ZZ CREDIT'); const inv = bk && acctBookingInvoice(bk.id);
  return { bk: !!bk, cutoff: pfmCutoff(a.d).toISOString(), prepaid: bk && pfmIsCreditPrepaid(bk), inv: inv && { kind: inv.kind, note: inv.note, fromOps: !!inv._fromOpsBackend }, isPrepayInv: inv && pfmIsPrepayInv(inv),
    inScope: bk && pfmInScope(bk), text: document.getElementById('dailypfm-host').innerText.slice(0, 1500) }; }, { d: T0 });
ok('server PFM row is kind prepay with a cutoff (18:00 Bangkok the day before)', prow && prow.kind === 'prepay' && prow.cutoff_at === '2026-10-19T11:00:00.000Z', prow);
ok('pfmCutoff(T0) = the row\'s cutoff_at', s.cutoff === prow.cutoff_at, { screen: s.cutoff, server: prow.cutoff_at });
ok('pfmIsCreditPrepaid(booking) true from the row\'s kind · pfmInScope follows', s.bk && s.prepaid === true && s.inScope === true, s);
const fake = await ev(() => ({ asProforma: pfmIsPrepayInv({ _fromOpsBackend: true, kind: 'proforma', note: 'prepay', status: 'issued' }), asPrepay: pfmIsPrepayInv({ _fromOpsBackend: true, kind: 'prepay', note: '', status: 'issued' }), voided: pfmIsPrepayInv({ _fromOpsBackend: true, kind: 'prepay', status: 'void' }) }));
ok('pfmIsPrepayInv(invoice) follows the server invoice kind (not the note): prepay true, proforma false even with the note, void false', s.inv && s.inv.kind === 'prepay' && s.isPrepayInv === true && fake.asPrepay === true && fake.asProforma === false && fake.voided === false, { inv: s.inv, fake });
console.log('   Daily PFM on screen: ' + JSON.stringify(s.text.replace(/\s+/g, ' ').slice(0, 1000)));
// the cutoff is an instant the server names: a browser in another time zone must show the same one (legacy built it from the browser's clock)
{
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 800 }, timezoneId: 'America/Los_Angeles' });
  await ctx2.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
  await ctx2.route(PROD, proxy);
  const p2 = await ctx2.newPage();
  p2.on('dialog', (d) => d.accept());
  await p2.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
  await p2.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
  await p2.waitForTimeout(1500);
  await p2.evaluate((d) => laOpsPfm.load(d, d), T0);
  const tz2 = await p2.evaluate((d) => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, shown: pfmCutoff(d).toISOString(), legacy: (function () { const c = new Date(d + 'T18:00:00'); c.setDate(c.getDate() - 1); return c.toISOString(); })() }), T0);
  ok('pfmCutoff in a Los Angeles browser = the server\'s instant (18:00 Bangkok), not 18:00 on that browser\'s clock', tz2.tz === 'America/Los_Angeles' && tz2.shown === prow.cutoff_at && tz2.legacy !== prow.cutoff_at, { tz2, server: prow.cutoff_at });
  await ctx2.close();
}

console.log('\n[5] Dashboard · Seats available month grid · pier ticker');
const MONTH = T0.slice(0, 7);
const cellsOf = () => ev(() => [...document.querySelectorAll('.dv-calg .dv-cell')].map((c) => ({ day: parseInt(c.querySelector('.d').innerText, 10), big: c.querySelector('.n').innerText.trim(), sub: c.querySelector('.s').innerText.trim(), pax: (c.querySelector('.p') || {}).innerText || '' })));
const expectCell = (d) => {
  const day = +d.date.slice(8);
  if (d.state === 'none') return { day, big: '—', sub: 'Closed' };
  if (d.state === 'wx') return { day, big: '⛈', sub: 'Cancelled' };
  return { day, big: String(d.free), sub: '/' + d.cap + ' free', pax: d.booked + ' pax' + (d.weather_closed > 0 ? ' · ⛈' + d.weather_closed : '') };
};
const sameCells = (scr, days) => days.every((d) => { const e = expectCell(d), c = scr.find((x) => x.day === e.day); return c && c.big === e.big && c.sub === e.sub && (e.pax === undefined || c.pax.replace(/\s+/g, ' ') === e.pax); });
await ev((d) => { window._dashDate = d; window._dashCalFam = ''; window._dashCalMonth = ''; document.querySelector('.nav-item[data-view="dashboard"]').click(); }, T0);
await waitScreen(() => document.querySelectorAll('.dv-calg .dv-cell').length > 20 && laOps.dashboard.get(document.querySelector('.dv-calg') && window._dashDate.slice(0, 7) + '-01', 'month'), null, 10000);
await settle(600);
const nDash = calls.length;
let srvMonthAll = await api(`/v1/dashboard?date=${MONTH}-01&mode=month`);
let scr5 = await cellsOf();
ok(`month grid: all ${srvMonthAll.days.length} days on screen = GET /v1/dashboard?mode=month days[] (free / cap / booked / closed)`, scr5.length === srvMonthAll.days.length && sameCells(scr5, srvMonthAll.days), { scr: scr5.slice(18, 24), srv: srvMonthAll.days.slice(18, 24) });
const d20 = srvMonthAll.days.find((d) => d.date === T0), d21 = srvMonthAll.days.find((d) => d.date === T1);
ok('month grid numbers: T0 cap 74 (b6 40 + b7 34) with 2 booked · T1 cap 40', d20.cap === 74 && d20.booked === 2 && d21.cap === 40, { d20, d21 });
// the same days asked the other way: GET /v1/availability per route (what getAllotment shows, lock-aware)
const availFree = async (d) => { let f = 0; for (const r of ['r4', 'r5']) f += Math.max(0, (await api(`/v1/availability?route_id=${r}&date=${d}`)).available_seats || 0); return f; };
const [a20, a21] = [await availFree(T0), await availFree(T1)];
console.log(`   free seats T0: month grid ${d20.free} · availability sum ${a20} | T1: month grid ${d21.free} · availability sum ${a21}  (T0's bulk departure was released in [3]; T1 holds 8 + 10)`);
ok('month grid free seats = what the booking screen sells (availability, locks held back)', d20.free === a20 && d21.free === a21, { grid: [d20.free, d21.free], availability: [a20, a21] });
// family chip
const nFam = calls.length;
await page.locator('[onclick="dashCalSetFam(\'phiphi\')"]').click();
await waitScreen(() => laOps.dashboard.get(window._dashCalMonth ? window._dashCalMonth + '-01' : window._dashDate.slice(0, 7) + '-01', 'month', 'phiphi'), null, 8000);
await settle(600);
const famCalls = lastCalls(nFam).filter((c) => /dashboard/.test(c));
const srvPhi = await api(`/v1/dashboard?date=${MONTH}-01&mode=month&family=phiphi`);
scr5 = await cellsOf();
const phi26 = srvPhi.days.find((d) => d.date === SRC[0]);
ok('family chip Phi Phi → GET /v1/dashboard?mode=month&family=phiphi · the grid shows that answer (T0 closed for the family, 26 Oct cap 38)', famCalls.some((c) => /mode=month/.test(c) && /family=phiphi/.test(c)) && sameCells(scr5, srvPhi.days) && phi26.cap === 38 && srvPhi.days.find((d) => d.date === T0).state === 'none', { famCalls, scr: scr5.slice(19, 27), srv: srvPhi.days.slice(19, 27) });
await page.locator('[onclick="dashCalSetFam(\'\')"]').click(); await settle(600);
// pier ticker: the sums feed tickerCells, which nothing draws
const fs5 = await import('node:fs');
const core = fs5.readFileSync(path.join(HERE, '../../allotment_v2/js/04-data-core.js'), 'utf8');
const uses = (core.match(/tickerCells/g) || []).length;
const dashTxt = await ev(() => document.getElementById('dash-wrap').innerText);
console.log(`   ticker: 'tickerCells' appears ${uses}x in 04-data-core.js (declaration only) · dashboard text has a TL/VP/RN ticker: ${/\bVP\b.*\bRN\b/s.test(dashTxt)}`);
ok('pier ticker (TL / VP / RN, today vs yesterday) is NOT-REACHABLE: tickerCells is declared and never read, so nothing on screen shows it', uses === 1, { uses });

console.log('\n[6] Boat Operation · Early / Normal · bulk copy with a closed day · capacity override');
const depsOf = async (from, to) => (await api(`/operations/deployments?from=${from}&to=${to}`)).deployments;
// Early / Normal: the pick sits on the cell (TRIPS[date][boat].type) and ends in save('operations'); the portal that offered it
// (openPortal 'type' on #matrix-tbl) is not drawn by any screen any more, so the pick is set on the cell, as t_ops does for assign.
const E1 = '2026-10-30', E2 = '2026-10-31';
await ev((a) => { TRIPS[a.E1] = TRIPS[a.E1] || {}; TRIPS[a.E1].b7 = { route: 'r5', type: 'early', booked: 0 }; TRIPS[a.E2] = TRIPS[a.E2] || {}; TRIPS[a.E2].b7 = { route: 'r5', type: 'normal', booked: 0 }; save('operations'); }, { E1, E2 });
await settle(); await idle();
let dd = await depsOf(E1, E2);
ok('new deployment picked Early → trip_type early on the server · a Normal one is stored as normal (or the route default)', dd.find((x) => x.service_date === E1).trip_type === 'early' && ['normal', null, undefined].includes(dd.find((x) => x.service_date === E2).trip_type), dd.map((x) => [x.service_date, x.trip_type]));
// change Normal → Early on the stored one: one POST carrying trip_type
const nT = calls.length;
await ev((a) => { TRIPS[a.E2].b7.type = 'early'; save('operations'); }, { E2 });
await settle(); await idle();
dd = await depsOf(E1, E2);
const posts6 = lastCalls(nT).filter((c) => /^POST \/operations\/deployments/.test(c));
ok('Normal → Early on a stored cell → one POST /operations/deployments · server now early', posts6.length === 1 && dd.find((x) => x.service_date === E2).trip_type === 'early', { posts6, dd: dd.map((x) => [x.service_date, x.trip_type]) });
// read side: reload the app, the cells come back with the server's type, and Daily Announcement shows the Early chip
await page.reload(); await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 }); await settle(1200);
s = await ev((a) => ({ e1: TRIPS[a.E1] && TRIPS[a.E1].b7, e2: TRIPS[a.E2] && TRIPS[a.E2].b7 }), { E1, E2 });
ok('after a reload the cells read trip_type from the server (both early)', s.e1 && s.e1.type === 'early' && s.e2 && s.e2.type === 'early', s);
await ev((d) => { daDate = new Date(d + 'T12:00:00'); document.querySelector('.nav-item[data-view="daily"]').click(); }, E1);
await settle(1500);
const daTxt = await ev(() => document.getElementById('view-daily').innerText.replace(/\s+/g, ' '));
ok('Daily Announcement for that day lists the trip with the Early chip', /Early/.test(daTxt) && /Similan Islands by Speedboat/.test(daTxt), daTxt.slice(0, 500));

// bulk form: "Copy view → next week" with the closed day among the targets (r10 closed on CLOSED = SRC[1] + 7)
await ev((a) => { document.querySelector('.nav-item[data-view="operation"]').click(); _bop2.viewMode = 'week'; _bop2.anchor = new Date(2026, 9, 26); renderOp(); }, {});
await settle(800);
const before6 = await depsOf('2026-11-01', '2026-11-07');
const nB = calls.length;
await page.locator('.bo-pier-pill', { hasText: 'Bulk actions' }).first().click();
await page.locator('text=Copy view').first().click();
await settle(); await idle(); await settle(1200);
const after6 = await depsOf('2026-11-01', '2026-11-07');
const T = (d) => after6.filter((x) => x.service_date === d).map((x) => x.boat_id + '>' + x.route_id);
s = await ev((a) => ({ n2: !!(TRIPS['2026-11-02'] || {}).b13, n3: !!(TRIPS[a.CLOSED] || {}).b13, n4: !!(TRIPS['2026-11-04'] || {}).b13,
  toasts: [...document.querySelectorAll('#la-savetoast-wrap > *')].map((t) => t.innerText.replace(/\s+/g, ' ')) }), { CLOSED });
const refused409 = refusals.filter((r) => /route_closed/.test(r));
console.log('   dialogs:', JSON.stringify(dialogs.slice(-3)), '\n   toasts:', JSON.stringify(s.toasts), '\n   after:', JSON.stringify(after6.map((x) => [x.service_date, x.boat_id, x.route_id])));
ok('copy week: server has b13>r10 on Nov 2 and Nov 4, nothing on the closed Nov 3', before6.length === 0 && T('2026-11-02').join() === 'b13>r10' && T('2026-11-04').join() === 'b13>r10' && T(CLOSED).length === 0, { before6, after6 });
ok('copy week: the screen keeps Nov 2 and Nov 4, leaves the closed day out (no rollback of the rest)', s.n2 && s.n4 && !s.n3, s);
ok('exactly one toast, "1 day not saved", with the server\'s closed-day message · one 409 route_closed received', s.toasts.length === 1 && /1 day not saved/.test(s.toasts[0]) && refused409.length === 1, { toasts: s.toasts, refused409 });

// capacity override through the real modal
await ev(() => boatCapModalOpen('b13', '2026-10-26', null), {});
await page.fill('#bcap-val', '30'); await page.fill('#bcap-reason', 'walk');
await page.click('#bcap-host button[onclick^="_bcapSave"]');
await settle(); await idle();
const ovr6 = (await api('/v1/boats/b13/capacity-overrides?from=2026-10-26&to=2026-10-26')).overrides;
const av6 = await api('/v1/availability?route_id=r10&date=2026-10-26');
s = await ev(() => ({ cap: boatCapFor('b13', '2026-10-26'), modal: !!document.querySelector('#bcap-ov') }));
ok('capacity override 30 on b13 (normal 38) → override row on the server · day sells 30 · the deployment keeps 38', ovr6.length === 1 && ovr6[0].capacity === 30 && (await depsOf('2026-10-26', '2026-10-26'))[0].capacity === 38 && av6.deployed_capacity === 30 && s.cap === 30 && !s.modal, { ovr6, av6: av6.deployed_capacity, s });

console.log('\n[7] Fleet daily log pax_booked · boat assignment panels');
await ev(() => { document.querySelector('.nav-item[data-view="dailyreport"]').click(); });
await waitScreen(() => document.getElementById('fl-dr-date'), null, 6000);
await settle(2000);
const dl = await api(`/v1/fleet/daily-log?from=${TODAY}&to=${TODAY}`);
const srvBooked = ((dl.days[0] || {}).boats || []).map((b) => [b.boat_id, b.pax_booked]);
await ev(() => { document.getElementById('fl-dr-date').value = ''; flRenderDR(); });
await settle(500);
await waitScreen((a) => { const sv = SB_BOOKINGS.splice(0); const v = flBoatBookingsFor('b6', a.TODAY).pax; SB_BOOKINGS.push(...sv); return v === 3; }, { TODAY }, 8000);
s = await ev((a) => ({ b6: flBoatBookingsFor('b6', a.TODAY), b7: flBoatBookingsFor('b7', a.TODAY), ds: document.getElementById('fl-dr-date').value }), { TODAY });
ok('server daily log says b6 carries 3 booked pax today', (srvBooked.find((x) => x[0] === 'b6') || [])[1] === 3, srvBooked);
ok('flBoatBookingsFor(b6, today).pax = the server\'s pax_booked (3)', s.b6.pax === 3, { s, srvBooked });
s = await ev((a) => { const saved = SB_BOOKINGS.splice(0); const v = flBoatBookingsFor('b6', a.TODAY).pax; SB_BOOKINGS.push(...saved); return v; }, { TODAY });
ok('with the browser\'s booking rows taken away the count stays the server\'s (legacy would say 0)', s === 3, s);

const rowTxt = await ev(() => { const h = document.getElementById('view-dailyreport').innerText.replace(/\s+/g, ' '); const i = h.indexOf('Zeus'); return i < 0 ? null : h.slice(i, i + 140); });
console.log('   Daily Fleet Log row: ' + JSON.stringify(rowTxt));
ok('the Daily Fleet Log screen draws the Zeus row', rowTxt && /Zeus/.test(rowTxt), rowTxt);

// assignment panels, driven through the real assignment dialog
const asnSave = async (boatId, o) => {
  await ev((id) => flOpenNewAssignment(id), boatId);
  await page.selectOption('#asn-to', o.to);
  await page.fill('#asn-start', o.start);
  if (o.open) { await page.check('#asn-open'); } else await page.fill('#asn-end', o.end);
  await page.fill('#asn-reason', 'walk');
  const n = calls.length;
  await page.click('#fl-modal-assignment button[onclick="flSaveAssignment()"]');
  await idle(); await settle(1500);
  return lastCalls(n);
};
const dayT = TODAY;
const c1 = await asnSave('b1', { to: 'panwa', start: TODAY, end: '2026-10-19' });
const c2 = await asnSave('b7', { to: 'panwa', start: '2026-10-25', end: '2026-10-26' });
const c3 = await asnSave('b13', { to: 'tublamu', start: TODAY, open: true });
const asn = {}; for (const b of ['b1', 'b7', 'b13']) asn[b] = await api(`/v1/boats/${b}/assignments`);
console.log('   server b13 panels:', JSON.stringify({ active: asn.b13.active, open: (asn.b13.assignments || []).map((x) => [x.id, x.start_date, x.end_date, x.open_end, x.status]) }));
console.log('   calls b13:', JSON.stringify(c3.filter((c) => /assign/.test(c))));
s = await ev((a) => { const out = {}; ['b1', 'b7', 'b13'].forEach((id) => { const b = BOATS.find((x) => x.id === id);
  out[id] = { active: (getActiveAssignment(b) || {}).id || null, planned: getPlannedAssignments(b).map((x) => x.id), past: getPastAssignments(b).map((x) => x.id), ends: (b.assignments || []).map((x) => [x.id, asnEndOf(x), asnIsOpen(x)]) }; }); return out; }, {});
ok('b1 (today → 19 Oct): POST /v1/boats/b1/assignments · screen active = server active', c1.some((c) => /^POST \/v1\/boats\/b1\/assignments/.test(c)) && asn.b1.active && s.b1.active === asn.b1.active.id, { c1, srv: asn.b1.active, scr: s.b1 });
ok('b7 (25 → 26 Oct): screen planned = server planned, nothing active', asn.b7.planned.length === 1 && JSON.stringify(s.b7.planned) === JSON.stringify(asn.b7.planned.map((x) => x.id)) && s.b7.active === null, { srv: asn.b7.planned, scr: s.b7 });
const openSrv = (asn.b13.assignments || []).find((x) => x.open_end);
ok('b13 with "return date not known" ticked: the server holds an open-ended assignment', !!openSrv, { c3, asn: asn.b13.assignments });
if (openSrv) ok('asnEndOf / asnIsOpen: open end is 9999-12-31 and open on screen', s.b13.ends.some((e) => e[0] === openSrv.id && e[1] === '9999-12-31' && e[2] === true), s.b13);

//PROBE

await browser.close(); srv.close(); backend.kill();
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
