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
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + (u.search || ''));
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
await put(`/v1/routes/r10/days/${CLOSED}`, { kind: 'closed' });
for (const d of SRC) await post('/operations/deployments', { boat_id: 'b13', route_id: 'r10', service_date: d, capacity: 38 });
console.log('seed: bulk', bulk.id, bulk.__status || '', '| day', dayLock.id, dayLock.__status || '', '| sub', sub && sub.id, sub && sub.__status || '', '| pend', pendLock.id, pendLock.__status || '', pendLock.pending_pax);

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
const s0 = await ev(() => ({ failed: laOps.state.failed, locks: SB_SEAT_LOCKS.length, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }));
ok('boot: nothing failed, locks loaded', s0.failed.length === 0 && s0.locks >= 4, s0);
console.log('   browser tz', s0.tz);

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
ok('only b7 (placed on r4 that day) cannot be held · its row carries the server\'s own message', rows.filter((r) => !r.ok).map((r) => r.id).join() === 'b7' && rows.filter((r) => !r.ok).every((r) => { const w = opts.find((b) => b.boat_id === r.id).why; return w && r.text.replace(/\s+/g, ' ').includes(w.message.replace(/\s+/g, ' ')); }), { rows });
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

//PROBE
if (process.env.PROBE) {
  console.log(JSON.stringify(await ev(() => SB_SEAT_LOCKS.map((l) => ({ id: l.id, scope: l.scope, status: l.status })))));
}

await browser.close(); srv.close(); backend.kill();
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
