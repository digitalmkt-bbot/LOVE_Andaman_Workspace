// t_walk_booking · BROWSER walk-through of the wired BOOKINGS screens against a real seeded operation-backend
//
//   node test/ui/t_walk_booking.mjs      (OPS_BACKEND_DIR, default D:/projects/operation-backend)
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
const calls = [], refusals = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
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

let s, r;

console.log('\n[1] confirm a booking that lacks required fields → 400 booking_incomplete');
{
  // The client's own "Cannot save" guard (bookingV2CommitBooking) refuses the same list first, so the server's 400 is
  // reached only when the client believes the booking is whole. The form says "No Transfer" for the pickup (pickupZoneFilter)
  // while the trip's zone is a hotel-pickup zone (PK): the client lets it through, the server finds no pickup and no self-arrive
  // trip. A create with intent confirm is stored as sent (the gate is the /confirm command), so: save a quote, then Submit it.
  await form({ lead: 'ZZ INCOMPLETE', date: F1, zone: 'PK', zoneFilter: 'NoTransfer', self: false, status: 'quote' });
  await waitScreen(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ INCOMPLETE'); return b && b.opsId; }, null, 15000); await idle();
  let sb1 = await srvBy('ZZ INCOMPLETE');
  ok('saved as a quote on the server (a quote need not be whole)', sb1 && sb1.status === 'quote' && sb1.status === 'quote', sb1 && { st: sb1.status, inc: sb1.incomplete });
  const bid = await ev(() => SB_BOOKINGS.find((x) => x.leadPax === 'ZZ INCOMPLETE').id);
  const nDlg = dialogs.length, nRef = refusals.length;
  await ev((id) => { bookingV2EditBooking(id); _bkV2.newBooking.pickupZoneFilter = 'NoTransfer'; bookingV2CommitBooking('confirmed'); }, bid);
  await waitScreen((n) => true, null, 100);
  const gotAlert = async () => dialogs.slice(nDlg).some((d) => /^alert: Cannot confirm/.test(d));
  for (let i = 0; i < 30 && !(await gotAlert()); i++) await settle(300);
  await idle(); await settle(800);
  const al = dialogs.slice(nDlg).find((d) => /^alert: Cannot confirm/.test(d));
  sb1 = await srvBy('ZZ INCOMPLETE');
  s = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return { status: b.status, form: !!_bkV2.newBooking, inc: b.incomplete || null }; }, bid);
  ok('server answered 400 booking_incomplete on the confirm', refusals.slice(nRef).some((x) => /\/confirm → 400/.test(x) && /booking_incomplete/.test(x)), refusals.slice(nRef));
  ok('screen alert lists the server\'s message (pickup)', !!al && /Hotel \/ pickup location: needed before confirming/.test(al), dialogs.slice(nDlg));
  ok('server still holds a quote · the screen booking was reloaded (quote, form reopened)', sb1.status === 'quote' && s.status === 'quote', { sb1: sb1.status, s });
}


console.log('\n[2] "Save Draft" on a live booking → POST /unconfirm');
{
  await form({ lead: 'ZZ DRAFT', date: F2 });
  await waitScreen(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ DRAFT'); return b && b.opsId; }, null, 15000); await idle();
  let sb2 = await srvBy('ZZ DRAFT');
  ok('start: the server holds it confirmed', sb2 && sb2.status === 'confirmed', sb2 && sb2.status);
  const bid = await ev(() => SB_BOOKINGS.find((x) => x.leadPax === 'ZZ DRAFT').id);
  await ev((id) => { _bkV2.newBooking = null; bookingV2EditBooking(id); }, bid);
  await settle(500);
  const nC = calls.length, nD = dialogs.length;
  await page.locator('button[onclick="bookingV2SaveDraft()"]').click();      // the real button
  await waitScreen((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return b && b.status === 'quote'; }, bid, 15000); await idle();
  sb2 = await srvBy('ZZ DRAFT');
  const c2 = calls.slice(nC).filter((c) => !/^GET /.test(c)).map((c) => c.replace(/booking_[0-9a-f-]+/, '{id}'));
  s = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return { status: b.status }; }, bid);
  ok('legacy\'s "downgrade to quote?" confirm was asked', dialogs.slice(nD).some((d) => /^confirm: booking นี้สถานะ "confirmed"/.test(d)), dialogs.slice(nD));
  ok('writes: PATCH then POST /unconfirm', c2.includes('POST /v1/bookings/{id}/unconfirm') && c2[0] === 'PATCH /v1/bookings/{id}', c2);
  ok('server status is now quote · the screen agrees', sb2.status === 'quote' && s.status === 'quote', { server: sb2.status, screen: s.status });
  await ev(() => { _bkV2.newBooking = null; bookingV2Render(); });
}

console.log('\n[3] duplicate voucher from another month');
{
  await apiBook({ voucherRef: 'VCH-DUP-1', leadPax: 'ZZ OTHER MONTH 1', trip: { date: DEC } });
  await apiBook({ voucherRef: 'VCH-DUP-2', leadPax: 'ZZ OTHER MONTH 2', trip: { date: DEC } });
  s = await ev(() => SB_BOOKINGS.some((b) => /^VCH-DUP/.test(b.voucherRef || '')));
  ok('start: the app has not loaded the December bookings', s === false, s);
  // typing
  await ev(() => { _bkV2.newBooking = null; bookingV2NewBooking(); });
  const nC = calls.length;
  await page.locator('input[placeholder^="e.g. AT-VC"]').pressSequentially('VCH-DUP-1', { delay: 15 });
  const warned = await waitScreen(() => /เลข Voucher นี้มีอยู่แล้ว: ZZ OTHER MONTH 1/.test((document.getElementById('bkv2-voucher-dup-warn') || {}).innerText || ''), null, 8000);
  const q3 = calls.slice(nC).filter((c) => /voucher_ref=/.test(c));
  ok('typing a used voucher shows the duplicate warning under the field (found by GET /v1/bookings?voucher_ref=)', warned && q3.some((c) => /^GET \/v1\/bookings\?.*voucher_ref=VCH-DUP-1/.test(c)), { warned, q3, txt: await ev(() => (document.getElementById('bkv2-voucher-dup-warn') || {}).innerText) });
  // the save waits for one check
  await ev(() => { _bkV2.newBooking = null; });
  answer.confirm = false;
  const nD = dialogs.length, nC2 = calls.length;
  await form({ lead: 'ZZ DUPV', date: F3, voucher: 'VCH-DUP-2' });
  for (let i = 0; i < 20 && !dialogs.slice(nD).some((d) => /พบ booking ที่อาจซ้ำ/.test(d)); i++) await settle(250);
  await settle(800); await idle();
  const d3 = dialogs.slice(nD).find((d) => /พบ booking ที่อาจซ้ำ/.test(d));
  const seq3 = calls.slice(nC2).filter((c) => /voucher_ref=VCH-DUP-2|^POST \/v1\/bookings$/.test(c));
  ok('save asked the server about the voucher first (one GET), before any POST', seq3.filter((c) => /voucher_ref=/.test(c)).length === 1 && !seq3.includes('POST /v1/bookings'), seq3);
  ok('duplicate question names the other-month booking', !!d3 && /ZZ OTHER MONTH 2/.test(d3), dialogs.slice(nD));
  ok('answered No → nothing saved on the server · form still open', (await srvBy('ZZ DUPV')) === null && await ev(() => !!_bkV2.newBooking), null);
  answer.confirm = true;
  await ev(() => bookingV2CommitBooking('confirmed'));
  await waitScreen(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ DUPV'); return b && b.opsId; }, null, 15000); await idle();
  const sv = await srvBy('ZZ DUPV');
  ok('answered Yes → saved with the voucher', sv && sv.voucher_ref === 'VCH-DUP-2', sv && sv.voucher_ref);
}

console.log('\n[4] a custom nationality from the dropdown');
{
  await ev(() => { _bkV2.newBooking = null; bookingV2NewBooking(); });
  const nC = calls.length;
  await page.locator('#bkv2-nat-input-lead').fill('Zzlandic');
  await page.locator('.bkv2-nat-addnew').click();
  await waitScreen(() => (_bkV2.newBooking || {}).leadNationality && (_bkV2.newBooking || {}).leadNationality !== 'RU', null, 8000); await idle();
  const list = (await api('/v1/nationalities')).nationalities;
  const row = list.find((n) => n.custom && /zzlandic/i.test(n.name));
  s = await ev(() => ({ picked: _bkV2.newBooking.leadNationality, shown: document.getElementById('bkv2-nat-input-lead').value, inList: SB_CUSTOM_NATIONALITIES.map((n) => n.code) }));
  ok('POST /v1/nationalities was sent', calls.slice(nC).includes('POST /v1/nationalities'), calls.slice(nC));
  ok('the server holds it as a custom row', !!row, list.filter((n) => n.custom));
  ok('the picker took the server\'s code · the field shows its name', row && s.picked === row.code && /zzlandic/i.test(s.shown) && s.inList.includes(row.code), { s, row });
  await ev(() => { _bkV2.newBooking = null; });
  await page.reload(); await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 }); await settle(1200);
  s = await ev((c) => ({ has: SB_CUSTOM_NATIONALITIES.some((n) => n.code === c), label: typeof bookingV2NatDDLabel === 'function' ? bookingV2NatDDLabel(c) : null, all: bookingV2AllNats().some((n) => n.code === c) }), row && row.code);
  ok('after a reload it is still in the list and in the dropdown', s.has && s.all && /zzlandic/i.test(s.label || ''), s);
}

console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
await browser.close(); srv.close(); backend.kill();
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
