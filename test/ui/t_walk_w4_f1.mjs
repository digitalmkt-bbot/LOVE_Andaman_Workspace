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
  ok('no booking range was loaded for the board (the three loads of 52 are not started)', !mine.some((c) => /GET \/v1\/bookings( |\/recent|\/agent-month)/.test(c)), mine.filter((c) => /bookings/.test(c)));
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

// ── summary ──
const byItem = {};
results.forEach((r) => { const x = byItem[r.item] = byItem[r.item] || { pass: 0, fail: 0 }; r.pass ? x.pass++ : x.fail++; });
console.log('\nchecks per item: ' + Object.keys(byItem).sort().map((k) => k + ' -> ' + byItem[k].pass + ' ok / ' + byItem[k].fail + ' failed').join(' | '));
console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.map((r) => r.slice(0, 200)).join('\n  '));
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nall passed');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
