// t_walk_booking2 · BROWSER walk-through of the wave-3 booking form + By-trip wiring (Q43 Q44 Q45 Q47 Q51)
//
//   node test/ui/t_walk_booking2.mjs      (OPS_BACKEND_DIR, default D:/projects/operation-backend)
//
// Same method as t_ops.mjs: the app's calls to the production URL go to a local in-process backend
// (test/helpers/ops-backend-local.mjs). Each item drives the REAL UI and reads BOTH sides: the screen
// and what the server holds (asked directly, not through the app). Fixed dates (Nov/Dec 2026), so the
// result does not depend on the clock.
//
//   [1] booking_incomplete     [2] Save Draft → /unconfirm     [3] duplicate voucher    [4] custom nationality
//   [5] NO RATE ← quote        [6] cancel reasons / cancels    [7] B2C review           [8] 409 cancelled edits
//   [9] programme_anyway · route_closed                         [10] nationality_effective in Market Data
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
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const loginAs = async (username, password) => (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) })).json()).access_token;
const token = await loginAs('tester', 'pw');
const raw = async (p, init = {}, tok = token) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json', ...(init.headers || {}) } });
  const text = r.status === 204 ? '' : await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await raw(p, init)).body;
const post = (p, b, tok) => raw(p, { method: 'POST', body: JSON.stringify(b || {}) }, tok);

// ── app ──
const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], quotes = [], posted = [];
const hook = { offlineReserve: false, doctorByTrip: null };
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  if (hook.offlineReserve && u.pathname === '/v1/bookings/reserve-code') return route.abort();
  if (req.method() === 'POST' && (u.pathname === '/v1/bookings' || /partial-cancel/.test(u.pathname))) { try { posted.push({ path: u.pathname, body: JSON.parse(req.postData() || '{}') }); } catch (_) {} }
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (hook.doctorByTrip && u.pathname === '/operations/by-trip' && r.status === 200) { const j = JSON.parse(buf.toString()); hook.doctorByTrip(j); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(j) }); }
  if (u.pathname === '/v1/quote') quotes.push({ status: r.status, res: (() => { try { return JSON.parse(buf.toString()); } catch (_) { return null; } })() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' → ' + r.status + ' ' + buf.toString().slice(0, 300));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [], warns = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300));
  if (m.type() === 'warning' && /^\[ops\]/.test(m.text())) warns.push(m.text().slice(0, 400));
});
// every dialog is answered and recorded · the answer can be steered per test with `answer.next`
const answer = { confirm: true };
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); d.type() === 'prompt' ? d.accept('Tester') : (d.type() === 'confirm' && !answer.confirm ? d.dismiss() : d.accept()); });

const fails = [], notes = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got).slice(0, 600))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitScreen = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const dlg = (re) => dialogs.filter((d) => re.test(d));

// ── fixed dates · all after 2026-10-17 ──
const F1 = '2026-11-10', F2 = '2026-11-11', F3 = '2026-11-12', F4 = '2026-11-13', DEC = '2026-12-20';
const dep = (boat, route, date, capacity = 40) => api('/operations/deployments', { method: 'POST', body: JSON.stringify({ boat_id: boat, route_id: route, service_date: date, capacity }) });
for (const d of [F1, F2, F3, DEC]) await dep('b6', 'r5', d);
await dep('b1', 'r4', F1, 64);
await dep('b13', 'r10', F4, 38);

// a booking made straight through the API (the "other client")
let seq = 0;
const apiBook = (o) => post('/v1/bookings', {
  external_id: 'zz-walk-' + (++seq), intent: 'confirm', agentId: 'a01', leadPax: 'ZZ API', leadNationality: 'RU', pickupSelf: true,
  guides: { english: true }, ...o, trips: [{ routeId: 'r5', date: F1, pax: { ad_fr: 1 }, zone: 'NoTransfer', ...(o.trip || {}) }] });

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1200);

// the form, driven through its own setters (as t_ops [4]) and committed with the real commit
const form = (o) => ev((o) => {
  bookingV2NewBooking();
  const d = _bkV2.newBooking;
  if (o.agent !== null) bookingV2SetBookingField('agentId', o.agent || 'a01');
  Object.assign(d, { leadPax: o.lead, leadNationality: o.nat === undefined ? 'RU' : o.nat, leadPhone: '+7 900 000', hotelName: o.hotel || '', voucherRef: o.voucher || '' });
  if (o.zoneFilter !== null) d.pickupZoneFilter = o.zoneFilter || 'NoTransfer';
  d.pickupSelf = o.self !== false;
  d.guides = o.guides || { english: true, russian: false, chinese: false, otherLang: '' };
  d.trips = (o.trips || [{}]).map((t) => Object.assign(bookingV2NewTrip(), { routeId: 'r5', date: o.date, pax: { ad_fr: o.pax || 1 }, zone: o.zone || 'NoTransfer' }, t));
  if (o.commit !== false) bookingV2CommitBooking(o.status || 'confirmed');
}, o);
const srvBy = async (lead) => ((await api('/v1/bookings?q=' + encodeURIComponent(lead))).bookings || [])[0] || null;
const scr = (lead) => ev((l) => { const b = SB_BOOKINGS.find((x) => x.leadPax === l); return b && { id: b.id, opsId: b.opsId, status: b.status, total: b.total }; }, lead);


// ── helpers of this walk ──
const waitCall = async (re, from = 0, ms = 8000) => { for (let t = 0; t < ms; t += 150) { if (calls.slice(from).some((c) => re.test(c))) return true; await settle(150); } return false; };
const draft = () => ev(() => { const d = _bkV2.newBooking; return d && { code: d.code, trips: d.trips.map((t) => ({ sel: t.lockDrawSel, use: t.lockUse, zone: t.zone })), addOns: d.addOns }; });
const bodyText = () => ev(() => document.body.innerText);
const openDraft = (o) => ev((o) => {
  bookingV2NewBooking();
  const d = _bkV2.newBooking;
  bookingV2SetBookingField('agentId', o.agent || 'a01');
  Object.assign(d, { leadPax: o.lead, leadNationality: 'RU', leadPhone: '+7 900 000', hotelName: '', voucherRef: '' });
  d.pickupZoneFilter = 'NoTransfer'; d.pickupSelf = true;
  d.guides = { english: true, russian: false, chinese: false, otherLang: '' };
  d.trips = (o.trips || [{}]).map((t) => Object.assign(bookingV2NewTrip(), { routeId: 'r5', date: o.date, pax: { ad_fr: o.pax || 1 }, zone: o.zone || 'NoTransfer' }, t));
  bookingV2Render();
}, o);
const fillDraft = (lead, date) => ev(([lead, date]) => {
  const d = _bkV2.newBooking; bookingV2SetBookingField('agentId', 'a01');
  Object.assign(d, { leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 000' });
  d.pickupZoneFilter = 'NoTransfer'; d.pickupSelf = true; d.guides = { english: true };
  d.trips = [Object.assign(bookingV2NewTrip(), { routeId: 'r5', date, pax: { ad_fr: 1 }, zone: 'NoTransfer' })];
}, [lead, date]);
const onScreen = (lead) => waitScreen((l) => { const b = SB_BOOKINGS.find((x) => x.leadPax === l); return b && b.opsId; }, lead, 15000);

// ── seed (after the app loaded): agent a01 holds a day lock of 8 on F1 with a sub-group A of 3 ──
const lockF1 = (await post('/v1/seat-locks', { route_id: 'r5', service_date: F1, pax: 8, holder_type: 'agent', agent_id: 'a01' })).body;
const subA = await raw(`/v1/seat-locks/${lockF1.id}/sub-groups`, { method: 'POST', headers: { 'if-match': '"' + lockF1.version + '"' }, body: JSON.stringify({ sub_name: 'A', pax: 3 }) });
console.log('seed: lock', lockF1.id, 'sub-group', subA.status);
await ev(() => laOps.locks.reload()); await idle();

console.log('\n[Q43] lock draws · POST /v1/quote/lock-draws');
let bk43;
{
  const n0 = calls.length;
  await openDraft({ lead: 'ZZ LOCKS', date: F1, pax: 4 });
  const asked = await waitCall(/POST \/v1\/quote\/lock-draws/, n0);
  ok('opening the form with an agent and a trip asks POST /v1/quote/lock-draws', asked, calls.slice(n0));
  await settle(600);
  const direct = (await post('/v1/quote/lock-draws', { agentId: 'a01', trips: [{ routeId: 'r5', date: F1, pax: { ad_fr: 4 } }] })).body;
  const srv = direct.trips[0].lock_draws;
  console.log('    server sources:', JSON.stringify(srv.sources.map((x) => [x.label, x.kind, x.remaining])), 'proposed_total', srv.proposed_total);
  const scr = await ev((d) => bookingV2DrawSources('r5', d, 'a01').map((x) => [x.label, x.remaining]), F1);
  ok('the screen lists the server\'s sources, in the server\'s order, with its labels and seats left', JSON.stringify(scr) === JSON.stringify(srv.sources.map((x) => [x.label, x.remaining])) && scr.length >= 2, { scr, srv: srv.sources });
  const txt = await bodyText();
  const warn = srv.warning;
  ok('the "free but none drawn" banner shows the server\'s Thai warning text', !!warn && txt.includes(warn.message), { warn, has: txt.includes('อย่าลืมใช้ seat lock') });
  await ev(() => bookingV2AutoDrawLocks(0)); await settle(800);
  const dr = await draft();
  const proposed = Object.values(srv.proposed_draws).reduce((a, b) => a + b, 0);
  ok('"ใช้ lock ก่อน" draws the server\'s proposal (' + proposed + ' seats from the server\'s sources)', dr.trips[0].use === srv.proposed_total && proposed === srv.proposed_total && Object.keys(dr.trips[0].sel || {}).length === srv.proposed.length, { dr, srv: srv.proposed });
  const txt2 = await bodyText();
  ok('the banner is the "locked seats" one now (drawn), not the warning', !txt2.includes(warn.message), null);
  // save: staff choice goes in lock_draws
  await ev(() => bookingV2CommitBooking('confirmed'));
  await onScreen('ZZ LOCKS'); await idle();
  bk43 = await srvBy('ZZ LOCKS');
  const drawn = bk43 && Object.values(bk43.trips[0].lock_draws || {}).reduce((a, b) => a + b, 0);
  ok('the save sent the draw and the server holds it (lock_draws total = the proposal)', drawn === srv.proposed_total, { drawn, trips: bk43 && bk43.trips[0].lock_draws, ref: refusals.slice(-2) });
  // edit: the booking's own draws are given back
  const lid = await ev(() => SB_BOOKINGS.find((x) => x.leadPax === 'ZZ LOCKS').id);
  const n1 = calls.length;
  await ev((id) => bookingV2EditBooking(id), lid);
  await waitCall(/POST \/v1\/quote\/lock-draws/, n1); await settle(600);
  const own = (await post('/v1/quote/lock-draws', { bookingId: bk43.id, agentId: 'a01', trips: [{ id: bk43.trips[0].id, routeId: 'r5', date: F1, pax: { ad_fr: 4 } }] })).body.trips[0].lock_draws;
  const scrOwn = await ev((d) => bookingV2DrawSources('r5', d, 'a01').map((x) => [x.label, x.remaining]), F1);
  const sentBid = await ev(() => Object.keys(laOps.lockDraws._cache).some((k) => /"bookingId":"/.test(k)));
  ok('editing: the sources give back the booking\'s own draws (the request carries booking_id)', JSON.stringify(scrOwn) === JSON.stringify(own.sources.map((x) => [x.label, x.remaining])) && own.free_total > srv.free_total - srv.proposed_total && sentBid, { scrOwn, own: own.sources, sentBid });
  await ev(() => { _bkV2.newBooking = null; _bkV2.editingId = null; bookingV2Render(); });
}

console.log('\n[Q44] private van → No-Transfer seat · 400 private_van_transfer');
{
  const VAN = 'transfer-r5-PK-van';
  const direct = await post('/v1/quote', { agentId: 'a01', trips: [{ routeId: 'r5', date: F2, pax: { ad_fr: 2 }, zone: 'PK' }], addOns: [{ type: VAN }] });
  ok('(server) a PK seat with a private van is 400 private_van_transfer, with its message', direct.status === 400 && direct.body.code === 'private_van_transfer' && !!direct.body.message, direct);
  console.log('    server message:', direct.body && direct.body.message);
  await openDraft({ lead: 'ZZ VAN', date: F2, pax: 2, zone: 'PK' });
  const added = await ev((t) => { bookingV2ToggleAddOn(t); const d = _bkV2.newBooking; return { add: d.addOns.map((a) => a.type), zone: d.trips[0].zone }; }, VAN);
  ok('ticking the private van puts the seat on NoTransfer (legacy)', added.add.includes(VAN) && added.zone === 'NoTransfer', added);
  // a later step puts the old zone back (an edit of an imported booking, a pickup-area change): the send must still say NoTransfer
  const req = await ev(() => { _bkV2.newBooking.trips[0].zone = 'PK'; const r = laOpsQuote.buildRequest(_bkV2.newBooking, {}); return r && r.body.trips.map((t) => t.zone); });
  ok('the quote request sends NoTransfer, not the old PK zone', JSON.stringify(req) === JSON.stringify(['NoTransfer']), req);
  const nPost = posted.length, nRef = refusals.length;
  await ev(() => { _bkV2.newBooking.trips[0].zone = 'PK'; bookingV2CommitBooking('quote'); });
  await onScreen('ZZ VAN'); await idle();
  const sb = await srvBy('ZZ VAN');
  const sent = posted.slice(nPost).find((p) => p.path === '/v1/bookings');
  ok('the save sent zone NoTransfer for the van trip · no 400 · the server holds NoTransfer', !!sb && sent && sent.body.trips[0].zone === 'NoTransfer' && sb.trips[0].zone === 'NoTransfer' && !refusals.slice(nRef).some((x) => /private_van_transfer/.test(x)), { sent: sent && sent.body.trips, sb: sb && sb.trips[0].zone, ref: refusals.slice(nRef) });
}

console.log('\n[Q45] booking code · POST /v1/bookings/reserve-code');
{
  const n0 = calls.length;
  await ev(() => bookingV2NewBooking());
  ok('opening the form asks POST /v1/bookings/reserve-code', await waitCall(/POST \/v1\/bookings\/reserve-code/, n0), calls.slice(n0));
  await settle(500);
  const c1 = (await draft()).code;
  ok('the form shows the server\'s code (BK-YYMMNNNN, no random suffix), not a browser-made one', /^BK-\d{6,}$/.test(c1), c1);
  await fillDraft('ZZ CODE', F2);
  const nPost = posted.length;
  await ev(() => bookingV2CommitBooking('quote'));
  await onScreen('ZZ CODE'); await idle();
  const sb = await srvBy('ZZ CODE'); const sent = posted.slice(nPost).find((p) => p.path === '/v1/bookings');
  ok('the create sent the reserved code as `code` · the server booking has it', sent && sent.body.code === c1 && sb && sb.code === c1, { sent: sent && sent.body.code, code: sb && sb.code, c1 });

  // offline: the answer never comes → the local code stays and is NOT sent as a reserved code
  hook.offlineReserve = true;
  await ev(() => bookingV2NewBooking()); await settle(700);
  const c2 = (await draft()).code;
  ok('offline: the form keeps legacy\'s locally made code (BK-YYMMNNNN-XXXX)', /^BK-\d{4}\d{4}-[A-Z0-9]{4}$/.test(c2), c2);
  await fillDraft('ZZ OFFCODE', F2);
  const nP2 = posted.length;
  await ev(() => bookingV2CommitBooking('quote'));
  await onScreen('ZZ OFFCODE'); await idle();
  hook.offlineReserve = false;
  const sb2 = await srvBy('ZZ OFFCODE'); const sent2 = posted.slice(nP2).find((p) => p.path === '/v1/bookings');
  ok('offline: the create sends no `code` · the server numbered the booking itself', sent2 && sent2.body.code === undefined && sb2 && sb2.code !== c2 && /^BK-\d{6,}$/.test(sb2.code), { sent: sent2 && sent2.body.code, code: sb2 && sb2.code });

  // 409 code_used: someone else's create took the reserved code while the form was open
  await ev(() => bookingV2NewBooking()); await settle(700);
  const c3 = (await draft()).code;
  const taken = await post('/v1/bookings', { external_id: 'zz-taken', intent: 'quote', code: c3, agentId: 'a01', leadPax: 'ZZ TAKEN', leadNationality: 'RU', pickupSelf: true, guides: { english: true }, trips: [{ routeId: 'r5', date: F2, pax: { ad_fr: 1 }, zone: 'NoTransfer' }] });
  ok('setup: the reserved code was used by another create', taken.status === 201 && taken.body.code === c3, taken);
  await fillDraft('ZZ REUSED', F2);
  const nW = warns.length;
  await ev(() => bookingV2CommitBooking('quote'));
  for (let i = 0; i < 40 && !refusals.some((x) => /code_used/.test(x)); i++) await settle(250);
  await idle(); await settle(1200);
  const refused = refusals.find((x) => /code_used/.test(x));
  ok('409 code_used came back and the screen showed the server\'s message', !!refused && /→ 409/.test(refused) && warns.slice(nW).some((w) => /Booking not saved/.test(w) && /used|code/i.test(w)), { ref: refused, warns: warns.slice(nW) });
  console.log('    shown:', warns.slice(nW).filter((w) => /Booking not saved/.test(w))[0]);
  const c4 = ((await draft()) || {}).code;
  ok('the open form got a new reserved code', !!c4 && c4 !== c3 && /^BK-\d{6,}$/.test(c4), { c3, c4 });
  await ev(() => bookingV2CommitBooking('quote'));
  await onScreen('ZZ REUSED'); await idle();
  const sb4 = await srvBy('ZZ REUSED');
  ok('saving again works with the new code', sb4 && sb4.code === c4, { sb4: sb4 && sb4.code, c4 });
  // the other refusal, straight from the server (the app never sends an unreserved code)
  const nr = await post('/v1/bookings', { external_id: 'zz-nr', intent: 'quote', code: 'BK-26109999', agentId: 'a01', leadPax: 'ZZ NR', leadNationality: 'RU', pickupSelf: true, guides: { english: true }, trips: [{ routeId: 'r5', date: F2, pax: { ad_fr: 1 }, zone: 'NoTransfer' }] });
  ok('(server) a code nobody reserved is 400 code_not_reserved', nr.status === 400 && nr.body.code === 'code_not_reserved', nr);
}

console.log('\n[Q47] By-trip counts · GET /operations/by-trip');
{
  const F = F3;
  const a = await apiBook({ leadPax: 'ZZ BT1', trip: { date: F, pax: { ad_fr: 3, chd_fr: 1 } }, guides: { english: true, russian: true }, specialMeals: { veg: 2, halal: 1 } });
  const b = await apiBook({ leadPax: 'ZZ BT2', trip: { date: F, pax: { ad_fr: 2 } }, guides: { chinese: true } });
  ok('setup: two bookings on ' + F, a.status === 201 && b.status === 201, { a: a.body, b: b.body });
  await ev((F) => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = F; try { bookingV2Tab2PickDay(F); } catch (_) {} bookingV2Render(); }, F);
  ok('the By-trip page asked GET /operations/by-trip?date=' + F, await waitCall(new RegExp('GET /operations/by-trip\\?date=' + F), 0), calls.filter((c) => /by-trip/.test(c)));
  await settle(1200);
  const srv = await api('/operations/by-trip?date=' + F);
  const read = () => ev(() => ({ tot: (document.querySelector('.bt-daytot') || {}).textContent, prep: [...document.querySelectorAll('.bt-prep')].map((x) => x.textContent), notice: (document.querySelector('.bt-notice') || {}).textContent, modes: [...document.querySelectorAll('.bt-mc')].map((x) => x.textContent) }));
  let scr = await read();
  console.log('    day:', JSON.stringify(srv.day), '\n    screen:', JSON.stringify(scr.tot));
  ok('the day header = the server\'s day (bookings and pax)', scr.tot && scr.tot.includes(srv.day.bookings + ' booking') && scr.tot.includes(String(srv.day.pax.total) + ' pax'), { tot: scr.tot, day: srv.day });
  const r5 = srv.routes.find((r) => r.route_id === 'r5');
  const pj = scr.prep.join('|');
  ok('the prep chips = the server\'s prep (EN/RU/CN heads, veg, halal)', pj.includes('EN · ' + r5.prep.languages.EN) && pj.includes('CN · ' + r5.prep.languages.CN) && pj.includes(r5.prep.veg + ' veg') && pj.includes(r5.prep.halal + ' halal'), { prep: scr.prep, srv: r5.prep });
  ok('the Boat "not assigned" figure = the server\'s warnings.boat.bookings', scr.modes.some((m) => /Boat/.test(m) && m.includes(String(srv.warnings.boat.bookings))) && srv.warnings.boat.bookings >= 2, { modes: scr.modes, w: srv.warnings });
  // proof the page does not count: the answer is doctored, the page shows the doctored numbers
  hook.doctorByTrip = (j) => {
    j.day.bookings = 77; j.day.pax = { ad: 61, chd: 9, inf: 5, foc: 2, total: 77 }; j.warnings.boat.bookings = 13; j.warnings.van.bookings = 11; j.day.pending_approval = { bookings: 4, pax: 8 };
    const r = j.routes.find((x) => x.route_id === 'r5'); if (r) { r.prep.languages = { EN: 99 }; r.prep.veg = 55; }
  };
  await ev(() => { Object.values(laOpsByTrip._cache).forEach((e) => { e.stale = true; }); bookingV2Render(); });
  await settle(1500); scr = await read();
  ok('doctored answer (77 bookings, 13 without a boat, 11 without a van, 4 pending): the page draws the server\'s figures, it counts nothing',
    scr.tot.includes('77') && scr.tot.includes('61A') && scr.modes.some((m) => /Boat/.test(m) && m.includes('13')) && scr.modes.some((m) => /Van/.test(m) && m.includes('11')) && /Pending approval.*4 booking/.test(scr.notice || '') && scr.prep.join('|').includes('EN · 99') && scr.prep.join('|').includes('55 veg'), scr);
  hook.doctorByTrip = null;
  // City Tour page asks with land=true
  const nL = calls.length;
  await ev(() => { _bkV2CityTourOnly = true; bookingV2Render(); }); await settle(1200);
  const asked = calls.slice(nL).some((c) => new RegExp('by-trip\\?date=' + F + '&land=true').test(c));
  await ev(() => { _bkV2CityTourOnly = false; bookingV2Render(); });
  ok('the City Tour page asks with land=true', asked, calls.slice(nL));
  await ev(() => { _bkV2.tab = 'new'; bookingV2Render(); });
}

console.log('\n[Q51] partial cancel · preview, fee range, read-only refund');
{
  const mk = await apiBook({ leadPax: 'ZZ PARTIAL', trip: { date: F2, pax: { ad_fr: 4 } } });
  ok('setup: a 4-pax booking', mk.status === 201 && mk.body.trips, mk);
  const sb = mk.body, perPax = Math.round((sb.price_seat ?? sb.total) / 4);
  await ev((id) => laOps.bookings.reload(id), sb.id);
  await waitScreen((id) => SB_BOOKINGS.some((b) => b.opsId === id && b.trips[0].opsTripId), sb.id, 8000);
  const bid = await ev((id) => SB_BOOKINGS.find((b) => b.opsId === id).id, sb.id);
  await ev((bid) => bookingV2PartialModal(bid, 0), bid);
  const ro = await ev(() => { const w = document.getElementById('bkp-waive-amt'); return w && { ro: w.readOnly }; });
  ok('the refund box is READ-ONLY', ro && ro.ro === true, ro);
  const n0 = calls.length;
  await ev(() => { document.getElementById('bkp-rm-ad_fr').value = '2'; document.getElementById('bkp-chg-cnt').value = '1'; bookingV2PartialRecalc(); });
  ok('typing the numbers asks POST …/partial-cancel/preview', await waitCall(/POST \/v1\/bookings\/.+\/partial-cancel\/preview/, n0), calls.slice(n0));
  await settle(700);
  const prev = (await post(`/v1/bookings/${sb.id}/partial-cancel/preview`, { trip_id: sb.trips[0].id, pax: { ad_fr: 2 }, category: 'sick', charged: { count: 1 }, waived: { count: 1 } })).body;
  const box = () => ev(() => ({ chg: document.getElementById('bkp-chg-amt').value, wv: document.getElementById('bkp-waive-amt').value, max: document.getElementById('bkp-chg-amt').max, note: (document.getElementById('bkp-srv-note') || {}).textContent || '' }));
  let bx = await box();
  console.log('    preview:', JSON.stringify(prev.charged), JSON.stringify(prev.waived), 'per_pax', prev.per_pax, ' boxes:', JSON.stringify(bx));
  ok('fee box = the server\'s proposal; refund box = the server\'s figure; max from the server', +bx.chg === prev.charged.amount && +bx.wv === prev.waived.amount && +bx.max === prev.charged.max && prev.per_pax === perPax, { bx, prev });
  // overtype above the range → the server's message under the box
  await ev((v) => { const c = document.getElementById('bkp-chg-amt'); c.value = v; c.dispatchEvent(new Event('input', { bubbles: true })); }, prev.charged.max + 500);
  await settle(1000); bx = await box();
  ok('overtyping above the range shows the server\'s charged_amount_out_of_range message', /between 0 and/.test(bx.note) && bx.note.includes(String(prev.charged.max)), bx);
  // confirm with the out-of-range figure → the server refuses, nothing changes
  await ev(() => { document.getElementById('bkp-cat').value = 'sick'; });
  const nRef = refusals.length;
  await ev((bid) => bookingV2PartialConfirm(bid, 0), bid);
  for (let i = 0; i < 30 && !refusals.slice(nRef).some((x) => /charged_amount_out_of_range/.test(x)); i++) await settle(250);
  await idle();
  const after1 = await api('/v1/bookings/' + sb.id);
  ok('Confirm with a fee above the range: server 400 charged_amount_out_of_range · nothing changed', refusals.slice(nRef).some((x) => /→ 400/.test(x) && /charged_amount_out_of_range/.test(x)) && after1.trips[0].pax_total === 4, { ref: refusals.slice(nRef), pax: after1.trips[0].pax_total });
  // again, with a lowered fee inside the range
  await ev((bid) => bookingV2PartialModal(bid, 0), bid);
  await ev(() => { document.getElementById('bkp-rm-ad_fr').value = '2'; document.getElementById('bkp-chg-cnt').value = '1'; bookingV2PartialRecalc(); });
  await settle(1000);
  const low = Math.max(0, prev.charged.max - 100);
  await ev((v) => { const c = document.getElementById('bkp-chg-amt'); c.value = v; c.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('bkp-cat').value = 'sick'; }, low);
  await settle(800);
  const nP = posted.length;
  await ev((bid) => bookingV2PartialConfirm(bid, 0), bid);
  for (let i = 0; i < 30 && !posted.slice(nP).some((p) => /partial-cancel$/.test(p.path)); i++) await settle(250);
  await idle(); await settle(800);
  const sentP = posted.slice(nP).find((p) => /partial-cancel$/.test(p.path));
  const after2 = await api('/v1/bookings/' + sb.id);
  const rec = (after2.partial_cancels || [])[0];
  console.log('    record:', JSON.stringify(rec), 'keys', Object.keys(after2).filter((k) => /partial|cancel/.test(k)));
  ok('the fee inside the range was sent and recorded; waived.amount was NOT sent; the refund is the server\'s', sentP && sentP.body.charged.amount === low && sentP.body.waived.amount === undefined && rec && rec.charged.amount === low && rec.waived.amount === perPax, { sent: sentP && sentP.body, rec });
}

ok('no page errors', errors.length === 0, errors);
if (notes.length) console.log('\nnotes:\n  ' + notes.join('\n  '));
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
await browser.close(); srv.close(); backend.kill();
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
