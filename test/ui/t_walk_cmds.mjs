// t_walk_cmds · browser walk of the Q36 check-in commands and the Q33 moved-away read, against a REAL operation-backend
// (in-process store, seeded). Every check reads BOTH sides: the screen and what the server holds (asked directly).
//   node test/ui/t_walk_cmds.mjs
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

const DAY = '2026-11-10', DAY2 = '2026-11-11';

// ── seed through the API ──
for (const d of [DAY, DAY2]) await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: d, capacity: 40 });
const mkVan = async (name, cap) => (await send('POST', '/operations/vans', { name, capacity: cap })).body;
const vanA = await mkVan('Van Alpha', 12), vanB = await mkVan('Van Bravo', 12);
for (const d of [DAY, DAY2]) for (const v of [vanA, vanB]) await send('PUT', `/operations/van-days/${d}/${v.id}`, { route_ids: ['r5'] });
const mkBk = async (id, lead, date, pax, extra = {}) => send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: 'r5', date, pax: { ad_fr: pax }, zone: 'PK' }], ...extra });
const agR = await send('POST', '/v1/agents', { name: 'Cot Agent', market_id: 'ru', pay_type: 'cot', vat_mode: 'none', rate_type_id: 'rt001', company: { legal_name: 'Cot Agent Co', address: '1 Test Rd' } });
const cotAgent = agR.body.id;
const bk = {};
for (const [k, lead, pax, extra] of [['k1', 'CMD ONE', 2, {}], ['k2', 'CMD TWO', 3, {}], ['k3', 'CMD THREE', 2, {}], ['k4', 'CMD FOUR', 2, {}], ['k5', 'CMD FIVE', 3, {}], ['k6', 'CMD SIX', 1, {}],
  ['kc', 'CMD COT', 2, { agentId: cotAgent, cash_on_tour_amount: 3000, cash_on_tour_currency: 'THB' }], ['ks', 'CMD STRAND', 2, {}]]) {
  const r = await mkBk('zz-' + k, lead, DAY, pax, extra);
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body)); process.exit(2); }
  bk[k] = { id: r.body.id, trip: r.body.trips[0].id };
}
const mkGroup = async (members, van_id) => (await send('POST', '/operations/van-groups', { service_date: DAY, route_id: 'r5', zone: 'PK', members: members.map((m) => ({ trip_id: bk[m].trip })), van_id })).body;
await mkGroup(['k1', 'k2', 'k3', 'ks'], vanA.id); await mkGroup(['k4', 'k5', 'k6', 'kc'], vanB.id);

// ── helpers ──
const rec = async (k, side, slot = 0) => { const t = (await api('/v1/bookings/' + bk[k].id)).trips[0].operations.checkins[side].find((r) => r.slot === slot); return t || null; };
const lastPost = (re) => { const b = bodies.filter((x) => re.test(x.k)).pop(); return b ? { status: b.status, req: b.req ? JSON.parse(b.req) : null, json: (() => { try { return JSON.parse(b.body); } catch (_) { return null; } })() } : null; };
const screenRec = (k, side) => ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === 'zz-' + a.k); return JSON.parse(JSON.stringify(ckRead(b, a.d, a.side) || null)); }, { k, d: DAY, side });
const COMPUTED = ['actual_pax', 'expected', 'no_show', 'self_add', 'reinstate', 'checked_in_at', 'checked_in_by', 'arrived_at', 'arrived_by', 'cleared_at', 'cleared_by', 'flow_at', 'flow_by', 'by', 'ts'];
const noComputed = (req) => !req || !Object.keys(req).some((x) => COMPUTED.includes(x));
const nonGet = (n) => callsSince(n).filter((c) => !c.startsWith('GET'));
let n0 = 0;

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1000);
const openVanCk = async (date) => {
  await ev((d) => { _vanCkDate = d; const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el); renderVanCheckin(); }, date);
  await waitFor(() => document.querySelector('#vancheckin-host .vck-arr'), null, 15000);
  await idle(); await settle(800);
};
const openPier = async (date) => {
  await ev((d) => { _pckDate = d; const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); renderPierCheckin(); }, date);
  await waitFor(() => !!document.querySelector('#piercheckin-host'), null, 10000);
  await idle(); await ev(() => laOpsPierMoney.loadDay(_pckDate, true)); await settle(1500);
};
const pageText = () => ev(() => document.body.innerText);
await openVanCk(DAY);

// ════════════ 1. ckToggle (the tick) ════════════
curItem = '1'; console.log('\n[1] ckToggle: POST …/check-in');
n0 = calls.length;
await page.locator('#vancheckin-host select.vck-sel[onchange*="zz-k1"]').first().selectOption('checkin');
await idle(); await settle(1200);
let p = lastPost(/POST .*\/checkins\/van\/0\/check-in$/), r1 = await rec('k1', 'van'), s1 = await screenRec('k1', 'van');
ok('tick: POST …/van/0/check-in 200 with an empty body (no stamp, no count)', p && p.status === 200 && JSON.stringify(p.req) === '{}', p);
ok('server: ticked in with the count defaulted to the booking (2 of 2), stamped by the login', r1 && r1.checked_in_at && r1.checked_in_by && r1.checked_in_by !== '—' && r1.actual_pax === 2 && r1.expected === 2, r1);
ok('screen: the row shows the server\'s stamp and count', s1 && s1.at === r1.checked_in_at && s1.by === r1.checked_in_by && s1.actualPax === 2, s1);
ok('no PUT of a whole record was sent', !nonGet(n0).some((c) => /^PUT /.test(c)), nonGet(n0));
await ev(() => ckToggle('zz-k1', '2026-11-10', 'van'));
await idle(); await settle(1200);
r1 = await rec('k1', 'van'); s1 = await screenRec('k1', 'van');
ok('second press unticks and keeps the count (server and screen)', r1.checked_in_at === null && r1.actual_pax === 2 && s1.at === null && s1.actualPax === 2, { r1, s1 });

// ════════════ 2. ckStep + ckReasonSave ════════════
curItem = '2'; console.log('\n[2] ckStep: POST …/count · reason_needed opens the reason dialog · ckReasonSave: PUT …/reason');
await ev(() => document.querySelector('#vancheckin-host button[onclick*="ckStep(\'zz-k2\'"][onclick$=",-1)"]').click());
await idle(); await settle(1200);
p = lastPost(/POST .*\/checkins\/van\/0\/count$/); let r2 = await rec('k2', 'van');
ok('minus: POST …/count {delta:-1} and nothing else', p && p.status === 200 && JSON.stringify(p.req) === '{"delta":-1}', p);
ok('server: count 2 of 3 expected, no_show 1, no reason yet; warning reason_needed in the answer', r2.actual_pax === 2 && r2.expected === 3 && r2.no_show === 1 && !r2.reason_code && p.json.warnings.some((w) => w.code === 'reason_needed'), { r2, w: p.json.warnings });
ok('screen: count 2 and legacy\'s reason dialog is open', (await screenRec('k2', 'van')).actualPax === 2 && (await ev(() => !!document.querySelector('#ck-reason-ov [onclick*="ckReasonPick"]'))), null);
const code = await ev(() => CK_NOSHOW_REASONS[0].code);
await ev((c) => { ckReasonPick(c); document.getElementById('ck-reason-note').value = 'phone off'; ckReasonSave(); }, code);
await idle(); await settle(1200);
p = lastPost(/PUT .*\/checkins\/van\/0\/reason$/); r2 = await rec('k2', 'van');
ok('reason: PUT …/reason with the code, the note and the time only', p && p.status === 200 && p.req.reason_code === code && p.req.reason_note === 'phone off' && noComputed(p.req), p);
ok('server: reason stored, the count did not move; dialog closed', r2.reason_code === code && r2.reason_note === 'phone off' && r2.actual_pax === 2 && !(await ev(() => !!document.querySelector('#ck-reason-ov'))), r2);
await ev(() => document.querySelector('#vancheckin-host button[onclick*="ckStep(\'zz-k2\'"][onclick$=",1)"]').click());
await idle(); await settle(1000);
r2 = await rec('k2', 'van');
ok('plus back to 3: reason cleared by the server (nobody short)', r2.actual_pax === 3 && !r2.reason_code, r2);
n0 = calls.length;
await ev(() => document.querySelector('#vancheckin-host button[onclick*="ckStep(\'zz-k2\'"][onclick$=",1)"]').click());
await idle(); await settle(1000);
ok('plus at the ceiling: answered 200, nothing changed, no error toast', nonGet(n0).every((c) => /POST .*count 200/.test(c)) && (await rec('k2', 'van')).actual_pax === 3 && !/Could not change the count/.test(await pageText()), nonGet(n0));
// the redraw from the answer keeps the scroll and does not cut off a note being typed
await ev(() => { document.body.style.minHeight = '5000px'; const i = document.createElement('input'); i.id = 'zz-typing'; i.value = 'half a no'; document.body.appendChild(i); window.scrollTo(0, 240); i.focus(); });
await ev(() => ckStep('zz-k2', '2026-11-10', 'van', -1));
await idle(); await settle(1200);
const keep = await ev(() => ({ y: Math.round(window.scrollY), focus: document.activeElement && document.activeElement.id, val: (document.getElementById('zz-typing') || {}).value }));
ok('after the answer: scroll kept (240), the input being typed in keeps focus and its text', Math.abs(keep.y - 240) < 5 && keep.focus === 'zz-typing' && keep.val === 'half a no', keep);
await ev(() => { document.getElementById('zz-typing').remove(); document.body.style.minHeight = ''; ckReasonClose(); });
await ev(() => ckStep('zz-k2', '2026-11-10', 'van', 1)); await idle(); await settle(600);

// ════════════ 3. events: ckEvSave, ckTrySave, ckBackSave ════════════
curItem = '3'; console.log('\n[3] ckEvSave: POST …/events · ckTrySave: …/tries · ckBackSave: …/undo');
await ev(() => ckEventOpen('zz-k3', '2026-11-10', 'van', 'no_show'));
await ev((c) => { ckEvPick(c); _ckEvBumpK('ad', 1); document.getElementById('ck-reason-note').value = 'no answer'; }, code);
await ev(() => ckEvSave());
await idle(); await settle(1200);
p = lastPost(/POST .*\/checkins\/van\/0\/events$/); let r3 = await rec('k3', 'van');
ok('event: POST …/events {type, reason_code, ad/chd/inf/foc, note, at} with no by/ts/count', p && p.status === 200 && p.req.type === 'no_show' && p.req.reason_code === code && p.req.ad === 1 && p.req.chd === 0 && p.req.note === 'no answer' && noComputed(p.req), p);
ok('server: one event, count 1 of 2, event stamped with the login and the server clock', r3.events.length === 1 && r3.actual_pax === 1 && r3.expected === 2 && r3.events[0].by && r3.events[0].ts && r3.reason_code === code, r3);
ok('screen: event and count are the server\'s; dialog closed', await ev(() => { const k = ckRead(SB_BOOKINGS.find((x) => x.id === 'zz-k3'), '2026-11-10', 'van'); return k.events.length === 1 && k.actualPax === 1 && !document.querySelector('#ck-reason-ov'); }), null);
await ev(() => ckTryOpen('zz-k3', '2026-11-10', 'van'));
await ev(() => { document.getElementById('ck-try-note').value = 'lobby empty'; ckTrySave(); });
await idle(); await settle(1200);
p = lastPost(/POST .*\/events\/0\/tries$/); r3 = await rec('k3', 'van');
ok('try: POST …/events/0/tries; the server holds the look and no number moved', p && p.status === 200 && p.req.note === 'lobby empty' && noComputed(p.req) && r3.events[0].tries.length === 1 && r3.actual_pax === 1, { p, tries: r3.events[0].tries });
await ev(() => ckBackOpen('zz-k3', '2026-11-10', 'van'));
await ev(() => { document.getElementById('ck-bk-note').value = 'found at the gate'; ckBackSave(); });
await idle(); await settle(1200);
p = lastPost(/POST .*\/events\/0\/undo$/); r3 = await rec('k3', 'van');
ok('undo: POST …/events/0/undo {why:"found", note}', p && p.status === 200 && p.req.why === 'found' && p.req.note === 'found at the gate' && noComputed(p.req), p);
ok('server: event struck (kept), count back to 2, reason cleared', r3.events.length === 1 && r3.events[0].undone && r3.events[0].undone.why === 'found' && r3.actual_pax === 2 && !r3.reason_code, r3);
ok('screen: the struck event shows as handled (ckBackList empty)', await ev(() => ckBackList(ckRead(SB_BOOKINGS.find((x) => x.id === 'zz-k3'), '2026-11-10', 'van')).length === 0), null);

// ════════════ 4. a refusal is shown with the server's message ════════════
curItem = '4'; console.log('\n[4] refusals: the server\'s message on screen');
await ev(() => ckEventOpen('zz-k1', '2026-11-10', 'van', 'no_show'));
await ev((c) => { ckEvPick(c); _ckEvAll(0); ckEvSave(); }, code);          // both people of k1 gone
await idle(); await settle(1000);
ok('k1: no-show of 2 -> count 0 on the server', (await rec('k1', 'van')).actual_pax === 0, await rec('k1', 'van'));
await ev((c) => { window._ckEv = { bkId: 'zz-k1', date: '2026-11-10', kind: 'van', type: 'no_show', code: c, note: '', at: '10:00' }; window._ckEvMixed = false; ckEvSave(); }, code);
await idle(); await settle(1200);
const ref = refusals.filter((x) => /events -> 409/.test(x)).pop() || '';
const msgOf = (() => { try { return JSON.parse(ref.replace(/^[^{]*/, '')).message; } catch (_) { return null; } })();
ok('nobody left: 409 nobody_left, the server\'s message is on screen, the event list is unchanged', /nobody_left/.test(ref) && msgOf && (await pageText()).includes(msgOf.slice(0, 25)) && (await rec('k1', 'van')).events.length === 1, { ref, msgOf });
await ev(() => ckReasonClose());

// ════════════ 5. vckSetFlow ════════════
curItem = '5'; console.log('\n[5] vckSetFlow: POST …/stage {flow}');
await openVanCk(DAY);
await ev(() => vckStatus('zz-k4', '2026-11-10', 'van', 'standby'));
await idle(); await settle(1200);
p = lastPost(/POST .*\/checkins\/van\/0\/stage$/); let r5 = await rec('k4', 'van');
ok('status Standby: POST …/stage {flow:"standby"}, no flow_at/flow_by sent', p && p.status === 200 && JSON.stringify(p.req) === '{"flow":"standby"}', p);
ok('server: flow standby stamped with a time and the login; screen shows it', r5.flow === 'standby' && r5.flow_at && r5.flow_by && (await screenRec('k4', 'van')).flow === 'standby' && (await screenRec('k4', 'van')).flowAt === r5.flow_at, { r5 });
await ev(() => vckSetFlow('zz-k4', '2026-11-10', 'van', 'pending', 'looking'));
await idle(); await settle(1000);
r5 = await rec('k4', 'van');
ok('pending with a note: POST …/stage {flow, note}', lastPost(/POST .*\/checkins\/van\/0\/stage$/).req.note === 'looking' && r5.flow === 'pending' && r5.flow_note === 'looking', r5);
await ev(() => vckSetFlow('zz-k4', '2026-11-10', 'van', ''));
await idle(); await settle(1000);
r5 = await rec('k4', 'van');
ok('cleared: flow null and its stamps gone', r5.flow === null && r5.flow_at === null && r5.flow_by === null, r5);

// ════════════ 6. Pier: self-add, reinstate, stage, pay_owed ════════════
curItem = '6'; console.log('\n[6] Pier: ckStep -> ckSelfSave, ckPierReinstate, pckStageSet, the pay warning');
// k5 (3): the van lost 1 -> the pier expects 2
await ev(() => ckEventOpen('zz-k5', '2026-11-10', 'van', 'no_show'));
await ev((c) => { ckEvPick(c); _ckEvBumpK('ad', 1); ckEvSave(); }, code);
await idle(); await settle(1000);
await openPier(DAY);
await ev(() => document.querySelector('#piercheckin-host button[onclick*="ckStep(\'zz-k5\'"][onclick$=",1)"]').click());
await idle(); await settle(1200);
p = lastPost(/POST .*\/checkins\/pier\/0\/count$/);
ok('pier plus past the 2 expected: POST …/count answered 409 needs_self_add, legacy\'s self-add dialog opened (no error toast)', p && p.status === 409 && p.json.code === 'needs_self_add' && (await ev(() => !!document.getElementById('ck-self-go'))) && !/Could not change the count/.test(await pageText()), p);
await ev(() => { ckSelfBump('ad', 1); document.getElementById('ck-self-note').value = 'taxi'; ckSelfSave(); });
await idle(); await settle(1200);
p = lastPost(/POST .*\/checkins\/pier\/0\/self-add$/); let r6 = await rec('k5', 'pier');
ok('self-add: POST …/self-add {ad,chd,inf,foc,note} only', p && p.status === 200 && p.req.ad === 1 && p.req.note === 'taxi' && noComputed(p.req) && !('pax' in p.req), p);
ok('server: self_add 1 stamped by the login, pier count 3, nothing short', r6.self_add && r6.self_add.pax === 1 && r6.self_add.by && r6.actual_pax === 3 && r6.no_show === 0, r6);
ok('screen: pier row shows 3 and the dialog is closed', (await screenRec('k5', 'pier')).actualPax === 3 && !(await ev(() => !!document.getElementById('ck-self-go'))), await screenRec('k5', 'pier'));
// k1: the van lost both -> pier reinstate
await ev(() => ckPierReinstate('zz-k1', '2026-11-10', true));
await idle(); await settle(1200);
p = lastPost(/POST .*\/checkins\/pier\/0\/reinstate$/); r6 = await rec('k1', 'pier');
ok('reinstate: legacy confirm, then POST …/reinstate {on:true}', dialogs.some((d) => /ยืนยันว่าลูกค้ามาถึงท่าจริง/.test(d)) && p && p.status === 200 && JSON.stringify(p.req) === '{"on":true}', p);
ok('server: reinstate stamped, pier count = expected = 2; the van record untouched (still 0)', r6.reinstate && r6.reinstate.by && r6.actual_pax === 2 && r6.expected === 2 && (await rec('k1', 'van')).actual_pax === 0, r6);
await ev(() => ckPierReinstate('zz-k1', '2026-11-10', false));
await idle(); await settle(1000);
ok('reinstate off: POST {on:false}; the mark is gone on the server', JSON.stringify(lastPost(/POST .*\/checkins\/pier\/0\/reinstate$/).req) === '{"on":false}' && (await rec('k1', 'pier')).reinstate === null, await rec('k1', 'pier'));
// stages on k3 (2 people, van fine)
const stage = async (st) => { await ev((s) => pckStageSet('zz-k3', '2026-11-10', s, 'pier'), st); await idle(); await settle(1000); return rec('k3', 'pier'); };
let r9 = await stage('arr');
p = lastPost(/POST .*\/checkins\/pier\/0\/stage$/);
ok('stage Arrived: POST …/stage {stage:"arrived",on:true}; server stamps arrived_at/by', JSON.stringify(p.req) === '{"stage":"arrived","on":true}' && r9.arrived_at && r9.arrived_by && !r9.cleared_at, { p: p.req, r9 });
r9 = await stage('clr');
ok('stage Cleared: server has cleared_at/by (and still arrived)', lastPost(/POST .*\/checkins\/pier\/0\/stage$/).req.stage === 'cleared' && r9.cleared_at && r9.cleared_by && r9.arrived_at, r9);
n0 = calls.length;
r9 = await stage('on');
ok('stage Boarded: the check-in command (POST …/check-in), server ticked', nonGet(n0).some((c) => /pier\/0\/check-in 200/.test(c)) && r9.checked_in_at && r9.actual_pax === 2, { c: nonGet(n0), r9 });
r9 = await stage('arr');
ok('step back to Arrived from boarded: cleared and the tick both come off on the server, arrived stays', r9.arrived_at && !r9.cleared_at && !r9.checked_in_at, r9);
r9 = await stage('arr');
ok('press Arrived again: the step goes back to waiting (server arrived_at null)', !r9.arrived_at, r9);
// money still owed: legacy's dialog first, then the tick; the server's warning is the safety net
n0 = calls.length;
await ev(() => document.querySelector('#piercheckin-host [onclick*="ckTap(\'zz-kc\'"]').click());
await idle(); await settle(1500);
ok('owed 3000: legacy\'s money dialog opens first and nothing is sent', (await ev(() => /ยังเก็บเงินไม่ครบ/.test(document.body.innerText))) && nonGet(n0).length === 0, nonGet(n0));
await ev(() => pckPaySkipOn('zz-kc', '2026-11-10'));
await idle(); await settle(1500);
p = lastPost(/POST .*\/checkins\/pier\/0\/check-in$/);
ok('"ขึ้นเรือก่อน": POST …/check-in ticks; the answer carries pay_owed (3000); no second nag on screen', p && p.status === 200 && p.json.warnings.some((w) => w.code === 'pay_owed' && w.amount === 3000) && !/Money still to collect/.test(await pageText()), p && p.json.warnings);
await ev(() => ckToggle('zz-kc', '2026-11-10', 'pier')); await idle(); await settle(800);     // untick
await ev(() => { window.__g = window.pckPayGuard; window.pckPayGuard = () => false; ckToggle('zz-kc', '2026-11-10', 'pier'); });
await idle(); await settle(1500);
ok('when the screen did not know about the debt, the server\'s pay_owed message is shown', /Money still to collect/.test(await pageText()) && /3000 still to collect/.test(await pageText()), (await pageText()).slice(0, 200));
await ev(() => { window.pckPayGuard = window.__g; });

// ════════════ 7. Q33: moved-away rows from the server on a fresh browser ════════════
curItem = '7'; console.log('\n[7] GET /operations/van-strands: a fresh browser sees the struck row on Van Check-in, Van Jobs and Pier Check-in');
await openVanCk(DAY);
await ev((a) => { document.body.insertAdjacentHTML('beforeend',
  '<div id="zz-r"><input id="bkr-from" value="' + a.from + '"><input id="bkr-newdate" value="' + a.to + '"><input id="bkr-reason" value="walk"><input type="radio" name="bkr-charge" value="none" checked><input type="radio" name="bkr-collect" value="invoice" checked></div>');
  bookingV2RescheduleConfirm(a.id); document.getElementById('zz-r').remove(); }, { id: 'zz-ks', from: DAY, to: DAY2 });
await settle(1500); await idle();
ok('server: the strand exists for DAY', (await api('/operations/van-strands?date=' + DAY)).rows.some((r) => r.booking_id === bk.ks.id), await api('/operations/van-strands?date=' + DAY));
await openVanCk(DAY); await settle(1200);
ok('this browser draws the struck row with its clear button (rows from the server read)', (await ev(() => document.querySelectorAll('#vancheckin-host [onclick*="ckStrandClear(\'zz-ks\'"]').length)) > 0 && /เลื่อนไป/.test(await ev(() => document.querySelector('#vancheckin-host').innerText)), null);
ok('the browser blob ops_stranded is not written any more', await ev(() => { try { return !(laBlob() || {}).ops_stranded; } catch (_) { return true; } }), null);
const ctx2 = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx2.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
await ctx2.route(PROD, routeFn);
const p2 = await ctx2.newPage();
const dlg2 = [];
p2.on('dialog', (d) => { dlg2.push(d.message()); d.accept(); });
await p2.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await p2.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
const seeIn = async (view, host, dateVar, renderFn) => {
  await p2.evaluate((a) => { new Function('d', a.dateVar + ' = d')(a.d); const el = document.querySelector('.nav-item[data-view="' + a.view + '"]'); if (el) nav(el); window[a.renderFn](); }, { view, d: DAY, dateVar, renderFn });
  await p2.waitForTimeout(3500);
  return p2.evaluate((h) => ({ btns: document.querySelectorAll('#' + h + ' [onclick*="ckStrandClear(\'zz-ks\'"]').length, why: /เลื่อนไป/.test((document.querySelector('#' + h) || { innerText: '' }).innerText) }), host);
};
const f1 = await seeIn('vancheckin', 'vancheckin-host', '_vanCkDate', 'renderVanCheckin');
ok('fresh browser, Van Check-in: the moved-away row with its reason line and clear button', f1.btns > 0 && f1.why, f1);
let f2 = await seeIn('vanjobs', 'vanjobs-host', '_vanJobsDate', 'renderVanJobs');
// the clear button sits on the van's order sheet: open Van Alpha's preview
await p2.evaluate((vid) => { const el = [...document.querySelectorAll('#vanjobs-host [onclick*="vanJobsOpenPreview"]')].find((e) => e.getAttribute('onclick').includes(vid)); if (el) el.click(); }, vanA.id);
await p2.waitForTimeout(2000);
f2 = await p2.evaluate(() => ({ btns: document.querySelectorAll('#vanjobs-host [onclick*="ckStrandClear(\'zz-ks\'"]').length, why: /เลื่อนไป/.test(document.querySelector('#vanjobs-host').innerText) }));
ok('fresh browser, Van Jobs (Van Alpha\'s order sheet): the struck row with its reason and clear button', f2.btns > 0, f2);
const f3 = await seeIn('piercheckin', 'piercheckin-host', '_pckDate', 'renderPierCheckin');
ok('fresh browser, Pier Check-in: the struck row with its clear button', f3.btns > 0, f3);
ok('fresh browser keeps nothing in the blob', await p2.evaluate(() => { try { return !(laBlob() || {}).ops_stranded; } catch (_) { return true; } }), null);
// clear it from the fresh browser: DELETE, then the read again
await p2.evaluate((d) => { window._vanCkDate = d; const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el); renderVanCheckin(); }, DAY);
await p2.waitForTimeout(2500);
n0 = calls.length;
await p2.locator('#vancheckin-host [onclick*="ckStrandClear(\'zz-ks\'"]').first().click();
await p2.waitForTimeout(2500);
const after = callsSince(n0);
const iDel = after.findIndex((c) => /^DELETE \/operations\/van-strands\/.+\/2026-11-10 200/.test(c));
ok('clear from the fresh browser: legacy confirm, DELETE …/van-strands/{booking}/{date}, then GET …/van-strands?date= again, row gone', /ล้างรายการค้างของ CMD STRAND/.test(dlg2.join('|')) && iDel >= 0 && after.slice(iDel).some((c) => /^GET \/operations\/van-strands 200/.test(c)) && (await p2.evaluate(() => document.querySelectorAll('#vancheckin-host [onclick*="ckStrandClear(\'zz-ks\'"]').length)) === 0, after);
ok('server: the strand is gone', (await api('/operations/van-strands?date=' + DAY)).rows.length === 0, await api('/operations/van-strands?date=' + DAY));
await ctx2.close();

// ── summary ──
const byItem = {};
results.forEach((r) => { const x = byItem[r.item] = byItem[r.item] || { pass: 0, fail: 0 }; r.pass ? x.pass++ : x.fail++; });
console.log('\nchecks per item: ' + Object.keys(byItem).sort().map((k) => k + ' -> ' + byItem[k].pass + ' ok / ' + byItem[k].fail + ' failed').join(' | '));
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.map((r) => r.slice(0, 200)).join('\n  '));
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
