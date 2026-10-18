// t_walk_w4_f3 · BROWSER walk-through of group F3 "booking list and booking form leftovers" (wave 4)
//
//   node test/ui/t_walk_w4_f3.mjs      (OPS_BACKEND_DIR, default D:/projects/operation-backend)
//
// Same method as t_walk_booking2.mjs / t_walk_costing.mjs: the app's calls to the production URL go to a local in-process
// backend (test/helpers/ops-backend-local.mjs). Each item seeds through the API, drives the REAL screen and reads BOTH
// sides: what the screen shows, and what the server says (asked directly). Where the walk needs to show that the screen
// follows the SERVER and not the browser's own arithmetic, the proxy changes one server answer on its way (hook.doctor)
// so it differs from what legacy would compute; the screen must print the doctored (server) value.
//
//   [L] All-bookings list: chips, last activity, Pending-FOC KPI, search beyond the loaded month, request bodies
//   [W] save warnings printed with the server's text     [A] agent dropdown ranking
//   [K] lock banner + save-time confirm print the server's warning text
//   [B] By-trip: re-confirm chip, return-van chip, overnight holding rows
//   [C] Fact Sheet redrawn from sheet.*, and the plan tab's pax / pax_th clamp while typing
import { serve, goView } from './_harness.mjs';
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
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const raw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  const text = r.status === 204 ? '' : await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await raw(p, init)).body;
const post = (p, b) => raw(p, { method: 'POST', body: JSON.stringify(b || {}) });

// ── app ──
const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], bodies = [], refusals = [];
const hook = { doctor: {} };      // pathname -> (json, request) => json   (one server answer changed on its way to the screen)
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  if (req.method() !== 'GET') bodies.push([req.method() + ' ' + u.pathname, req.postData() || '']);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  let buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  const fn = hook.doctor[u.pathname];
  if (fn && r.status >= 200 && r.status < 300) { try { const j = JSON.parse(buf.toString()); const out = fn(j, req); buf = Buffer.from(JSON.stringify(out === undefined ? j : out)); } catch (_) {} }
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' → ' + r.status + ' ' + buf.toString().slice(0, 300));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const answer = { confirm: true, refuse: null };      // refuse: a regexp - a confirm whose text matches is answered Cancel
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); d.type() === 'prompt' ? d.accept('Tester') : (d.type() === 'confirm' && ((answer.refuse && answer.refuse.test(d.message())) || !answer.confirm) ? d.dismiss() : d.accept()); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + (JSON.stringify(got) || '').slice(0, 700))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitScreen = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const item = (t) => console.log('\n' + t);
const bodyText = () => ev(() => document.body.innerText);
const waitCall = async (re, from = 0, ms = 8000) => { for (let t = 0; t < ms; t += 150) { if (calls.slice(from).some((c) => re.test(c))) return true; await settle(150); } return false; };

// ── dates (relative to today, so the "new / soon / today" chips are real) ──
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const D1 = day(1), D2 = day(10), DFAR = day(75), OV = [day(20), day(21), day(22), day(23)];
const monthOf = (d) => d.slice(0, 7);
const dep = (boat, route, date, capacity = 40) => api('/operations/deployments', { method: 'POST', body: JSON.stringify({ boat_id: boat, route_id: route, service_date: date, capacity }) });
for (const d of [D1, D2, DFAR]) await dep('b6', 'r5', d);
for (const d of OV) await dep('b13', 'r10', d, 38);

let seq = 0;
const mk = (o = {}) => post('/v1/bookings', {
  external_id: 'zz-f3-' + (++seq), intent: 'confirm', agentId: 'a01', leadPax: 'ZZ F3', leadNationality: 'RU', leadPhone: '+7 900 000', pickupSelf: true,
  guides: { english: true }, trips: [{ routeId: 'r5', date: D1, pax: { ad_fr: 1 }, zone: 'NoTransfer' }], ...o });

// A and B share the voucher (a possible duplicate of each other); C waits for FOC approval; F is far away (a month the screen has not loaded)
const A = (await mk({ external_id: 'zz-f3-A', leadPax: 'ZZ F3 One', voucherRef: 'ZZ-V1' })).body;
const Bk = await mk({ external_id: 'zz-f3-B', leadPax: 'ZZ F3 Two', voucherRef: 'ZZ-V1' });
const C = (await mk({ external_id: 'zz-f3-C', intent: 'quote', leadPax: 'ZZ F3 Foc', voucherRef: 'ZZ-V3', focReason: 'guide', trips: [{ routeId: 'r5', date: D2, pax: { ad_fr: 1, foc: 1 }, zone: 'NoTransfer' }] })).body;
const F = (await mk({ external_id: 'zz-f3-F', leadPax: 'ZZ Faraway', voucherRef: 'ZZ-V6', trips: [{ routeId: 'r5', date: DFAR, pax: { ad_fr: 1 }, zone: 'NoTransfer' }] })).body;
console.log('seed:', A.id && 'A', Bk.status, Bk.body && Bk.body.warnings && Bk.body.warnings[0] && Bk.body.warnings[0].code, C.status, F.status);

// an overnight charter (B2C style, the price is sent as is): 4 days on b13, two held nights with no trip of their own
const ovn = await post('/v1/bookings', { external_id: 'b2c_f3_ovn', total: 9000, leadPax: 'ZZ F3 OVERNIGHT', leadNationality: 'RU', leadPhone: '+7 900 1', pickupSelf: true,
  trips: [{ routeId: 'r10', date: OV[0], pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13', ovn: 'return', ovnReturnDate: OV[3] },
          { routeId: 'r10', date: OV[3], pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13', ovnLeg: true, ovnOf: 0 }] });
if (ovn.status !== 201) console.log('seed: overnight charter refused', ovn.status, JSON.stringify(ovn.body).slice(0, 300));

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1200);

const openList = (month, extra = {}) => ev(([m, x]) => {
  bookingV2OpsResetCache && bookingV2OpsResetCache();
  Object.assign(_bkV2, { tab: 'all', month: m, statusFilter: 'all', search: '', page: 1, newBooking: null, editingId: null }, x);
  bookingV2Render();
}, [month, extra]);
const rows = () => ev(() => [...document.querySelectorAll('.bkv2-tbl tr.bkr')].map((tr) => ({
  id: tr.dataset.id, tags: tr.querySelector('.bk-sub') ? tr.querySelector('.bk-sub').innerText : '', dupTitle: (tr.querySelector('.bkv2-tag.dup') || {}).title || '',
  soon: (tr.querySelector('.tv-soon') || {}).innerText || '', act: (tr.querySelector('.act') || {}).innerText || '', actTitle: (tr.querySelector('.act') || {}).title || '' })));
const row = async (id) => (await rows()).find((r) => r.id === id);
const serverRow = async (id, q) => ((await api('/v1/bookings?limit=100&q=' + encodeURIComponent(q || id))).bookings || []).find((b) => b.external_id === id);

// ═══ [L] the All-bookings list ═══
item('[L] All-bookings list · chips, last activity and KPI come from GET /v1/bookings and /stats');
{
  const n0 = calls.length;
  await openList(monthOf(D1));
  await waitScreen(() => document.querySelectorAll('.bkv2-tbl tr.bkr').length >= 2, null, 15000); await settle(900);
  ok('the list asks the server for the month (GET /v1/bookings?from&to) and the summary (GET /v1/bookings/stats)', calls.slice(n0).some((c) => /GET \/v1\/bookings\?.*from=/.test(c)) && calls.slice(n0).some((c) => /GET \/v1\/bookings\/stats/.test(c)), calls.slice(n0));
  const sA = await serverRow('zz-f3-A', 'ZZ F3 One'), sB = await serverRow('zz-f3-B', 'ZZ F3 Two'), sC = await serverRow('zz-f3-C', 'ZZ F3 Foc');
  console.log('    server flags A:', JSON.stringify({ n: sA.is_new, s: sA.is_soon, t: sA.is_today, d: sA.possible_duplicate, act: sA.last_activity }));
  const rA = await row('zz-f3-A'), rB = await row('zz-f3-B'), rC = await row('zz-f3-C');
  ok('rows A, B, C are on the screen', !!rA && !!rB && !!rC, [rA, rB, rC].map(Boolean));
  ok('chip "ใหม่" follows the server\'s is_new (A, B, C)', [[rA, sA], [rB, sB], [rC, sC]].every(([r, s]) => r.tags.includes('ใหม่') === !!s.is_new), { rA: rA.tags, sA: sA.is_new });
  ok('"อาจซ้ำ" follows possible_duplicate: A and B (same voucher) have it, C does not', rA.tags.includes('อาจซ้ำ') === !!sA.possible_duplicate && rB.tags.includes('อาจซ้ำ') === !!sB.possible_duplicate && !!sA.possible_duplicate && !!sB.possible_duplicate && !rC.tags.includes('อาจซ้ำ'), { a: rA.tags, sA: sA.possible_duplicate });
  ok('the "อาจซ้ำ" tooltip prints the server\'s reasons (legacy\'s Thai text)', sA.duplicates.length > 0 && sA.duplicates[0].reasons.every((t) => rA.dupTitle.includes(t)), { title: rA.dupTitle, reasons: sA.duplicates[0] && sA.duplicates[0].reasons });
  ok('"ใกล้ถึง" (travel in the next 2 days) follows is_soon: A yes, C (10 days away) no', (rA.soon.includes('ใกล้ถึง') || rA.soon.includes('วันนี้')) === !!sA.is_soon && !!sA.is_soon && rC.soon === '' && !sC.is_soon, { rA: rA.soon, sA: sA.is_soon, rC: rC.soon });
  ok('the Activity column prints the server\'s last_activity (a create)', sA.last_activity && sA.last_activity.kind === 'create' && rA.act.includes('สร้างใบจอง'), { act: rA.act, srv: sA.last_activity });

  // KPI: the server's own count of the rule; the status count (by_status.pending_foc) is 0 for a FOC quote
  const stats = await api('/v1/bookings/stats');
  const kpi = await ev(() => { const k = [...document.querySelectorAll('.bkv2-kpi')].find((x) => /pending foc/i.test(x.innerText)); return k && k.querySelector('.bkv2-kpi-val').innerText; });
  console.log('    stats:', JSON.stringify({ pending_foc_count: stats.pending_foc_count, by_status: stats.by_status }));
  ok('the Pending FOC card = stats.pending_foc_count (the status count would say ' + ((stats.by_status || {}).pending_foc || 0) + ')', stats.pending_foc_count >= 1 && String(kpi) === String(stats.pending_foc_count) && ((stats.by_status || {}).pending_foc || 0) !== stats.pending_foc_count, { kpi, stats });
  const pill = await ev(() => (document.querySelector('.bkv2-pill[data-st="pending_foc"]') || {}).innerText);
  ok('the Pending FOC pill carries the same number', /· *(\d+)/.exec(pill || '') && +/· *(\d+)/.exec(pill)[1] === stats.pending_foc_count, pill);
  const n1 = calls.length;
  await ev(() => bookingV2SetFilter('pending_foc')); await waitCall(/GET \/v1\/bookings\?.*pending_foc=true/, n1); await settle(900);
  const pf = await rows();
  const srvPf = (await api('/v1/bookings?pending_foc=true')).bookings.map((b) => b.external_id);
  ok('the pill asks GET /v1/bookings?pending_foc=true and shows exactly those bookings', JSON.stringify(pf.map((r) => r.id).sort()) === JSON.stringify(srvPf.filter((i) => pf.some((r) => r.id === i)).sort()) && pf.some((r) => r.id === 'zz-f3-C') && !pf.some((r) => r.id === 'zz-f3-A'), { pf: pf.map((r) => r.id), srvPf });
  await ev(() => bookingV2SetFilter('all')); await settle(300);
}

item('[L2] the screen follows the SERVER when it differs from legacy\'s arithmetic (one answer changed on its way)');
{
  hook.doctor['/v1/bookings'] = (j) => {
    for (const b of j.bookings || []) if (b.external_id === 'zz-f3-A') {
      b.is_new = false; b.is_soon = false; b.is_today = false; b.possible_duplicate = false; b.duplicates = [];
      b.last_activity = { at: new Date().toISOString(), kind: 'foc', text: 'ZZ SERVER SAYS FOC', by: 'zz-srv' };
    }
    return j;
  };
  await openList(monthOf(D1));
  await waitScreen(() => document.querySelectorAll('.bkv2-tbl tr.bkr').length >= 2, null, 15000); await settle(900);
  const rA = await row('zz-f3-A'), rB = await row('zz-f3-B');
  ok('A: no "ใหม่", no "อาจซ้ำ", no "ใกล้ถึง" although the browser would have drawn all three (created minutes ago, same voucher as B, travels tomorrow)', rA && !rA.tags.includes('ใหม่') && !rA.tags.includes('อาจซ้ำ') && rA.soon === '', rA);
  ok('A: the Activity cell prints the server\'s text and author', rA && rA.act.includes('ZZ SERVER SAYS FOC') && rA.act.includes('zz-srv'), rA);
  ok('B (not changed) still shows the real chips', rB && rB.tags.includes('อาจซ้ำ'), rB);
  delete hook.doctor['/v1/bookings'];
}

item('[L3] search asks the server (a month the screen has not loaded)');
{
  await openList(monthOf(D1));
  await waitScreen(() => document.querySelectorAll('.bkv2-tbl tr.bkr').length >= 2, null, 15000); await settle(600);
  const before = await ev((i) => SB_BOOKINGS.some((b) => b.id === i), 'zz-f3-F');
  const n0 = calls.length;
  await ev(() => bookingV2SetSearch('ZZ Faraway'));
  const asked = await waitCall(/GET \/v1\/bookings\?.*q=zz(%20|\+)faraway/i, n0, 8000);
  await waitScreen(() => [...document.querySelectorAll('.bkv2-tbl tr.bkr')].some((r) => r.dataset.id === 'zz-f3-F'), null, 8000); await settle(400);
  const r = await rows();
  ok('the booking of the other month is not in the browser before the search', before === false, before);
  ok('typing asks GET /v1/bookings?q=… and the hit is listed (legacy would say "No bookings match")', asked && r.length === 1 && r[0].id === 'zz-f3-F', { asked, r: r.map((x) => x.id), calls: calls.slice(n0) });
  await ev(() => bookingV2SetSearch('')); await settle(300);
}

// ═══ [W] warnings on a save, printed with the server's text ═══
item('[W] a save that repeats a voucher: the server\'s warning is shown with its own text');
{
  await openList(monthOf(D1)); await waitScreen(() => document.querySelectorAll('.bkv2-tbl tr.bkr').length >= 2, null, 15000); await settle(600);
  const d0 = dialogs.length, b0 = bodies.length;
  await ev(([D1]) => {
    bookingV2NewBooking();
    const d = _bkV2.newBooking;
    bookingV2SetBookingField('agentId', 'a01');
    Object.assign(d, { leadPax: 'ZZ F3 UI Dup', leadNationality: 'RU', leadPhone: '+7 900 000', hotelName: '', voucherRef: 'ZZ-V1' });
    d.pickupZoneFilter = 'NoTransfer'; d.pickupSelf = true; d.guides = { english: true, russian: false, chinese: false, otherLang: '' };
    d.trips = [Object.assign(bookingV2NewTrip(), { routeId: 'r5', date: D1, pax: { ad_fr: 1 }, zone: 'NoTransfer' })];
    bookingV2CommitBooking('confirmed');
  }, [D1]);
  await waitScreen(() => SB_BOOKINGS.some((x) => x.leadPax === 'ZZ F3 UI Dup' && x.opsId), null, 15000); await idle(); await settle(900);
  const saved = await api('/v1/bookings?q=' + encodeURIComponent('ZZ F3 UI Dup'));
  const srvB = saved.bookings[0];
  const text = await bodyText();
  const dups = await api('/v1/bookings/' + srvB.id + '/duplicates');
  ok('(server) the new booking repeats A and B: GET /v1/bookings/{id}/duplicates lists them with reasons', dups.duplicates.length >= 2 && dups.duplicates.every((x) => x.reasons.length), dups);
  ok('legacy\'s own confirm before saving still asked (the browser had A and B loaded)', dialogs.slice(d0).some((m) => /พบ booking ที่อาจซ้ำ/.test(m)), dialogs.slice(d0));
  ok('after the save the toast prints the SERVER\'s warning text "⚠ พบ booking ที่อาจซ้ำ N รายการ"', /⚠ พบ booking ที่อาจซ้ำ \d+ รายการ/.test(text), text.slice(0, 300));
  ok('and the reasons the server gave (voucher match)', text.includes('เลข Voucher ตรงกัน'), null);
  const postBody = bodies.slice(b0).filter((b) => b[0] === 'POST /v1/bookings').map((b) => JSON.parse(b[1]))[0] || {};
  const computed = ['warnings', 'duplicates', 'possible_duplicate', 'last_activity', 'is_new', 'is_soon', 'is_today', 'code_used'].filter((k) => k in postBody);
  ok('the request body carries no computed list field (warnings, duplicates, last_activity, is_*)', computed.length === 0 && Object.keys(postBody).length > 3, { computed, keys: Object.keys(postBody) });
}
{
  // the passenger-types warning: the form always fits the list, so show the printing with the server's real answer for an API save
  const w = await post('/v1/bookings', { external_id: 'zz-f3-pt', intent: 'confirm', agentId: 'a01', leadPax: 'ZZ F3 PT', leadNationality: 'RU', pickupSelf: true, guides: { english: true },
    trips: [{ routeId: 'r5', date: D1, pax: { ad_fr: 2 }, zone: 'NoTransfer' }], passengers: [{ name: 'p1', nationality: 'RU', type: 'CHD' }, { name: 'p2', nationality: 'RU', type: 'CHD' }] });
  const pt = (w.body.warnings || []).find((x) => x.code === 'passenger_types');
  ok('(server) 2 adults listed as children: warning code passenger_types with message, expected and listed', w.status === 201 && pt && pt.message && pt.expected && pt.listed, w.body.warnings);
  await ev((pt) => laOps.saveWarnings({ id: 'zz-f3-pt' }, [pt]), pt);
  await settle(300);
  const text = await bodyText();
  ok('laOps.saveWarnings prints that warning with the server\'s message', pt && text.includes(pt.message), pt && pt.message);
}

// ═══ [A] agent dropdown ═══
item('[A] agent dropdown · GET /v1/agents/ranking');
{
  const openDd = () => ev(() => { bookingV2NewBooking(); const inp = document.getElementById('bkv2-agent-input'); if (inp) { inp.focus(); } bookingV2AgentDDShow(); return !!document.getElementById('bkv2-agent-dd'); });
  await ev(() => { if (window.laOpsListRank) laOpsListRank._state().at = 0; });
  const n0 = calls.length;
  await ev(() => { _bkV2.tab = 'new'; bookingV2Render(); });
  await openDd(); await waitCall(/GET \/v1\/agents\/ranking/, n0); await settle(600);
  const srvRank = await api('/v1/agents/ranking');
  const dd = await ev(() => document.getElementById('bkv2-agent-dd').innerText);
  ok('opening the dropdown asks GET /v1/agents/ranking', calls.slice(n0).some((c) => c === 'GET /v1/agents/ranking'), calls.slice(n0));
  ok('"Recent" lists the agents the server says this login confirmed last (a01 · "today")', srvRank.recent.length >= 1 && /recent/i.test(dd) && /suntour/i.test(dd), { dd: dd.slice(0, 300), srvRank });
  // changed answer: B2C is recent, Sun Tour is "top" with 7 bookings
  hook.doctor['/v1/agents/ranking'] = () => ({ recent: [{ agent_id: 'a_b2c', at: new Date().toISOString() }], top: [{ agent_id: 'a01', count: 7 }], window_days: 30 });
  await ev(() => { laOpsListRank._state().at = 0; laOpsListRank._state().shape = null; });
  const n1 = calls.length;
  await ev(() => { bookingV2AgentDDShow(); }); await waitCall(/GET \/v1\/agents\/ranking/, n1); await settle(700);
  const dd2 = await ev(() => document.getElementById('bkv2-agent-dd').innerText);
  ok('a changed server answer changes the dropdown: B2C under Recent, Sun Tour under Top with "7 bookings"', /recent[\s\S]*B2C[\s\S]*top[\s\S]*SUNTOUR[\s\S]*7 bookings/i.test(dd2), dd2.slice(0, 500));
  delete hook.doctor['/v1/agents/ranking'];
  await ev(() => { _bkV2.newBooking = null; _bkV2.tab = 'all'; bookingV2Render(); });
}

// ═══ [K] lock banner and save-time confirm ═══
item('[K] seat-lock banner and the save-time confirm print the server\'s warning text');
{
  const lock = (await post('/v1/seat-locks', { route_id: 'r5', service_date: D2, pax: 8, holder_type: 'agent', agent_id: 'a01' })).body;
  await ev(() => laOps.locks.reload()); await idle();
  hook.doctor['/v1/quote/lock-draws'] = (j) => { for (const t of j.trips || []) if (t.lock_draws && t.lock_draws.warning) { t.lock_draws.warning.message = 'ZZ SERVER BANNER · มี ' + t.lock_draws.warning.free + ' ที่ว่าง'; t.lock_draws.warning.save_line = 'ZZ SERVER SAVE LINE'; } return j; };
  await ev(([D2]) => {
    _bkV2.tab = 'new'; bookingV2NewBooking();
    const d = _bkV2.newBooking;
    bookingV2SetBookingField('agentId', 'a01');
    Object.assign(d, { leadPax: 'ZZ F3 LOCKS', leadNationality: 'RU', leadPhone: '+7 900 000', hotelName: '', voucherRef: '' });
    d.pickupZoneFilter = 'NoTransfer'; d.pickupSelf = true; d.guides = { english: true, russian: false, chinese: false, otherLang: '' };
    d.trips = [Object.assign(bookingV2NewTrip(), { routeId: 'r5', date: D2, pax: { ad_fr: 2 }, zone: 'NoTransfer' })];
    bookingV2Render();
  }, [D2]);
  const n0 = calls.length;
  await waitCall(/POST \/v1\/quote\/lock-draws/, n0); await settle(900);
  const txt = await bodyText();
  ok('the banner prints the server\'s warning.message', txt.includes('ZZ SERVER BANNER'), txt.slice(0, 200));
  const free = (await post('/v1/quote/lock-draws', { agentId: 'a01', trips: [{ routeId: 'r5', date: D2, pax: { ad_fr: 2 } }] })).body.trips[0].lock_draws;
  ok('(server) the real warning is there: locks_free_none_drawn with the free seats', free.warning && free.warning.code === 'locks_free_none_drawn' && free.warning.free >= 8, free.warning);
  ok('the button says how many seats the server would draw', txt.includes('ดึง ' + free.warning.would_draw + ')'), { would: free.warning.would_draw });
  answer.refuse = /seat lock ที่ยังไม่ได้ใช้/;
  const d0 = dialogs.length;
  await ev(() => bookingV2CommitBooking('confirmed')); await settle(600);
  const dl = dialogs.slice(d0).find((m) => /seat lock ที่ยังไม่ได้ใช้/.test(m)) || '';
  answer.refuse = null;
  ok('the save-time confirm lists the server\'s warning.save_line', dl.includes('ZZ SERVER SAVE LINE'), dialogs.slice(d0));
  ok('Cancel on that confirm saved nothing', (await api('/v1/bookings?q=' + encodeURIComponent('ZZ F3 LOCKS'))).bookings.length === 0, null);
  delete hook.doctor['/v1/quote/lock-draws'];
  await ev(() => { _bkV2.newBooking = null; _bkV2.tab = 'all'; bookingV2Render(); });
}

// ═══ [B] By-trip ═══
item('[B] By-trip · re-confirm chip, return-van chip, overnight rows');
const openDay = async (d) => { await ev((d) => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; _bkV2.newBooking = null; try { bookingV2Tab2PickDay(d); } catch (_) {} bookingV2Render(); }, d); await settle(1200); };
const chips = () => ev(() => [...document.querySelectorAll('.t2-hd-warnchip')].map((c) => c.innerText.replace(/\s+/g, ' ')));
const modeCard = (name) => ev((n) => { const b = [...document.querySelectorAll('.bt-mc')].find((x) => x.title === n); return b ? b.innerText.replace(/\s+/g, ' ') : null; }, name);
{
  const n0 = calls.length;
  await openDay(D1);
  await waitCall(/GET \/operations\/by-trip/, n0); await waitCall(/GET \/operations\/van-board/, n0); await settle(900);
  const srv = await api('/operations/by-trip?date=' + D1);
  const rc = srv.warnings.reconfirm;
  const cs = await chips();
  console.log('    chips:', JSON.stringify(cs), ' server reconfirm:', JSON.stringify(rc));
  ok('the page asks GET /operations/by-trip and GET /operations/van-board for the day', calls.slice(n0).some((c) => /GET \/operations\/by-trip\?date=/.test(c)) && calls.slice(n0).some((c) => /GET \/operations\/van-board\?date=/.test(c)), calls.slice(n0));
  ok('the Re-confirm chip = warnings.reconfirm (' + rc.pax + ' pax) and the mode card counts ' + rc.bookings, cs.some((c) => c.includes('Re-confirm') && c.includes(rc.pax + ' pax')) && /Re-confirm.*not confirmed.*\b/.test(await modeCard('Re-confirm') || '') && (await modeCard('Re-confirm')).includes(String(rc.bookings)), { cs, card: await modeCard('Re-confirm') });
  // the server says something else than the browser would count
  hook.doctor['/operations/by-trip'] = (j) => { j.warnings.reconfirm = { bookings: 7, pax: 11, by_route: [{ route_id: 'r5', pax: 11 }] }; return j; };
  hook.doctor['/operations/van-board'] = (j) => { const r = (j.routes || []).find((x) => x.route_id === 'r5') || (j.routes[0] = { route_id: 'r5', route_name: 'x', return_unarranged: [] }); r.return_unarranged = [{ booking_id: 'zz', trip_id: 'zz', lead_pax: 'ZZ', drop: 'Hotel', pax: 3 }]; if (!j.routes.includes(r)) j.routes.push(r); return j; };
  await ev(() => laOps.wrote && laOps.wrote('booking'));     // any write marks the by-trip and van-board answers stale
  await settle(300); await ev(() => bookingV2Render()); await settle(1500);
  const cs2 = await chips();
  console.log('    chips (doctored):', JSON.stringify(cs2));
  ok('Re-confirm chip prints the server\'s 11 pax (not the browser\'s count) and its mode card 7', cs2.some((c) => c.includes('Re-confirm') && c.includes('11 pax')) && (await modeCard('Re-confirm') || '').includes('7'), { cs2, card: await modeCard('Re-confirm') });
  ok('"รถกลับ" chip prints the van board\'s return_unarranged (3 pax)', cs2.some((c) => c.includes('รถกลับ') && c.includes('3 pax')), cs2);
  delete hook.doctor['/operations/by-trip']; delete hook.doctor['/operations/van-board'];
}
{
  // the overnight charter: day 2 of 4 has no trip of its own, so its booking is not in the day's load
  const srv = await api('/operations/by-trip?date=' + OV[1]);
  const h = (srv.ovn_holds || [])[0];
  ok('(server) ovn_holds has the held night: day 2 of 4, 2 on the island', h && h.day === 2 && h.days === 4 && h.island_pax === 2, srv.ovn_holds);
  const had = await ev((id) => SB_BOOKINGS.some((b) => b.opsId === id), h && h.booking_id);
  const n0 = calls.length;
  await openDay(OV[1]);
  await waitCall(new RegExp('GET /v1/bookings/' + (h && h.booking_id)), n0, 8000); await settle(1200);
  const row = await ev(() => { const e = document.querySelector('.t2-ovnh'); return e ? { a: e.innerText, b: (document.querySelector('.t2-ovnh2') || {}).innerText } : null; });
  ok('the booking was not in the browser; the page read it (GET /v1/bookings/{id}) because the server listed the hold', had === false && calls.slice(n0).some((c) => c === 'GET /v1/bookings/' + h.booking_id), { had, calls: calls.slice(n0) });
  ok('the overnight row shows the server\'s "day 2/4" and "2 คนอยู่บนเกาะ"', row && row.a.includes('วันที่ 2/4') && row.b.includes(h.island_pax + ' คน'), row);
}

// ═══ [C] costing: the Fact Sheet from sheet.* ═══
item('[C] Fact Sheet drawn from the server\'s sheet · and pax / pax_th clamp while typing');
{
  const planA = await post('/v1/costing/plans', { name: 'F3 Rented', route_key: 'r4', engines: '3EN', boats: 1, capacity: 64, pax: 30, pax_th: 5, price: 2500, child_pct: 10, price_child: 1500, commission_pct: 5, fuel_price: 38,
    itinerary: [{ t: '08:00', a: 'Pier', k: '0' }, { t: '09:30', a: 'Island', k: '24.5' }] });
  ok('seed: a plan', planA.status === 201, planA);
  await goView(page, 'costing', 1500);
  await ev(() => laOps.costingPL.loadCosting());
  await ev((id) => { _ct.pid = id; ctSetTab('plan'); }, planA.body.id);
  await settle(500);
  // a rented boat with a contract span, so the rent block, the contract by month and best / base / worst are all drawn
  await ev((id) => { _ct.pid = id; ctSetTab('plan'); ctPlanSet('boatId', 'b6'); ctRentSet('b6', 'on', 1); ctRentSet('b6', 'amt', 300000); ctRentSet('b6', 'days', 30); ctRentSet('b6', 'off', 4); ctRentSet('b6', 'from', '2026-11-01'); ctRentSet('b6', 'to', '2027-04-30'); }, planA.body.id);
  await idle(); await settle(800);
  await waitScreen((id) => { const pl = ctPlan(id); return !!laOps.costingPL.answer(pl); }, planA.body.id, 12000); await settle(600);
  const have = await ev((id) => !!laOps.costingPL.answer(ctPlan(id)), planA.body.id);
  ok('the design sheet has the server\'s answer for the plan (POST /v1/costing/calc)', have, null);
  const plan = (await api('/v1/costing/plans')).plans ? (await api('/v1/costing/plans')).plans.find((p) => p.id === planA.body.id) : null;
  const srv = await api('/v1/costing/plans/' + planA.body.id);
  const S = srv.sheet;
  console.log('    server sheet: rent', !!S.rent, 'contract', S.contract && S.contract.state, 'levels', S.price_levels.length, 'months', S.contract && S.contract.rows && S.contract.rows.length);

  // 1. the redraw is the same sheet as legacy's own drawing (same markup, same numbers)
  const both = await ev((id) => {
    const pl = ctPlan(id), strip = (h) => h.replace(/ออกเมื่อ[^<]*/g, '').replace(/<span>\d{4}-\d\d-\d\d \d\d:\d\d<\/span>/g, '');
    const w = window.ctFactSheet, orig = w.__orig;
    const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
    const srvHtml = strip(w(pl)), legacyHtml = strip(orig(pl));
    return { srvHtml, legacyHtml, srvText: text(srvHtml).replace(/\s+/g, ' '), legacyText: text(legacyHtml).replace(/\s+/g, ' '), wrapped: !!w.__opsSheet };
  }, planA.body.id);
  // the server rounds every amount to 2 decimals before the screen rounds to baht, legacy rounded once: a half-satang can show 1 baht apart (decision in docs/walk/w4-f3.md)
  const near = (a, b) => { const A = a.split(/(\d[\d,]*)/), B = b.split(/(\d[\d,]*)/); if (A.length !== B.length) return false; return A.every((x, i) => (i % 2 === 0 ? x === B[i] : Math.abs(+x.replace(/,/g, '') - +B[i].replace(/,/g, '')) <= 1)); };
  const where = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return { at: i, srv: a.slice(Math.max(0, i - 100), i + 160), legacy: b.slice(Math.max(0, i - 100), i + 160) }; };
  ok('ctFactSheet is wrapped, and its text is the same as legacy\'s own drawing (same Thai words, every figure equal to the baht or 1 apart)', both.wrapped && near(both.srvText, both.legacyText), where(both.srvText, both.legacyText));
  ok('and the markup is the same (class names, table structure)', near(both.srvHtml, both.legacyHtml), where(both.srvHtml, both.legacyHtml));

  // 2. the figures are the sheet's: a marker put in the cached answer shows up in the printed sheet
  const marked = await ev((id) => {
    const pl = ctPlan(id), a = laOps.costingPL.answer(pl), s = a.sheet;
    const keep = JSON.stringify(a);
    s.key_figures.profit = 123457; s.key_figures.break_even = 17; s.key_figures.break_even_load_pct = 27;
    s.price_levels[0].profit = 99001; s.vat.payable = 88002;
    if (s.rent) { s.rent.days_needed = 41; s.rent.within_run_days = true; s.rent.spare_days = 3; s.rent.heads_needed = 54321; }
    if (s.contract && s.contract.rows) { s.contract.rows[0].rent_due = 77003; s.contract.scenarios[2].total.net = 66004; }
    const html = ctFactSheet(pl);
    Object.assign(a, JSON.parse(keep)); a.sheet = JSON.parse(keep).sheet;
    return html;
  }, planA.body.id);
  const mt = await ev((h) => { const d = document.createElement('div'); d.innerHTML = h; return d.innerText.replace(/\s+/g, ' '); }, marked);
  ok('server figures drive the sheet: profit +123,457, break-even 17, level profit, VAT payable, rent days, month rent, best-case net', ['+123,457', '17 คน', '99,001', '88,002', '54,321', '77,003', '66,004'].every((x) => mt.includes(x)), ['+123,457', '17 คน', '99,001', '88,002', '54,321', '77,003', '66,004'].filter((x) => !mt.includes(x)));

  // 3. printing: the sheet in a new window comes from the same function
  const popupP = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
  await ev(() => { try { ctFactPrint(); } catch (e) { console.warn(e); } });
  const popup = await popupP;
  if (popup) {
    await settle(600);
    const ptxt = await popup.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    ok('ctFactPrint opens the sheet with the server\'s figures (key figures, five price levels)', ptxt.includes('Fact Sheet') && ptxt.includes('ราคา 5 ระดับ') && ptxt.includes(Math.round(S.key_figures.cost.net).toLocaleString()), ptxt.slice(0, 200));
    await popup.close();
  } else console.log('  - the pop-up was not allowed in this browser run (not asserted)');

  // 4. clamp while typing
  await ev((id) => { _ct.pid = id; ctSetTab('plan'); }, planA.body.id); await settle(400);
  const b0 = bodies.length;
  await (await page.$('input[data-fk="pl.pax"]')).fill('0'); await idle(); await settle(900);
  const pax0 = await ev((id) => ({ pax: ctPlan(id).pax, shown: (document.querySelector('input[data-fk="pl.pax"]') || {}).value }), planA.body.id);
  ok('typing 0 in "จำนวนคนที่คาด" is clamped to 1 on screen at once (as the column header does)', pax0.pax === 1 && pax0.shown === '1', pax0);
  await (await page.$('input[data-fk="pl.pax"]')).fill('20'); await idle(); await settle(500);
  await (await page.$('input[data-fk="pl.paxTH"]')).fill('50'); await idle(); await settle(900);
  const th = await ev((id) => ({ pax: ctPlan(id).pax, th: ctPlan(id).paxTH, shown: (document.querySelector('input[data-fk="pl.paxTH"]') || {}).value }), planA.body.id);
  ok('typing 50 Thai guests with 20 heads is clamped to 20 on screen', th.th === 20 && th.shown === '20', th);
  const patches = bodies.slice(b0).filter((b) => b[0] === 'PATCH /v1/costing/plans/' + planA.body.id).map((b) => JSON.parse(b[1]));
  ok('no PATCH ever carried pax 0 or pax_th above pax', patches.length > 0 && patches.every((p) => (p.pax === undefined || p.pax >= 1) && (p.pax_th === undefined || p.pax === undefined || p.pax_th <= p.pax)), patches);
  const srv2 = await api('/v1/costing/plans/' + planA.body.id);
  ok('the server holds the same numbers the screen shows', srv2.pax === 20 && srv2.pax_th === 20, { pax: srv2.pax, th: srv2.pax_th });
  ok('the PATCH bodies carry no computed field (calc, sheet, break_even, seats)', patches.every((p) => !('calc' in p) && !('sheet' in p) && !('break_even' in p) && !('seats' in p)), patches[0]);
}

console.log('\nserver refusals the app received (' + refusals.length + '):'); refusals.slice(0, 8).forEach((r) => console.log('  ' + r));
ok('no page errors', errors.length === 0, errors.slice(0, 5));
console.log(fails.length ? `\n✖ ${fails.length} failed:\n  - ${fails.join('\n  - ')}` : '\n✓ all passed');
cleanup();
process.exit(fails.length ? 1 : 0);
