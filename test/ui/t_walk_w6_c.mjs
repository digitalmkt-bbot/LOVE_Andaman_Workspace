// t_walk_w6_c · wave 6 group c: the server fields wave 5 group C built (todo/w5-c-model.md asks 1-11), wired into the screens, against a
// REAL operation-backend (in-process store, seeded through its API).
//
//   node test/ui/t_walk_w6_c.mjs        (OPS_BACKEND_DIR, default D:/projects/operation-backend; ONLY=1,2 runs some sections)
//
// Every check asks the screen's function / the DOM AND the server directly. A "differs" case changes what the BROWSER holds, so legacy's
// arithmetic would answer differently, and expects the server's figure.
import { serve } from './_harness.mjs';
import { seedVanJobs, D, ROUTE } from './_vanjobs_seed.mjs';
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
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const raw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text(); let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await raw(p, init)).body;
const send = (m, p, b) => raw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) });
const seed = async (method, p, body) => {
  const r = await send(method, p, body);
  if (r.status >= 300) throw new Error(`seed ${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
};

// ───────────────────────────── seed ─────────────────────────────
// market data: two arrival days (a Monday and a Tuesday), a departure, a nationality the code table does not know
const MD1 = '2026-12-07', MD2 = '2026-12-08';
await seed('PUT', `/v1/market-stats/${MD1}/in`, { rows: { 'รัสเซีย': 100, 'จีน': 60, 'อินเดีย': 40, 'ไทย': 5, 'ไม่มีในตาราง': 7 } });
await seed('PUT', `/v1/market-stats/${MD2}/in`, { rows: { 'รัสเซีย': 20, 'จีน': 10, 'บริติช': 30 } });
await seed('PUT', `/v1/market-stats/${MD1}/out`, { rows: { 'จีน': 3 } });

const seeded = await seedVanJobs(send);                // Van Alpha (own), Van Bravo (partner), the 2026-11-20 day with its groups
const { vanAlpha, g1, bk: vjBk } = seeded;
const mkBk = (id, extra, trips) => seed('POST', '/v1/bookings', { external_id: id, intent: 'confirm', guides: { english: true }, agentId: 'a01', leadPax: id.toUpperCase(), leadNationality: 'RU', leadPhone: '+7 900 1', hotelName: 'Test Hotel', ...extra, trips });
// a boat day: Zeus carries two bookings (2 + 3 heads)
const DBT = '2026-12-16';
await seed('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DBT, capacity: 40 });
const assign = async (bk) => { const v = (await api('/v1/bookings/' + bk.id)).version; await seed('PATCH', '/operations/trip-ops/' + bk.trips[0].id, { boat_id: 'b6', version: v }); };
const boat1 = await mkBk('zz-w6c-boat1', { pickupSelf: false, pickupZone: 'PK' }, [{ routeId: 'r5', date: DBT, pax: { ad_fr: 2 }, zone: 'PK' }]);
const boat2 = await mkBk('zz-w6c-boat2', { pickupSelf: false, pickupZone: 'PK' }, [{ routeId: 'r5', date: DBT, pax: { ad_fr: 3 }, zone: 'PK' }]);
await assign(boat1); await assign(boat2);
// the Prepay picker: two invoice agents with a booking each, a proforma agent with an invoice and two payments
const DP = '2026-12-20';
await seed('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: DP, capacity: 40 });
const mkAgent = (name, pay_type, vat_mode) => seed('POST', '/v1/agents', { name, market_id: 'ru', pay_type, vat_mode, rate_type_id: 'rt001', company: { legal_name: name + ' Co', address: '1 Test Rd' } });
const agA = await mkAgent('Alpha Prepay Agent', 'invoice', 'exclude'), agB = await mkAgent('Beta Prepay Agent', 'invoice', 'none'), agP = await mkAgent('Gamma Proforma Agent', 'proforma', 'none');
const preA = await mkBk('zz-w6c-preA', { agentId: agA.id, pickupSelf: false, pickupZone: 'PK' }, [{ routeId: 'r5', date: DP, pax: { ad_fr: 2 }, zone: 'PK' }]);
const preB = await mkBk('zz-w6c-preB', { agentId: agB.id, pickupSelf: false, pickupZone: 'PK' }, [{ routeId: 'r5', date: DP, pax: { ad_fr: 3 }, zone: 'PK' }]);
const proB = await mkBk('zz-w6c-pro', { agentId: agP.id, pickupSelf: false, pickupZone: 'PK' }, [{ routeId: 'r5', date: DP, pax: { ad_fr: 4 }, zone: 'PK' }]);
const proInv = await seed('POST', '/v1/invoices', { agent_id: agP.id, booking_ids: [proB.id] });
const pay1 = await seed('POST', `/v1/invoices/${proInv.id}/payments`, { amount: 700, method: 'transfer', paid_on: DP });
const pay2 = await seed('POST', `/v1/invoices/${proInv.id}/payments`, { amount: 300, method: 'cash', paid_on: DP });
// van stops: a guide for the way out (3 seats), cargo (0 seats), a guide only for the way back (2 seats)
await seed('POST', '/operations/van-stops', { group_id: g1.id, kind: 'staff', label: 'Guide W6 out', place: 'Walk Office', pax: 3, time: '06:10', area: 'Patong', leg: 'out' });
await seed('POST', '/operations/van-stops', { group_id: g1.id, kind: 'cargo', label: 'Cargo W6', place: 'Walk Office', pax: 5, time: '06:20', area: 'Patong', leg: 'out' });
await seed('POST', '/operations/van-stops', { group_id: g1.id, kind: 'staff', label: 'Guide W6 back', place: 'Walk Office', pax: 2, time: '16:20', area: 'Patong', leg: 'ret' });
// check-ins on the day D: arrived / cleared at the pier (the pills), WALK SIX was a no-show at the van (booked > travelling)
for (const [b, stage] of [[vjBk.one, 'arrived'], [vjBk.two, 'arrived'], [vjBk.two, 'cleared']]) await seed('POST', `/operations/trip-ops/${b.trips[0].id}/checkins/pier/0/stage`, { stage, on: true });
// the park sheet of the pier: a boat with both a due and a paid amount, a boat with a due only
const PIER = 'tublamu';
const P = (p) => `/v1/pier-cash/${PIER}${p}`;
await seed('POST', '/v1/costing/plans', { name: 'W6 park plan', route_key: 'r5' });
await seed('PATCH', P(`/days/${D}/park/b6`), { ad_fr: 2, chd_fr: 1, amount: 1200, dock: 0 });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} window.print = function () {}; window.close = function () {}; }, token);
const calls = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url()), hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const body = ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined);
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push({ m: req.method(), p: u.pathname + u.search, status: r.status, req: body, res: buf.toString() });
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 900))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 12000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const todo = [];
const section = (name, fn) => todo.push([name, fn]);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1000);
const goView = (v) => ev((v) => nav({ dataset: { view: v }, classList: { add() {} } }), v);
const loadDay = (d) => ev(async (d) => { await bookingV2EnsureOpsRange({ from: d, to: d, refresh: true }); }, d);
const clientId = (opsId) => ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); return b ? b.id : null; }, opsId);
const text = (html) => ev((h) => { const b = document.createElement('div'); b.innerHTML = h; return (b.innerText || b.textContent).replace(/\s+/g, ' ').trim(); }, html);

// ═════════════════════════════ 1 · Market Data and the report market (asks 1-4) ═════════════════════════════
section('1', async () => {
  console.log('\n[1] Market Data: arrivals by weekday / by code / merged months / guide languages, and pmMarket = the booking\'s report_market');
  const srv = await api('/v1/market-stats');
  const wd = new Date(MD1 + 'T00:00').getDay();
  ok('server: weekday totals (Monday 212 = 100+60+40+5+7, Tuesday 60), arrivals by code drop the name the table lacks, the merged months say "daily"',
    srv.arrivals_by_weekday[wd] === 212 && srv.arrivals_by_weekday[(wd + 1) % 7] === 60 && srv.arrivals_by_code.RU === 120 && srv.arrivals_by_code.CN === 70 && !Object.values(srv.arrivals_by_code).includes(7)
    && srv.monthly_merged.some((m) => m.ym === '2026-12' && m.pax === 272 && m.source === 'daily'), { wd: srv.arrivals_by_weekday, code: srv.arrivals_by_code, merged: srv.monthly_merged });
  ok('server: the days carry in_by_code and the guide languages of the latest day are Russian 20 / Chinese 10 / English 30',
    srv.days.find((d) => d.date === MD2).in_by_code.RU === 20, srv.days.map((d) => d.in_by_code));
  const one = await api(`/v1/market-stats?from=${MD2}&to=${MD2}`);
  ok('server: lang_buckets of the latest day alone', eq(one.lang_buckets, { Russian: 20, Chinese: 10, English: 30 }), one.lang_buckets);

  // the browser's own copy of the days is changed: legacy would add up other figures
  await ev((a) => { SB_MARKET_STATS[a.d1].in['รัสเซีย'] = 99999; SB_MARKET_STATS[a.d1].inTotal = 99999; SB_MARKET_MONTHLY['2026-01'] = 777777; SB_MARKET_STATS[a.d2].in['บริติช'] = 4444; }, { d1: MD1, d2: MD2 });
  await ev(() => { mdArrivalsByWeekday(); });                                   // the first call starts the read
  await waitFor(() => window.laOps.srv.peek('w6c-market'), null, 8000); await settle(300);
  const r = await ev((a) => {
    const w = mdArrivalsByWeekday(), wl = window.mdArrivalsByWeekday.__orig();
    const c = mdArrivalsByCode(), cl = window.mdArrivalsByCode.__orig();
    const mm = _mdOvMonthly([]), ml = window._mdOvMonthly.__orig(Object.values(SB_MARKET_STATS));
    return { w, wl, c, cl, m: Object.keys(mm.m).map((y) => [y, mm.m[y].filter((v) => v).length]), ml: Object.keys(ml.m).map((y) => [y, ml.m[y].filter((v) => v).length]), pres: Object.keys(mm.pres).map((y) => [y, [...mm.pres[y]]]) };
  }, null);
  ok('mdArrivalsByWeekday = the server\'s seven totals although the browser\'s Monday says 99999 more (legacy: ' + r.wl[wd] + ')', eq(r.w, srv.arrivals_by_weekday) && r.wl[wd] !== r.w[wd], r);
  ok('mdArrivalsByCode = the server\'s arrivals by code (RU ' + srv.arrivals_by_code.RU + ') although legacy\'s sum over the browser days says ' + r.cl.RU, eq(r.c, srv.arrivals_by_code) && r.cl.RU !== r.c.RU, { c: r.c, cl: r.cl });
  ok('_mdOvMonthly = the merged months (only Dec 2026, as daily); legacy would add the bogus monthly figure of Jan 2026', eq(r.m, [['2026', 1]]) && eq(r.pres, [['2026', [11]]]) && r.ml.length >= 1 && r.ml[0][1] === 2, r);
  // the Ops & Guides tab draws the guide-language bars of its latest day
  await ev(() => { _mdTab = 'ops'; });
  const html = async () => ev(() => { const days = Object.values(SB_MARKET_STATS).sort((a, b) => (a.date || '').localeCompare(b.date || '')); return mdTabOps(days); });
  await html(); await waitFor(() => window.laOps.srv.peek('w6c-lang:2026-12-08'), null, 8000); await settle(300);
  const t = await text(await html());
  const g = (re) => { const m = re.exec(t); return m ? +m[1].replace(/,/g, '') : null; };
  ok('Ops & Guides: Russian / Chinese / English guide demand are the server\'s lang_buckets of the latest day (20 / 10 / 30) although the browser\'s British row says 4444',
    g(/Russian guide\s*([\d,]+)/) === 20 && g(/Chinese guide\s*([\d,]+)/) === 10 && g(/English guide\s*([\d,]+)/) === 30, t.slice(0, 400));
  await ev((a) => { SB_MARKET_STATS[a.d1].in['รัสเซีย'] = 100; SB_MARKET_STATS[a.d1].inTotal = 212; delete SB_MARKET_MONTHLY['2026-01']; SB_MARKET_STATS[a.d2].in['บริติช'] = 30; }, { d1: MD1, d2: MD2 });

  // pmMarket
  await loadDay(DBT);
  const cid = await clientId(boat1.id);
  const srvBk = await api('/v1/bookings/' + boat1.id);
  const pm = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.id === id); if (!b) return null; const keep = [b.marketSnapshot, b.agentId]; b.marketSnapshot = { market: 'zz-browser-market' };
    const out = { now: pmMarket(b), legacy: window.pmMarket.__orig(b), has: !!(b.srvFlags && b.srvFlags.reportMarket) }; b.marketSnapshot = keep[0]; return out; }, cid);
  ok('server: the booking read carries report_market (' + srvBk.report_market + ')', typeof srvBk.report_market === 'string' && srvBk.report_market.length > 0, srvBk.report_market);
  ok('pmMarket = the booking\'s report_market although the browser\'s market snapshot says another (legacy: zz-browser-market)', pm && pm.has && pm.now === srvBk.report_market && pm.legacy === 'zz-browser-market', { pm, want: srvBk.report_market });
});

// ═════════════════════════════ 2 · Daily PFM: prepay picker, correction totals (asks 5, 6) ═════════════════════════════
section('2', async () => {
  console.log('\n[2] Daily PFM: the prepay picker lists every invoice agent (server), the edit dialog totals are the dry run (server)');
  const cand = await api('/v1/invoices/candidates?kind=prepay');
  const mine = cand.candidates.filter((c) => [preA.id, preB.id].includes(c.booking_id));
  ok('server: without agent_id the prepay candidates list both invoice agents, each with agent_name, with count and left', mine.length === 2 && mine.every((c) => c.agent_name && c.agent_id) && typeof cand.count === 'number' && typeof cand.left === 'number', cand);
  const candB = (await api('/v1/invoices/candidates?kind=prepay&q=Beta')).candidates;
  ok('server: q also matches the agent name', candB.length >= 1 && candB.every((c) => c.agent_name === 'Beta Prepay Agent'), candB.map((c) => c.agent_name));
  await goView('dailypfm'); await settle(1500);
  // the browser's own copy of the two agents says they pay by cash: legacy's picker would list nobody
  const legacyEmpty = await ev((ids) => { const keep = []; ids.forEach((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); const a = b && sbGetAgent(b.agentId); if (a) { keep.push([a, a.payType]); a.payType = 'cash'; } }); const n = window.pfmPrepayCands.__orig('').length; keep.forEach(([a, t]) => { a.payType = t; }); return n; }, [preA.id, preB.id]);
  await ev((ids) => { window.__w6pay = []; ids.forEach((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); const a = b && sbGetAgent(b.agentId); if (a) { window.__w6pay.push([a, a.payType]); a.payType = 'cash'; } }); }, [preA.id, preB.id]);
  const mark = calls.length;
  await ev(() => { pfmPrepayOpen(); });
  const listText = () => ev(() => { const el = document.getElementById('pfm-pre-list'); return el ? el.innerText.replace(/\s+/g, ' ') : ''; });
  await waitFor(() => /Alpha Prepay Agent/.test((document.getElementById('pfm-pre-list') || {}).innerText || ''), null, 10000);
  let lt = await listText();
  const asked = calls.slice(mark).filter((c) => c.m === 'GET' && c.p.startsWith('/v1/invoices/candidates'));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  ok('the picker asked GET /v1/invoices/candidates?kind=prepay with NO agent_id (the browser\'s agents say cash: legacy\'s picker lists ' + legacyEmpty + ' bookings of these two)', asked.length >= 1 && !asked[0].p.includes('agent_id') && asked[0].p.includes('kind=prepay') && legacyEmpty === 0, { asked: asked.map((c) => c.p), legacyEmpty });
  const cA = mine.find((c) => c.booking_id === preA.id), cB = mine.find((c) => c.booking_id === preB.id);
  ok('the picker lists both agents\' bookings with the server\'s invoice total (the 7% on top for Alpha: ฿' + fmt(cA.invoice_total) + ')', lt.includes('Alpha Prepay Agent') && lt.includes('Beta Prepay Agent') && lt.includes(fmt(cA.invoice_total)) && lt.includes(fmt(cB.invoice_total)) && cA.invoice_total > cA.total, { lt: lt.slice(0, 500), cA, cB });
  // the search box: the text goes to the server
  const mark2 = calls.length;
  await ev(() => { document.getElementById('pfm-pre-q').value = 'Beta'; pfmPrepaySearch('Beta'); });
  await waitFor(() => window.laOps.srv.peek('w6c-prepay:Beta') && !/Alpha Prepay Agent/.test((document.getElementById('pfm-pre-list') || {}).innerText || '') && /Beta Prepay Agent/.test((document.getElementById('pfm-pre-list') || {}).innerText || ''), null, 10000); await settle(300);
  lt = await listText();
  const asked2 = calls.slice(mark2).filter((c) => c.m === 'GET' && c.p.startsWith('/v1/invoices/candidates'));
  ok('typing "Beta" asks the server with q=Beta and the list shows only Beta\'s booking', asked2.some((c) => c.p.includes('q=Beta')) && lt.includes('Beta Prepay Agent') && !lt.includes('Alpha Prepay Agent'), { asked2: asked2.map((c) => c.p), lt: lt.slice(0, 300) });
  // "รับเงิน" on a booking the browser does not hold: it is read first, then the dialog opens with the server's amount
  await ev((id) => { const i = SB_BOOKINGS.findIndex((x) => x.opsId === id); window.__w6gone = SB_BOOKINGS.splice(i, 1)[0]; pfmPrepaySearch('Beta'); }, preB.id);          // the booking is not in the browser (the list is drawn again from the server's answer)
  const btn = await ev(() => { const b = document.querySelector('#pfm-pre-list button[onclick^="pfmPrepayStart"]'); if (!b) return null; const id = /pfmPrepayStart\('([^']*)'\)/.exec(b.getAttribute('onclick'))[1]; b.click(); return id; });
  await waitFor(() => typeof _pfmRec !== 'undefined' && _pfmRec && _pfmRec.prepay, null, 10000); await settle(1500);
  const rec = await ev(() => ({ amount: _pfmRec ? _pfmRec.amount : null, prepay: !!(_pfmRec && _pfmRec.prepay) }));
  ok('"รับเงิน" opened the Record-payment dialog for the booking that was not loaded, with the server\'s invoice total (฿' + fmt(cB.invoice_total) + ')', btn && rec.prepay && rec.amount === Math.round(cB.invoice_total), { btn, rec });
  await ev(() => pfmRecClose && pfmRecClose());
  await ev(() => { window.__w6pay.forEach(([a, t]) => { a.payType = t; }); });

  // the edit dialog
  await ev(async () => { await laOps.money.load(); }); await loadDay(DP); await settle(500);
  const cid = await clientId(proB.id);
  await ev((id) => pfmEditOpen(id), cid); await settle(500);
  const opened = await ev(() => !!(typeof _pfmEdit !== 'undefined' && _pfmEdit && _pfmEdit.rows && _pfmEdit.rows.length === 2));
  ok('the edit dialog opened with the invoice\'s two payments (700 and 300)', opened, null);
  const invNow = await api('/v1/invoices/' + proInv.id);
  const payId = (invNow.payments || []).find((p) => Math.round(p.amount) === 700).id;
  const dry = await send('POST', `/v1/invoices/${proInv.id}/payment-corrections`, { payments: [{ id: payId, amount: 6000 }], dry_run: true });
  ok('server: the dry run answers the invoice as it would read (paid 6300, overpaid 300) and stores nothing', dry.status === 200 && dry.body.dry_run === true && Math.round(dry.body.paid) === 6300 && dry.body.overpaid > 0 && (await api('/v1/invoices/' + proInv.id)).paid === 1000, dry.body && { paid: dry.body.paid, total: dry.body.total, balance: dry.body.balance, overpaid: dry.body.overpaid });
  const mark3 = calls.length;
  // the browser's copy of the invoice total is changed: legacy's totals line would show it
  await ev((a) => { SB_INVOICES.find((i) => i.id === a.inv).total = 12345; const rows = _pfmEdit.rows; const i = rows.findIndex((r) => Math.round(r.amount) === 700); pfmEditSet(i, 'amount', '6000'); }, { inv: proInv.id });
  await waitFor(() => /6,300/.test((document.getElementById('pfm-edit-sum') || {}).innerText || ''), null, 8000); await settle(300);
  const sum = await ev(() => (document.getElementById('pfm-edit-sum') || {}).innerText || '');
  const dryCalls = calls.slice(mark3).filter((c) => c.m === 'POST' && /payment-corrections$/.test(c.p));
  const sent = dryCalls.length ? JSON.parse(dryCalls[dryCalls.length - 1].req) : null;
  const fm = (n) => '฿' + Math.round(n).toLocaleString('en-US');
  ok('the totals line is the dry run: ยอดใบ ' + fm(dry.body.total) + ' · รับแล้ว ฿6,300 · รับเกิน ' + fm(dry.body.overpaid) + ' (the browser\'s invoice total says 12,345)', sum.includes(fm(dry.body.total)) && sum.includes('฿6,300') && sum.includes('รับเกิน') && sum.includes(fm(dry.body.overpaid)) && !sum.includes('12,345'), sum);
  ok('the dry run sent only the edited payment (id + amount + method + date) and dry_run: true, no computed field; nothing was stored', sent && sent.dry_run === true && sent.payments.length === 1 && sent.payments[0].id === payId && !('total' in sent) && !('paid' in sent) && (await api('/v1/invoices/' + proInv.id)).paid === 1000, sent);
  await ev(() => pfmEditClose());
});

// ═════════════════════════════ 3 · boats: heads placed, a day's seats (asks 7, 9) ═════════════════════════════
section('3', async () => {
  console.log('\n[3] boats: baAssignedPax / baAssignedBookings = the fleet panel\'s booked, boatCapInfo of a day with no override = the server\'s day object');
  await loadDay(DBT);
  const panel = (await api(`/v1/fleet/boat-operation?from=${DBT}&to=${DBT}&pier=all`)).days[0];
  const zeus = [...panel.assigned, ...panel.available, ...panel.unavailable].find((b) => b.boat_id === 'b6');
  ok('server: Zeus carries booked { pax: 5, bookings: 2 }', zeus && zeus.booked && zeus.booked.pax === 5 && zeus.booked.bookings === 2, zeus);
  const id1 = await clientId(boat1.id);
  // the browser's own copy forgets the boat of one booking: legacy's walk would count 3 heads
  await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); const o = bkOpsRead(b, a.d); window.__w6keep = o.boatId; o.boatId = ''; }, { id: id1, d: DBT });
  await ev((d) => { baAssignedPax(d, 'b6'); }, DBT);
  await waitFor((d) => window.laOps.boatOperation.isFresh(d), DBT, 10000); await settle(300);
  const r = await ev((a) => ({ pax: baAssignedPax(a.d, 'b6'), bk: baAssignedBookings(a.d, 'b6'), legacy: window.baAssignedPax.__orig(a.d, 'b6'), legacyBk: window.baAssignedBookings.__orig(a.d, 'b6') }), { d: DBT });
  await ev((a) => { const b = SB_BOOKINGS.find((x) => x.id === a.id); bkOpsRead(b, a.d).boatId = window.__w6keep; }, { id: id1, d: DBT });
  ok('baAssignedPax = booked.pax (5) although the browser\'s copy puts only 3 heads on the boat (legacy: ' + r.legacy + ')', r.pax === 5 && r.legacy === 3, r);
  ok('baAssignedBookings = { count: 2, pax: 5 } (legacy: ' + JSON.stringify(r.legacyBk) + ')', eq(r.bk, { count: 2, pax: 5 }) && r.legacyBk.count === 1, r);
  // the seats of a day without an override
  const win = await api(`/v1/boats/b7/capacity-overrides?from=${DBT}&to=${DBT}&all=true`);
  const day = win.overrides[0];
  ok('server: a day with no override has { capacity, normal, ceiling } (b7: 34 / 34 / 45)', day && day.overridden === false && day.capacity === 34 && day.normal === 34 && day.ceiling === 45, day);
  await ev(() => { const b = getBoat('b7'); window.__w6b7 = [b.cap, b.licensePax]; b.cap = 99; b.licensePax = 99; });          // the browser's boat record says another thing
  const mark = calls.length;
  await ev((d) => { boatCapFor('b7', d); }, DBT);
  await waitFor((d) => { const i = boatCapInfo('b7', d); return i.cap === 34; }, DBT, 10000); await settle(300);
  const info = await ev((d) => ({ now: boatCapInfo('b7', d), legacy: window.boatCapInfo.__orig('b7', d), cap: boatCapFor('b7', d) }), DBT);
  await ev(() => { const b = getBoat('b7'); b.cap = window.__w6b7[0]; b.licensePax = window.__w6b7[1]; });
  const asked = calls.slice(mark).filter((c) => c.m === 'GET' && /\/v1\/boats\/b7\/capacity-overrides/.test(c.p));
  ok('boatCapInfo of a plain day = the server\'s day object (cap 34, base 34, licence 45) although the boat record in the browser says 99', info.now.cap === 34 && info.now.base === 34 && info.now.license === 45 && info.now.overridden === false && info.legacy.cap === 99 && info.cap === 34, info);
  ok('it asked GET /v1/boats/b7/capacity-overrides?from&to&all=true (once for the 62-day window)', asked.length === 1 && asked[0].p.includes('all=true') && asked[0].p.includes('from=') && asked[0].p.includes('to='), asked.map((c) => c.p));
  // an overridden day still answers from the override (82-ops-w5c-boats.js)
  const ovDay = await seed('PUT', `/v1/boats/b7/capacity-overrides/${DBT}`, { capacity: 38, reason: 'w6c walk' });
  await ev((d) => { laOps.capOverrides.applyDay(d); }, ovDay);
  const ov = await ev((d) => boatCapInfo('b7', d), DBT);
  ok('and an overridden day: cap 38, base 34, licence 45 from the override', ov.cap === 38 && ov.base === 34 && ov.license === 45 && ov.overridden === true, ov);
  await seed('DELETE', `/v1/boats/b7/capacity-overrides/${DBT}`);
  await ev((d) => { delete BOAT_CAP_OVR[d + '::b7']; }, DBT);
});

// ═════════════════════════════ 4 · vans: stop seats, Van Check-in pills, pier pills (asks 8, 10) ═════════════════════════════
section('4', async () => {
  console.log('\n[4] vans: a stop\'s seats and the return-leg seats are the server\'s; the pills of the Van Check-in page and the pier page carry the server\'s booked heads and booking counts');
  await ev(async (d) => { await laOps.vanJobs.loadDay(d); }, D); await settle(1200);
  const stops = (await api(`/operations/van-stops?service_date=${D}`)).stops;
  const staffOut = stops.find((s) => s.label === 'Guide W6 out'), cargo = stops.find((s) => s.label === 'Cargo W6'), back = stops.find((s) => s.label === 'Guide W6 back');
  const gs = (await api(`/operations/van-groups?service_date=${D}&route_id=${ROUTE}`)).groups.find((g) => g.id === g1.id);
  ok('server: stop seats (staff out 3, cargo 0, staff back 2) and the group\'s stop_seats / stop_seats_return', staffOut.seats === 3 && cargo.seats === 0 && back.seats === 2 && typeof gs.stop_seats === 'number' && gs.stop_seats_return >= 2, { stops: stops.map((s) => [s.label, s.seats]), gs: [gs.stop_seats, gs.stop_seats_return] });
  const r = await ev((a) => {
    const S = VAN_STOPS; const keys = Object.keys(S).filter((k) => k.startsWith(a.d + '::'));
    const find = (label) => keys.map((k) => S[k]).find((s) => s.label === label);
    const o = find('Guide W6 out'), c = find('Cargo W6');
    const keep = [o.pax, c.kind, c.pax]; o.pax = 77; c.kind = 'staff'; c.pax = 9;                // the browser's copy: legacy would say 77 seats and 9 seats
    const out = { staff: vsSeats(o), staffLegacy: window.vsSeats.__orig(o), cargo: vsSeats(c), cargoLegacy: window.vsSeats.__orig(c), unsaved: vsSeats({ kind: 'staff', pax: 4 }) };
    o.pax = keep[0]; c.kind = keep[1]; c.pax = keep[2]; return out;
  }, { d: D });
  ok('vsSeats = the stop\'s seats from the server (3 and 0) although the browser\'s rows say 77 and 9 staff seats (legacy: ' + r.staffLegacy + ' and ' + r.cargoLegacy + ')', r.staff === 3 && r.cargo === 0 && r.staffLegacy === 77 && r.cargoLegacy === 9, r);
  ok('a stop that is not saved yet keeps legacy\'s rule (staff = its pax)', r.unsaved === 4, r);
  const ret = await ev((a) => { const S = VAN_STOPS; const ks = Object.keys(S).filter((k) => k.startsWith(a.d + '::')); const keep = ks.map((k) => [k, S[k].leg]); ks.forEach((k) => { S[k].leg = 'out'; });        // the browser's copy: no stop rides the way back
    const out = { now: vsSeatsOfVan(a.d, a.r, a.v, a.n, true), legacy: window.vsSeatsOfVan.__orig(a.d, a.r, a.v, a.n, true), out: vsSeatsOfVan(a.d, a.r, a.v, a.n, false) }; keep.forEach(([k, v]) => { S[k].leg = v; }); return out; }, { d: D, r: ROUTE, v: vanAlpha.id, n: gs.number });
  ok('vsSeatsOfVan(return leg) = the group\'s stop_seats_return (' + gs.stop_seats_return + ') although the browser\'s rows say no stop rides the way back (legacy: ' + ret.legacy + '); the way out is stop_seats (' + gs.stop_seats + ')', ret.now === gs.stop_seats_return && ret.legacy === 0 && ret.out === gs.stop_seats, { ret, gs: [gs.stop_seats, gs.stop_seats_return] });

  // — the pills of the Van Check-in page —
  const vsheet = await api('/v1/van-checkin?date=' + D);
  const fam = vsheet.programmes.find((p) => p.variants.some((v) => v.route_id === ROUTE)), variant = fam.variants.find((v) => v.route_id === ROUTE);
  ok('server: the van sheet carries programmes with zones { total, done, booked } per variant', fam && variant.zones.PK && typeof variant.zones.PK.booked === 'number' && variant.zones.PK.total > 0, variant);
  const pills = (kind) => ev((a) => { const kind = a.kind;
    const r = kind === 'van' ? ckRoutePills(a.d, null, null, 'vckSetFam', 'vckSetRoute', 'van') : ckRoutePills(a.d, null, null, 'pckSetFam', 'pckSetRoute', 'pier');
    const box = document.createElement('div'); box.innerHTML = r.html;
    const zones = {};
    box.querySelectorAll('span[title]').forEach((sp) => { const m = /^(PK|KL) · เช็คอินแล้ว (\d+) จาก (\d+) pax/.exec(sp.getAttribute('title')); if (m) { const s = sp.querySelector('s'); zones[m[1]] = { done: +m[2], tot: +m[3], booked: s ? +s.textContent : null }; } });
    const titles = [...box.querySelectorAll('span[title]')].map((s) => s.getAttribute('title'));
    const famTxt = (box.querySelector('button[title^="กรองเฉพาะ"]') || {}).innerText || '';
    return { zones, titles, famTxt: famTxt.replace(/\s+/g, ' ').trim() };
  }, { d: D, kind });
  // the browser's own copy of a booking's heads is changed (legacy's walk would count them)
  await ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); b.trips[0].pax.ad_fr = (b.trips[0].pax.ad_fr || 0) + 5; }, vjBk.three.id);
  await goView('vancheckin'); await settle(1200);
  await pills('van'); await waitFor(() => true, null, 100); await settle(1500);
  const vp = await pills('van');
  ok('Van Check-in pills: the PK box reads done/total from the server and the struck-through figure is the booked heads before any loss (' + variant.zones.PK.booked + ') although the browser\'s booking says 5 more heads',
    vp.zones.PK && vp.zones.PK.done === variant.zones.PK.done && vp.zones.PK.tot === variant.zones.PK.total && (variant.zones.PK.booked > variant.zones.PK.total ? vp.zones.PK.booked === variant.zones.PK.booked : vp.zones.PK.booked === null), { vp, variant: variant.zones });
  ok('the programme chip shows the programme\'s pax (' + fam.pax + ') with the booked heads struck through when more (' + fam.booked + ')', vp.famTxt.includes(String(fam.pax)) && (fam.booked > fam.pax ? vp.famTxt.includes(String(fam.booked)) : true), { vp: vp.famTxt, fam: [fam.pax, fam.booked] });
  await ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); b.trips[0].pax.ad_fr -= 5; }, vjBk.three.id);

  // — the pier page: booked per zone and the bookings behind each stage —
  const psheet = await api('/v1/pier-checkin?date=' + D);
  const pfam = psheet.programmes.find((p) => p.variants.some((v) => v.route_id === ROUTE)), pvar = pfam.variants.find((v) => v.route_id === ROUTE);
  ok('server: the pier programme carries arr_rows / clr_rows / brd_rows and zones.PK.booked', typeof pfam.arr_rows === 'number' && pfam.arr_rows >= 2 && pfam.clr_rows >= 1 && typeof pvar.zones.PK.booked === 'number', { pfam: [pfam.arr_rows, pfam.clr_rows, pfam.brd_rows, pfam.rows], zones: pvar.zones });
  await ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); b.trips[0].pax.ad_fr = (b.trips[0].pax.ad_fr || 0) + 5; }, vjBk.three.id);
  await goView('piercheckin'); await settle(1200);
  await ev((d) => { window._pckDate = d; }, D);
  await pills('pier'); await settle(1800);
  const pp = await pills('pier');
  ok('pier pills: the hover texts count the bookings the server counted (ถึงท่า ' + pfam.arr_rows + '/' + pfam.rows + ' booking, เคลียร์ ' + pfam.clr_rows + ', ขึ้นเรือ ' + pfam.brd_rows + ')',
    pp.titles.includes(`นับเป็นคน · ${pfam.arr_rows}/${pfam.rows} booking`) && pp.titles.includes(`นับเป็นคน · ${pfam.clr_rows} booking`) && pp.titles.includes(`นับเป็นคน · ${pfam.brd_rows} booking`), { titles: pp.titles.filter((t) => /นับเป็นคน/.test(t)), want: [pfam.arr_rows, pfam.rows, pfam.clr_rows, pfam.brd_rows] });
  ok('pier pills: the PK box\'s struck-through figure is the server\'s booked (' + pvar.zones.PK.booked + ')', pp.zones.PK && pp.zones.PK.tot === pvar.zones.PK.total && (pvar.zones.PK.booked > pvar.zones.PK.total ? pp.zones.PK.booked === pvar.zones.PK.booked : pp.zones.PK.booked === null), { pp: pp.zones, zones: pvar.zones });
  await ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id); b.trips[0].pax.ad_fr -= 5; }, vjBk.three.id);
});

// ═════════════════════════════ 5 · the park sheet's paid - due difference (ask 11) ═════════════════════════════
section('5', async () => {
  console.log('\n[5] Park sheet: the day\'s and the month\'s difference are the sheet\'s check.diff_paid');
  const pk = await api(P('/months/2026-11/park'));
  const day = pk.days.find((x) => x.date === D);
  ok('server: the day and the sheet carry check.diff_paid (a number: Zeus has a due and a paid amount)', day.check && typeof day.check.diff_paid === 'number' && pk.check && 'diff_paid' in pk.check, { day: day.check, sheet: pk.check });
  await ev((a) => { window._poPier = a.p; window._poDate = a.d; }, { p: PIER, d: D }); await goView('pop-' + PIER); await settle(2500);
  await ev((d) => pcPickDay(d), D); await idle(); await settle(2000);
  await ev(() => pcTab(2)); await settle(1200);
  // the browser's own cell says another amount paid: legacy's subtraction would differ
  await ev((a) => { const C = (pcDay(a.p, a.d, false) || {}).pk || {}; if (C.b6) C.b6.amt = 7000; renderPierCash(a.p); }, { p: PIER, d: D });
  await settle(900);
  const f = await ev((a) => ({ now: pcPkDiffPaid(a.p, a.d, 4242), legacy: window.pcPkDiffPaid.__orig(a.p, a.d, 4242), month: pcPkDiffPaid(a.p, null, 4242) }), { p: PIER, d: D });
  ok('pcPkDiffPaid(day) = check.diff_paid of the day (' + day.check.diff_paid + '), pcPkDiffPaid(month) = the sheet\'s (' + pk.check.diff_paid + ')', f.now === Math.round(day.check.diff_paid) && f.legacy === 4242 && f.month === (pk.check.diff_paid === null ? null : Math.round(pk.check.diff_paid)), f);
  const totRow = await ev(() => { const r = document.querySelector('.pc2-tr.pk.tot'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const sign = day.check.diff_paid > 0 ? '+' : day.check.diff_paid < 0 ? '−' : '';
  const want = day.check.diff_paid === 0 ? 'ตรง' : sign + Math.abs(Math.round(day.check.diff_paid)).toLocaleString('en-US');
  ok('the day\'s total row shows the server\'s difference (' + want + ') although the browser\'s cell says 7,000 paid', totRow.includes(want), { totRow, want });
  const kpi = await ev(() => [...document.querySelectorAll('.pc2-kpi .k')].map((k) => k.innerText.replace(/\s+/g, ' ').trim()));
  const kd = kpi.find((k) => /^ต่าง/.test(k)) || '';
  ok('and the "ต่าง" card is the same figure', day.check.diff_paid === 0 ? /0/.test(kd) : kd.includes(sign + '฿' + Math.abs(Math.round(day.check.diff_paid)).toLocaleString('en-US')) || kd.includes(Math.abs(Math.round(day.check.diff_paid)).toLocaleString('en-US')), { kd, kpi });
});

// ───────────────────────────── run ─────────────────────────────
for (const [name, fn] of todo) {
  if (only && !only.includes(name)) continue;
  try { await fn(); } catch (e) { console.log('  FAIL section ' + name + ' threw: ' + String(e && e.stack || e).slice(0, 900)); fails.push('section ' + name + ' threw'); }
}
console.log('\npage errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
ok('no page errors', errors.length === 0, errors);
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nALL OK');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
