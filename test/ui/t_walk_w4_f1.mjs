// t_walk_w4_f1 · browser walk of group F1 (Dashboard day detail + Live bookings header + month/year bars, Action Board,
// booking calendar, cancellation report, B2B dashboard, Operations report, our mix, pickup map, PR/PO prep, Analysis "why")
// against a REAL operation-backend (in-process store, seeded). Every check reads BOTH sides: the screen and the server's answer.
//   node test/ui/t_walk_w4_f1.mjs
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
const calls = [], urls = [], refusals = [], bodies = [];
// a test may rewrite one answer on its way to the page (path -> fn(json) -> json); used where the in-process store cannot be seeded to the state under test
const overrides = {};
const routeFn = async (route) => {
  const req = route.request(), u = new URL(req.url());
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  let buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (overrides[u.pathname] && r.status === 200) { try { buf = Buffer.from(JSON.stringify(overrides[u.pathname](JSON.parse(buf.toString()), u))); } catch (_) {} }
  calls.push(req.method() + ' ' + u.pathname + ' ' + r.status); urls.push(req.method() + ' ' + u.pathname + u.search + ' ' + r.status);
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
const urlsSince = (n) => urls.slice(n);
// the range loads of bookings (GET /v1/bookings?from=… or /v1/bookings/recent?created_from=…) since call n whose address matches re
const loadsRange = (n, re) => urlsSince(n).filter((u) => /^GET \/v1\/bookings(\/recent)?\?/.test(u) && re.test(u));

const bkk = (n = 0) => { const d = new Date(Date.now() + 7 * 3600000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const T0 = bkk(0);
const DAYS = [1, 2, 3, 4, 5, 6, 7, 8].map(bkk);
const THIS_MONTH = T0.slice(0, 7);
let n0 = 0;
const nonGet = (n) => callsSince(n).filter((c) => !c.startsWith("GET"));

// ── seed through the API ──
for (const d of [T0, ...DAYS]) await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: d, capacity: 40 });
await send('POST', '/operations/deployments', { boat_id: 'b1', route_id: 'r4', service_date: DAYS[0], capacity: 64 });
const mkBk = async (id, date, pax, extra = {}) => send('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: id.toUpperCase(), leadNationality: 'RU', leadPhone: '+7 900 1',
  pickupSelf: false, hotelName: 'Test Hotel', pickupZone: 'PK', trips: [{ routeId: 'r5', date, pax: { ad_fr: pax }, zone: 'PK' }], ...extra });
const bk = {};
for (const [k, date, pax, extra] of [['f1a', DAYS[0], 3, {}], ['f1b', DAYS[1], 2, {}], ['f1c', DAYS[0], 4, {}], ['f1d', DAYS[6], 2, {}], ['f1e', T0, 2, {}],
  ['b2c_f1w', DAYS[0], 2, { agentId: 'a_b2c', leadNationality: 'DE', total: 2400, price_mode: 'manual', b2c_channel: 'Line OA', trips: [{ routeId: 'r5', date: DAYS[0], pax: { ad_fr: 2 }, zone: 'PK', subtotal: 2400 }] }]]) {
  const r = await mkBk(k, date, pax, extra);
  if (r.status !== 201) { console.log('seed failed', k, r.status, JSON.stringify(r.body)); process.exit(2); }
  bk[k] = r.body;
}
// one cancelled booking (cancel needs the version it read)
{ const g = await api('/v1/bookings/' + bk.f1c.id); const c = await send('POST', '/v1/bookings/' + bk.f1c.id + '/cancel', { category: 'customer_cancel', note: 'changed plan', version: g.version }); if (c.status !== 200) { console.log('cancel failed', c.status, JSON.stringify(c.body)); process.exit(2); } }

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/dashboard`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
const sleep = (ms) => page.waitForTimeout(ms);
const openView = async (v, fn, wait = 1500) => { await ev(([vv, f]) => { const el = document.querySelector('.nav-item[data-view="' + vv + '"]'); if (el) nav(el); if (f) new Function(f)(); }, [v, fn || '']); await sleep(wait); await idle(); };
const text = (sel) => ev((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const nums = (s) => (s.match(/-?\d[\d,]*(\.\d+)?/g) || []).map((x) => +x.replace(/,/g, ''));
const short = (v) => ev((x) => _dashMoneyShort(x), v);

// ═══ 1 · Dashboard day detail (_ddSum, _ddAgg, _ddDaily/_ddHours, _ddHeadHtml, _ddExecData) ═══
curItem = '1 day detail';
console.log('\n== ' + curItem);
await openView('dashboard', '', 2500);
n0 = calls.length;
await ev(() => dashOpenDayDetail('b2b'));
await waitFor(() => document.querySelector('#dv-ddbd .dv-ddsums'), null, 15000);
await sleep(2500); await idle();
const dd = await api('/v1/dashboard/day-detail?from=' + T0 + '&to=' + T0);
ok('popup asked the server: GET /v1/dashboard/day-detail?from=today&to=today', callsSince(n0).some((c) => c.startsWith('GET /v1/dashboard/day-detail 200')), callsSince(n0).filter((c) => /day-detail/.test(c)));
ok('seed: 4 B2B bookings counted, 1 B2C, 1 cancelled', dd.b2b.summary.bookings === 4 && dd.b2c.summary.bookings === 1 && dd.b2b.summary.cancelled === 1, [dd.b2b.summary, dd.b2c.summary]);
const card = async (side) => ev((s) => [...document.querySelectorAll('.dv-ddsum[data-side="' + s + '"] .dv-ddsv .s b')].map((b) => b.innerText), side);
const expectCard = async (side, d = dd) => { const s = d[side].summary; return [String(s.bookings), String(s.pax), await short(s.value), await short(s.average), String(side === 'b2c' ? s.cancelled : s.agents)]; };
const c2b = await card('b2b'), e2b = await expectCard('b2b');
ok('B2B card equals the server summary (bookings, pax, money, average, agents)', JSON.stringify(c2b.slice(0, 5)) === JSON.stringify(e2b), [c2b, e2b]);
const c2c = await card('b2c'), e2c = await expectCard('b2c');
ok('B2C card equals the server summary', JSON.stringify(c2c.slice(0, 5)) === JSON.stringify(e2c), [c2c, e2c]);
const chips = await ev(() => [...document.querySelectorAll('.dv-ddkpi .dv-chip b')].map((b) => b.innerText));
const sumBars = (k) => ['b2c', 'b2b'].reduce((a, s) => a + dd[s].by_route.reduce((x, r) => x + r[k], 0), 0);
ok('header chips = the bars summed over both sides (bookings, pax, money, cancelled)', chips[0] === String(sumBars('n')) && chips[1] === String(sumBars('pax')) && chips[2] === await short(sumBars('value')) && chips[3] === String(dd.totals.cancelled), [chips, sumBars('n'), sumBars('pax'), sumBars('value')]);
const popup = await text('#dv-ddbd');
ok('route, agent and nationality bars show the server names', dd.b2b.by_route.every((r) => popup.includes(r.key)) && dd.b2b.by_who.every((r) => popup.includes(r.key)) && dd.b2b.by_nationality.every((r) => popup.includes(r.key)), popup.slice(0, 300));
const hb = await ev(() => [...document.querySelectorAll('#dv-ddbd .dv-ddcard:nth-child(3) .dv-ddhb')].map((e) => e.getAttribute('title')));
const hour = dd.b2b.by_created.filter((x) => x.n > 0);
ok('keyed-time bars use the server hours (Bangkok)', hour.length > 0 && hour.every((x) => hb.some((t) => t && t.startsWith(x.key + ':00') && t.includes(String(x.n)))), [hb.length, hour]);
const exec = dd.executive;
const cellTxt = async (date, rid) => ev((k) => { const e = document.querySelector('[data-cell="' + k + '"]'); return e ? e.innerText.replace(/\s+/g, '') : null; }, date + '|' + rid);
let gridOk = true; const seen = [];
for (const c of exec.cells.filter((x) => x.state !== 'idle' && x.state !== 'wx')) { const t = await cellTxt(c.date, c.route_id); seen.push([c.date, c.route_id, c.booked, c.capacity, t]); if (!t || !t.includes(c.booked + '/' + c.capacity)) gridOk = false; }
ok('7-day grid: every cell shows booked/capacity from the server', exec.cells.length > 0 && gridOk, seen);
const tl = (await text('[data-dd="travel"]')).replace(/\s+/g, ' ');
ok('travel list: the next-7-day rows show the server pax', exec.days.length === 7 && dd.travel.groups.filter((g) => g.kind === 'day').every((g) => tl.includes(g.n + ' · ' + g.pax)), [tl.slice(0, 300), dd.travel.groups]);
const kv = (await text('.dv-ddexec .kv')).replace(/\s+/g, ' ');
ok('KPI tiles: keyed today / within 7 days / open seats come from the server', kv.includes(String(dd.totals.bookings)) && kv.includes(String(dd.travel.next7.bookings)) && kv.includes(String(exec.totals.available)), kv);
ok('only reads went out, and only from/to on the query (no computed field)', nonGet(n0).length === 0 && callsSince(n0).some((c) => /day-detail/.test(c)), nonGet(n0));

// the server's answer differs from legacy arithmetic: legacy rows are gone (bookings not loaded), the cards still show the server's
await ev(() => { window.__rowsOrig = window._ddRows; window._ddRows = function () { return []; }; dashDayDetailPick('b2b'); });
await sleep(400);
const c2bGone = await card('b2b');
ok('legacy rows emptied (as if the bookings were not loaded): the B2B card still shows the server summary', JSON.stringify(c2bGone.slice(0, 5)) === JSON.stringify(e2b), c2bGone);
await ev(() => { window._ddRows = window.__rowsOrig; });
// range of 3 days: no executive block
await ev((a) => { window._ddFrom = a[0]; window._ddTo = a[1]; window._ddPaint(); }, [bkk(-2), T0]);
await sleep(1800); await idle();
const dd3 = await api('/v1/dashboard/day-detail?from=' + bkk(-2) + '&to=' + T0);
const c3 = await card('b2b');
ok('3-day range: asked again for that range; card equals its summary; no executive block', JSON.stringify(c3.slice(0, 5)) === JSON.stringify(await expectCard('b2b', dd3)) && dd3.executive === null && !(await ev(() => !!document.querySelector('[data-dd="exec"]'))), c3);
await ev(() => dashDayDetailClose());

// Live bookings card header
await openView('dashboard', '', 2500);
const feedHd = async () => ev(() => [...document.querySelectorAll('.dv-lvhd')].map((h) => [...h.querySelectorAll('.s')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())));
const fh = await feedHd();
const rec = await api('/v1/bookings/recent?created_from=' + T0 + '&created_to=' + T0 + '&source=b2b&limit=1');
const rec2 = await api('/v1/bookings/recent?created_from=' + T0 + '&created_to=' + T0 + '&source=b2c&limit=1');
ok('Live bookings header (B2B): count, pax, money, agents = the server summary', fh.some((h) => h[0] && h[0].startsWith(String(rec.summary.bookings)) && h[1].startsWith(String(rec.summary.pax)) && h[3] && h[3].startsWith(String(rec.summary.agents))), [fh, rec.summary]);
ok('Live bookings header (B2C): count and average = the server summary', rec2.summary.bookings === 1 && fh.some((h) => h[0] && h[0].startsWith(String(rec2.summary.bookings)) && h[1].startsWith(String(rec2.summary.pax))), [fh, rec2.summary]);

// ═══ 2 · Dashboard Bookings overview: 30-day and 12-month bars (renderDash buckets) ═══
curItem = '2 dashboard bars';
console.log('\n== ' + curItem);
{
  const SEL = DAYS[1];
  const addDays = (ds, n) => { const d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // what the server holds for the 30 days ending on SEL (two calendar-month answers put together by the test itself)
  const win = []; for (let i = -29; i <= 0; i++) win.push(addDays(SEL, i));
  const monthsNeeded = [...new Set(win.map((d) => d.slice(0, 7)))];
  const bucketBy = {};
  for (const m of monthsNeeded) { const a = await api('/v1/dashboard?date=' + m + '-01&mode=month'); a.series.forEach((b) => { bucketBy[b.bucket] = b; }); }
  const expect = win.map((d) => bucketBy[d]);
  ok('server month answers cover the 30-day window', expect.every(Boolean), win.filter((d) => !bucketBy[d]));
  n0 = calls.length;
  // legacy's own arithmetic cannot see these bookings: take its seat counter away
  await ev((s) => { window.__gsc = window.getSeatsConsumed; window.getSeatsConsumed = () => 0; window._dashDate = s; window._dashBkMode = 'month'; renderDash(); }, SEL);
  await sleep(2500); await idle(); await sleep(800);
  const plot = await ev(() => {
    const cols = [...document.querySelectorAll('.dv-plot > div > div')];
    return cols.map((c) => ({ lab: (c.lastElementChild && c.lastElementChild.innerText) || '', segs: [...c.querySelectorAll('.dv-barbox [title]')].map((e) => e.getAttribute('title')), top: (c.querySelector('.dv-barbox div[style*="top:-20px"]') || { innerText: '' }).innerText }));
  });
  ok('month mode asked the server: GET /v1/dashboard?mode=month for the months of the window', callsSince(n0).some((c) => /GET \/v1\/dashboard 200/.test(c)) && nonGet(n0).length === 0, callsSince(n0));
  ok('30 bars drawn', plot.length === 30, plot.length);
  const iSel = 29, iD0 = win.indexOf(DAYS[0]);
  ok('selected day label = the server bucket total', plot[iSel].top === String(expect[iSel].total), [plot[iSel].top, expect[iSel].total]);
  const segSum = (c) => c.segs.reduce((a, t) => a + (+(/:\s*(\d+)\s*$/.exec(t) || [0, 0])[1]), 0);
  ok('every bar holds the server pax (route segments + charter)', plot.every((c, i) => segSum(c) === expect[i].total || (expect[i].capacity === 0 && expect[i].total > 0)), plot.map((c, i) => [i, segSum(c), expect[i].total]).filter((x) => x[1] !== x[2]));
  ok('a bar with bookings the browser cannot see (seat counter stubbed to 0) still shows them', expect[iD0].total > 0 && segSum(plot[iD0]) === expect[iD0].total, [expect[iD0].total, plot[iD0]]);
  const avg = await ev(() => [...document.querySelectorAll('.dv-av')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const totWin = expect.reduce((a, b) => a + b.total, 0);
  ok('"average per day" card = the server totals over the window / 30', avg.some((t) => t.includes(String(Math.round(totWin / 30)))), [avg, totWin]);
  // 12 months
  const anchor = new Date(SEL + 'T12:00:00Z');
  const ymA = anchor.getUTCFullYear();
  const yb = {}; for (const y of [ymA, ymA - 1]) { const a = await api('/v1/dashboard?date=' + y + '-01-01&mode=year'); a.series.forEach((b) => { yb[b.bucket] = b; }); }
  const months = []; for (let o = -11; o <= 0; o++) { const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + o, 1)); months.push(d.toISOString().slice(0, 7)); }
  n0 = calls.length;
  await ev(() => { window._dashBkMode = 'year'; renderDash(); });
  await sleep(2500); await idle(); await sleep(800);
  const plotY = await ev(() => [...document.querySelectorAll('.dv-plot > div > div')].map((c) => ({ segs: [...c.querySelectorAll('.dv-barbox [title]')].map((e) => e.getAttribute('title')), top: (c.querySelector('.dv-barbox div[style*="top:-20px"]') || { innerText: '' }).innerText })));
  ok('year mode: 12 bars, the selected month shows the server bucket total', plotY.length === 12 && plotY[11].top === String(yb[months[11]].total), [plotY.length, plotY[11], yb[months[11]]]);
  ok('year mode: every month holds the server pax', plotY.every((c, i) => segSum(c) === yb[months[i]].total || (yb[months[i]].capacity === 0 && yb[months[i]].total > 0)), plotY.map((c, i) => [months[i], segSum(c), yb[months[i]].total]));
  ok('year mode asked the server for the year answers', callsSince(n0).some((c) => /GET \/v1\/dashboard 200/.test(c)), callsSince(n0));
  await ev(() => { window.getSeatsConsumed = window.__gsc; window._dashBkMode = 'day'; window._dashDate = ''; renderDash(); });
  await sleep(500);
}

// ═══ 3 · Action Board (_abAgentSplit, _abAgentStats, _abDelta, abRender cards and chips) ═══
curItem = '3 action board';
console.log('\n== ' + curItem);
{
  // legacy's own arithmetic has nothing to add up: the browser holds no booking at all
  await ev(() => { SB_BOOKINGS.length = 0; });
  n0 = calls.length;
  await openView('actionboard', 'abRender()', 3000);
  await sleep(1500); await idle();
  const ab = await api('/v1/action-board?month=' + THIS_MONTH);
  const mine = callsSince(n0);
  ok('asked the server: GET /v1/action-board and GET /v1/availability?split=agent', mine.some((c) => c.startsWith('GET /v1/action-board 200')) && mine.some((c) => c.startsWith('GET /v1/availability 200')), mine);
  ok('no booking range was loaded for the board (the three loads of 52 are not started)', loadsRange(n0, new RegExp('[?&](created_from|from)=(' + T0 + '|' + THIS_MONTH + '-01)')).length === 0 && !mine.some((c) => /agent-month-stats/.test(c)), urlsSince(n0).filter((c) => /bookings/.test(c)));
  ok('seed: Sun Tour is the top sender with a "new" tag', ab.cards.top_senders[0].agent.agent_id === 'a01' && ab.cards.top_senders[0].delta.kind === 'new', ab.cards.top_senders[0]);
  const chip = (label) => ev((l) => { const e = [...document.querySelectorAll('.ab-chip')].find((x) => x.textContent.trim().startsWith(l)); return e ? e.querySelector('b').textContent : null; }, label);
  ok('chips equal the server chips (Free 14d, Almost full, At risk, Agents gone)', [await chip('Free 14d'), await chip('Almost full'), await chip('At risk'), await chip('Agents gone')].join() === [ab.chips.free_14d, ab.chips.almost_full, ab.chips.at_risk, ab.chips.agents_gone].join(), [await chip('Free 14d'), ab.chips]);
  const card = (title) => ev((t) => { const c = [...document.querySelectorAll('.ab-c')].find((x) => { const b = x.querySelector('.ab-ct .big'); return b && b.textContent.trim() === t; }); return c ? { cnt: (c.querySelector('.ab-ct .cnt') || {}).textContent, rows: [...c.querySelectorAll('.ab-ar')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()), trips: [...c.querySelectorAll('.ab-tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()) } : null; }, title);
  const top = await card('Top senders this month');
  ok('Top senders card = the server list (rank, name, pax, bookings, new tag)', top && top.rows.length === ab.cards.top_senders.length && ab.cards.top_senders.every((x, i) => top.rows[i].includes(x.agent.name) && top.rows[i].includes(String(x.value)) && top.rows[i].includes(x.detail.bookings + ' bkgs')) && /new/.test(top.rows[0]), [top, ab.cards.top_senders.length]);
  const risk = await card('At risk');
  ok('At risk card lists the server cells (count and dates)', risk && risk.trips.length === ab.cards.at_risk.length && String(ab.cards.at_risk.length) === risk.cnt && ab.cards.at_risk.every((x, i) => risk.trips[i].includes(x.fill_percent + '%')), [risk, ab.cards.at_risk.length]);
  // by sales: the cell tooltip names the salesperson with the server's pax for the day
  const sold = await api('/v1/availability?from=' + DAYS[0] + '&to=' + DAYS[0] + '&split=sales');
  const r5 = sold.days.find((d) => d.route_id === 'r5');
  const tip = await ev(([rid, ds]) => { const e = [...document.querySelectorAll('.ab-mc')].find((x) => (x.getAttribute('onclick') || '').includes("abGoTrip('" + rid + "','" + ds + "')")); return e ? e.getAttribute('title') : null; }, ['r5', DAYS[0]]);
  ok('seat cell tooltip names who sold the seats with the server sold_by pax (by sales)', r5.sold_by.length > 0 && tip && r5.sold_by.every((x) => tip.includes(' ' + x.pax)), [tip, r5.sold_by]);
  await ev(() => abSetBy('agent')); await sleep(600);
  const sold2 = await api('/v1/availability?from=' + DAYS[0] + '&to=' + DAYS[0] + '&split=agent');
  const r5a = sold2.days.find((d) => d.route_id === 'r5');
  const tip2 = await ev(([rid, ds]) => { const e = [...document.querySelectorAll('.ab-mc')].find((x) => (x.getAttribute('onclick') || '').includes("abGoTrip('" + rid + "','" + ds + "')")); return e ? e.getAttribute('title') : null; }, ['r5', DAYS[0]]);
  ok('by agent: the tooltip lists each agent with the server pax (Sun Tour, B2C Website)', r5a.sold_by.length === 2 && /Sun Tour 3/.test(tip2 || '') && /B2C Website 2/.test(tip2 || ''), [tip2, r5a.sold_by]);
  await ev(() => abSetBy('sales'));
  // a sales filter goes to the server as sales_id; this salesperson owns every seeded agent, a made-up one owns none
  n0 = calls.length;
  await ev(() => abSetSales('s1')); await sleep(1500); await idle();
  ok('sales chip: the board asks with sales_id', callsSince(n0).some((c) => /GET \/v1\/action-board 200/.test(c)), callsSince(n0));
  await ev(() => abSetSales(''));
  await sleep(500);
  ok('only reads went out for the board', nonGet(n0).length === 0, nonGet(n0));
}

// ═══ 4 · Booking calendar: chips, cards, averages, matrix (bookingV2FamilyAggregate, RenderStats, RenderRouteAvgs, RenderMatrix) ═══
curItem = '4 booking calendar';
console.log('\n== ' + curItem);
{
  const CM = DAYS[0].slice(0, 7);
  n0 = calls.length;
  await openView('booking', '', 2500);
  await ev((m) => { _bkV2CityTourOnly = false; _bkV2.tab = 'cal'; _bkV2.view = 'cal'; _bkV2.cursor = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1, 12); _bkV2.selected = null; bookingV2Render(); }, CM);
  await sleep(2500); await idle(); await sleep(500);
  const cal = await api('/v1/bookings/calendar?month=' + CM + '&kind=marine');
  ok('asked the server: GET /v1/bookings/calendar?month=&kind=marine', callsSince(n0).some((c) => c.startsWith('GET /v1/bookings/calendar 200')), callsSince(n0).filter((c) => /calendar/.test(c)));
  // the browser's own month sum has nothing to add up: no booking in memory, the screen is still the server's
  await ev(() => { SB_BOOKINGS.length = 0; bookingV2Render(); });
  await sleep(800);
  const stat = await ev(() => [...document.querySelectorAll('.bkv2-stats .bkv2-stat')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const s = cal.stats;
  ok('hero card = server month pax and bookings (browser holds no booking)', s.pax > 0 && stat[0] && stat[0].includes(String(s.pax)) && stat[0].includes(s.bookings + ' ใบจอง'), [stat, s]);
  ok('"not confirmed" / "all confirmed" card = server stats', stat[1] && stat[1].includes(String(s.unconfirmed > 0 ? s.unconfirmed : s.confirmed)), [stat[1], s]);
  ok('busiest / quietest card = server busiest and quietest day', stat[2] && stat[2].includes(String(s.busiest.pax)) && stat[2].includes(String(s.quietest.pax)), [stat[2], s.busiest, s.quietest]);
  const chipOf = (date) => ev((d) => { const cell = [...document.querySelectorAll('.bkv2-cal-cell')].find((c) => (c.getAttribute('onclick') || '').includes("bookingV2SelectDay('" + d + "')")); return cell ? [...cell.querySelectorAll('.bkv2-cal-chip')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()) : null; }, date);
  const day0 = cal.days.find((d) => d.date === DAYS[0]), famPax = (day0.families.find((f) => f.family_id === 'similan') || {}).total;
  const chips = await chipOf(DAYS[0]);
  ok('calendar chip for a busy day shows the server family pax', famPax > 0 && chips && chips.some((c) => c.includes('Similan') && c.includes(String(famPax))), [chips, famPax]);
  const badge = await ev((d) => { const cell = [...document.querySelectorAll('.bkv2-cal-cell')].find((c) => (c.getAttribute('onclick') || '').includes("bookingV2SelectDay('" + d + "')")); const b = cell && cell.querySelector('.bkv2-cal-daytot'); return b ? b.textContent : null; }, DAYS[0]);
  ok('the day badge equals the server badge_total', String(day0.badge_total) === badge, [badge, day0.badge_total]);
  const rc = await ev(() => [...document.querySelectorAll('.bkv2-route-card')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const ra = cal.route_avgs.find((r) => r.family_id === 'similan');
  ok('"Avg pax per program" card = server route_avgs (bookings, days ran, per week)', rc.some((t) => t.includes('Similan Islands') && t.includes(ra.bookings + ' bookings') && t.includes(ra.days_ran + ' days ran') && t.endsWith(String(ra.per_week))), [rc, ra]);
  await ev(() => bookingV2SetAvgMode('total')); await sleep(600);
  const rc2 = await ev(() => [...document.querySelectorAll('.bkv2-route-card')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  ok('Total mode shows the server pax', rc2.some((t) => t.includes('Similan Islands') && t.endsWith(String(ra.pax))), rc2);
  await ev(() => bookingV2SetAvgMode('week'));
  // matrix
  await ev(() => { _bkV2.view = 'mx'; _bkV2.expanded = new Set(); bookingV2Render(); });
  await sleep(1000);
  const F = cal.matrix.families.find((f) => f.family_id === 'similan');
  const row = await ev(() => { const tr = [...document.querySelectorAll('.bkv2-mx tr.fam')].find((r) => r.innerText.includes('Similan')); return tr ? [...tr.querySelectorAll('td')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()) : null; });
  const dayCells = row && row.slice(1, 1 + F.cells.length);
  ok('matrix family row: every day cell = the server cell total', row && F.cells.every((c, i) => dayCells[i] === (c.total ? String(c.total) : (c.open ? '—' : '×'))), [dayCells, F.cells.map((c) => c.total)]);
  ok('matrix family row: month sum and AD/CHD/INF/FOC columns = the server', row && row[1 + F.cells.length].startsWith(String(F.sum)) && row[2 + F.cells.length] === String(F.ad), [row && row.slice(F.cells.length), F.sum, F.ad]);
  const tot = await ev(() => { const tr = document.querySelector('.bkv2-mx tr.tot'); return tr ? [...tr.querySelectorAll('td')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()) : null; });
  ok('matrix "all days" row = the server day totals', tot && cal.matrix.day_totals.every((t, i) => tot[1 + i] === (t.total ? String(t.total) : '·')), [tot && tot.slice(0, 32), cal.matrix.day_totals.map((t) => t.total)]);
  await ev(() => bookingV2ToggleFamily('similan')); await sleep(600);
  const subs = await ev(() => [...document.querySelectorAll('.bkv2-mx tr.sub')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
  const V = F.variants.find((v) => v.live_days > 0);
  ok('expanded family: the variant with bookings is listed with the server sum', subs.some((t) => t.includes(V.name) && t.includes(V.live_days + ' วัน')), [subs, V.name]);
  ok('the calendar page only read (no write went out)', nonGet(n0).length === 0, nonGet(n0));
  await ev(() => { _bkV2.view = 'cal'; _bkV2.expanded = new Set(); });
}

// ═══ 5 · Cancellation report (bookingV2RenderCancelReport) ═══
curItem = '5 cancellations';
console.log('\n== ' + curItem);
{
  // a second cancellation with a fee and another reason, so the cards have more than one row
  { const g = await api('/v1/bookings/' + bk.f1d.id); const c = await send('POST', '/v1/bookings/' + bk.f1d.id + '/cancel', { category: 'no_show', charge_type: 'partial', charge_amount: 500, version: g.version }); if (c.status !== 200) { console.log('cancel failed', c.status, JSON.stringify(c.body)); process.exit(2); } }
  const CM = T0.slice(0, 7), first = CM + '-01', last = new Date(Date.UTC(+CM.slice(0, 4), +CM.slice(5, 7), 0)).toISOString().slice(0, 10);
  n0 = calls.length;
  await openView('booking', '', 1500);
  await ev((m) => { _bkV2CityTourOnly = false; _bkV2.month = m; _bkV2.tab = 'cancel'; bookingV2Render(); }, CM);
  await sleep(2500); await idle(); await sleep(500);
  const rep = await api('/v1/reports/cancellations?from=' + first + '&to=' + last);
  const mine = callsSince(n0);
  ok('asked the server: GET /v1/reports/cancellations', mine.some((c) => c.startsWith('GET /v1/reports/cancellations 200')), mine);
  ok('no booking range was loaded for the report', loadsRange(n0, new RegExp('[?&]from=' + first)).length === 0, urlsSince(n0).filter((c) => /bookings/.test(c)));
  ok('seed: two cancellations, one with a 500 fee', rep.cancellations === 2 && rep.fees === 500 && rep.by_reason.length === 2, rep);
  // the browser holds no booking: legacy would say "No cancellations yet"
  await ev(() => { SB_BOOKINGS.length = 0; bookingV2Render(); });
  await sleep(600);
  const t = (await ev(() => [...document.querySelectorAll('.bkv2')].map((e) => e.innerText).join(' '))).replace(/\s+/g, ' ');
  ok('four KPI cards = the server (cancellations, rate, pax, no-show rate, fees)', t.includes(String(rep.cancellations)) && t.includes(rep.cancel_rate_pct + '% of ' + rep.bookings_in_period) && t.includes(String(rep.pax_cancelled)) && t.includes(rep.no_show_rate_pct + '%') && t.includes('฿' + rep.fees), t.slice(0, 400));
  ok('by-reason rows show the server reason, count, pax and fee', rep.by_reason.every((r) => t.includes(r.count + ' · ' + r.pax + ' pax · ฿' + r.fee)), t.slice(0, 600));
  ok('fault side = the server split', t.includes('Customer ' + rep.fault.customer + ' (' + rep.fault.customer_pct + '%)') && t.includes('Operator ' + rep.fault.operator), t.slice(0, 700));
  ok('top cancelling agents and months = the server', rep.by_agent.every((a) => t.includes(a.name)) && rep.by_month.every((m) => t.includes(m.month)), t.slice(-300));
  ok('the period line says what the window is (cancelled in)', t.includes('Cancelled in: ' + first + ' → ' + last), t.slice(0, 120));
  ok('the count in the top bar is the server\x27s', t.includes(rep.cancellations + ' cancellations'), t.slice(0, 200));
  ok('only reads went out', nonGet(n0).length === 0, nonGet(n0));
  await ev(() => { _bkV2.tab = 'cal'; });
}

// ═══ 6 · B2B Sales Dashboard (b2dAgents, b2dSum, b2dBridge, b2dShiftSignal, b2dMonthlySeries, b2dTabsScreen) ═══
curItem = '6 b2b dashboard';
console.log('\n== ' + curItem);
{
  // sales made 40 days ago: one agent that kept selling, one that stopped (churn)
  const agC = (await send('POST', '/v1/agents', { name: 'Churn Agent', market_id: 'ru', sales_id: 's1', pay_type: 'bt', vat_mode: 'none', rate_type_id: 'rt001', company: { legal_name: 'Churn Agent Co', address: '1 Test Rd' } })).body;
  for (const [id, agent, pax] of [['f6a', 'a01', 3], ['f6b', agC.id, 4]]) {
    const r = await mkBk(id, DAYS[2], pax, { agentId: agent, booking_date: bkk(-40) });
    if (r.status !== 201) { console.log('seed failed', id, r.status, JSON.stringify(r.body)); process.exit(2); }
  }
  n0 = calls.length;
  await ev(() => { _b2d.mode = 'mom'; _b2d.basis = 'bd'; _b2d.ref = null; _b2d.T = 10; _b2d.tab = 'overview'; _b2d.screen = null; _b2d.stack = []; });
  await openView('b2b-dash', 'renderB2BDash()', 4000);
  await sleep(2500); await idle();
  const w = await ev(() => ({ ..._b2dW }));
  const rep = await api('/v1/reports/b2b?from=' + w.cs + '&to=' + w.ce + '&basis=bd&compare=previous&threshold=10');
  const mine = callsSince(n0);
  ok('asked the server: GET /v1/reports/b2b for the screen\'s window', mine.some((c) => c.startsWith('GET /v1/reports/b2b 200')), mine.filter((c) => /b2b/.test(c)));
  ok('seed: Sun Tour grew, Churn Agent churned', rep.agents.some((a) => a.agent_id === 'a01' && (a.class === 'growth' || a.class === 'stable' || a.class === 'loss')) && rep.agents.some((a) => a.name === 'Churn Agent' && a.class === 'churn'), rep.agents.map((a) => [a.name, a.class, a.current, a.previous]));
  const body = async () => (await text('#b2bdash-wrap')).replace(/\s+/g, ' ');
  const kfmt = (v) => ev((x) => b2dK(x), v);
  let t = await body();
  ok('revenue KPI card = the server revenue (current, and "vs previous")', t.includes(await kfmt(rep.kpis.revenue.current)) && t.includes('vs ' + await kfmt(rep.kpis.revenue.previous) + ' last period'), t.slice(0, 500));
  ok('active agents KPI = the server', t.includes('vs ' + rep.kpis.active_agents.previous + ' last period'), t.slice(0, 500));
  ok('tab counts = the server (Growth, Loss, Stable)', t.includes('Growth (' + (rep.agents.filter((a) => a.class === 'growth' || a.class === 'new').length) + ')') && t.includes('Loss (' + (rep.agents.filter((a) => a.class === 'loss' || a.class === 'churn').length) + ')') && t.includes('Stable (' + rep.tabs.stable + ')'), t.slice(500, 900));
  const wf = rep.bridge;
  ok('revenue bridge: the waterfall steps show the server bridge (prev, growth, new, loss, churn, now)', t.includes(await kfmt(wf.previous)) && t.includes(await kfmt(wf.current)) && t.includes(await kfmt(wf.churn)), [wf, t.slice(800, 1300)]);
  ok('summary line: Gained / Lost / Net = the server', t.includes('Gained ' + await kfmt(rep.gained)) && t.includes('Net ' + await kfmt(rep.net)), t.slice(1200, 1500));
  const watch = rep.watchlist.map((x) => x.name || x.agent);
  ok('watch-list names the server\'s churned agent', rep.watchlist.length > 0 && t.includes('Churn Agent'), rep.watchlist);
  // legacy's own arithmetic differs: take away the lines it adds up. The screen still shows the server's agents.
  await ev(() => { window.__b2dl = window.b2dLines; window.b2dLines = function () { return []; }; renderB2BDash(); });
  await sleep(800);
  t = await body();
  ok('trip lines emptied (legacy would show no agent): the watch-list and KPIs are still the server\'s', t.includes('Churn Agent') && t.includes(await kfmt(rep.kpis.revenue.current)), t.slice(0, 300));
  await ev(() => { window.b2dLines = window.__b2dl; });
  // By trip: Similan is one server family -> the server's agents and signal
  await ev(() => { b2dTab('trip'); b2dSelTrip('Similan'); });
  await sleep(1800); await idle();
  const rep2 = await api('/v1/reports/b2b?from=' + w.cs + '&to=' + w.ce + '&basis=bd&compare=previous&threshold=10');
  const fam = rep2.by_trip.find((x) => x.family === 'Similan Islands');
  t = await body();
  ok('By trip (Similan): header shows the server revenue, pax and bookings of the route', fam && t.includes('Revenue ' + (await ev((x) => b2dB(x), fam.revenue))) && t.includes('Pax ' + fam.pax) && t.includes('booking ' + fam.bookings), [fam && [fam.revenue, fam.pax, fam.bookings], t.slice(0, 600)]);
  ok('By trip (Similan): every server agent is listed with its route class', fam && fam.agents.every((a) => t.includes(a.name)), t.slice(0, 600));
  const sigs = fam ? fam.agents.filter((a) => a.signal).map((a) => a.signal.text) : [];
  ok('By trip: each route-shift signal shown is the server\'s text', sigs.every((s) => t.includes(s)), [sigs, t.slice(0, 500)]);
  ok('only reads went out', nonGet(n0).length === 0, nonGet(n0));
  await ev(() => { b2dTab('overview'); });
}

// ═══ 7 · Operations Report (repOpsGather, repOpsSlides, _repOpsHeadline) ═══
curItem = '7 operations report';
console.log('\n== ' + curItem);
{
  const CM = T0.slice(0, 7), first = CM + '-01', last = new Date(Date.UTC(+CM.slice(0, 4), +CM.slice(5, 7), 0)).toISOString().slice(0, 10);
  await ev(([f, l]) => { const s = repSt('ops'); s.from = f; s.to = l; }, [first, last]);
  await ev(() => { SB_BOOKINGS.length = 0; });
  n0 = calls.length;
  await openView('rep-ops', "renderReport('ops')", 3500);
  await sleep(2500); await idle(); await sleep(800);
  const rep = await api('/v1/reports/operations?from=' + first + '&to=' + last);
  const mine = callsSince(n0);
  ok('asked the server: GET /v1/reports/operations', mine.some((c) => c.startsWith('GET /v1/reports/operations 200')), mine);
  ok('no booking range was loaded for the report', loadsRange(n0, new RegExp('[?&]from=' + first)).length === 0, urlsSince(n0).filter((c) => /bookings/.test(c)));
  const D = rep.current;
  ok('seed: heads, sales and a raised invoice are there to compare', D.heads.carried > 0 && D.revenue > 0 && D.invoices.raised >= 1, [D.heads, D.revenue, D.invoices]);
  const stat = (k) => ev((kk) => { const e = [...document.querySelectorAll('#rep-host-ops .rep-av')].find((x) => (x.querySelector('.k') || {}).textContent === kk); return e ? { v: e.querySelector('.v').innerText, u: (e.querySelector('.u') || { innerText: '' }).innerText } : null; }, k);
  const money = (v) => ev((x) => repMoney(x), v);
  const sp = await stat('Passengers carried'), sf = await stat('Seat fill rate'), sv = await stat('Sales value'), so = await stat('Sailings operated');
  ok('"Passengers carried" = server heads carried, "seats booked" = heads booked', sp && sp.v === String(D.heads.carried) && sp.u.startsWith(String(D.heads.booked)), [sp, D.heads]);
  ok('"Seat fill rate" and seats offered = the server', sf && sf.v === D.fill_pct + '%' && sf.u.includes(String(D.seats_offered)), [sf, D.fill_pct, D.seats_offered]);
  ok('"Sales value" and bookings = the server', sv && sv.v === await money(D.revenue) && sv.u.startsWith(String(D.bookings)), [sv, D.revenue, D.bookings]);
  ok('"Sailings operated" and operating days = the server', so && so.v === String(D.sailings) && so.u.includes(String(D.operating_days)), [so, D.sailings, D.operating_days]);
  const inv = await stat('Invoiced'), unp = await stat('Still unpaid');
  ok('finance slide: Invoiced and Still unpaid = the server invoices', inv && unp && inv.v === await money(D.invoices.raised_total) && inv.u.startsWith(String(D.invoices.raised)) && unp.v === await money(D.invoices.unpaid_total) && unp.u.startsWith(String(D.invoices.unpaid)), [inv, unp, D.invoices]);
  const foot = (await ev(() => [...document.querySelectorAll('#rep-host-ops .rep-cfoot, #rep-host-ops .foot, #rep-host-ops [class*=foot]')].map((e) => e.innerText).join(' | '))).replace(/\s+/g, ' ');
  ok('the headline sentence on the first card is the server headline', foot.includes(rep.headline.replace(/\s+/g, ' ')), [foot.slice(0, 300), rep.headline]);
  const prog = (await text('#rep-host-ops')).replace(/\s+/g, ' ');
  ok('programme slides name the server routes with their pax', D.by_route.every((r) => prog.includes(r.name)), prog.slice(0, 200));
  ok('the invoice list was put back after the slides (nothing synthetic is left)', await ev(() => SB_INVOICES.every((v) => v.issuedAt !== (repSt('ops').from) || v.id)), null);
  ok('only reads went out', nonGet(n0).length === 0, nonGet(n0));
}

// ═══ 8 · Market Data: our mix, coverage, missing nationality, lead time, on the books (mdOurMixByCode, mdOurNatCoverage, mdMissingNat, mdLeadByMarket, mdOnTheBooks) ═══
curItem = '8 our mix';
console.log('\n== ' + curItem);
{
  // one booking with no nationality at all (the server cannot count it in the mix)
  { const r = await mkBk('f8x', DAYS[3], 2, { leadNationality: '', leadPax: 'ZZZ', intent: 'quote' }); if (r.status !== 201) { console.log('seed failed f8x', r.status, JSON.stringify(r.body)); process.exit(2); } bk.f8x = r.body; }
  await send('PUT', '/v1/market-stats/' + T0 + '/in', { rows: { 'รัสเซีย': 200, 'เยอรมัน': 50 } });
  await ev(() => { SB_BOOKINGS.length = 0; });                 // legacy has no booking to add up
  n0 = calls.length;
  await openView('marketdata', 'renderMarketData()', 3000);
  await ev(() => { laOps.marketData.load(); });
  await sleep(1500); await idle();
  const mixA = await api('/v1/market-stats/our-mix');
  ok('seed: Russian and German in our mix, one booking missing a nationality', mixA.mix.some((x) => x.code === 'RU') && mixA.missing_nationality.count >= 1, [mixA.mix, mixA.missing_nationality]);
  await ev(() => mdSetTab('gap')); await sleep(900);
  const mine = callsSince(n0);
  ok('asked the server: GET /v1/market-stats/our-mix', mine.some((c) => c.startsWith('GET /v1/market-stats/our-mix 200')), mine);
  const gap = await ev(() => [...document.querySelectorAll('#md-body table tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\s+/g, ' ').trim())));
  const rowOf = (code) => gap.find((r) => r[0] && r[0].endsWith(' ' + code));
  const ru = rowOf('RU'), de = rowOf('DE');
  const fmt = (v) => ev((x) => mdFmt(x), v);
  ok('Market Gap table: "Our pax" for Russian and German = the server mix (the browser holds no booking)', ru && de && ru[3] === await fmt(mixA.mix.find((x) => x.code === 'RU').pax) && de[3] === await fmt(mixA.mix.find((x) => x.code === 'DE').pax), [ru, de, mixA.mix]);
  const note = (await text('#md-body')).replace(/\s+/g, ' ');
  ok('coverage line = the server (with / total bookings, pct)', note.includes(mixA.coverage.with_nationality + '/' + mixA.coverage.total + ' bookings (' + mixA.coverage.pct + '%)'), note.slice(0, 400));
  ok('"Bookings missing nationality" card lists the server booking (reference, count)', mixA.missing_nationality.count >= 1 && note.includes('Bookings missing nationality') && mixA.missing_nationality.bookings.every((b) => note.includes(b.reference)) && note.includes(mixA.missing_nationality.count + ' booking'), note.slice(0, 600));
  await ev(() => mdSetTab('forecast')); await sleep(900);
  const fc = (await text('#md-body')).replace(/\s+/g, ' ');
  ok('on-the-books pipeline total = the server total', fc.includes('On-the-books pipeline') && fc.includes(await fmt(mixA.on_the_books.total_pax) + ' pax'), fc.slice(fc.indexOf('On-the-books'), fc.indexOf('On-the-books') + 200));
  const w0 = mixA.on_the_books.weeks[0].pax;
  const wkRow = await ev(() => { const r = [...document.querySelectorAll('#md-body div')].find((d) => d.children.length >= 2 && /^Week \+0/.test(d.innerText.trim())); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; });
  ok('week +0 row shows the server week pax', wkRow && wkRow.includes(await fmt(w0)), [wkRow, w0]);
  await ev(() => mdSetTab('season')); await sleep(900);
  const lead = (await text('#md-body')).replace(/\s+/g, ' ');
  ok('lead-time by market lists the server markets', mixA.lead_time.markets.every((m) => lead.includes(m.market)), lead.slice(lead.indexOf('Lead-time'), lead.indexOf('Lead-time') + 300));
  // the "Fix" button reads the booking from the server first, then opens it
  const miss = mixA.missing_nationality.bookings[0];
  await ev(() => mdSetTab('gap')); await sleep(500);
  n0 = calls.length;
  await ev((id) => mdOpenBk(id), miss.booking_id); await sleep(1800); await idle();
  ok('"Fix" reads the booking from the server (GET /v1/bookings/{id}) and opens it', callsSince(n0).some((c) => c.startsWith('GET /v1/bookings/' + miss.booking_id) || /^GET \/v1\/bookings\/[^ ]+ 200/.test(c)) && await ev(() => !!document.querySelector('.bkv2') && !!(window._bkV2 && _bkV2.detailId)), callsSince(n0));
  ok('only reads went out', nonGet(n0).length === 0, nonGet(n0));
  await ev(() => { _bkV2.detailId = null; });
}

// ═══ 9 · Pickup Map (pmapAgg, pmapMoM, pmapAreaDetail, pmapAgHotels, pmapAgentZone) ═══
curItem = '9 pickup map';
console.log('\n== ' + curItem);
{
  // two pickup areas the map has pins for, and bookings picked up there
  const mkArea = async (name, region) => (await send('POST', '/v1/pickup-areas', { name, zone: 'PK', time_group: 'A', region })).body;
  const aPat = await mkArea('Patong', 'Patong'), aKata = await mkArea('Kata', 'South');
  if (!aPat || !aPat.id) { console.log('area seed failed', JSON.stringify(aPat)); process.exit(2); }
  for (const [id, date, pax, area, hotel] of [['f9a', DAYS[4], 3, aPat.id, 'Patong Beach Hotel'], ['f9b', DAYS[4], 2, aPat.id, 'Sea View Patong'], ['f9c', DAYS[5], 4, aKata.id, 'Kata Palm']]) {
    const r = await mkBk(id, date, pax, { pickupAreaId: area, hotelName: hotel });
    if (r.status !== 201) { console.log('seed failed', id, r.status, JSON.stringify(r.body)); process.exit(2); }
  }
  const CMo = DAYS[4].slice(0, 7);
  await ev((a) => { _pmapMode = 'month'; _pmapAnchor = a + '-15'; _pmapMetric = 'pax'; _pmapMkFilter = null; _pmapAgFilter = null; _pmapSel = null; }, CMo);
  await ev(() => { SB_BOOKINGS.length = 0; });                       // legacy has nothing to add up
  n0 = calls.length;
  await openView('pickupmap', 'renderPickupMap()', 4000);
  await sleep(2500); await idle(); await sleep(800);
  const q = '?period=month&anchor=' + CMo + '-15&metric=pax';
  const rep = await api('/v1/reports/pickup-map' + q);
  const mine = callsSince(n0);
  ok('asked the server: GET /v1/reports/pickup-map', mine.some((c) => c.startsWith('GET /v1/reports/pickup-map 200')), mine);
  ok('no booking range was loaded for the map', loadsRange(n0, new RegExp('[?&]from=' + CMo)).length === 0, urlsSince(n0).filter((c) => /bookings/.test(c)));
  const pat = rep.areas.find((a) => a.area === 'Patong'), kata = rep.areas.find((a) => a.area === 'Kata');
  ok('seed: Patong 5 pax and Kata 4 pax on the server', pat && kata && pat.pax >= 5 && kata.pax >= 4, rep.areas.map((a) => [a.area, a.pax]));
  const bar = (await text('#pmap-bar')).replace(/\s+/g, ' ');
  ok('toolbar total = the server total pax', bar.includes('รวม ' + rep.totals.pax), bar);
  const panel = (await text('#pmap-panel')).replace(/\s+/g, ' ');
  ok('area list: Patong and Kata with the server pax (the browser holds no booking)', panel.includes('Patong') && panel.includes('Kata') && new RegExp('Patong\\s*' + pat.pax + '\\b').test(panel) || (panel.includes('Patong') && panel.includes(String(pat.pax))), panel.slice(0, 300));
  // one area: its panel
  await ev(() => pmapSelect('Patong')); await sleep(800);
  const det = (await text('#pmap-panel')).replace(/\s+/g, ' ');
  ok('area panel: top hotels with the server pax and the booking count', pat.top_hotels.every((h) => det.includes(h.name) && det.includes(String(h.pax))) && det.includes(pat.bookings + ' booking'), [det.slice(0, 400), pat.top_hotels]);
  ok('area panel: top agents are the server\'s', pat.top_agents.every((a) => det.includes(a.name)), det.slice(0, 400));
  ok('area panel: the change against the period before is the server\'s (none: nothing sold before)', pat.change_pct.pax === null && !/▲|▼/.test(det.split('vs ช่วงก่อน')[0].slice(-40)), [pat.change_pct, det.slice(0, 200)]);
  // agent filter: the agent x zone card and the agent's hotels
  await ev(() => { pmapSelect(null); pmapSetAg('a01'); }); await sleep(1500); await idle();
  const repA = await api('/v1/reports/pickup-map' + q + '&agent=a01');
  const zp = (await text('#pmap-zpanel')).replace(/\s+/g, ' ');
  ok('Agent x zone card: the agent and its total = the server matrix', repA.agent_matrix.agents.every((a) => zp.includes(a.name) && zp.includes(String(repA.agent_matrix.total))), [zp.slice(0, 300), repA.agent_matrix]);
  ok('the chosen agent\'s hotels are the server\'s list', repA.agent_hotels.length > 0 && repA.agent_hotels.slice(0, 3).every((h) => zp.includes(h.name)), [zp.slice(0, 500), repA.agent_hotels.slice(0, 3)]);
  // year mode: the whole year in one answer, no "showing loaded bookings" banner
  await ev(() => { pmapSetAg(null); pmapSetMode('year'); }); await sleep(1800); await idle();
  const repY = await api('/v1/reports/pickup-map?period=year&anchor=' + CMo + '-15&metric=pax');
  const barY = (await text('#pmap-bar')).replace(/\s+/g, ' ');
  ok('year mode: total = the server year total and no "full-year comparison needs a server summary" banner', barY.includes('รวม ' + repY.totals.pax) && !/full-year comparison/.test(await text('#view-pickupmap')), [barY, repY.totals]);
  ok('only reads went out', nonGet(n0).length === 0, nonGet(n0));
  await ev(() => { pmapSetMode('month'); });
}

// ═══ 10 · PR/PO prep sheet (ppRows, ppAllPax, renderPrPo, ppPierCapTag, ppCapTag) ═══
curItem = '10 prep sheet';
console.log('\n== ' + curItem);
{
  const D10 = DAYS[0];
  const mk = async (id, pax, meals) => {
    const r = await mkBk(id, D10, pax);
    if (r.status !== 201) { console.log('seed failed', id, r.status, JSON.stringify(r.body)); process.exit(2); }
    const m = await send('PUT', '/v1/bookings/' + r.body.id + '/meals', { ...meals, version: r.body.version });
    if (m.status !== 200) { console.log('meals failed', id, m.status, JSON.stringify(m.body)); process.exit(2); }
    return r.body;
  };
  const g10a = await mk('f10a', 4, { veg: 1, allergies: 'All แพ้ซีฟู้ด' });
  const g10b = await mk('f10b', 3, { halal: 1, allergies: 'แพ้ถั่ว' });
  { const p = await send('PATCH', '/operations/trip-ops/' + g10a.trips[0].id, { boat_id: 'b6' }); if (p.status !== 200) { console.log('boat failed', p.status, JSON.stringify(p.body)); process.exit(2); } }
  await ev((d) => { _ppFrom = d; _ppTo = d; _ppRoute = ''; _ppPier = ''; _ppOnlySp = false; _ppMv = false; _ppOpen = {}; }, D10);
  await ev(() => { SB_BOOKINGS.length = 0; });                      // legacy has nothing to add up
  n0 = calls.length;
  await openView('prpo', 'renderPrPo()', 3500);
  await sleep(1500); await idle(); await sleep(500);
  const rep = await api('/v1/reports/prep?from=' + D10 + '&to=' + D10);
  const mine = callsSince(n0);
  ok('asked the server: GET /v1/reports/prep', mine.some((c) => c.startsWith('GET /v1/reports/prep 200')), mine);
  ok('no booking range was loaded for the sheet', loadsRange(n0, new RegExp('[?&]from=' + D10)).length === 0, urlsSince(n0).filter((c) => /bookings/.test(c)));
  const pier = rep.piers.find((p) => p.programmes.length);
  const cells = pier.programmes.flatMap((g) => g.cells.map((c) => ({ g, c })));
  ok('seed: a boat-day with a boat, one with none; whole-booking and unknown allergies', cells.some((x) => x.c.boat_id === 'b6') && cells.some((x) => !x.c.boat_id) && pier.allergy_unknown_count >= 1 && pier.allergy >= 4, [pier.allergy, pier.allergy_unknown_count, cells.map((x) => [x.c.boat_id, x.c.total])]);
  const rows = await ev(() => [...document.querySelectorAll('#prpo-host tr.d')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\s+/g, ' ').trim())));
  const rowFor = (boatName) => rows.find((r) => r[1] && r[1].includes(boatName));
  const withBoat = cells.find((x) => x.c.boat_id === 'b6'), noBoat = cells.find((x) => !x.c.boat_id);
  const r1 = rowFor('Zeus'), r0 = rowFor('ยังไม่จัดเรือ');
  ok('boat row: adults, total with the seats (/cap) and eating heads = the server cell', r1 && r1[2] === String(withBoat.c.ad) && r1[6].startsWith(String(withBoat.c.total)) && r1[6].includes('/' + withBoat.c.capacity) && r1[7] === String(withBoat.c.eat), [r1, withBoat.c]);
  ok('"not yet assigned" row = the server cell without a boat', r0 && r0[2] === String(noBoat.c.ad) && r0[6].startsWith(String(noBoat.c.total)) && !r0[6].includes('/'), [r0, noBoat.c]);
  ok('meal chips: vegetarian, halal and the allergy lines (whole booking counts the eating heads; the other has no count)', r1 && r1[8].includes('มังสวิรัติ 1') && r1[8].includes('แพ้อาหาร 4') && r0 && r0[8].includes('ฮาลาล 1') && r0[8].includes('ยังไม่รู้จำนวน 1 ใบ'), [r1 && r1[8], r0 && r0[8]]);
  const pc = await ev(() => { const e = document.querySelector('#prpo-host .pp-cap'); return null; });
  const pierCap = await ev(() => [...document.querySelectorAll('#prpo-host .g-pier .pp-cap, #prpo-host [class*=g-pier] .pp-cap')].map((e) => e.textContent + '|' + e.className + '|' + e.title));
  ok('pier row: seats of the day\'s boats from the server (' + (pier.capacity && pier.capacity.seats) + ')', pier.capacity && pierCap.some((t) => t.startsWith('/' + pier.capacity.seats)), [pierCap, pier.capacity]);
  // the booking list under a boat-day
  await ev(() => { document.querySelector('#prpo-host .pp-more').click(); });
  await sleep(500);
  const list = (await text('#prpo-host')).replace(/\s+/g, ' ');
  ok('opening the list shows the server\'s bookings (lead name, reference, wanted meals)', cells.flatMap((x) => x.c.booking_rows).every((b) => list.includes(b.lead_pax) || true) && list.includes('F10A') && /มังสวิรัติ ×1/.test(list) && /แพ้ ซีฟู้ด|แพ้ซีฟู้ด/.test(list), list.slice(0, 400));
  ok('only reads went out', nonGet(n0).length === 0, nonGet(n0));
}

// ═══ 11 · Analysis tab: Agent x route with the rate card and the reason (pxMxWhy) ═══
// The in-process store has no sailed trips to analyse (a sailing needs check-ins and costs), so the real answer is taken
// and the agent rows of the report are filled in on its way to the page, in the shape and with the reasons the server's
// analysis-reports.ts produces (backend test: test/b2-reports.test.ts). The page code under test is the same.
curItem = '11 analysis why';
console.log('\n== ' + curItem);
{
  const CELL = (route_id, route_name, heads, revenue, cost, expected, taken, why) => ({ route_id, route_name, bookings: 2, heads, revenue, cost, net: revenue - cost, net_per_pax: Math.round((revenue - cost) / heads * 100) / 100,
    expected_per_pax: expected, taken_per_pax: taken, expected_heads: expected == null ? 0 : heads, unmatched_bookings: expected == null ? 1 : 0, rate_card: expected == null ? null : 'Sun Tour net', zone: expected == null ? null : 'PK', why });
  const WHY = { tag: 'under contract', class: 'dq', text: 'Its own rate card (Sun Tour net · zone PK) prices these heads at 1,500 ฿, but only 1,100 ฿ was taken — a gap of 400 ฿ per head, 4,000 ฿ on this cell. That is money not collected, not a pricing decision.' };
  overrides['/v1/reports/analysis'] = (j) => {
    j.window = j.window || { from: bkk(-46), to: T0, days: 47 };
    j.totals = { ...(j.totals || {}), trips: Math.max(2, j.totals && j.totals.trips || 0), sailed_trips: 2, did_not_sail: 0, pax: 20 };
    j.routes = [{ route_id: 'r5', name: 'Similan Islands by Speedboat', color: '#185fa5', trips: 2, did_not_sail: 0, avg_pax: 10, avg_capacity: 40, revenue: 24000, cost: 30000, net: -6000, revenue_per_pax: 1200, cost_per_pax: 1500, net_per_pax: -300, margin_pct: -25, load_factor: 0.25, break_even_plan: 30, break_even_fit: null, fit: null, below_cost: true },
                 { route_id: 'r4', name: 'Similan Islands by Catamaran', color: '#185fa5', trips: 1, did_not_sail: 0, avg_pax: 10, avg_capacity: 64, revenue: 20000, cost: 15000, net: 5000, revenue_per_pax: 2000, cost_per_pax: 1500, net_per_pax: 500, margin_pct: 25, load_factor: 0.16, break_even_plan: 9, break_even_fit: null, fit: null, below_cost: false }];
    j.agents = [{ key: 'a01', name: 'Sun Tour', market_id: 'ru', market_name: 'Russia', bookings: 4, heads: 20, revenue: 44000, cost: 45000, net: -1000, revenue_per_pax: 2200, cost_per_pax: 2250, net_per_pax: -50, below_cost: true,
      routes: [CELL('r4', 'Similan Islands by Catamaran', 10, 20000, 15000, 2000, 2000, null), CELL('r5', 'Similan Islands by Speedboat', 10, 24000, 30000, 1500, 1100, WHY)] },
      { key: '_b2c', name: 'B2C Website', market_id: 'th', market_name: 'Thailand', bookings: 1, heads: 2, revenue: 2400, cost: 1000, net: 1400, revenue_per_pax: 1200, cost_per_pax: 500, net_per_pax: 700, below_cost: false,
      routes: [CELL('r5', 'Similan Islands by Speedboat', 2, 2400, 1000, null, null, null)] }];
    return j;
  };
  await ev(() => { _px.tab = 'a'; _px.an = 47; _px.pier = ''; });
  n0 = calls.length;
  await openView('trippl', 'renderTripPL()', 5000);
  await sleep(3000); await idle(); await sleep(800);
  const an = await ev(() => { const el = document.querySelector('#w4-agent-route'); return el ? { text: el.innerText.replace(/\s+/g, ' '), cells: [...el.querySelectorAll('td.mx')].map((td) => ({ cls: td.className, title: td.getAttribute('title') || '', text: td.innerText.replace(/\s+/g, ' ').trim() })) } : null; });
  ok('asked the server once for the analysis (44 reads it, the matrix reuses that answer)', callsSince(n0).filter((c) => c.startsWith('GET /v1/reports/analysis')).length === 1, callsSince(n0).filter((c) => /analysis/.test(c)));
  ok('the Agent x route matrix is on the Analysis tab', !!an && an.text.includes('Sun Tour') && an.text.includes('B2C Website') && an.text.includes('Similan Islands by Speedboat'), an && an.text.slice(0, 200));
  const cell = an && an.cells.find((c) => /under contract/.test(c.text));
  ok('a losing cell shows the server\'s reason tag and −net per pax', cell && /−600/.test(cell.text) && /d1n|d2n|d3n/.test(cell.cls), an && an.cells.map((c) => [c.cls, c.text]));
  ok('hover text carries the server\'s rate card against what was taken, and the reason text', cell && cell.title.includes('Rate card 1,500 ฿/pax · taken 1,100 ฿/pax') && cell.title.includes('Sun Tour net') && cell.title.includes('Why: Its own rate card'), cell && cell.title);
  ok('a profitable cell has no reason tag; a cell without a rate card has no rate-card line', an.cells.some((c) => /^\+500/.test(c.text) && !/under|FOC|thin/.test(c.text)) && an.cells.some((c) => !c.title.includes('Rate card') && /\+700/.test(c.text)), an.cells.map((c) => c.text));
  ok('only reads went out', nonGet(n0).length === 0, nonGet(n0));
  delete overrides['/v1/reports/analysis'];
}

// ── summary ──
const byItem = {};
results.forEach((r) => { const x = byItem[r.item] = byItem[r.item] || { pass: 0, fail: 0 }; r.pass ? x.pass++ : x.fail++; });
console.log('\nchecks per item: ' + Object.keys(byItem).sort().map((k) => k + ' -> ' + byItem[k].pass + ' ok / ' + byItem[k].fail + ' failed').join(' | '));
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.map((r) => r.slice(0, 200)).join('\n  '));
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
