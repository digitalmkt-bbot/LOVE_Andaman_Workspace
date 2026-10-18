// t_walk_aboard · the check-in figures (trip.aboard, Q35) against a REAL operation-backend: the screen functions (ckLostByType, ckPaxLeft,
// ckSummary, pckVoidInfo, pckSelfPierNote, pckOnBoard, pckExpected, ckHasArrange, ckSelfOf, ckReinstateOf, ckVanNsPax, goCounts, pckTripStats)
// answer what the server computed. Also Q24 (Daily PFM cards read totals.received) and Q53 (Accounting void refusal).
//   node test/ui/t_walk_aboard.mjs
// Every check reads BOTH sides: the screen's state and what the server holds (asked directly).
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
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 90000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m){ clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
backend.on('exit', (c, sig) => console.log('BACKEND EXIT', c, sig, backendLog.slice(-1500)));
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
// api(): ask the server directly. Returns the JSON body; .status is attached through apiRaw for refusals.
const apiRaw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await apiRaw(p, init)).body;
const send = (m, p, b) => apiRaw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], bodies = [];
const routeFn = async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push(req.method() + ' ' + u.pathname + ' ' + r.status);
  if (req.method() !== "GET") bodies.push({ k: req.method() + " " + u.pathname, status: r.status, req: req.postData() || "", body: buf.toString() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 260));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
};
await ctx.route(PROD, routeFn);
const page = await ctx.newPage();
const errors = [], dialogs = [];
let dialogAnswer = true;
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); if (d.type() === 'prompt') d.accept('Tester'); else if (dialogAnswer) d.accept(); else d.dismiss(); });

const results = [];   // item -> PASS/FAIL list
const fails = [];
let curItem = '0';
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 500))); results.push({ item: curItem, name, pass: !!cond }); if (!cond) fails.push(curItem + ' ' + name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const callsSince = (n) => calls.slice(n);
const lastBody = (re) => { const b = bodies.filter((x) => re.test(x.k)).pop(); return b ? { status: b.status, req: b.req, json: (() => { try { return JSON.parse(b.body); } catch (_) { return null; } })() } : null; };

const DAY = '2026-11-10';
// ── seed through the API: six bookings with the check-in cases the block has to read ──
await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DAY, capacity: 40 });
const mkBk = async (id, lead, pax, extra = {}) => send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: 'r5', date: DAY, pax: { ad_fr: pax }, zone: 'PK' }], ...extra });
const B = {};
for (const [k, lead, pax] of [['a1', 'ABOARD ONE', 4], ['a2', 'ABOARD TWO', 3], ['a3', 'ABOARD THREE', 2], ['a4', 'ABOARD FOUR', 2], ['a5', 'ABOARD FIVE', 2], ['a6', 'ABOARD SIX', 2]]) {
  const r = await mkBk('zz-' + k, lead, pax);
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body)); process.exit(2); }
  B[k] = { id: r.body.id, ext: 'zz-' + k, trip: r.body.trips[0].id };
}
const cmd = async (k, kind, what, body = {}) => { const r = await send('POST', `/operations/trip-ops/${B[k].trip}/checkins/${kind}/0/${what}`, body); if (r.status >= 300) { console.log('command failed', k, kind, what, r.status, JSON.stringify(r.body)); process.exit(2); } return r.body; };
// a1: 4 booked, van no-show of 1 ("not_down"), pier ticked in
await cmd('a1', 'van', 'check-in'); await cmd('a1', 'van', 'events', { type: 'no_show', reason_code: 'not_down', ad: 1 }); await cmd('a1', 'pier', 'check-in');
// a2: 3 booked, van no-show of 1, pier ticked in, then the pier confirms that person came on their own (self-add)
await cmd('a2', 'van', 'check-in'); await cmd('a2', 'van', 'events', { type: 'no_show', reason_code: 'not_down', ad: 1 }); await cmd('a2', 'pier', 'check-in'); await cmd('a2', 'pier', 'self-add', { ad: 1 });
// a3: 2 booked, both cancelled on site -> the row is void
await cmd('a3', 'van', 'check-in'); await cmd('a3', 'van', 'events', { type: 'cxl', reason_code: 'cancel_onsite', ad: 2 });
// a4: 2 booked, 1 no-show who said they would come to the pier themselves
await cmd('a4', 'van', 'check-in'); await cmd('a4', 'van', 'events', { type: 'no_show', reason_code: 'self_arrive', ad: 1 });
// a5: 2 booked, both no-show on the van, the pier reinstates them
await cmd('a5', 'van', 'check-in'); await cmd('a5', 'van', 'events', { type: 'no_show', reason_code: 'late', ad: 2 }); await cmd('a5', 'pier', 'reinstate', { on: true });
// a6: nothing done yet
const srvAboard = async (k) => (await api('/v1/bookings/' + B[k].id)).trips[0].aboard;
const A = {}; for (const k of Object.keys(B)) A[k] = await srvAboard(k);
console.log('server aboard a1', JSON.stringify(A.a1));
console.log('server aboard a2', JSON.stringify(A.a2));

// ── boot the app ──
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);

// the screen's answers for one booking, all in one object
const screenOf = (ext) => ev((a) => {
  const b = SB_BOOKINGS.find((x) => x.id === a.ext), t = ckTripOn(b, a.d), pb = ckPaxBreak(t.pax);
  const L = ckLostByType(b, a.d), left = {}; ['ad', 'chd', 'inf', 'foc'].forEach((k) => { left[k] = ckPaxLeft(b, a.d, k, pb[k]); });
  const S = ckSummary(b, a.d), V = pckVoidInfo(b, a.d, t), N = pckSelfPierNote(b, a.d), sa = ckSelfOf(b, a.d), re = ckReinstateOf(b, a.d);
  const booked = ckBookedPax(t);
  return { lost: L, left, sum: S && { booked: S.booked, vanNoShow: S.vanNoShow, pierNoShow: S.pierNoShow, noShow: S.noShow, stage: S.stage, at: S.at, reasonText: S.reasonText },
    void: V && { pax: V.pax, cxl: V.cxl, ns: V.ns, kind: V.kind }, selfPier: N && { pax: N.pax, label: N.label }, onBoard: pckOnBoard(b, a.d, booked), expected: pckExpected(b, a.d, booked),
    arrange: ckHasArrange(b, a.d), selfAdd: sa && { ad: sa.ad, pax: sa.pax }, selfUnalloc: ckSelfUnalloc(b, a.d), reinstate: !!re, vanNs: ckVanNsPax(b, a.d), selfK: ckSelfK(b, a.d, 'ad') };
}, { ext, d: DAY });
const expectOf = (a) => ({ lost: { ad: a.lost.ad, chd: a.lost.chd, inf: a.lost.inf, foc: a.lost.foc, total: a.lost.total, unalloc: a.lost.unalloc, ns: a.lost.ns, cxl: a.lost.cxl, selfPier: a.lost.self_pier },
  left: { ad: a.left.ad, chd: a.left.chd, inf: a.left.inf, foc: a.left.foc },
  sum: { booked: a.summary.booked, vanNoShow: a.summary.van_no_show, pierNoShow: a.summary.pier_no_show, noShow: a.summary.no_show, stage: a.summary.stage, at: a.summary.at, reasonText: a.summary.reason_text },
  void: a.void && { pax: a.void.pax, cxl: a.void.cxl, ns: a.void.ns, kind: a.void.kind }, selfPier: a.self_pier_note && { pax: a.self_pier_note.pax, label: a.self_pier_note.label },
  onBoard: a.on_board, expected: a.expected, arrange: a.has_arrange, selfAdd: a.self_add && { ad: a.self_add.ad, pax: a.self_add.pax }, selfUnalloc: a.self_add ? a.self_add.unalloc : 0,
  reinstate: a.reinstated, vanNs: a.van_ns_pax, selfK: a.self_add ? a.self_add.ad : 0 });
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

// ════════════ Q35 · the screen answers what the server computed ════════════
curItem = 'Q35'; console.log('\n[Q35] check-in figures from trip.aboard');
ok('the booking read carries aboard on the trip and the screen kept it (aboardDate = the day)', await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.e), t = ckTripOn(b, a.d); return !!(t && t.aboard && t.aboardDate === a.d); }, { e: B.a1.ext, d: DAY }));
ok('the 11 legacy functions are wrapped by the aboard adapter', await ev(() => ['ckLostByType', 'ckPaxLeft', 'pckVoidInfo', 'pckSelfPierNote', 'pckOnBoard', 'pckExpected', 'ckHasArrange', 'ckSelfOf', 'ckReinstateOf', 'ckVanNsPax', 'ckSummary'].every((n) => window[n].__opsAboard)));
for (const [k, what] of [['a1', 'van no-show 1, pier ticked'], ['a2', 'no-show 1 then self-add 1'], ['a3', 'both cancelled on site (void)'], ['a4', 'no-show who comes to the pier alone'], ['a5', 'both no-show, pier reinstates'], ['a6', 'nothing done']]) {
  const got = await screenOf(B[k].ext), want = expectOf(A[k]);
  ok(k + ' (' + what + '): all figures on the screen = the server\'s aboard', same(got, want), { got, want });
}
ok('a3 is void (kind cxl), a4 has the self-pier note, a2 has the self-add, a5 is reinstated (the cases really were read)', A.a3.void && A.a3.void.kind === 'cxl' && A.a4.self_pier_note && A.a2.self_add && A.a5.reinstated && A.a1.van_ns_pax === 1, { a3: A.a3.void, a4: A.a4.self_pier_note, a2: A.a2.self_add, a5: A.a5.reinstated });
// the answer is the server's, not the browser's: blank the local check-in records and the figures do not move
const a1Local = await ev((e) => { const b = SB_BOOKINGS.find((x) => x.id === e); window.__keep = { v: b.ops.vanCheckin, p: b.ops.pierCheckin }; b.ops.vanCheckin = null; b.ops.pierCheckin = null; return !!window.__keep.v; }, B.a1.ext);
const blank = await screenOf(B.a1.ext);
ok('a1 with its local van/pier records blanked: figures unchanged (answered from aboard, not from ops.vanCheckin)', a1Local && same(blank, expectOf(A.a1)), { blank, want: expectOf(A.a1) });
// the legacy rule on the same trip (aboard taken off) reads the blanked records: the legacy path is still there for a trip without the block
await ev((e) => { const b = SB_BOOKINGS.find((x) => x.id === e); window.__ab = b.trips[0].aboard; delete b.trips[0].aboard; }, B.a1.ext);
const legacyBlank = await screenOf(B.a1.ext);
ok('a trip without aboard runs the legacy browser rule (blank records -> nothing lost)', legacyBlank.lost.total === 0 && legacyBlank.sum.noShow === 0, legacyBlank);
await ev((e) => { const b = SB_BOOKINGS.find((x) => x.id === e); b.ops.vanCheckin = window.__keep.v; b.ops.pierCheckin = window.__keep.p; }, B.a1.ext);
const legacyReal = await screenOf(B.a1.ext);                // aboard still off, records back: the legacy rule on the real records
await ev((e) => { SB_BOOKINGS.find((x) => x.id === e).trips[0].aboard = window.__ab; }, B.a1.ext);
console.log('  note  a1 legacy rule on the same records: lost ' + JSON.stringify(legacyReal.lost) + ' · server: ' + JSON.stringify(A.a1.lost));
ok('parity: the legacy rule on the real records agrees with the server on the totals (lost.total, left, summary)', legacyReal.lost.total === A.a1.lost.total && same(legacyReal.left, expectOf(A.a1).left) && same(legacyReal.sum, expectOf(A.a1).sum), { legacyReal, want: expectOf(A.a1) });
console.log('  note  the legacy rule cannot split the lost heads by category here (unalloc ' + legacyReal.lost.unalloc + ' vs the server ad ' + A.a1.lost.ad + '): it reads event.paxBreak, which the check-in adapter does not map (events carry ad/chd/inf/foc). The server block does.');

// unsaved edit in the browser: the block keeps its last-read figures; a caller asking about other heads gets the legacy rule on the server's losses
await ev((e) => { SB_BOOKINGS.find((x) => x.id === e).trips[0].pax.ad_fr = 9; }, B.a1.ext);
const edited = await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.e); return { lost: ckLostByType(b, a.d).total, noShow: ckSummary(b, a.d).noShow, onBoard: pckOnBoard(b, a.d), left9: ckPaxLeft(b, a.d, 'ad', 9), exp9: pckExpected(b, a.d, 9) }; }, { e: B.a1.ext, d: DAY });
ok('a1 edited in the browser (9 heads, not saved): lost / summary / onBoard keep the last-read aboard', edited.lost === A.a1.lost.total && edited.noShow === A.a1.summary.no_show && edited.onBoard === A.a1.on_board, edited);
ok('... and ckPaxLeft / pckExpected asked for the 9 heads fall back to the legacy rule on the server\'s losses (9 - 1 = 8)', edited.left9 === 8 && edited.exp9 === 8, edited);
await ev((e) => { SB_BOOKINGS.find((x) => x.id === e).trips[0].pax.ad_fr = 4; }, B.a1.ext);

// pckTripStats reads ckPaxLeft: the day's real heads
const stats = await ev((a) => { const rows = a.es.map((e) => { const b = SB_BOOKINGS.find((x) => x.id === e); return { b, t: ckTripOn(b, a.d) }; }); const s = pckTripStats(rows, a.d); return { real: s.real.all, book: s.book, lost: s.lost }; }, { es: Object.values(B).map((x) => x.ext), d: DAY });
const sumLeft = Object.values(A).reduce((s, a) => s + a.left.total, 0);
ok('pckTripStats over the 6 rows: real = the sum of the server\'s left totals', stats.real === sumLeft, { stats, sumLeft });

// ── another session adds a no-show: the screen has the old figures until the booking is read again ──
await cmd('a6', 'van', 'check-in'); await cmd('a6', 'van', 'events', { type: 'no_show', reason_code: 'sick', ad: 1 });
const before6 = await screenOf(B.a6.ext);
ok('a6: another session\'s no-show is not on the screen yet (last-read aboard)', before6.lost.total === 0, before6);
await ev((e) => laOps.bookings.reload(e), B.a6.ext); await idle();
const after6 = await screenOf(B.a6.ext), want6 = expectOf(await srvAboard('a6'));
ok('a6: after the booking is read again the screen shows the no-show (lost 1, stage van) = the server\'s', after6.lost.total === 1 && after6.sum.stage === 'van' && same(after6, want6), { after6, want6 });

// ── the screen's own check-in write (PUT) carries the answer: aboard refreshed from it ──
await ev((e) => ckToggle(e, '2026-11-10', 'pier'), B.a6.ext); await idle(); await settle(1500);
const srv6 = await srvAboard('a6'), put6 = lastBody(/^(PUT|POST) \/operations\/trip-ops\/.*\/checkins\/pier\//);
ok('pier tick on the screen: the PUT answered with aboard on the trip', put6 && put6.status === 200 && put6.json && put6.json.trip && put6.json.trip.aboard && put6.json.trip.aboard.summary, put6 && put6.json && Object.keys(put6.json));
const scr6 = await screenOf(B.a6.ext);
ok('a6 after the tick: the screen figures = the server aboard read afresh', same(scr6, expectOf(srv6)), { scr6, want: expectOf(srv6) });
ok('... and trip.aboard on the screen is the PUT answer block (no booking read in between)', same(await ev((e) => SB_BOOKINGS.find((x) => x.id === e).trips[0].aboard, B.a6.ext), put6.json.trip.aboard));
// the counter down on the pier: the figures change (a pier shortfall), and the screen has them from the PUT answer alone
await ev((e) => ckStep(e, '2026-11-10', 'pier', -1), B.a6.ext); await idle(); await settle(1500);
const srv6b = await srvAboard('a6'), scr6b = await screenOf(B.a6.ext);
console.log('  note  a6 after the step: server summary ' + JSON.stringify(srv6b.summary) + ' on_board ' + srv6b.on_board);
ok('a6 after the pier counter went down: the pier shortfall is on the server (pier_no_show 1, stage pier, on_board 0)', srv6b.summary.pier_no_show === 1 && srv6b.summary.stage === 'pier' && srv6b.on_board === 0, srv6b.summary);
ok('... and the screen shows the same figures without a booking read (answer of the PUT merged)', same(scr6b, expectOf(srv6b)) && scr6b.sum.stage === 'pier' && scr6b.onBoard === 0, { scr6b, want: expectOf(srv6b) });

// ── a booking save: the PATCH answer carries aboard and it is merged ──
const nSave = bodies.length;
await ev((e) => { const b = SB_BOOKINGS.find((x) => x.id === e); b.notes = 'saved from the walk'; return laOps.bookings.save(b); }, B.a5.ext); await idle(); await settle(800);
const patch = bodies.slice(nSave).filter((x) => /^PATCH \/v1\/bookings\//.test(x.k)).pop();
const srv5 = await srvAboard('a5');
ok('save: PATCH /v1/bookings answered 200 with aboard on its trip; the request did not send aboard', patch && patch.status === 200 && JSON.parse(patch.body).trips[0].aboard && !/aboard/.test(patch.req), patch && { s: patch.status, req: patch.req.slice(0, 200) });
ok('save: the screen\'s trip.aboard after the answer = the server\'s', same(await ev((e) => SB_BOOKINGS.find((x) => x.id === e).trips[0].aboard, B.a5.ext), srv5));
ok('a5 (reinstated): the figures on the screen = the server\'s after the save, ckReinstateOf true', same(await screenOf(B.a5.ext), expectOf(srv5)) && (await screenOf(B.a5.ext)).reinstate === true);

// ════════════ Q24 · Daily PFM cards ════════════
curItem = 'Q24'; console.log('\n[Q24] Daily PFM cards read what was received');
const mkAgent = async (name, pay_type) => (await send('POST', '/v1/agents', { name, market_id: 'ru', pay_type, vat_mode: 'none', rate_type_id: 'rt001', company: { legal_name: name + ' Co', address: '1 Test Rd' } })).body.id;
const proAgent = await mkAgent('Pfm Pro Agent', 'proforma'), invAgent = await mkAgent('Pfm Inv Agent', 'invoice');
const pfmBk = [];
for (const [ext, ag, pax] of [['zz-p1', proAgent, 2], ['zz-p2', invAgent, 3]]) { const r = await mkBk(ext, 'PFM ' + ext, pax, { agentId: ag }); if (r.status !== 201) { console.log('pfm seed failed', r.status, JSON.stringify(r.body)); process.exit(2); } pfmBk.push(r.body); }
const inv1 = await send('POST', '/v1/invoices', { agent_id: proAgent, booking_ids: [pfmBk[0].id] });
const inv2 = await send('POST', '/v1/invoices', { agent_id: invAgent, booking_ids: [pfmBk[1].id], kind: 'prepay' });
console.log('  note  invoices', inv1.status, inv2.status, JSON.stringify(inv2.body).slice(0, 160));
const pay1 = inv1.status < 300 ? await send('POST', `/v1/invoices/${inv1.body.id}/payments`, { amount: 700 }) : null;
const pay2 = inv2.status < 300 ? await send('POST', `/v1/invoices/${inv2.body.id}/payments`, { amount: 900 }) : null;
console.log('  note  payments', pay1 && pay1.status, pay2 && pay2.status);
const pfm = await api('/v1/pfm?date=' + DAY);
console.log('  note  server pfm totals ' + JSON.stringify(pfm.totals) + ' rows ' + JSON.stringify(pfm.rows.map((r) => ({ k: r.kind, t: r.total, p: r.paid, rc: r.received }))));
ok('server: rows carry received and totals.received is their sum (>= the 1600 paid)', pfm.rows.length >= 2 && pfm.rows.every((r) => typeof r.received === 'number') && pfm.totals.received === pfm.rows.reduce((s, r) => s + r.received, 0) && pfm.totals.received >= 1600, pfm.totals);
await ev((d) => { const el = document.querySelector('.nav-item[data-view="dailypfm"]'); _pfmDate = d; _pfmMode = 'daily'; el.click(); }, DAY);
await waitFor(() => document.getElementById('dailypfm-host') && /Total PFM value/.test(document.getElementById('dailypfm-host').innerText), null, 15000);
await idle(); await settle(1500);
const cards = await ev(() => {
  const h = document.getElementById('dailypfm-host'), n = (s) => +String(s).replace(/[^0-9.]/g, '');
  const big = [...h.querySelectorAll('div')].find((d) => /font-size:28px/.test(d.getAttribute('style') || ''));
  const paid = [...h.querySelectorAll('div')].find((d) => d.children.length === 0 && d.innerText === 'Paid' && d.nextElementSibling);
  return { total: big && n(big.innerText), paid: paid && n(paid.nextElementSibling.innerText) };
});
ok('Total PFM value card = totals.total (' + pfm.totals.total + ') and Paid card = totals.received (' + pfm.totals.received + ')', cards.total === Math.round(pfm.totals.total) && cards.paid === Math.round(pfm.totals.received), { cards, totals: pfm.totals });

// ════════════ Q53 · Accounting void refused while a payment remains ════════════
curItem = 'Q53'; console.log('\n[Q53] void with a payment -> 409 invoice_has_payments shown');
if (inv1.status < 300 && pay1 && pay1.status < 300) {
  await ev(() => laOpsMoney.load()); await idle(); await settle(500);
  const d0 = dialogs.length, r0 = refusals.length;
  await ev((id) => acctVoidConfirm(id), inv1.body.id); await idle(); await settle(1200);
  const mine = dialogs.slice(d0), ref = refusals.slice(r0).filter((r) => /\/void/.test(r));
  const srvInv = await api('/v1/invoices/' + inv1.body.id);
  ok('server answered 409 invoice_has_payments', ref.length === 1 && /409/.test(ref[0]) && /invoice_has_payments/.test(ref[0]), ref);
  ok('screen: confirm asked, then the server\'s message shown as an alert ("... still has payments. Delete them and save first.")', mine.length === 2 && /^confirm/.test(mine[0]) && /^alert: Invoice .* still has payments\. Delete them and save first\./.test(mine[1]), mine);
  ok('nothing changed: invoice still not void on the server and on the screen', srvInv.status !== 'void' && !srvInv.voided && await ev((id) => { const i = SB_INVOICES.find((x) => x.id === id); return !!i && i.status !== 'void' && !i.voided; }, inv1.body.id), srvInv.status);
} else ok('invoice with payment seeded', false, { inv1: inv1.status, pay1: pay1 && pay1.status });

// ── summary ──
const byItem = {};
results.forEach((r) => { const x = byItem[r.item] = byItem[r.item] || { pass: 0, fail: 0 }; r.pass ? x.pass++ : x.fail++; });
console.log('\nchecks per item: ' + Object.keys(byItem).sort().map((k) => k + ' -> ' + byItem[k].pass + ' ok / ' + byItem[k].fail + ' failed').join(' | '));
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.map((r) => r.slice(0, 200)).join('\n  '));
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
