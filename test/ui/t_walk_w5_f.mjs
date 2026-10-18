// t_walk_w5_f · browser walk of group F (wave 5): pier job card (charter, itinerary, copy yesterday, boat list, guide lead, long-tail heads),
// roster page (server totals, range paste, cycle notes), towel batches, park lead names, fleet report, long-tail sheet, contract sections, B2B group sums.
// Real seeded operation-backend (in-process store); every check reads the screen AND the server.
//   node test/ui/t_walk_w5_f.mjs
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const ONLY = process.env.WALK_ONLY ? process.env.WALK_ONLY.split(',') : null;

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
  const txt = await r.text(); let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await raw(p, init)).body;
const seed = async (method, p, body) => {                     // a seeding call that must succeed
  const r = await raw(p, { method, body: body ? JSON.stringify(body) : undefined });
  if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
};

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const overrides = {};   // an answer a test rewrites on its way to the page (path -> fn(json) -> json)
const calls = [], refusals = [], bodies = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  let buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (overrides[u.pathname] && r.status === 200) { try { buf = Buffer.from(JSON.stringify(overrides[u.pathname](JSON.parse(buf.toString()), u))); } catch (_) {} }
  if (req.method() !== 'GET') bodies.push({ k: req.method() + ' ' + u.pathname, status: r.status, req: req.postData() || '', res: buf.toString() });
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' → ' + r.status + ' ' + buf.toString().slice(0, 220));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
let promptAnswer = 'Tester';
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 160)); d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept(); });
const popups = [];
ctx.on('page', (p) => { if (p !== page) popups.push(p); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + String(JSON.stringify(got)).slice(0, 500))); if (!cond) fails.push(name); return cond; };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const D = '2026-10-22', D2 = '2026-10-23';
const PIER = 'tublamu';



// ───────────────────────────── helpers ─────────────────────────────
const bkk = (n = 0) => { const d = new Date(Date.now() + 7 * 3600000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const T0 = bkk(0);
const waitFor = async (fn, arg, ms = 10000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const lastBody = (re, from = 0) => { const b = bodies.slice(from).filter((x) => re.test(x.k)).pop(); return b ? { status: b.status, req: b.req ? JSON.parse(b.req) : null, res: (() => { try { return JSON.parse(b.res); } catch (_) { return null; } })() } : null; };
const goView = (v) => ev((v) => nav({ dataset: { view: v }, classList: { add() {} } }), v);
const stage = async (date) => { await ev((a) => { window._poPier = a.p; window._poDate = a.d; }, { p: PIER, d: date }); };
const openView = async (view, date = D, wait = 2500) => { await stage(date); await goView(view); await settle(wait); await idle(); };
const flush = async () => { await ev(() => window.laOps.pier.flush()); await idle(); await settle(300); };
const todo = [];
const section = (name, fn) => todo.push([name, fn]);

// ───────────────────────────── seed (through the backend API) ─────────────────────────────
const staff = {};
for (const [nick, name, role] of [['Somchai', 'Somchai Captain', 'captain'], ['Nok', 'Nok Pier', 'captain'], ['Mali', 'Mali Assistant', 'assistant']]) {
  staff[nick] = (await seed('POST', '/v1/pier-office/staff', { pier: PIER, nick, name, role })).id;
}
for (const [b, r] of [['b6', 'r5'], ['b7', 'r4']]) for (const d of [D, D2]) await seed('POST', '/operations/deployments', { boat_id: b, route_id: r, service_date: d, capacity: 40, deploy_anyway: true });
let nb = 0;
const book = async (date, boat, route, pax, extra = {}) => {
  const b = await seed('POST', '/v1/bookings', { external_id: `b2c_w5f_${Date.now().toString(36)}_${nb++}`, total: 3000, trips: [{ route_id: route, date, pax, zone: 'PK' }], ...extra });
  if (boat) { const v = (await api(`/v1/bookings/${b.id}`)).version; await seed('PATCH', `/operations/trip-ops/${b.trips[0].id}`, { boat_id: boat, version: v }); }
  return b;
};
const bkSeat = await book(D, 'b6', 'r5', { ad_fr: 3 }, { lead_pax: 'SEAT LEAD', add_ons: [{ type: 'longtail-join', label: 'Longtail join', join_adults: 3, join_children: 0 }] });
const bkChar = await seed('POST', '/v1/bookings', { external_id: `b2c_w5f_ch_${Date.now().toString(36)}`, total: 9000, lead_pax: 'CHARTER LEAD', trips: [{ route_id: 'r4', date: D, pax: { ad_fr: 5 }, zone: 'PK', booking_mode: 'charter', charter_boat_id: 'b7' }] });
// yesterday's cards (D): b6 has a captain and a wristband; b7 too, and b7's card of today (D2) is complete, so "copy yesterday" must skip it
await seed('PATCH', `/v1/pier-office/${PIER}/days/${D}/boats/b6/job`, { captain_name: 'CAP YDAY', wristband_text: 'ฟ้า', wristband_colour: '#2BC8DE' });
await seed('PATCH', `/v1/pier-office/${PIER}/days/${D}/boats/b7/job`, { captain_name: 'CAP B7 YDAY', wristband_text: 'ดำ', wristband_colour: '#1A1A1A' });
const venue = await seed('POST', '/v1/meal-venues', { name: 'W5 Venue' });
await seed('PATCH', `/v1/pier-office/${PIER}/days/${D2}/boats/b7/job`, { captain_name: 'CAP B7 TODAY', wristband_text: 'แดง', wristband_colour: '#C0271C', note: 'done today' });
await seed('PUT', `/v1/guide-orders/${D2}/b7`, { guide_ids: [], other_count: 1 });
await seed('PUT', `/v1/trip-actuals/${D2}/b7/venue`, { venue: venue.id });
await seed('POST', `/v1/pier-office/${PIER}/days/${D2}/boats/b7/job/complete`, {});

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1200);

// ═══ 1 · pier job card ═══
section('1', async () => {
  console.log('\n[1] pier job card · charter, itinerary, copy yesterday, boat list, long-tail heads, guide lead');
  await openView('poj-' + PIER, D, 3500);
  const day = await api(`/v1/pier-office/${PIER}/days/${D}/boats`);
  // 1a charter
  const jb7 = await api(`/v1/pier-office/${PIER}/days/${D}/boats/b7/job`);
  const ch = await ev(() => pjChtrOf({ bid: 'b7', bks: [] }));
  ok('server: b7 is chartered by the lead guest', jb7.charter && jb7.charter.heads === 5 && /CHARTER LEAD/.test(jb7.charter.who), jb7.charter);
  ok('pjChtrOf = the server charter (who, heads, mixed, seat heads, voucher), the card holding no booking rows', ch && ch.who === jb7.charter.who && ch.n === jb7.charter.heads && ch.mixed === jb7.charter.mixed && ch.seat === jb7.charter.seat_heads && ch.vc === jb7.charter.voucher, { screen: ch, server: jb7.charter });
  const none = await ev(() => pjChtrOf({ bid: 'b6', bks: [] }));
  ok('a boat nobody chartered: null, as the server says', none === null && (await api(`/v1/pier-office/${PIER}/days/${D}/boats/b6/job`)).charter === null, none);
  ok('the chartered card shows the "เหมาลำ" chip', await ev(() => !!document.querySelector('.pj-chp')), null);
  // 1d long-tail heads
  const srvLt = day.boats.find((b) => b.boat_id === 'b6').booked.join_heads;
  const lt = await ev((a) => pjPrep(a.D, 'b6', a.P).lt, { D, P: PIER });
  const lt2 = await ev((a) => { const save = SB_BOOKINGS.map((b) => b.status); SB_BOOKINGS.forEach((b) => { b.status = 'cancelled'; }); const r = pjPrep(a.D, 'b6', a.P).lt; SB_BOOKINGS.forEach((b, i) => { b.status = save[i]; }); return r; }, { D, P: PIER });
  ok('pjPrep.lt = the server join_heads of the boat (3), also with the browser bookings cancelled', srvLt === 3 && lt === srvLt && lt2 === srvLt, { srvLt, lt, lt2 });
  // 1b itinerary
  let n0 = bodies.length;
  const typed = 'เกาะ 4 -> เกาะ 8 > เกาะ 9';
  await ev((t) => pjItinSet('b6', t), typed); await idle(); await settle(1800);
  let p = lastBody(/PATCH .*\/days\/2026-10-22\/boats\/b6\/job$/, n0);
  ok('typed itinerary goes as itinerary_text exactly as typed (the server turns the arrows into →); no computed field sent', p && p.status === 200 && p.req.itinerary_text === typed && !('itinerary' in p.req) && !('itinerary_own' in p.req), p);
  let jb6 = await api(`/v1/pier-office/${PIER}/days/${D}/boats/b6/job`);
  ok('server: normalised text, own day', jb6.itinerary.text === 'เกาะ 4 → เกาะ 8 → เกาะ 9' && jb6.itinerary.own === true, jb6.itinerary);
  const it = await ev((a) => pjItinOf(a.D, 'b6', getRoute('r5')), { D });
  const inp = await ev(() => { const i = [...document.querySelectorAll('.pj-itin')].find((x) => (x.getAttribute('onchange') || '').includes("'b6'")); return i && i.value; });
  ok('pjItinOf and the card box show the server\'s normalised text', it.t === jb6.itinerary.text && it.own === true && inp === jb6.itinerary.text, { it, inp });
  n0 = bodies.length;
  await ev(() => pjItinColor('b6', '#D9761F')); await idle(); await settle(1800);
  p = lastBody(/PATCH .*\/days\/2026-10-22\/boats\/b6\/job$/, n0);
  jb6 = await api(`/v1/pier-office/${PIER}/days/${D}/boats/b6/job`);
  ok('colour goes as itinerary_colour only; server and pjItinOf agree', p && p.req.itinerary_colour === '#D9761F' && !('itinerary_text' in p.req) && jb6.itinerary.colour === '#D9761F' && (await ev((a) => pjItinOf(a.D, 'b6', getRoute('r5')).c, { D })) === '#D9761F', p);
  // refusal: 201 characters
  n0 = bodies.length;
  await ev(() => pjItinSet('b6', 'x'.repeat(201))); await idle(); await settle(1800);
  p = lastBody(/PATCH .*\/days\/2026-10-22\/boats\/b6\/job$/, n0);
  jb6 = await api(`/v1/pier-office/${PIER}/days/${D}/boats/b6/job`);
  const back = await ev((a) => pjItinOf(a.D, 'b6', getRoute('r5')).t, { D });
  ok('over 200 characters: the server\'s 400 ("at most 200") and the card goes back to the saved text', p && p.status === 400 && /200/.test((p.res && p.res.message) || '') && jb6.itinerary.text === 'เกาะ 4 → เกาะ 8 → เกาะ 9' && back === jb6.itinerary.text, { p, back });
  // carry to the next day: the server's rule (legacy main shows the route's islands)
  await openView('poj-' + PIER, D2, 3500);
  const jb6n = await api(`/v1/pier-office/${PIER}/days/${D2}/boats/b6/job`);
  const itn = await ev((a) => ({ now: pjItinOf(a.D2, 'b6', getRoute('r5')), legacy: window.pjItinOf.__orig(a.D2, 'b6', getRoute('r5')) }), { D2 });
  ok('next day, same boat and programme, untouched: itinerary and colour are carried from yesterday (server), not the route\'s islands', jb6n.itinerary.from === D && itn.now.t === jb6n.itinerary.text && itn.now.from === D && itn.now.c === '#D9761F' && itn.legacy.own === false, { server: jb6n.itinerary, screen: itn });
  // 1c copy yesterday
  n0 = bodies.length; dialogs.length = 0;
  await ev((pp) => pjCopyYday(pp), PIER); await idle(); await settle(2500);
  p = lastBody(/POST .*\/days\/2026-10-23\/jobs\/copy-yesterday$/, n0);
  ok('"copy yesterday" is ONE command with no body; the server says what it copied and skipped', p && p.status === 200 && p.req === null && p.res.copied.includes('b6') && p.res.skipped_complete.includes('b7'), p);
  const j2 = await api(`/v1/pier-office/${PIER}/days/${D2}/boats/b6/job`);
  const scr = await ev((a) => (PIER_JOB[a.D2 + '::b6'] || {}).cap, { D2 });
  ok('server: b6 of today holds yesterday\'s captain and wristband; the screen shows them', j2.captain_name === 'CAP YDAY' && j2.wristband_text === 'ฟ้า' && scr === 'CAP YDAY', { j2: [j2.captain_name, j2.wristband_text], scr });
  ok('b1\'s completed card was skipped (note unchanged); legacy\'s message names the counts', (await api(`/v1/pier-office/${PIER}/days/${D2}/boats/b7/job`)).captain_name === 'CAP B7 TODAY' && dialogs.some((d) => /คัดลอกมา 1 ลำ · ข้าม 1 ลำที่กดจัดเสร็จแล้วไว้/.test(d)), dialogs);
  // 1e boat list
  const day2 = await api(`/v1/pier-office/${PIER}/days/${D2}/boats`);
  await ev(() => renderPierJob()); await settle(1500);
  const all = await ev((a) => pjAllBoats(a.D2, a.P).map((x) => ({ id: x.bid, away: !!x._away, k: x._st && x._st.k })), { D2, P: PIER });
  const srvIds = day2.fleet.filter((f) => !f.no_charter).map((f) => f.boat_id);
  ok('pjAllBoats lists the pier\'s boats in the server\'s order, b1 (idle) with the server state', JSON.stringify(all.map((x) => x.id)) === JSON.stringify(srvIds) && all.find((x) => x.id === 'b1').k === day2.fleet.find((f) => f.boat_id === 'b1').state, { screen: all, server: day2.fleet.map((f) => [f.boat_id, f.state, f.order]) });
  // 1f guide lead
  await seed('PUT', '/v1/config/guides', { value: [{ id: 'g_int', name: 'Intern One', role: 'intern' }, { id: 'g_lead', name: 'Lead Guide', role: 'guide' }] });
  await seed('PUT', `/v1/guide-orders/${D}/b6`, { guide_ids: ['g_int', 'g_lead'] });
  await openView('poj-' + PIER, D, 3500);
  n0 = calls.length;
  await ev(() => laOps.wrote('walk')); await ev(() => renderPierJob()); await settle(2500);
  const sheet = await api(`/v1/guide-orders/${D}/b6/sheet`);
  const gl = await ev(() => pjGdLead('b6'));
  ok('pjGdLead = the server lead_guide of the saved order (g_lead: the first guide-role person), asked from the sheet read', sheet.lead_guide && sheet.lead_guide.id === 'g_lead' && gl === 'g_lead' && calls.slice(n0).some((c) => /GET \/v1\/guide-orders\/2026-10-22\/b6\/sheet/.test(c)), { gl, lead: sheet.lead_guide });
});

// @@SECTIONS

// ═══ 2 · roster page ═══
section('2', async () => {
  console.log('\n[2] roster · server totals, range paste, cycle notes');
  const cell = (date, sid, body) => seed('PUT', `/v1/pier-office/${PIER}/roster/${date}/${staff[sid]}`, body);
  await cell(D, 'Somchai', { code: 'OFF' }); await cell(D2, 'Somchai', { code: 'OFF' }); await cell('2026-10-24', 'Somchai', { code: 'PH' });
  await cell(D, 'Nok', { code: 'PP' }); await cell(D2, 'Nok', { code: 'PP' }); await cell('2026-10-19', 'Nok', { code: 'PP', night_code: 'N' }).catch(() => null);
  await ev((d) => { window._paDate = d; }, D);
  await openView('poa-' + PIER, D, 3500);
  await ev(() => renderPierAtt()); await settle(2500); await idle();
  const cy = await ev(() => paCycle(_paDate));
  const roster = await api(`/v1/pier-office/${PIER}/roster?from=${cy.from}&to=${cy.to}`);
  const srv = (sid) => roster.rows.find((r) => r.staff_id === staff[sid]).totals;
  const dom = (name) => ev((nm) => { const tr = [...document.querySelectorAll('#pa-host-tublamu tr')].find((t) => (t.querySelector('.pa-nm2') || {}).textContent === nm); if (!tr) return null; const tot = tr.querySelector('.pa-sc.tot'); return { total: tot && +tot.textContent, title: tot && tot.title, sums: [...tr.querySelectorAll('.pa-sc')].map((x) => x.textContent) }; }, name);
  let rs = await dom('Somchai Captain'), rn = await dom('Nok Pier');
  ok('server: Somchai has OFF 2, PH 1; Nok has PP 2', srv('Somchai').by_code.OFF === 2 && srv('Somchai').by_code.PH === 1 && srv('Nok').by_code.PP >= 2, [srv('Somchai'), srv('Nok')]);
  ok('TOTAL column = the server row_total (work + OFF + PH), the tooltip carries the server work days', rs && rn && rs.total === srv('Somchai').row_total && rn.total === srv('Nok').row_total && rs.title.includes('วันทำงาน ' + srv('Somchai').work + ' ') && rn.title.includes('วันทำงาน ' + srv('Nok').work + ' '), { rs, rn, s: [srv('Somchai'), srv('Nok')] });
  // the browser's own code kinds say PP is not work: legacy would count Nok's work days as 0; the server's count stands
  await ev(() => { const c = (window.PIER_CODES || []).find((x) => x.code === 'PP'); if (c) { window.__ppKind = c.kind; c.kind = 'none'; } renderPierAtt(); });
  await settle(800);
  rn = await dom('Nok Pier');
  ok('code kinds tampered in the browser (PP = none): Nok\'s work days and TOTAL are still the server\'s', rn.total === srv('Nok').row_total && rn.title.includes('วันทำงาน ' + srv('Nok').work + ' ') && srv('Nok').work > 0, { rn, work: srv('Nok').work });
  await ev(() => { const c = (window.PIER_CODES || []).find((x) => x.code === 'PP'); if (c && window.__ppKind) c.kind = window.__ppKind; renderPierAtt(); });
  // range paste: one command, the server decides what is skipped
  let n0 = bodies.length; dialogs.length = 0;
  await ev(() => paRangeOpen()); await settle(500);
  await ev((ids) => { document.querySelectorAll('.pa-rs').forEach((x) => { x.checked = ids.includes(x.value); }); document.getElementById('pa_d1').value = '2026-10-24'; document.getElementById('pa_d2').value = '2026-10-25'; document.getElementById('pa_code').value = 'LWP'; document.getElementById('pa_lay').value = '0'; document.getElementById('pa_ovr').value = '0'; }, [staff.Somchai, staff.Nok]);
  await ev(() => paRangeApply()); await idle(); await settle(2500);
  const posts = bodies.slice(n0).filter((b) => /POST .*\/roster\/range$/.test(b.k)), cellPuts = bodies.slice(n0).filter((b) => /PUT .*\/roster\/\d{4}-/.test(b.k));
  const pb = posts[0] && JSON.parse(posts[0].req), pr = posts[0] && JSON.parse(posts[0].res);
  ok('range paste = ONE POST …/roster/range (no per-cell PUT), body = the form\'s facts only', posts.length === 1 && cellPuts.length === 0 && JSON.stringify(Object.keys(pb).sort()) === JSON.stringify(['code', 'from', 'is_plan', 'overwrite', 'staff_ids', 'to']) && pb.is_plan === false && pb.overwrite === false, { posts: posts.length, cellPuts: cellPuts.length, pb });
  ok('server decided: 3 written, 1 skipped (Somchai already had PH on 24th); legacy\'s message prints exactly those', pr && pr.written === 3 && pr.skipped === 1 && dialogs.some((d) => d.includes('ลงแก้ทับแล้ว 3 ช่อง · ข้าม 1 ช่องที่ลงไว้แล้ว')), { pr, dialogs });
  const after = await api(`/v1/pier-office/${PIER}/roster?from=2026-10-24&to=2026-10-25`);
  const cellOf = (sid, d) => after.rows.find((r) => r.staff_id === staff[sid]).cells.find((c) => c.date === d);
  ok('server cells: Somchai keeps PH on the 24th, has LWP on the 25th; Nok has LWP on both', cellOf('Somchai', '2026-10-24').code === 'PH' && cellOf('Somchai', '2026-10-25').code === 'LWP' && cellOf('Nok', '2026-10-24').code === 'LWP' && cellOf('Nok', '2026-10-25').code === 'LWP', after.rows.map((r) => r.cells.map((c) => c.code)));
  const scr = await ev((a) => [paCell('2026-10-24', 'tublamu', { id: a.s }, null).c, paCell('2026-10-25', 'tublamu', { id: a.s }, null).c], { s: staff.Somchai });
  ok('the screen shows those cells after the roster was read again', scr[0] === 'PH' && scr[1] === 'LWP', scr);
  // cycle notes
  const noteInput = (sid) => ev((id) => { const i = [...document.querySelectorAll('.pa-nti')].find((x) => (x.getAttribute('onchange') || '').includes("'" + id + "'")); return i ? i.value : null; }, staff[sid]);
  const typeNote = (sid, v) => ev(({ id, v }) => { const i = [...document.querySelectorAll('.pa-nti')].find((x) => (x.getAttribute('onchange') || '').includes("'" + id + "'")); i.value = v; i.dispatchEvent(new Event('change')); }, { id: staff[sid], v });
  n0 = bodies.length;
  await typeNote('Nok', 'ลาพักร้อน 3 วัน'); await idle(); await settle(1200);
  const cyc = cy.from.slice(0, 7);
  const np = lastBody(/PUT .*\/roster\/notes\/.+/, n0);
  let notes = await api(`/v1/pier-office/${PIER}/roster/notes?cycle=${cyc}`);
  ok('typing a note = PUT …/roster/notes/{cycle}/{staff} { note }; the server holds it', np && np.status === 200 && JSON.stringify(np.req) === '{"note":"ลาพักร้อน 3 วัน"}' && notes.notes[staff.Nok] === 'ลาพักร้อน 3 วัน', { np, notes });
  await ev(() => renderPierAtt()); await settle(1200);
  ok('paCycNote and the box read the server note after the page is drawn again', (await ev((a) => paCycNote(a.f, a.s), { f: cy.from, s: staff.Nok })) === 'ลาพักร้อน 3 วัน' && (await noteInput('Nok')) === 'ลาพักร้อน 3 วัน', null);
  ok('the note is not kept in the settings blob (no cycNote in a settings PATCH)', !bodies.slice(n0).some((b) => /PATCH .*\/settings$/.test(b.k) && /cycNote/.test(b.req)), null);
  // a note written elsewhere (the server holds it) appears on the screen without the browser having typed it
  await seed('PUT', `/v1/pier-office/${PIER}/roster/notes/${cyc}/${staff.Somchai}`, { note: 'from another desk' });
  await ev(() => laOps.wrote('pier')); await ev(() => renderPierAtt()); await settle(2500);
  ok('a note typed elsewhere shows after the next read', (await noteInput('Somchai')) === 'from another desk', await noteInput('Somchai'));
  n0 = bodies.length;
  await typeNote('Nok', 'x'.repeat(121)); await idle(); await settle(1500);
  notes = await api(`/v1/pier-office/${PIER}/roster/notes?cycle=${cyc}`);
  const refused = lastBody(/PUT .*\/roster\/notes\/.+/, n0);
  ok('121 characters: the server refuses (400) and the box goes back to the saved note', refused && refused.status === 400 && notes.notes[staff.Nok] === 'ลาพักร้อน 3 วัน' && (await noteInput('Nok')) === 'ลาพักร้อน 3 วัน', { refused, box: await noteInput('Nok') });
});

// ═══ 3 · towels ═══
section('3', async () => {
  console.log('\n[3] towel batches and the overdue limits');
  const day = (n) => bkk(n);
  const item = await seed('POST', '/v1/pier-office/items', { pier: PIER, kind_id: 'towel', label: 'Towel L', total: 60 });
  await seed('POST', `/v1/pier-office/${PIER}/stock/receive`, { date: day(-9), lines: [{ item_id: item.id, qty: 30 }], source: 'buy' });
  await seed('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: day(-6), capacity: 40, deploy_anyway: true });
  await seed('PUT', `/v1/pier-office/${PIER}/days/${day(-6)}/sheets/b6`, { lines: [{ label: 'towels', adults: 1, deposit_baht: 0, deposit_returned_baht: 0, deduction_a: 0, deduction_b: 0, qty: { issued: { towel: 12 }, returned: {} } }], split: { issued: { [item.id]: 12 }, returned: {} } });
  await seed('POST', `/v1/pier-office/${PIER}/days/${day(-6)}/sheets/b6/commit`, {});
  await seed('POST', `/v1/pier-office/${PIER}/days/${day(-6)}/boats/b6/close`, { lines: [{ item_id: item.id, returned: 12, repair: 0, writeoff: 0, lost: 0, onboard: 0 }] });
  await seed('POST', `/v1/pier-office/${PIER}/stock/laundry-out`, { date: day(-5), lines: [{ item_id: item.id, qty: 5 }] });
  await ev(() => laOps.pier.load()); await openView('po-' + PIER, D, 3500);
  await ev(() => renderPierOffice()); await settle(2500); await idle();
  const st = await api(`/v1/pier-office/${PIER}/stock`);
  const tw = st.towels;
  ok('server: 7 dirty (6 days, over), 5 at the laundry (5 days, over), limits 1 and 2', tw.dirty_over === 7 && tw.laundry_over === 5 && tw.limits.dirty_days === 1 && tw.limits.laundry_days === 2, tw);
  const q = await ev((p) => poTowelQ(p), PIER);
  const flat = (a) => a.map((b) => [b.date, b.q]);
  ok('poTowelQ = the server batches (on boat, dirty, laundry), oldest first', JSON.stringify(flat(q.dirty)) === JSON.stringify(tw.dirty.map((b) => [b.date, b.qty])) && JSON.stringify(flat(q.laundry)) === JSON.stringify(tw.laundry.map((b) => [b.date, b.qty])) && JSON.stringify(flat(q.onboat)) === JSON.stringify(tw.on_boat.map((b) => [b.date, b.qty])), { q, tw });
  const lo = await ev((p) => poLaundryOpen(p), PIER);
  ok('poLaundryOpen = the server laundry_open (qty, since, days)', JSON.stringify(lo) === JSON.stringify(tw.laundry_open.map((b) => ({ qty: b.qty, since: b.since, days: b.days }))) && lo.length === 1, { lo, srv: tw.laundry_open });
  // legacy would walk the browser's moves: empty them and set the limits to nonsense; the card must still be the server's
  await ev(() => { window.PIER_MOVES.length = 0; window.PO_DIRTY_DUE = 9; window.PO_LAUNDRY_DUE = 9; renderPierOffice(); });
  await settle(1000);
  const lim = await ev(() => [PO_DIRTY_DUE, PO_LAUNDRY_DUE]);
  const text = (await ev(() => document.getElementById('po-host-tublamu') ? document.getElementById('po-host-tublamu').innerText : document.body.innerText)).replace(/\s+/g, ' ');
  ok('limits set from the server (1 and 2) though the browser had 9', lim[0] === 1 && lim[1] === 2, lim);
  ok('with the browser ledger empty the card still shows the server\'s batches: oldest dirty 6 days, laundry 5 days, the overdue notes', text.includes('เก่าสุดค้างมา ' + tw.dirty[0].days + ' วัน') && text.includes('ส่งไปแล้ว ' + tw.laundry[0].days + ' วัน') && text.includes('ควรโทรตามร้าน'), text.slice(0, 600));
  const age = await ev((id) => poQAge(id, 'dirty'), item.id);
  ok('poQAge (send dialog line) = the server\'s oldest dirty batch and its age', age.includes('(' + tw.dirty[0].days + ' วัน)') && age.includes('#B4560A'), age);
  // a write makes the read old: the batches come from legacy's own queue until the server's read is back, then the server's again
  n0Towel = calls.length;
  await seed('POST', `/v1/pier-office/${PIER}/stock/laundry-in`, { date: day(0), lines: [{ item_id: item.id, qty: 5 }] });
  await ev(() => { laOps.wrote('pier'); renderPierOffice(); }); await settle(2500); await idle();
  const st2 = await api(`/v1/pier-office/${PIER}/stock`);
  const q2 = await ev((p) => poTowelQ(p), PIER);
  ok('after the write: stock read again and the batches follow the server (laundry empty)', calls.slice(n0Towel).some((c) => /GET \/v1\/pier-office\/tublamu\/stock/.test(c)) && q2.laundry.length === st2.towels.laundry.length && q2.laundry.length === 0, { q2, srv: st2.towels });
});
var n0Towel = 0;

// ═══ 4 · park tickets: names from the lead ═══
section('4', async () => {
  console.log('\n[4] park tickets · fill from the lead, lead-copy names');
  await openView('pok-' + PIER, D, 4000);
  await ev(() => renderPierPark()); await settle(2000); await idle();
  const peopleOf = async () => (await api(`/v1/pier-office/${PIER}/park-tickets?date=${D}`)).boats.find((b) => b.boat_id === 'b6');
  let b6 = await peopleOf();
  ok('server: b6 has empty seats and the lead name on each person', b6.miss_total >= 2 && b6.people.every((p) => p.lead === 'SEAT LEAD'), b6.people.map((p) => [p.full, p.lead, p.ph]));
  let n0 = bodies.length; dialogs.length = 0;
  await ev((a) => pkNmFillLead(a.D, 'b6', a.P), { D, P: PIER }); await idle(); await settle(2500);
  const post = lastBody(/POST .*\/park-tickets\/.+\/fill-lead$/, n0);
  b6 = await peopleOf();
  const names = b6.people.filter((p) => p.ph && p.typed).map((p) => p.full).sort();
  ok('"fill from the lead" = ONE POST …/fill-lead { boat_id }; the server named the seats "<lead> (2)", "(3)"', post && post.status === 200 && JSON.stringify(post.req) === '{"boat_id":"b6"}' && post.res.filled.length === 2 && names.join('|') === 'SEAT LEAD (2)|SEAT LEAD (3)', { post, names });
  const scr = await ev((a) => { const out = []; pkTkData(a.D, a.P).forEach((g) => g.boats.forEach((B) => { if (B.bid === 'b6') B.people.forEach((p) => out.push(p.full)); })); return out; }, { D, P: PIER });
  ok('the screen lists those names; nothing about the lead was worked out in the browser (no PUT of names)', names.every((nm) => scr.includes(nm)) && !bodies.slice(n0).some((b) => /PUT .*\/names$/.test(b.k)), scr);
  n0 = bodies.length; dialogs.length = 0;
  await ev((a) => pkNmFillLead(a.D, 'b6', a.P), { D, P: PIER }); await idle(); await settle(1500);
  ok('a boat with nothing to fill: legacy\'s message ("ลำนี้ไม่มีหัวที่ต้องเติมชื่อ …")', dialogs.some((d) => d.includes('ลำนี้ไม่มีหัวที่ต้องเติมชื่อ')), dialogs);
  // lead-copy names: the in-process store cannot hold one (it refuses the name as a duplicate), so the server's list is rewritten on its way
  const victim = b6.people.find((p) => p.ph && p.typed);
  overrides[`/v1/pier-office/${PIER}/park-tickets`] = (j) => { j.boats.forEach((b) => { if (b.boat_id === 'b6') b.lead_duplicates = b.people.filter((p) => p.ph && p.typed && p.full === victim.full); }); return j; };
  await ev(() => laOps.park.load()); await settle(1500);
  const dupN = await ev((a) => { let n = -1; pkTkData(a.D, a.P).forEach((g) => g.boats.forEach((B) => { if (B.bid === 'b6') n = pkNmLeadDup(B).length; })); return n; }, { D, P: PIER });
  ok('pkNmLeadDup = the server lead_duplicates of the boat (1)', dupN === 1, dupN);
  await ev(() => { pkTab('r5', 'b6'); }); await settle(800);
  ok('the "delete lead-copy names" button is on the card', await ev(() => !!document.querySelector('button[onclick^="pkNmDropLeadDup("]')), null);
  n0 = bodies.length; dialogs.length = 0;
  await ev((a) => pkNmDropLeadDup(a.D, 'b6', a.P), { D, P: PIER }); await idle(); await settle(2500);
  const del = bodies.slice(n0).filter((b) => /PUT .*\/names$/.test(b.k)).map((b) => JSON.parse(b.req));
  b6 = await peopleOf();
  ok('legacy\'s confirm names the person; then the name is cleared on the server (PUT names { name: null }) and gone from the list', dialogs.some((d) => d.includes('พบชื่อที่พิมพ์เองซ้ำกับชื่อหัวกรุ๊ปของใบเดียวกัน 1 ชื่อ') && d.includes(victim.full)) && del.length === 1 && del[0].name === null && del[0].booking_id === victim.booking_id && !b6.people.some((p) => p.typed && p.full === victim.full), { dialogs, del });
  delete overrides[`/v1/pier-office/${PIER}/park-tickets`];
});

// ═══ 5 · Fleet Report ═══
section('5', async () => {
  console.log('\n[5] Fleet Report · repFleetGather');
  await seed('POST', '/v1/fleet/jobs', { no: 'MJ-W5-1', boat_id: 'b7', title: 'W5 repair', type: 'corrective' });
  await seed('POST', '/v1/fleet/jobs', { no: 'MJ-W5-2', boat_id: 'b6', title: 'W5 second', type: 'corrective' });
  const first = T0.slice(0, 7) + '-01', last = new Date(Date.UTC(+T0.slice(0, 4), +T0.slice(5, 7), 0)).toISOString().slice(0, 10);
  await ev(([f, l]) => { const s = repSt('fleet'); s.from = f; s.to = l; }, [first, last]);
  const n0 = calls.length;
  await goView('rep-fleet'); await ev(() => renderReport('fleet')); await settle(3500); await idle(); await settle(800);
  const srv = await api(`/v1/fleet/reports/fleet?from=${first}&to=${last}`);
  ok('asked the server: GET /v1/fleet/reports/fleet for the range on screen', calls.slice(n0).some((c) => /GET \/v1\/fleet\/reports\/fleet\?from=/.test(c)), calls.slice(n0));
  const C = srv.current;
  const g = await ev(([f, l]) => { const o = repFleetGather(f, l); return { avail: o.avail, downTot: o.downTot, boats: o.boats, boatsAll: o.boatsAll, mjOpen: o.mjOpen, mjDone: o.mjDone, inc: o.inc, memoAmt: o.memoAmt, invN: o.invN, invZero: o.invZero, nDays: o.nDays, srv: !!o.__srv, gaps: o.gaps.map((x) => x[1]) }; }, [first, last]);
  ok('repFleetGather (current) = the server: availability, days out, boats, open/closed repair jobs, incidents, spend, spare parts', g.srv && g.avail === C.availability.availability_pct && g.downTot === C.availability.down_days && g.boats === C.availability.boats_in_service && g.boatsAll === C.availability.boats_registered && g.mjOpen === C.jobs.started - C.jobs.closed && g.mjDone === C.jobs.closed && g.inc === C.incidents.count && g.memoAmt === C.memos.amount && g.invN === srv.stock.items && g.invZero === srv.stock.at_zero && g.nDays === srv.days, { g, C });
  ok('seed: 2 repair jobs started in the range, both open', C.jobs.started >= 2 && g.mjOpen >= 2, C.jobs);
  const pv = await ev(([f, l]) => repPrevRange(f, l), [first, last]);
  const gp = await ev(([f, l]) => { const o = repFleetGather(f, l); return { avail: o.avail, mjOpen: o.mjOpen, srv: !!o.__srv }; }, [pv.from, pv.to]);
  ok('the period before (the second call of the slides) = the server previous', gp.srv && gp.avail === srv.previous.availability.availability_pct && gp.mjOpen === srv.previous.jobs.started - srv.previous.jobs.closed && srv.previous.from === pv.from, { gp, prev: [srv.previous.from, srv.previous.to], pv });
  ok('"where the data is thin" sentences = the server\'s gap codes (jobs without cost / few consumables ...)', srv.data_gaps.every((x) => ({ jobs_without_cost: /Repair cost was entered on/, no_project_budget: /Not one of the/, safety_default_pm: /safety items still carry/, few_consumables: /fuel and consumable issue/, idle_boats: /never available on a single day/, uniform_min: /Minimum stock is set to/ }[x.code] || /./).test(g.gaps.join('|'))) && g.gaps.length === srv.data_gaps.length, { gaps: g.gaps, codes: srv.data_gaps.map((x) => x.code) });
  // the browser's repair list emptied: legacy would count none
  await ev(() => { window.__flm = FL_MAINT.slice(); FL_MAINT.length = 0; renderReport('fleet'); });
  await settle(800);
  const g2 = await ev(([f, l]) => repFleetGather(f, l).mjOpen, [first, last]);
  const txt = (await ev(() => document.getElementById('rep-host-fleet').innerText)).replace(/\s+/g, ' ');
  ok('browser repair list emptied: the open jobs and the slide text are still the server\'s', g2 === g.mjOpen && txt.includes(String(C.availability.availability_pct) + '%'), { g2, pct: C.availability.availability_pct, text: txt.slice(0, 300) });
  await ev(() => { FL_MAINT.push.apply(FL_MAINT, window.__flm); });
  ok('only reads went out for the report', !bodies.slice(0).some((b) => /fleet\/reports/.test(b.k)), null);
});

// ═══ 6 · petty cash, long-tail sheet: the booked side ═══
section('6', async () => {
  console.log('\n[6] petty cash long-tail sheet · pxLongtail (booked side)');
  await ev((a) => { window._pcPier = a.p; window._pcDate = a.d; window._pcYM = a.d.slice(0, 7); window._pcTab = 1; }, { p: PIER, d: D });
  await goView('pop-' + PIER); await ev((p) => renderPierCash(p), PIER); await settle(6000); await idle();
  const day = await api(`/v1/pier-office/${PIER}/days/${D}/boats`);
  const b6 = day.boats.find((b) => b.boat_id === 'b6').booked, b7 = day.boats.find((b) => b.boat_id === 'b7').booked;
  const cb = b7.charter_boats;
  ok('server: b6 needs 3 join heads (the seat booking with the join add-on)', b6.join_heads === 3, [b6.join_heads, b6.charter_boats, b7.join_heads, b7.charter_boats]);
  const read = (bid) => ev((a) => window.pxLongtail(a.D, a.b), { D, b: bid });
  // outside the sheet nobody changes pxLongtail (other screens keep the original); inside, the sheet draws the server's numbers
  const html = await ev((a) => { return pc2LTDay(a.P, a.D); }, { D, P: PIER });
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('the day card says the server\'s booked side: join 3 heads, the server\'s charter boats', txt.includes('จอย 3 คน · เหมา ' + cb + ' ลำ'), txt.slice(0, 300));
  // the browser bookings cancelled: legacy would walk none and say 0
  const html2 = await ev((a) => { const save = SB_BOOKINGS.map((b) => b.status); SB_BOOKINGS.forEach((b) => { b.status = 'cancelled'; }); const h = pc2LTDay(a.P, a.D); SB_BOOKINGS.forEach((b, i) => { b.status = save[i]; }); return h; }, { D, P: PIER });
  ok('browser bookings cancelled: the card still shows the server\'s heads and boats', html2.replace(/<[^>]+>/g, ' ').includes('จอย 3 คน · เหมา ' + cb + ' ลำ'), html2.replace(/<[^>]+>/g, ' ').slice(0, 300));
  const mon = await ev((p) => pc2LT(p).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), PIER);
  ok('the month cards add the server days (3 join heads)', mon.includes(' 3 ') && mon.includes('คน'), mon.slice(0, 300));
  ok('the day was asked for once: GET …/days/{D}/boats', calls.some((c) => c.startsWith('GET /v1/pier-office/tublamu/days/' + D + '/boats')), null);
  ok('outside the sheet pxLongtail is still legacy\'s (a call with no sheet context)', await ev((a) => typeof pxLongtail(a.D, 'b6').join === 'number', { D }), null);
});

// ═══ 7 · contract sections ═══
section('7', async () => {
  console.log('\n[7] contract document sections · CT_DOC_SECTIONS');
  overrides['/v1/contract-templates/sections'] = (j) => { j.sections[0].name = 'Cover Page (server)'; return j; };
  const t0 = await seed('POST', '/v1/contract-templates', { name: 'W5 template' });
  await seed('PATCH', `/v1/contract-templates/${t0.id}`, { sections: { cover: false, parties: false, programs: false } });
  const rd = await api(`/v1/contract-templates/${t0.id}`);
  const p2 = await ctx.newPage();
  await p2.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
  await p2.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
  await p2.waitForTimeout(1500);
  const srv = (await api('/v1/contract-templates/sections')).sections;
  const scr = await p2.evaluate(() => CT_DOC_SECTIONS.map((s) => [s.id, s.name, s.required, s.defaultOn, s.num]));
  ok('CT_DOC_SECTIONS is the server list (the first name was rewritten on its way: "Cover Page (server)")', scr.length === srv.length && scr[0][1] === 'Cover Page (server)' && srv.every((s, i) => scr[i][0] === s.id && scr[i][2] === s.required && scr[i][3] === s.default_on && scr[i][4] === s.num), { scr: scr.slice(0, 2), srv: srv.slice(0, 2) });
  delete overrides['/v1/contract-templates/sections'];
  // required sections are always on: the template read carries sections_effective
    const sec = await p2.evaluate((id) => { const t = (ctTmplLoad() || {})[id]; return t ? { cover: t.sections.cover, programs: t.sections.programs } : null; }, t0.id);
  ok('server: cover stored off but effective on (required); programs off', rd.sections.cover === false && rd.sections_effective.cover === true && rd.sections_effective.programs === false, { st: rd.sections, ef: rd.sections_effective });
  ok('the template on screen follows sections_effective: the required "cover" is on, "programs" off', sec && sec.cover === true && sec.programs === false, sec);
  await p2.close();
});

// ═══ 8 · B2B dashboard: a route group made of two server families ═══
section('8', async () => {
  console.log('\n[8] B2B Sales Dashboard · b2dSum for a group of two families');
  // the screen's Phi Phi group is two server families (Phi Phi Bamboo + Whale Shark): a route in the second family must exist in the catalogue
  await seed('POST', '/v1/routes', { name: 'Whale Shark Maiton by Speedboat', kind: 'marine', pier: 'panwa', family_id: 'whaleshark', times: ['08:00'] });
  await ev(() => laOps.catalogue.load()); await settle(1500);
  overrides['/v1/reports/b2b'] = (j) => {
    j.by_trip = (j.by_trip || []).filter((t) => t.family !== 'Phi Phi Bamboo' && t.family !== 'Whale Shark Phi Phi Maiton').concat([
      { family: 'Phi Phi Bamboo', revenue: 1000, pax: 10, bookings: 4, previous: 600, agents: [] },
      { family: 'Whale Shark Phi Phi Maiton', revenue: 2500, pax: 20, bookings: 6, previous: 900, agents: [] }]);
    return j;
  };
  await ev(() => { _b2d.mode = 'mom'; _b2d.basis = 'bd'; _b2d.ref = null; _b2d.T = 10; _b2d.tab = 'overview'; _b2d.screen = null; _b2d.stack = []; });
  await ev(() => { const el = document.querySelector('.nav-item[data-view="b2b-dash"]'); if (el) nav(el); renderB2BDash(); }); await settle(5000); await idle(); await settle(1500);
  const r = await ev(() => {
    const L = b2dLines(), w = b2dWin(L);
    return { cur: b2dSum(L, w.cs, w.ce, (l) => l.fam === 'Phi Phi'), prev: b2dSum(L, w.ps, w.pe, (l) => l.fam === 'Phi Phi'), all: b2dSum(L, w.cs, w.ce) };
  });
  ok('Phi Phi (2 server families): revenue, pax, bookings of the period = the sum of the server\'s family figures', r.cur.rev === 3500 && r.cur.pax === 30 && r.cur.bookings === 10, r);
  ok('the compared period: revenue = the sum of the families\' previous', r.prev.rev === 1500, r.prev);
  ok('the all-agents total is still the server kpis (not touched)', typeof r.all.rev === 'number', r.all);
  delete overrides['/v1/reports/b2b'];
});

for (const [name, fn] of todo) {
  if (ONLY && !ONLY.includes(name)) continue;
  try { await fn(); } catch (e) { ok('section ' + name + ' ran to the end', false, String(e.stack || e).slice(0, 700)); }
}
if (!ONLY) {
  const COMPUTED = ['itinerary', 'itinerary_own', 'charter', 'totals', 'row_total', 'by_code', 'work', 'nights', 'written', 'skipped', 'lead_duplicates', 'lead_guide', 'queue', 'towels', 'laundry_open', 'dirty_over', 'laundry_over', 'limits', 'used_boats', 'sections_effective', 'booked', 'join_heads', 'fleet'];
  const bad = bodies.filter((b) => b.req && /^[{[]/.test(b.req) && (() => { try { const j = JSON.parse(b.req); return !Array.isArray(j) && Object.keys(j).some((k) => COMPUTED.includes(k)); } catch (_) { return false; } })());
  ok('no request body of the whole walk carried a computed field (itinerary, totals, charter, towel limits, lead, booked heads ...)', bad.length === 0, bad.map((b) => b.k + ' ' + b.req.slice(0, 120)));
}
console.log('\nbrowser errors:', errors.length ? errors : 'none');
console.log('server refusals:', refusals.length ? refusals : 'none');
console.log('native dialogs:', dialogs);
console.log(fails.length ? '\nFAILED: ' + fails.join(' | ') : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
