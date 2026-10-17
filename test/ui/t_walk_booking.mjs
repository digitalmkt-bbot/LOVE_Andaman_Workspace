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
const calls = [], refusals = [], quotes = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
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
  ok('server still holds a quote · the screen booking is a quote again · the form is back as it was left', sb1.status === 'quote' && s.status === 'quote' && s.form, { sb1: sb1.status, s });
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


console.log('\n[5] NO RATE trips follow the server quote (POST /v1/quote warnings)');
{
  const probe = async (label, trip, agent = 'a01') => {
    await ev(() => { _bkV2.newBooking = null; });
    const nQ = quotes.length;
    await form({ lead: 'ZZ NORATE', date: trip.date, agent, trips: [trip], commit: false });
    await ev(() => bookingV2Render());
    const got = await waitScreen((n) => window.laOpsQuote && Object.keys(window.laOpsQuote._cache).length > 0 && document.getElementById('nbf-submit-slot'), null, 8000);
    for (let i = 0; i < 40 && quotes.length === nQ; i++) await settle(150);
    await settle(600);
    const q = quotes[quotes.length - 1];
    const w = ((q && q.res && q.res.warnings) || []).filter((x) => x.code === 'no_rate' || x.code === 'not_offered');
    const screen = await ev(() => ({ nr: bookingV2NoRateTrips().map((x) => ({ idx: x.idx, reason: x.reason })), btn: (document.querySelector('#nbf-submit-slot') || {}).innerText || '', band: /NO RATE/i.test((document.getElementById('bkv2-nb-body') || document.body).innerText) }));
    console.log('    ' + label + ': server warnings=' + JSON.stringify(w.map((x) => [x.code, x.trip, x.message])).slice(0, 300) + ' · screen=' + JSON.stringify(screen).slice(0, 300) + ' · quote total=' + (q && q.res && q.res.total));
    return { w, screen, q };
  };
  const a = await probe('r10 not in the agent\'s rate', { routeId: 'r10', date: F4, zone: 'NoTransfer' });
  ok('unrated route: the server warns no_rate / not_offered', a.w.length === 1, a.q && a.q.res);
  ok('screen lists that trip (reason = legacy\'s text when legacy flags it too) · submit button says "No rate · cannot save"', a.screen.nr.length === 1 && /No rate/i.test(a.screen.btn), { screen: a.screen, w: a.w });
  const b = await probe('r4 zone PK (r4 has NoTransfer only)', { routeId: 'r4', date: F1, zone: 'PK' });
  ok('route rated in another zone only: server and screen agree', (b.w.length === 1) === (b.screen.nr.length === 1), { w: b.w, screen: b.screen });
  const c = await probe('r5 NoTransfer (rated)', { routeId: 'r5', date: F1, zone: 'NoTransfer' });
  ok('rated trip: no server warning · no NO RATE · button is the normal Confirm', c.w.length === 0 && c.screen.nr.length === 0 && /Confirm Booking/i.test(c.screen.btn), c);
  // the server is the judge: its rate for r5 loses the PK zone AFTER the app loaded rates. Legacy's own list (the app's copy)
  // still prices PK, the server's quote says not_offered, and the screen must follow the server.
  const rb = await raw('/v1/rate-types/rt001'); const r5 = (rb.body.routes || []).find((x) => x.route_id === 'r5');
  const noPK = { zones: { NoTransfer: r5.zones.NoTransfer } };
  const put = await raw('/v1/rate-types/rt001/routes/r5', { method: 'PUT', body: JSON.stringify(noPK) });
  ok('setup: server rate for r5 now has NoTransfer only', put.status === 200, put);
  const legacyKnows = await ev(() => { const rt = SB_RATE_TYPES.find((x) => x.id === 'rt001'); return JSON.stringify(rt).includes('PK'); });
  const d = await probe('r5 PK after the server dropped it', { routeId: 'r5', date: F1, zone: 'PK' });
  ok('app still holds the old rate (legacy would price PK)', legacyKnows, null);
  ok('server warns · screen flags the trip with the server\'s message · button "No rate"', d.w.length === 1 && d.screen.nr.length === 1 && d.screen.nr[0].reason === d.w[0].message && /No rate/i.test(d.screen.btn), d);
  await raw('/v1/rate-types/rt001/routes/r5', { method: 'PUT', body: JSON.stringify({ zones: r5.zones }) });
  await ev(() => { _bkV2.newBooking = null; bookingV2Render(); });
}


console.log('\n[6] cancel reasons from the server · partial cancel · cancel');
let cx = null;
{
  await form({ lead: 'ZZ CXL', date: F2, pax: 3 });
  await waitScreen(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ CXL'); return b && b.opsId; }, null, 15000); await idle();
  cx = await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ CXL'); return { id: b.id, opsId: b.opsId }; });
  const cats = (await api('/v1/cancel-categories')).categories;
  await ev((id) => bookingV2CancelModal(id), cx.id);
  const opts = await page.$$eval('#bkc-cat option', (os) => os.map((o) => ({ v: o.value, t: o.textContent })).filter((o) => o.v));
  ok('the cancel dialog lists the server\'s reasons, in its order (' + cats.length + ')', JSON.stringify(opts.map((o) => o.v)) === JSON.stringify(cats.map((c) => c.code)) && opts.every((o, i) => o.t.includes(cats[i].en)), { opts: opts.map((o) => o.v), cats: cats.map((c) => c.code) });
  // the reason with a suggested charge pre-selects that charge (legacy `def`)
  const withDef = cats.find((c) => c.default_charge && c.default_charge !== 'none');
  if (withDef) {
    await page.selectOption('#bkc-cat', withDef.code);
    const picked = await ev(() => (document.querySelector('input[name=bkc-charge]:checked') || {}).value);
    ok('picking "' + withDef.code + '" pre-selects its suggested charge "' + withDef.default_charge + '"', picked === withDef.default_charge, { picked, withDef });
  }
  await ev(() => acctModalClose());
  const cancelCat = (cats.find((c) => c.code === 'customer_cancel') || cats[0]).code;

  // partial cancel through the dialog: take 1 of 3 off
  await ev((id) => bookingV2PartialModal(id, 0), cx.id);
  await page.selectOption('#bkp-cat', cancelCat);
  await page.fill('#bkp-note', 'one guest ill');
  await page.fill('#bkp-rm-ad_fr', '1');
  const nC = calls.length;
  await page.click('button[onclick^="bookingV2PartialConfirm"]');
  await waitScreen((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return b && (b.partialCancels || []).length === 1; }, cx.id, 15000); await idle();
  let sb6 = await api('/v1/bookings/' + cx.opsId);
  let h6 = (await api('/v1/bookings/' + cx.opsId + '/history')).history;
  s = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return { pax: b.trips[0].pax, n: (b.partialCancels || []).length, total: b.total }; }, cx.id);
  ok('partial cancel → POST partial-cancel · server pax 2 · one partial_cancels row · screen agrees', calls.slice(nC).some((c) => /POST \/v1\/bookings\/[^/]+\/partial-cancel/.test(c)) && sb6.trips[0].pax_total === 2 && sb6.partial_cancels.length === 1 && s.pax.ad_fr === 2 && s.n === 1, { calls: calls.slice(nC), sb: sb6.trips[0].pax_total, s });
  ok('server history has a line for it', h6.some((h) => /partial/i.test((h.tag || '') + ' ' + (h.kind || '') + ' ' + (h.text || ''))), h6.map((h) => [h.kind, h.tag, h.text]));

  // full cancel through the dialog, partial charge 700
  await ev((id) => bookingV2CancelModal(id), cx.id);
  await page.selectOption('#bkc-cat', cancelCat);
  await page.fill('#bkc-reason', 'changed plan');
  await page.check('input[name=bkc-charge][value=partial]');
  await page.fill('#bkc-amt', '700');
  await page.click('button[onclick^="bookingV2CancelConfirm"]');
  await waitScreen((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return b && b.status === 'cancelled'; }, cx.id, 15000); await idle();
  sb6 = await api('/v1/bookings/' + cx.opsId);
  h6 = (await api('/v1/bookings/' + cx.opsId + '/history')).history;
  s = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return { status: b.status, cat: b.cancellation && b.cancellation.category, amt: b.cancellation && b.cancellation.chargeAmount }; }, cx.id);
  ok('cancel → server cancelled with the category, note and 700 charge · screen agrees', sb6.status === 'cancelled' && sb6.cancellation.category === cancelCat && sb6.cancellation.charge_amount === 700 && s.status === 'cancelled' && s.cat === cancelCat && s.amt === 700, { cancellation: sb6.cancellation, s });
  ok('server history has the cancel line (and the partial one before it)', h6.some((h) => /cancel/i.test((h.kind || '') + (h.tag || ''))) && h6.length >= 3, h6.map((h) => [h.kind, h.tag, h.text]));
  await ev(() => { _bkV2.newBooking = null; bookingV2Render(); });
}

console.log('\n[7] B2C review: polled list, "Reviewed", "Mark all"');
{
  const mkUser = await post('/v1/users', { username: 'lkpush', password: 'Passw0rd-lk-9-x', name: 'LK push', agent_id: 'a_b2c', edit_areas: ['operations'] });
  ok('setup: a Love Kingdom login (agent a_b2c)', mkUser.status === 201, mkUser);
  const lk = await loginAs('lkpush', 'Passw0rd-lk-9-x');
  const lkBook = (n, date) => post('/v1/bookings', { external_id: 'b2c_walk_' + n, intent: 'confirm', agentId: 'a_b2c', leadPax: 'ZZ B2C ' + n, leadNationality: 'US', pickupSelf: true,
    priceMode: 'manual', manualTotal: 2500, total: 2500, hotelName: 'Hotel A', trips: [{ routeId: 'r5', date, pax: { ad_fr: 2 }, zone: 'NoTransfer' }] }, lk);
  const b1 = await lkBook(1, F3), b2 = await lkBook(2, F3);
  ok('setup: two B2C orders pushed', b1.status === 201 && b2.status === 201, [b1.body, b2.body]);
  const id1 = b1.body && b1.body.id, id2 = b2.body && b2.body.id;
  // `b2c` (changed) lines come from a push that changes an order (a "new" order counts only within 2 days of travel, which depends on the clock)
  const c1 = await raw('/v1/bookings/' + id1);
  const p1 = await raw('/v1/bookings/' + id1, { method: 'PATCH', headers: { 'if-match': '"' + c1.body.version + '"' }, body: JSON.stringify({ hotelName: 'Hotel B' }) }, lk);
  const c2 = await raw('/v1/bookings/' + id2);
  const p2 = await raw('/v1/bookings/' + id2, { method: 'PATCH', headers: { 'if-match': '"' + c2.body.version + '"' }, body: JSON.stringify({ hotelName: 'Hotel C' }) }, lk);
  const un0 = await api('/v1/bookings/b2c-unreviewed');
  ok('setup: both orders changed by the push → server lists 2 to review', p1.status === 200 && p2.status === 200 && un0.count === 2, { p1: p1.body, p2: p2.body, un0 });
  // the app polls GET /v1/bookings/b2c-unreviewed every 60 s; ask it once now instead of waiting
  const nC = calls.length;
  await ev(() => laOps.b2cReview.refresh());
  await waitScreen(() => window.bookingV2B2CList().length === 2, null, 8000);
  s = await ev(() => bookingV2B2CList().map((x) => ({ lead: x.bk.leadPax, segs: x.p.segs.map((g) => g.label + ': ' + g.vals.join(' → ')) })));
  ok('the app read the list (GET b2c-unreviewed) → 2 changed orders with the server\'s fields', calls.slice(nC).includes('GET /v1/bookings/b2c-unreviewed') && s.length === 2 && s.every((x) => x.segs.some((g) => /^Hotel: Hotel A → Hotel [BC]$/.test(g))), { calls: calls.slice(nC), s });
  // open the drawer from the head chip on the By-trip view
  await ev((d) => { _bkV2.newBooking = null; _bkV2.detailId = null; _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; bookingV2Render(); }, F3);
  await settle(600);
  const chip = page.locator('.bt-b2cbtn');
  ok('head chip "B2C changes" shows with the count', (await chip.count()) === 1 && /2/.test(await chip.innerText()), await chip.allInnerTexts());
  await chip.click(); await settle(400);
  const nC2 = calls.length;
  await page.locator('button.ok[onclick^="bookingV2B2CSeen("]').first().click();
  await waitScreen(() => window.bookingV2B2CList().length === 1, null, 8000); await idle();
  const un1 = await api('/v1/bookings/b2c-unreviewed');
  const seen = calls.slice(nC2).filter((c) => /b2c-seen/.test(c));
  ok('"Reviewed" on one → POST /v1/bookings/{id}/b2c-seen · server lists 1 · screen lists 1', seen.length === 1 && /^POST \/v1\/bookings\/[^/]+\/b2c-seen$/.test(seen[0]) && un1.count === 1, { seen, un1: un1.count });
  const gone = [id1, id2].find((i) => i !== un1.items[0].booking_id);
  const hist = (await api('/v1/bookings/' + gone + '/history')).history;
  ok('the reviewed order has a b2c_seen line from the staff login', hist.some((h) => h.kind === 'b2c_seen' && h.by === 'tester'), hist.map((h) => [h.kind, h.by]));
  const nC3 = calls.length;
  await page.locator('.b2cd-f button').click();
  await waitScreen(() => window.bookingV2B2CList().length === 0, null, 8000); await idle();
  const un2 = await api('/v1/bookings/b2c-unreviewed');
  ok('"Mark all" → POST /v1/bookings/b2c-seen (the confirm answered) · server lists 0 · screen lists 0', calls.slice(nC3).includes('POST /v1/bookings/b2c-seen') && dlg(/Mark all 1 B2C changes as seen\?/).length === 1 && un2.count === 0, { calls: calls.slice(nC3).filter((c) => /seen/.test(c)), un2: un2.count, dialogs: dlg(/Mark all/) });
  await ev(() => { if (document.getElementById('acct-modal')) acctModalClose(); });
}

console.log('\n[8] 409 cancelled: pickup time / pier note of a cancelled booking');
{
  // the booking cancelled in [6]; the dispatch fields are a day-of write the server refuses for a cancelled booking
  const bk8 = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return { status: b.status, trip: b.trips[0].opsTripId, date: b.trips[0].date, fin: (b.ops && b.ops.pickupTimeFinal) || '' }; }, cx.id);
  // pickup time: the By-trip row's time box
  await ev((d) => { _bkV2.newBooking = null; _bkV2.detailId = null; _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; bookingV2Render(); }, bk8.date);
  await settle(800);
  const boxOf = (id) => page.locator(`input[onchange*="bookingV2SetPickupFinal('${id}'"]`);
  ok('a cancelled booking\'s row on By-trip (folded list) has no time box · the box cannot be typed into', (await boxOf(cx.id).count()) === 0, await boxOf(cx.id).count());
  // The 409 is reachable when the booking is cancelled elsewhere after this screen loaded it: the row is still live here.
  await form({ lead: 'ZZ STALE', date: F2 });
  await waitScreen(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ STALE'); return b && b.opsId; }, null, 15000); await idle();
  const st = await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ STALE'); return { id: b.id, opsId: b.opsId, trip: b.trips[0].opsTripId }; });
  await ev((d) => { _bkV2.newBooking = null; _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; bookingV2Render(); }, F2);
  await settle(800);
  const cats8 = (await api('/v1/cancel-categories')).categories;
  const ver8 = (await api('/v1/bookings/' + st.opsId)).version;
  const cxlApi = await raw('/v1/bookings/' + st.opsId + '/cancel', { method: 'POST', headers: { 'if-match': '"' + ver8 + '"' }, body: JSON.stringify({ category: cats8[0].code, note: 'cancelled by another client', charge_type: 'none' }) });
  ok('setup: cancelled through the API (another client)', cxlApi.status === 200, cxlApi);
  if ((await boxOf(st.id).count()) === 0) {
    notes.push('[8] stale row: the screen already dropped the time box (feed refreshed the booking)');
    // the change feed had already told the screen: the row is gone, so the box cannot be typed into. The handler the box calls
    // (onchange) is driven directly to see what the wiring does with the server's 409.
    const w0 = warns.length, nR = refusals.length;
    await ev((a) => bookingV2SetPickupFinal(a.id, '07:45', a.date), { id: st.id, date: F2 });
    for (let i = 0; i < 24 && warns.length === w0; i++) await settle(250);
    await idle(); await settle(400);
    const after = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return { status: b.status, fin: (b.ops && b.ops.pickupTimeFinal) || '' }; }, st.id);
    ok('pickup time (handler called directly: no box on a cancelled row): server refused 409 cancelled', refusals.slice(nR).some((x) => /trip-ops.* → 409/.test(x) && /"code":"cancelled"/.test(x)), refusals.slice(nR));
    ok('pickup time: the screen showed the server\'s message · nothing kept on the screen', warns.slice(w0).some((x) => /Pickup time not saved/.test(x) && /is cancelled: its dispatch cannot change/.test(x)) && after.fin === '', { warns: warns.slice(w0), after });
  } else {
    const w0 = warns.length, nR = refusals.length;
    await boxOf(st.id).first().fill('07:45'); await boxOf(st.id).first().blur();
    for (let i = 0; i < 24 && warns.length === w0; i++) await settle(250);
    await idle(); await settle(600);
    const after = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); return (b.ops && b.ops.pickupTimeFinal) || ''; }, st.id);
    const boxNow = await boxOf(st.id).first().inputValue().catch(() => null);
    ok('pickup time: server refused (409 cancelled)', refusals.slice(nR).some((x) => /trip-ops.* → 409/.test(x) && /"code":"cancelled"/.test(x)), refusals.slice(nR));
    ok('pickup time: the screen showed the server\'s message', warns.slice(w0).some((x) => /Pickup time not saved/.test(x) && /is cancelled: its dispatch cannot change/.test(x)), warns.slice(w0));
    ok('pickup time: the box is back to the stored value (empty) · the screen kept nothing', (boxNow === null || boxNow === '') && after === '', { boxNow, after });
  }
  // pier note: the note dialog of the pier check-in
  const w1 = warns.length, nR1 = refusals.length;
  await ev((a) => pckNoteOpen(a.id, a.date), { id: cx.id, date: bk8.date });
  await page.fill('#pck-note-tx', 'window seat please');
  await page.click('.pn-b1');
  for (let i = 0; i < 20 && warns.length === w1; i++) await settle(250);
  await idle(); await settle(500);
  const note = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); const o = (typeof bkOpsRead === 'function' ? bkOpsRead(b, a.date) : b.ops) || {}; return o.pierNote || null; }, { id: cx.id, date: bk8.date });
  ok('pier note: server refused (409)', refusals.slice(nR1).some((x) => /trip-ops.* → 409/.test(x)), refusals.slice(nR1));
  ok('pier note: the screen showed the server\'s message', warns.slice(w1).some((x) => /Pier note not saved/.test(x) && /cancel/i.test(x)), warns.slice(w1));
  ok('pier note: nothing stored on the screen', !note, note);
}


console.log('\n[9] programme_anyway question · route_closed refusal');
{
  // (a) r4 is not in agent a01's programme (r5 only). The commit's own question is asked once and its OK goes up as programme_anyway.
  answer.confirm = false;
  let nD = dialogs.length;
  await form({ lead: 'ZZ PROG NO', date: F1, trips: [{ routeId: 'r4', zone: 'NoTransfer' }] });
  await settle(1500); await idle();
  ok('(a) answered No to "เส้นทางนอกสัญญา" → nothing saved', dialogs.slice(nD).some((d) => /^confirm: เส้นทางนอกสัญญาของ Sun Tour/.test(d)) && (await srvBy('ZZ PROG NO')) === null, { dialogs: dialogs.slice(nD), srv: await srvBy('ZZ PROG NO') });
  answer.confirm = true;
  nD = dialogs.length;
  const nR = refusals.length;
  await form({ lead: 'ZZ PROG YES', date: F1, trips: [{ routeId: 'r4', zone: 'NoTransfer' }] });
  await waitScreen(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ PROG YES'); return b && b.opsId; }, null, 15000); await idle();
  const py = await srvBy('ZZ PROG YES');
  ok('(a) answered Yes → saved on r4 · asked once (not again by the server) · no refusal', py && py.trips[0].route_id === 'r4' && dlg(/เส้นทางนอกสัญญา/).length === 2 && dialogs.slice(nD).filter((d) => /นอกสัญญา|anyway/i.test(d)).length === 1 && refusals.length === nR, { py: py && py.trips.map((t) => t.route_id), q: dialogs.slice(nD), refusals: refusals.slice(nR) });
  // (b) the screen's copy of the programme is out of date (it lists r4) but the server's is not: the server's 409 is asked
  await ev(() => { const a = sbGetAgent('a01'); a.programs = ['r5', 'r4']; });
  nD = dialogs.length;
  const nR2 = refusals.length;
  await form({ lead: 'ZZ PROG SRV', date: F2, trips: [{ routeId: 'r4', zone: 'NoTransfer' }] });
  await waitScreen(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ PROG SRV'); return b && b.opsId; }, null, 15000); await idle();
  const ps = await srvBy('ZZ PROG SRV');
  const q9 = dialogs.slice(nD).find((d) => /Confirm to save anyway\?/.test(d));
  ok('(b) the server\'s 409 route_not_in_programme is asked with its own message · OK sends programme_anyway · saved', !!q9 && refusals.slice(nR2).some((x) => /→ 409/.test(x) && /route_not_in_programme/.test(x)) && ps && ps.trips[0].route_id === 'r4', { q9, refusals: refusals.slice(nR2), ps: ps && ps.trips.map((t) => t.route_id) });
  console.log('    server question:', JSON.stringify(q9).slice(0, 300));
  await ev(() => { const a = sbGetAgent('a01'); a.programs = ['r5']; });

  // (c) the day is closed on the server after the app loaded its calendar
  const close = await raw('/v1/routes/r5/days/' + F3, { method: 'PUT', body: JSON.stringify({ kind: 'closed', close_anyway: true }) });
  ok('setup: r5 closed on ' + F3 + ' (after the app loaded)', close.status === 200, close);
  const open0 = await ev((d) => bookingV2IsRouteOpenOn('r5', d), F3);
  const w0 = warns.length, nR3 = refusals.length;
  await form({ lead: 'ZZ CLOSED', date: F3 });
  for (let i = 0; i < 30 && warns.length === w0; i++) await settle(250);
  await idle(); await settle(600);
  s = await ev(() => ({ n: SB_BOOKINGS.filter((b) => b.leadPax === 'ZZ CLOSED').length, form: !!_bkV2.newBooking && _bkV2.newBooking.leadPax === 'ZZ CLOSED' }));
  const refused = refusals.slice(nR3).find((x) => /POST \/v1\/bookings → 409/.test(x) && /route_closed/.test(x));
  console.log('    refusal:', (refused || '').slice(0, 300), '\n    warn:', warns.slice(w0).join(' | ').slice(0, 300));
  ok('(c) the screen did not know the day was closed (client rule passed) · the server refused 409 route_closed', open0 === true && !!refused, { open0, refusals: refusals.slice(nR3) });
  ok('(c) the server\'s message was shown · nothing saved · booking off the screen · form reopened with what was typed', !!refused && warns.slice(w0).some((x) => /Booking not saved/.test(x) && x.includes(JSON.parse(refused.slice(refused.indexOf('{'))).message)) && (await srvBy('ZZ CLOSED')) === null && s.n === 0 && s.form, { warns: warns.slice(w0), s });
  await ev(() => { _bkV2.newBooking = null; bookingV2Render(); });
  await raw('/v1/routes/r5/days/' + F3, { method: 'DELETE' });
}

console.log('\n[10] nationality_effective → Market Data code / mix');
{
  const mk = await apiBook({ leadPax: 'ZZ NATEFF', leadNationality: 'RU', intent: 'quote', trip: { date: F2, pax: { ad_fr: 3 } },
    passengers: [{ name: 'Wang Li', nationality: 'US' }, { name: 'Zhang Wei' }] });
  ok('setup: booking with a lead RU, one passenger US, one with no nationality (named like a Chinese guest)', mk.status === 201, mk.body);
  const sb10 = mk.body;
  const eff = (sb10.passengers || []).map((p) => [p.name, p.nationality || '', p.nationality_effective]);
  console.log('    server passengers:', JSON.stringify(eff));
  await ev((id) => laOps.bookings.reload ? laOps.bookings.reload(id) : null, sb10.id);
  await waitScreen((id) => SB_BOOKINGS.some((b) => b.opsId === id), sb10.id, 8000);
  const scr10 = await ev((id) => {
    const b = SB_BOOKINGS.find((x) => x.opsId === id); if (!b) return null;
    return { pax: (b.passengers || []).map((p) => [p.name, p.nationality || '', p.nationalityEffective]), code: mdBkCode(b), mix: mdBkMix(b), guess: bookingV2GuessNationality('Zhang Wei') };
  }, sb10.id);
  const blank = (sb10.passengers || []).find((p) => p.name === 'Zhang Wei');
  ok('the screen\'s passengers carry the server\'s nationality_effective (blank one = the lead\'s RU)', scr10 && JSON.stringify(scr10.pax) === JSON.stringify(eff) && blank && blank.nationality_effective === 'RU', { scr10, eff });
  ok('mdBkCode = the lead\'s code · mdBkMix counts the blank passenger as RU, not as the name\'s guess', scr10 && scr10.code === 'RU' && scr10.mix && scr10.mix.RU === 2 && scr10.mix.US === 1 && !scr10.mix[scr10.guess], { scr10 });
  console.log('    legacy would guess for "Zhang Wei":', scr10 && scr10.guess);
  // and the Market Data screen draws without error
  const e0 = errors.length;
  await ev(() => { const el = document.querySelector('.nav-item[data-view="marketdata"], .nav-item[data-view="market-data"]'); if (el) el.click(); else if (typeof renderMarketData === 'function') renderMarketData(); });
  await settle(800);
  ok('Market Data renders without an error', errors.length === e0, errors.slice(e0));
}

ok('no page errors', errors.length === 0, errors);
if (notes.length) console.log('\nnotes:\n  ' + notes.join('\n  '));
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
await browser.close(); srv.close(); backend.kill();
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
