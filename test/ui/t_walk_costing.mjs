// Walk: the costing design sheet against a real operation-backend (in-process store).
//   node test/ui/t_walk_costing.mjs          (OPS_BACKEND_DIR, default D:/projects/operation-backend)
// Q37: the sheet's figures are the answer of POST /v1/costing/calc.   Q38: plan rules and template commands reach the server.
import { serve, goView } from './_harness.mjs';
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
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 30000);
  backend.on('error', (err) => { clearTimeout(t); bad(err); });
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m) { clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const api = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  return r.status === 204 ? null : r.json();
};
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b) });
const put = (p, b) => api(p, { method: 'PUT', body: JSON.stringify(b) });
const patch = (p, b) => api(p, { method: 'PATCH', body: JSON.stringify(b) });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], bodies = [], refusals = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname);
  if (req.method() !== 'GET') bodies.push([req.method() + ' ' + u.pathname, req.postData() || '']);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 200));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); d.type() === 'prompt' ? d.accept('Renamed group') : d.accept(); });

const fails = [];
const chk = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + (JSON.stringify(got) || '').slice(0, 500))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const item = (t) => console.log('\n' + t);

// ── seed through the API: two plans, one on route r4 ──
const planA = await post('/v1/costing/plans', { name: 'Walk A', route_key: 'r4', engines: '3EN', boats: 1, capacity: 64, pax: 30, pax_th: 5, price: 2500, child_pct: 10, price_child: 1500, commission_pct: 5, fuel_price: 38 });
const planB = await post('/v1/costing/plans', { name: 'Walk B', engines: '4EN', boats: 2, capacity: 40, pax: 22, price: 3100, fuel_price: 40 });
chk('seed: two plans on the server', planA.id && planB.id && planA.sheet && planB.sheet, { a: planA.id, b: planB.id });

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/costing`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1200);
await goView(page, 'costing', 1500);
await ev(() => laOps.costingPL.loadCosting());
await ev((id) => { _ct.pid = id; ctSetTab('plan'); }, planA.id);
await settle(500);

// ═══ Q37 ═══
item('Q37 · the live preview is the server\'s answer');
let c0 = calls.length, b0 = bodies.length;
await ev(() => { ctPlanSet('price', 2800); ctPlanSet('pax', 28); });
await idle();
const got = await waitFor(() => Object.keys(laOps.costingPL.calcState.ans).length > 0 && !Object.keys(laOps.costingPL.calcState.busy).length, null, 10000);
await settle(500);
chk('editing the sheet asks POST /v1/costing/calc', got && calls.slice(c0).some((c) => c === 'POST /v1/costing/calc'), calls.slice(c0));
const sent = bodies.slice(b0).filter((b) => b[0] === 'POST /v1/costing/calc').map((b) => JSON.parse(b[1]));
const last = sent[sent.length - 1];
chk('the request carries the unsaved plan fields + template + heads, and only that', last && last.plan && last.plan.price === 2800 && last.plan.pax === 28 && last.template && last.template.lines.length > 5 && last.pax === 28 && last.plan.name === undefined, last && { plan: Object.keys(last.plan), pax: last.pax });
chk('debounced: one request per distinct plan state, not one per keystroke', sent.filter((s) => s.plan.price === 2800 && s.plan.pax === 28).length <= 2, sent.length);

const srvCalc = await post('/v1/costing/calc', { plan_id: planA.id, plan: { price: 2800, pax: 28 } });
const screen = await ev((id) => {
  const pl = ctPlan(id), T = ctTpl(), pax = Math.max(1, +pl.pax || 1);
  const cap = Math.max(1, ctPlanSeats(pl) * Math.max(1, +pl.boats || 1));
  const cur = ctProfitAt(pl, pax, T), be = ctBreakEven(pl, cap, T), c = cur.c;
  return { price: pl.price, pax, seats: ctPlanSeats(pl), p: cur.p, rev: cur.rev, be, net: c.net, gross: c.gross, rows: c.rows.length, step: ctStepCount(pl, pax, T),
           chd: ctChdAt(pl, pax), vat: ctVatR(T), cph: ctCostPerHead(pl), text: document.getElementById('ct-body').innerText };
}, planA.id);
chk('profit on screen = server calc.profit', Math.abs(screen.p - srvCalc.calc.profit) < 0.01, { screen: screen.p, server: srvCalc.calc.profit });
chk('revenue on screen = server calc.revenue', Math.abs(screen.rev - srvCalc.calc.revenue) < 0.01, { screen: screen.rev, server: srvCalc.calc.revenue });
chk('cost (net, gross, rows) = server', Math.abs(screen.net - srvCalc.calc.net) < 0.01 && Math.abs(screen.gross - srvCalc.calc.gross) < 0.01 && screen.rows === srvCalc.calc.rows.length, { screen, server: srvCalc.calc.net });
chk('break-even on screen = server sheet.key_figures.break_even', screen.be === srvCalc.sheet.key_figures.break_even, { screen: screen.be, server: srvCalc.sheet.key_figures.break_even });
chk('seats, step count, children, VAT share, cost per head = server', screen.seats === srvCalc.seats && screen.step === srvCalc.sheet.step_count && screen.chd === srvCalc.sheet.children
  && Math.abs(screen.vat - srvCalc.sheet.vat_share) < 1e-9 && Math.abs(screen.cph - srvCalc.sheet.cost_per_head.amount) < 1e-9, { screen, sheet: [srvCalc.seats, srvCalc.sheet.step_count, srvCalc.sheet.children, srvCalc.sheet.vat_share, srvCalc.sheet.cost_per_head] });
chk('the sheet\'s text shows the server\'s profit figure', screen.text.includes(Math.round(Math.abs(srvCalc.calc.profit)).toLocaleString()), Math.round(srvCalc.calc.profit));

// proof the sync functions READ the cache (not legacy): put a marker in the cached answer and read it back
const mark = await ev((id) => {
  const st = laOps.costingPL.calcState, pl = ctPlan(id), T = ctTpl();
  const key = Object.keys(st.ans).find((k) => JSON.parse(k.split('#')[0].split('|')[0]).price === pl.price && JSON.parse(k.split('#')[0].split('|')[0]).pax === pl.pax);
  const a = st.ans[key]; if (!a) return { none: true };
  a.calc.profit = 123456.5; a.sheet.key_figures.break_even = 77; a.seats = 99; a.sheet.vat_share = 0.5; a.sheet.step_count = 31;
  const pax = Math.max(1, +pl.pax || 1), cap = Math.max(1, a.sheet.capacity);
  const out = { p: ctProfitAt(pl, pax, T).p, be: ctBreakEven(pl, cap, T), seats: ctPlanSeats(pl), vat: ctVatR(T), step: ctStepCount(pl, pax, T) };
  delete st.ans[key]; return out;
}, planA.id);
chk('ctProfitAt / ctBreakEven / ctPlanSeats / ctVatR / ctStepCount return the cached server answer', mark.p === 123456.5 && mark.be === 77 && mark.seats === 99 && mark.vat === 0.5 && mark.step === 31, mark);

// before any answer legacy's arithmetic stays (the sheet never blanks)
const legacy = await ev((id) => {
  const st = laOps.costingPL.calcState; st.ans = {}; st.byTpl = {}; st.order = []; st.failed = {};
  const pl = ctPlan(id), T = ctTpl();
  const r = ctProfitAt(pl, Math.max(1, +pl.pax || 1), T);
  return { p: r.p, finite: Number.isFinite(r.p) && r.c.rows.length > 5 };
}, planA.id);
chk('no answer yet → legacy figures (finite, rows present)', legacy.finite, legacy);
await ev(() => ctRender()); await waitFor(() => Object.keys(laOps.costingPL.calcState.ans).length > 0, null, 8000); await settle(400);
const again = await ev((id) => { const pl = ctPlan(id); return ctProfitAt(pl, Math.max(1, +pl.pax || 1), ctTpl()).p; }, planA.id);
chk('the answer arrives and the sheet draws again: same profit as legacy computed (server = legacy maths)', Math.abs(again - legacy.p) < 0.01 && Math.abs(again - srvCalc.calc.profit) < 0.01, { again, legacy: legacy.p, server: srvCalc.calc.profit });

// the adjust tab's total row: server override_total
await ev(() => ctSetTab('ovr')); await waitFor(() => Object.keys(laOps.costingPL.calcState.ans).length >= 2, null, 10000); await settle(1200);
const ovr = await ev(() => [...document.querySelectorAll('tr.ct-totrow td.ct-tot b')].map((b) => +b.textContent.replace(/[^\d.-]/g, '')));
const srvA = await api('/v1/costing/plans/' + planA.id), srvB = await api('/v1/costing/plans/' + planB.id);
chk('adjust tab "total per trip" = server sheet.override_total.gross for each plan', ovr.length === 2 && ovr[0] === Math.round(srvA.sheet.override_total.gross) && ovr[1] === Math.round(srvB.sheet.override_total.gross), { ovr, a: srvA.sheet.override_total, b: srvB.sheet.override_total });

// the rent figures of a rented boat are the server's too (ctRentOf / _ctRentOfCalc)
await ev((id) => { _ct.pid = id; ctSetTab('plan'); ctPlanSet('boatId', 'b6'); ctRentSet('b6', 'on', 1); ctRentSet('b6', 'amt', 300000); ctRentSet('b6', 'days', 30); ctRentSet('b6', 'off', 4); }, planA.id);
await idle(); await settle(800);
const srvRent = ((await api('/v1/costing/boat-rents')).rents || []).find((r) => r.boat_id === 'b6');
const rscr = await ev(() => { ctRentBust(); const r = ctRentOf('b6'); return r && { perTrip: r.perTrip, perDay: r.perDay, runDays: r.runDays, amt: r.amt, seats: r.seats }; });
chk('rent of b6: perTrip / perDay / runDays / seats on screen = the boat-rent record of the server', srvRent && rscr && rscr.perTrip === srvRent.per_trip && rscr.perDay === srvRent.per_day && rscr.runDays === srvRent.run_days && rscr.seats === srvRent.seats, { rscr, srvRent });
chk('plan with the rented boat: screen profit = server calc.profit', await (async () => {
  await waitFor((id) => { const st = laOps.costingPL.calcState; return Object.keys(st.ans).some((k) => k.includes('"boat_id":"b6"')) && !Object.keys(st.busy).length; }, planA.id, 10000);
  const a = await api('/v1/costing/plans/' + planA.id);
  const p = await ev((id) => { const pl = ctPlan(id); return ctProfitAt(pl, Math.max(1, +pl.pax || 1), ctTpl()).p; }, planA.id);
  return Math.abs(p - a.calc.profit) < 0.01;
})(), 0);

// ═══ Q38 ═══
item('Q38 · plan rules and template commands');
await ev(() => ctSetTab('plan'));
// ctPlanSetOn: the server corrects pax < 1 and pax_th > pax
c0 = calls.length;
await ev((id) => { ctPlanSetOn(id, 'pax', 0); }, planA.id);
await idle(); await settle(500);
let sa = await api('/v1/costing/plans/' + planA.id);
let sc = await ev((id) => { const p = ctPlan(id); return { pax: p.pax, th: p.paxTH }; }, planA.id);
chk('ctPlanSetOn pax 0 → PATCH; server keeps 1; screen shows the server\'s value', calls.slice(c0).some((c) => c === 'PATCH /v1/costing/plans/' + planA.id) && sa.pax === 1 && sc.pax === 1, { sa: sa.pax, sc });
await ev((id) => { ctPlanSet('pax', 20); }, planA.id); await idle();
await ev((id) => { ctPlanSet('paxTH', 99); }, planA.id); await idle(); await settle(500);
sa = await api('/v1/costing/plans/' + planA.id);
sc = await ev((id) => { const p = ctPlan(id); return { pax: p.pax, th: p.paxTH }; }, planA.id);
chk('paxTH 99 over pax 20 → server cuts it to 20; screen shows 20 (legacy kept 99)', sa.pax_th === 20 && sc.th === 20, { sa: sa.pax_th, sc });

// ctFamSetPlan
c0 = calls.length;
await ev((a) => ctFamSetPlan('r4', a), planB.id);
await idle(); await settle(600);
let plans = (await api('/v1/costing/plans')).plans;
chk('ctFamSetPlan r4 → plan B → PUT /v1/costing/route-plans/r4; B holds r4, A freed (one plan per key)', calls.slice(c0).includes('PUT /v1/costing/route-plans/r4')
  && plans.find((p) => p.id === planB.id).route_key === 'r4' && plans.find((p) => p.id === planA.id).route_key === null, plans.map((p) => [p.name, p.route_key]));
chk('the screen shows the same (A has no route, B has r4)', await ev((a) => ctPlan(a.b).famId === 'r4' && !ctPlan(a.a).famId, { a: planA.id, b: planB.id }), 0);
c0 = calls.length;
await ev((a) => ctFamSetPlan('r4', ''), planB.id);
await idle(); await settle(500);
plans = (await api('/v1/costing/plans')).plans;
chk('ctFamSetPlan r4 → none → PUT {plan_id:null}; no plan holds r4', plans.every((p) => p.route_key !== 'r4') && bodies.some((b) => b[0] === 'PUT /v1/costing/route-plans/r4' && JSON.parse(b[1]).plan_id === null), plans.map((p) => p.route_key));

// ctDelLine (by id) + ctRenameGroup + ctResetTpl
await ev(() => ctSetTab('tpl'));
await ev(() => ctAddLine()); await idle(); await settle(500);
let tpl = await api('/v1/costing/template');
const custom = tpl.lines.find((l) => /^x/.test(l.id));
await patch('/v1/costing/plans/' + planA.id, { overrides: { [custom.id]: { off: 1 }, meal: { off: 1 } }, groups: { 'ค่าอาหารและเครื่องดื่ม': { off: 0, pct: 20 } }, on_demand: { [custom.id]: { agent_qty: 3 } } });
await ev(() => laOps.costingPL.loadCosting(true));
c0 = calls.length;
const idx = await ev((id) => ctTpl().lines.findIndex((l) => l.id === id), custom.id);
await ev((i) => ctDelLine(i), idx);
await idle(); await settle(900);
tpl = await api('/v1/costing/template'); sa = await api('/v1/costing/plans/' + planA.id);
chk('ctDelLine → DELETE /v1/costing/template/lines/{id} (by id, not index); line gone', calls.slice(c0).includes('DELETE /v1/costing/template/lines/' + custom.id) && !tpl.lines.some((l) => l.id === custom.id), calls.slice(c0));
chk('the server cleared the plan\'s override and on-demand figures for that line (other overrides kept)', !sa.overrides[custom.id] && !(sa.on_demand || {})[custom.id] && sa.overrides.meal, { o: sa.overrides, od: sa.on_demand });
chk('the screen no longer has the line or its override', await ev((a) => !ctTpl().lines.some((l) => l.id === a.l) && !(ctPlan(a.p).ovr || {})[a.l], { l: custom.id, p: planA.id }), 0);

c0 = calls.length;
await ev(() => ctRenameGroup('ค่าอาหารและเครื่องดื่ม'));
await idle(); await settle(900);
tpl = await api('/v1/costing/template'); sa = await api('/v1/costing/plans/' + planA.id);
chk('ctRenameGroup → POST /v1/costing/template/rename-group {from,to}', bodies.some((b) => b[0] === 'POST /v1/costing/template/rename-group' && JSON.parse(b[1]).to === 'Renamed group'), bodies.filter((b) => /rename/.test(b[0])));
chk('the lines moved to the new name and the plan\'s group setting went with it (one step)', tpl.lines.some((l) => l.group === 'Renamed group') && !tpl.lines.some((l) => l.group === 'ค่าอาหารและเครื่องดื่ม')
  && sa.groups['Renamed group'] && sa.groups['Renamed group'].pct === 20 && !sa.groups['ค่าอาหารและเครื่องดื่ม'], { groups: sa.groups });
chk('the screen has the same template (group renamed)', await ev(() => ctGroups(ctTpl()).includes('Renamed group') && !ctGroups(ctTpl()).includes('ค่าอาหารและเครื่องดื่ม')), 0);

c0 = calls.length;
await ev(() => ctResetTpl());
await idle(); await settle(900);
tpl = await api('/v1/costing/template'); sa = await api('/v1/costing/plans/' + planA.id);
chk('ctResetTpl → POST /v1/costing/template/reset; default template back, every plan\'s overrides cleared', calls.slice(c0).includes('POST /v1/costing/template/reset')
  && !tpl.lines.some((l) => l.group === 'Renamed group') && Object.keys(sa.overrides).length === 0, { o: sa.overrides, groups: [...new Set(tpl.lines.map((l) => l.group))] });
chk('the screen: default groups back, plan overrides empty', await ev((id) => !ctGroups(ctTpl()).includes('Renamed group') && Object.keys(ctPlan(id).ovr || {}).length === 0, planA.id), 0);

// ctDelPlan: delete B, then the last plan is refused with the server's message
await ev((id) => { _ct.pid = id; ctSetTab('plan'); }, planB.id);
c0 = calls.length;
await ev(() => ctDelPlan());
await idle(); await settle(600);
plans = (await api('/v1/costing/plans')).plans;
chk('ctDelPlan (two plans) → DELETE /v1/costing/plans/{id}; one plan left', calls.slice(c0).includes('DELETE /v1/costing/plans/' + planB.id) && plans.length === 1, { plans: plans.length });
const dn = dialogs.length; c0 = calls.length;
await ev(() => ctDelPlan());
await idle(); await settle(600);
plans = (await api('/v1/costing/plans')).plans;
chk('ctDelPlan (last plan) → the server refuses 409; its message is shown; the plan stays', plans.length === 1 && refusals.some((r) => /409/.test(r) && /last_plan|อย่างน้อย/.test(r))
  && dialogs.slice(dn).some((d) => d.startsWith('alert') && d.includes('ต้องเหลืออย่างน้อย 1 แผน')), { dialogs: dialogs.slice(dn), refusals: refusals.slice(-2) });
chk('the plan is still on screen', await ev(() => ctPlans().length === 1), 0);

console.log('\nrefusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
console.log('\npage errors: ' + errors.length + '\n  ' + errors.slice(0, 10).join('\n  '));
chk('no page errors', errors.length === 0, errors.slice(0, 3));
console.log(fails.length ? '\nFAILED: ' + fails.length + '\n  ' + fails.join('\n  ') : '\nALL OK');
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length ? 1 : 0);
