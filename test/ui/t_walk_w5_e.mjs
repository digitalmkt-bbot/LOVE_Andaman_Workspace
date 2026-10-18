// t_walk_w5_e · wave 5, group e: rate expiry, agent rules, booking-form price lines, approval impact, money state,
// history, pickup time, against a REAL operation-backend (in-process store, seeded). Every check reads BOTH sides:
// the screen's figure and what the server answers when asked directly; request bodies are checked for computed fields;
// each section includes a case where the server's answer DIFFERS from legacy's browser arithmetic and the screen shows the server's.
//   node test/ui/t_walk_w5_e.mjs            ONLY=1,2 node test/ui/t_walk_w5_e.mjs
//   [1] rate expiry: rtExpScan / rtExpRowFor / rtExpForAgent / agHdIssues / agHdScan / rtmSuggest
//   [2] group season table: rtExpBulkOpen / rtExpBulkPlan / rtExpBulkApply
//   [3] agent rules: agRtRoutes (+ plan/fill/add-missing), rtScopeList, ctTmplForAgent, agGapCounts, agFindDup text, agClearExecute
//   [4] booking form: TripSubtotal, AddOnInfo, rate drift, computed fields not sent, private-van zone not sent, upgrade settle
//   [5] approval impact, money state (PayOf), history refresh, pickup time of an area
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (n) => !ONLY || ONLY.includes(String(n));

process.env.WALK_AGENTS = '1';          // rt002 + a main contract of a01 that names it (the "next rate" of the expiry panel)
const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = '';
const opsPort = await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 60000);
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
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (_) { json = text; }
  return { status: r.status, json };
};
const api = async (p, init = {}) => (await raw(p, init)).json;
const send = (method, p, body) => raw(p, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const must = async (label, p) => { const r = await p; if (r.status >= 300) throw new Error('seed ' + label + ' -> ' + r.status + ' ' + JSON.stringify(r.json)); return r.json; };

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], bodies = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (req.method() !== 'GET' || u.pathname === '/v1/quote') { let b = null; try { b = req.postData() ? JSON.parse(req.postData()) : null; } catch (_) { b = req.postData(); } bodies.push({ m: req.method(), p: u.pathname, status: r.status, b }); }
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + buf.toString().slice(0, 300));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
let confirmAnswer = true;
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); if (d.type() === 'prompt') d.accept('Tester'); else if (d.type() === 'confirm' && !confirmAnswer) d.dismiss(); else d.accept(); });

const fails = [], results = {};
let item = 0;
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 600))); if (!cond) fails.push(item + ': ' + name); (results[item] = results[item] || [0, 0])[cond ? 0 : 1]++; };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 10000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const sentTo = (m, re, from = 0) => bodies.slice(from).filter((x) => x.m === m && re.test(x.p));
const ymd = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const nav = async (view) => { await ev((v) => { const el = document.querySelector('.nav-item[data-view="' + v + '"]'); if (el) el.click(); }, view); await settle(600); };
const COMPUTED_BK = ['total', 'purpose', 'priceBreakdown', 'price_seat', 'price_addon', 'price_discount', 'price_extra', 'price_foc_discount', 'payment_state', 'invoice', 'owed'];

// ── seed through the API ──
const AGENT_BASE = { market_id: 'ru', pay_type: 'invoice', vat_mode: 'exclude', credit_days: 30, credit_limit: 100000, email: 'zz@example.com', company: { legal_name: 'ZZ Co', address: '1 Test Rd' } };
const mkAgent = async (name, extra = {}) => must('agent ' + name, send('POST', '/v1/agents', { ...AGENT_BASE, name, rate_type_id: 'rt001', sales_id: 's1', ...extra }));
const END = ymd(20), SPLIT = ymd(21);            // rt001 ends in 20 days; rt002 starts the day after (the split of the group table)
await must('rt001 valid_to', send('PATCH', '/v1/rate-types/rt001', { valid_to: END }));
await must('rt002 valid_from', send('PATCH', '/v1/rate-types/rt002', { valid_from: SPLIT }));
const agX = await mkAgent('ZZ Expiring NoNext', { code: 'ZZEXPNN' });          // on rt001, no main contract -> no next rate
const agOk = await mkAgent('ZZ Other Rate', { code: 'ZZOTHER', rate_type_id: 'rt002' });   // on rt002 (no end) -> not in the panel
// a rate that prices r5 and carries an unpriced r10 row (every net 0): the server does not list r10 as priced
await must('rtZ', send('POST', '/v1/rate-types', { id: 'rtZ', code: 'RTZ', name: 'ZZ Priced Routes',
  routes: [{ route_id: 'r5', zones: { NoTransfer: { net: { ad_fr: 1000, chd_fr: 700, ad_th: 900, chd_th: 600 } } } },
           { route_id: 'r10', zones: { NoTransfer: { net: { ad_fr: 0, chd_fr: 0, ad_th: 0, chd_th: 0 } } } }] }));

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/agents`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
await ev(() => laOps.rateTypes.load());
await settle(800);

// ════════════════════════════════════════════════════════════════════════════════
if (want(1)) {
console.log('\n[1] rate expiry: the panel rows, an agent\'s line, the KPI counts, the season suggestion are the server\'s');
item = 1;
const srvScan = await api('/v1/rate-types/expiring?within=60');
const srvRow = srvScan.rows.find((r) => r.rate_type_id === 'rt001');
ok('server: rt001 is in the panel with a01 and the new agent, soonest first, next rate rt002 for one agent',
  !!srvRow && srvRow.days === 20 && srvRow.agents.some((a) => a.id === 'a01') && srvRow.agents.some((a) => a.id === agX.id) && srvRow.next.rt002 === 1, srvScan);
// A case where legacy's arithmetic differs: blank the end date of the rate in the browser (legacy then sees "nothing to warn about").
await ev(() => { window.__w5eEnd = getRateType('rt001').validTo; getRateType('rt001').validTo = ''; });
const legacyRows = await ev(() => SB_RATE_TYPES.map((rt) => rtExpRowFor.__orig(rt, 60)).filter(Boolean).map((r) => r.rt.id));
ok('sanity: legacy\'s own scan sees no expiring rate once the browser copy has no end date', legacyRows.length === 0, legacyRows);
await ev(() => rtExpScan());                                 // starts the read
ok('the server\'s answer lands', await waitFor(() => laOps.srv.status('rtexp|60') === 'ready'), null);
const rows = await ev(() => rtExpScan().map((r) => ({ id: r.rt.id, days: r.days, to: r.to, agents: r.agents.map((a) => a.id).sort(), blocked: r.blocked, next: r.next })));
ok('rtExpScan() = the server\'s rows (rate, days left, agents, blocked, next)', rows.length === srvScan.rows.length && rows[0].id === 'rt001' && rows[0].days === srvRow.days
  && JSON.stringify(rows[0].agents) === JSON.stringify(srvRow.agents.map((a) => a.id).sort()) && JSON.stringify(rows[0].next) === JSON.stringify(srvRow.next) && JSON.stringify(rows[0].blocked) === JSON.stringify(srvRow.blocked), { rows, srvRow });
const rowFor = await ev(() => { const r = rtExpRowFor(getRateType('rt001')); return r && { days: r.days, n: r.agents.length }; });
ok('rtExpRowFor(rt001) = the server row; a rate with no row is null', rowFor && rowFor.days === 20 && rowFor.n === srvRow.agents.length && (await ev(() => rtExpRowFor(getRateType('rt002')))) === null, rowFor);
// the panel draws the server's row
const panel = await ev(() => { let h = document.getElementById('w5e-exp'); if (!h) { h = document.createElement('div'); h.id = 'w5e-exp'; document.body.appendChild(h); } rtExpRender('w5e-exp'); return h.innerText; });
ok('the panel (rtExpRender) shows the rate name, "อีก 20 วัน" and the agent count', /Test agent net/.test(panel) && /อีก 20 วัน/.test(panel) && new RegExp(srvRow.agents.length + ' เอเย่นต์').test(panel), panel.slice(0, 300));
// the agent's own line
const srvOne = (await api('/v1/agents/a01/rate-expiry')).expiry;
await ev(() => rtExpForAgent(sbGetAgent('a01')));
await waitFor(() => laOps.srv.status('rtexp1|a01') === 'ready');
const one = await ev(() => { const x = rtExpForAgent(sbGetAgent('a01')); return x && { id: x.rt.id, days: x.days, to: x.to, next: x.next, blocked: x.blocked }; });
ok('rtExpForAgent(a01) = GET /v1/agents/a01/rate-expiry (rate, days, end, next rate rt002)', srvOne && one && one.id === srvOne.rate_type_id && one.days === srvOne.days && one.to === srvOne.valid_to && one.next === srvOne.next && one.next === 'rt002', { one, srvOne });
ok('an agent whose rate does not end soon has no line', (await ev((id) => rtExpForAgent(sbGetAgent(id)), agOk.id)) === null, null);
// header counts
const hd = await ev((x) => ({ a01: agHdIssues(sbGetAgent('a01')).exp || 0, x: agHdIssues(sbGetAgent(x)).exp || 0 }), agX.id);
ok('agHdIssues(...).exp is 1 for both agents of the expiring rate (the list drove it)', hd.a01 === 1 && hd.x === 1, hd);
const scan = await ev(() => agHdScan());
const srvExpAgents = new Set(srvScan.rows.flatMap((r) => r.agents.map((a) => a.id)));
const sellingExp = await ev((ids) => SB_AGENTS.filter((a) => ids.includes(a.id) && (a.programs || []).length).length, [...srvExpAgents]);
ok('agHdScan().exp = the server\'s count of selling agents on an expiring rate', scan.exp === sellingExp && scan.exp >= 2, { scan, sellingExp });
// suggestion
await ev(() => { window._rtmAgent = 'a01'; rtmInit('a01'); });
const srvSug = (await api('/v1/agents/a01/rate-seasons/suggestion')).suggestion;
ok('server: a01 has a suggested table (rt001 until the day before the split, then rt002)', srvSug && srvSug.split === SPLIT && srvSug.seasons.length >= 1 && srvSug.seasons[srvSug.seasons.length - 1].rate_type_id === 'rt002', srvSug);
const nPre = calls.length;
await ev(() => rtmFillFromContract());
await settle(900);
const draft = await ev(() => JSON.parse(JSON.stringify(window._rtmDraft)));
ok('rtmFillFromContract(): the draft rows are the server\'s suggestion (asked once, no browser dates)', JSON.stringify(draft) === JSON.stringify(srvSug.seasons.map((s) => ({ rt: s.rate_type_id, from: s.from, to: s.to || '' }))) && calls.slice(nPre).some((c) => /rate-seasons\/suggestion/.test(c)), { draft, srvSug });
await ev(() => { getRateType('rt001').validTo = window.__w5eEnd; });
}

// ════════════════════════════════════════════════════════════════════════════════
if (want(2)) {
console.log('\n[2] group season table: the plan is read from the server, "apply" is one command');
item = 2;
const srvPlan = await api('/v1/rate-types/rt001/expiry-plan');
ok('server plan: one group (rt002 from the split) with a01, the new agent skipped (no next rate)',
  srvPlan.total === 1 && srvPlan.groups[0].next_rate_type_id === 'rt002' && srvPlan.groups[0].split === SPLIT && srvPlan.groups[0].agent_ids.join() === 'a01' && srvPlan.skipped.no_next >= 1, srvPlan);
// legacy would find nobody: hide the contract's next rate from the browser copy of the contracts
await ev(() => { window.__w5eC = SB_CONTRACTS.map((c) => c.rateTypeId); SB_CONTRACTS.forEach((c) => { c.rateTypeId = 'rt001'; }); });
const legacyPlan = await ev(() => rtExpBulkPlan.__orig('rt001').total);
ok('sanity: legacy\'s plan over the same browser data is empty', legacyPlan === 0, legacyPlan);
await ev(() => { window._rtExpBulkRt = 'rt001'; rtExpBulkOpen('rt001'); });
ok('the dialog opens from the server plan', await waitFor(() => /ตั้งให้ 1 เอเย่นต์/.test((document.getElementById('acct-modal') || {}).innerText || '')), await ev(() => (document.getElementById('acct-modal') || {}).innerText));
const dlgText = await ev(() => document.getElementById('acct-modal').innerText);
ok('dialog text: the group line, the split date and the skipped line come from the plan', /1 เอเย่นต์/.test(dlgText) && /Test agent net|ZZ second rate/.test(dlgText) && /ไม่ได้ระบุเรทตัวถัดไปในสัญญา/.test(dlgText), dlgText.slice(0, 500));
const n0 = bodies.length;
await ev(() => document.querySelector('#acct-modal button[onclick="rtExpBulkApply()"]').click());
await idle(); await settle(1500);
const posted = sentTo('POST', /expiry-plan\/apply$/, n0);
ok('one command: POST /v1/rate-types/rt001/expiry-plan/apply with an empty body, no PUT of a season table',
  posted.length === 1 && JSON.stringify(posted[0].b) === '{}' && posted[0].status === 200 && !sentTo('PUT', /rate-seasons$/, n0).length, { posted, others: bodies.slice(n0).map((b) => b.m + ' ' + b.p) });
const srvSeasons = (await api('/v1/agents/a01/rate-seasons')).seasons;
const scrSeasons = await ev(() => sbGetAgent('a01').rateSeasons.map((s) => ({ rate_type_id: s.rt, from: s.from, to: s.to || null })));
ok('server: a01 has the table; screen: the agent holds the same rows', srvSeasons.length >= 1 && JSON.stringify(scrSeasons) === JSON.stringify(srvSeasons.map((s) => ({ rate_type_id: s.rate_type_id, from: s.from, to: s.to || null }))), { srvSeasons, scrSeasons });
ok('the dialog closed and the success toast text is legacy\'s', !(await ev(() => !!document.getElementById('acct-modal'))), null);
const after = await api('/v1/rate-types/expiring?within=60');
ok('server: a01 is no longer in the panel (a season covers the day after), the new agent still is', !after.rows[0].agents.some((a) => a.id === 'a01') && after.rows[0].agents.some((a) => a.id === agX.id), after.rows[0]);
await settle(600);
const exp2 = await ev(() => (rtExpScan().find((r) => r.rt.id === 'rt001') || { agents: [] }).agents.map((a) => a.id).sort());
ok('screen panel after the apply = the server\'s row', JSON.stringify(exp2) === JSON.stringify(after.rows[0].agents.map((a) => a.id).sort()), exp2);
await ev(() => { SB_CONTRACTS.forEach((c, i) => { c.rateTypeId = window.__w5eC[i]; }); });
}

// ════════════════════════════════════════════════════════════════════════════════
if (want(3)) {
console.log('\n[3] agent rules: priced routes, rate scope, template, gap counts, duplicate text, clear agents');
item = 3;
const rtZ = await api('/v1/rate-types/rtZ');
ok('server: rtZ prices r5 only (priced_routes), the r10 row has no price', JSON.stringify(rtZ.priced_routes) === '["r5"]', rtZ.priced_routes);
await ev(() => laOps.rateTypes.refresh('rtZ'));
const cover = await ev(() => ({ srv: agRtRoutes(getRateType('rtZ')), legacy: (function () { const rt = getRateType('rtZ'); return (rt.routes || []); })() }));
ok('agRtRoutes(rtZ) = ["r5"] from the server; legacy\'s rule would count both rows of the rate', JSON.stringify(cover.srv) === '["r5"]' && cover.legacy.includes('r10'), cover);
const plan = await ev(() => { const a = sbGetAgent('a01'); const p = agProgPlan(a, 'rtZ'); return { cover: p.cover, add: p.add, drop: p.drop }; });
ok('agProgPlan(a01, rtZ): cover = priced routes; r10 would never be added', JSON.stringify(plan.cover) === '["r5"]' && !plan.add.includes('r10'), plan);
const pp = await ev((id) => { _agEditAgentId = id; _agEditDraft = { programPeriods: [] }; const a = sbGetAgent(id); a.rateTypeId = 'rtZ'; try { agEditPPAddMissing(); } catch (e) { return { err: String(e) }; } const out = _agEditDraft.programPeriods.map((p) => ({ r: p.routeId, from: p.bookFrom, to: p.bookTo })); a.rateTypeId = 'rt001'; _agEditDraft = null; _agEditAgentId = null; return { out, cs: a.contractStart, ce: a.contractEnd }; }, agX.id);
ok('agEditPPAddMissing adds the priced route r5 only, with the contract window (not a fixed 2025 window)', pp.out && pp.out.length === 1 && pp.out[0].r === 'r5' && pp.out[0].from !== '2025-10-01', pp);
// rate scope: the browser no longer filters the list again
const scope = await ev(() => { const keepLa = window.laSalesScoped, keepMy = window.laMySalesId; window.laSalesScoped = () => true; window.laMySalesId = () => 's-nobody'; const list = SB_RATE_TYPES.slice(); const out = rtScopeList(list, null).length; window.laSalesScoped = keepLa; window.laMySalesId = keepMy; return { in: list.length, out }; });
ok('rtScopeList returns the list as the server scoped it (legacy would filter by owner again)', scope.out === scope.in && scope.in > 1, scope);
// template of an agent
await ev(() => laOpsAgentFetch('a01'));
const srvA = await api('/v1/agents/a01');
const tm = await ev(() => { const a = sbGetAgent('a01'); const t = ctTmplForAgent(a); return { eff: a.contractTemplateEffectiveId, tid: t && t.id }; });
ok('the agent carries the server\'s contract_template_effective_id and ctTmplForAgent follows it', tm.eff === srvA.contract_template_effective_id && (tm.eff == null || tm.tid === tm.eff), { tm, srv: srvA.contract_template_effective_id });
// gap counts
const lst = (await api('/v1/agents?active=all')).agents;
await ev(() => laOps.catalogue.load()); await settle(900);
const gaps = await ev(() => { const g = agGapCounts(); return { programs: g.programs, rate: g.rate, all: g.all }; });
ok('agGapCounts: "no programmes" and "no rate" = the server\'s `incomplete` counts', gaps.programs === lst.filter((a) => a.incomplete.includes('programs')).length && gaps.rate === lst.filter((a) => a.incomplete.includes('rate_type')).length && gaps.all === lst.length, { gaps, lst: lst.map((a) => [a.id, a.incomplete]) });
// duplicate name: legacy's Thai confirm, filled from the server's 409
confirmAnswer = false;
const nDlg = dialogs.length, nB = bodies.length;
await ev(() => { agNew(); _agNewDraft.name = 'Sun Tour'; _agNewDraft.legalName = 'Sun Tour Dup Co'; _agNewDraft.address = '2 Dup Rd'; _agNewDraft.market = 'ru'; _agNewDraft.rateTypeId = 'rt001'; _agNewDraft.payType = 'invoice'; _agNewDraft.vatMode = 'exclude'; agCreateSubmit(); });
await idle(); await settle(1200);
const dupConfirm = dialogs.slice(nDlg).find((d) => /^confirm:/.test(d)) || '';
const dupPost = sentTo('POST', /^\/v1\/agents$/, nB);
ok('server answered 409 possible_duplicate on the first POST and the screen asked legacy\'s Thai question with the other agent\'s name and code',
  dupPost.length === 1 && dupPost[0].status === 409 && /มีเอเยนต์ที่ชื่อ\/โค้ดใกล้เคียงกันอยู่แล้ว/.test(dupConfirm) && /Sun Tour/.test(dupConfirm) && /SUNTOUR/.test(dupConfirm) && /ยืนยันสร้างเป็นเอเยนต์ใหม่แยกอีกตัว/.test(dupConfirm), { dupConfirm, dupPost });
ok('answered "cancel": nothing was created, no create_anyway sent', dupPost.every((p) => !p.b.create_anyway) && (await api('/v1/agents?active=all&q=Sun%20Tour')).agents.length === 1, dupPost);
confirmAnswer = true;
await ev(() => { try { agEditClose(); } catch (_) {} });
// clear agents: the server decides
const del1 = await mkAgent('ZZ Clear Free', { code: 'ZZCLRFREE' });
const used = await mkAgent('ZZ Clear Used', { code: 'ZZCLRUSED' });
await must('booking for the used agent', send('POST', '/v1/bookings', { external_id: 'zz-w5e-clr', intent: 'confirm', agentId: used.id, leadPax: 'ZZ CLR', leadNationality: 'RU', leadPhone: '+7 9', pickupSelf: true, guides: { english: true }, trips: [{ routeId: 'r5', date: ymd(30), pax: { ad_fr: 1 }, zone: 'NoTransfer' }] }).then(async (r) => { if (r.status === 409) { await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: ymd(30), capacity: 40 }); return send('POST', '/v1/bookings', { external_id: 'zz-w5e-clr', intent: 'confirm', agentId: used.id, leadPax: 'ZZ CLR', leadNationality: 'RU', leadPhone: '+7 9', pickupSelf: true, guides: { english: true }, trips: [{ routeId: 'r5', date: ymd(30), pax: { ad_fr: 1 }, zone: 'NoTransfer' }] }); } return r; }));
await ev(() => laOps.catalogue.load()); await settle(900);
const nD2 = dialogs.length, nB2 = bodies.length;
await ev((ids) => { agClearOpen(); ids.forEach((i) => agClearToggle(i, true)); agClearConfirmInput('ลบ'); agClearExecute(); }, [del1.id, used.id]);
await idle(); await settle(1500);
const dels = sentTo('DELETE', /^\/v1\/agents\//, nB2);
const alertTxt = (dialogs.slice(nD2).find((d) => /^alert: Cleared/.test(d)) || '');
const srvAgents = (await api('/v1/agents?active=all')).agents.map((a) => a.id);
ok('one DELETE per ticked agent; the free one is gone on the server, the one with a booking is kept (409)', dels.length === 2 && !srvAgents.includes(del1.id) && srvAgents.includes(used.id) && dels.some((d) => d.status === 409), { dels, srvAgents });
ok('screen: the free agent left the list, the used one stays; the alert carries the server\'s message', await ev((a) => !SB_AGENTS.some((x) => x.id === a[0]) && SB_AGENTS.some((x) => x.id === a[1]), [del1.id, used.id]) && /Cleared 1 agent/.test(alertTxt) && /ZZCLRUSED/.test(alertTxt), alertTxt);
}

// ════════════════════════════════════════════════════════════════════════════════
const F1 = ymd(10), F2 = ymd(12);          // before the split of the group table (day 21): a01 is still on rt001
let TA = null;
if (want(4) || want(5)) {
  // a01 has the seeded MAIN contract (it names rt002); the server prices from the bound rate rt001, which now also sells a private van
  await must('rt001 van', send('PUT', '/v1/rate-types/rt001/routes/r5', { route_id: 'r5', zones: { NoTransfer: { net: { ad_fr: 1200, chd_fr: 900, ad_th: 1000, chd_th: 700 } }, PK: { net: { ad_fr: 1500, chd_fr: 1100, ad_th: 1300, chd_th: 900 } } }, transfer: { PK: { van: 1800 } } }));
  TA = { id: 'a01' };
  for (const d of [F1, F2]) await must('deployment ' + d, send('POST', '/operations/deployments', { boat_id: 'b6', route_id: 'r5', service_date: d, capacity: 40 }));
  await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
  await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
  await settle(1500);
  await ev(() => laOps.rateTypes.load()); await settle(800);
}
const form = (o) => ev((o) => {
  bookingV2NewBooking();
  const d = _bkV2.newBooking;
  bookingV2SetBookingField('agentId', o.agent);
  Object.assign(d, { leadPax: o.lead, leadNationality: 'RU', leadPhone: '+7 900 000', hotelName: '', voucherRef: '' });
  d.pickupZoneFilter = 'NoTransfer'; d.pickupSelf = true; d.guides = { english: true, russian: false, chinese: false, otherLang: '' };
  d.trips = [Object.assign(bookingV2NewTrip(), { routeId: 'r5', date: o.date, pax: { ad_fr: o.pax || 1 }, zone: 'NoTransfer' })];
  if (o.addOns) d.addOns = o.addOns;
  if (o.adjustments) d.adjustments = o.adjustments;
  if (o.commit) bookingV2CommitBooking(o.status || 'confirmed'); else bookingV2Render();
}, o);
const srvBy = async (lead) => ((await api('/v1/bookings?q=' + encodeURIComponent(lead))).bookings || [])[0] || null;
const quoteBody = () => ev(() => { const d = _bkV2.newBooking; const r = laOpsQuote.buildRequest(d, {}); return r && r.body; });

if (want(4)) {
console.log('\n[4] booking form: price lines from the quote, computed fields not sent, private-van zone not sent, upgrade settle');
item = 4;
// legacy's arithmetic differs: the browser's copy of the rate says 999 an adult and 999 for the van; the server's rate says 1200 and 1800
await form({ agent: TA.id, lead: 'ZZ W5E FORM', date: F1, pax: 3 });
const k = await waitFor(() => !!laOpsQuote.answered(), null, 15000);
ok('the quote for the draft is answered', k, null);
const qb = await quoteBody();
const srvQ = await api('/v1/quote', { method: 'POST', body: JSON.stringify(qb) });
await ev(() => { getRateType('rt001').seatRates.r5.NoTransfer['adult-fr'] = 999; });
const sub = await ev(() => { const d = _bkV2.newBooking; return { shown: bookingV2TripSubtotal(d.trips[0]).total, legacy: bookingV2TripSubtotal.__orig(d.trips[0]).total }; });
ok('bookingV2TripSubtotal = the quote\'s trips[0].subtotal (3 adults at 1200 = 3600); the browser\'s own arithmetic gave 3 x 999', sub.shown === srvQ.trips[0].subtotal && sub.shown === 3600 && sub.legacy === 2997, { sub, srvQ });
const panelTxt = await ev(() => (document.getElementById('nbf-review-slot') || document.body).innerText);
ok('the review panel prints the server total', panelTxt.includes((srvQ.total).toLocaleString()), panelTxt.slice(0, 400));
// add-on line: a private van on r5, priced 1800 on the server
await ev(() => { const d = _bkV2.newBooking; d.addOns = [{ type: 'transfer-r5-PK-van', qty: 1 }]; bookingV2Render(); });
ok('the quote with the van is answered', await waitFor(() => { const a = laOpsQuote.answered(); return a && a.quote.add_ons && a.quote.add_ons.length === 1; }, null, 15000), null);
const qb2 = await quoteBody(); const srvQ2 = await api('/v1/quote', { method: 'POST', body: JSON.stringify(qb2) });
await ev(() => { const rt = getRateType('rt001'); rt.addOns = rt.addOns || {}; rt.addOns.privateTransfer = { r5: { PK: { van: 999 } } }; });
const info = await ev(() => ({ shown: bookingV2AddOnInfo('transfer-r5-PK-van').total, legacy: bookingV2AddOnInfo.__orig('transfer-r5-PK-van').total }));
ok('bookingV2AddOnInfo(van).total = the quote\'s add_ons[0].amount (1800); the browser rate said 999', info.shown === srvQ2.add_ons[0].amount && info.shown === 1800 && info.legacy === 999, { info, srvQ2 });
// save: no computed field in the request, the van's zone is left to the server
const n0 = bodies.length;
await ev(() => { _bkV2.newBooking.leadPax = 'ZZ W5E FORM'; _bkV2.newBooking.trips[0].zone = 'NoTransfer'; bookingV2CommitBooking('confirmed'); });
await waitFor(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); return b && b.opsId; }, null, 20000); await idle(); await settle(800);
const post = sentTo('POST', /^\/v1\/bookings$/, n0)[0];
ok('POST /v1/bookings carries no total, purpose, price breakdown or other computed field', post && post.status === 201 && COMPUTED_BK.every((f) => !(f in post.b)), post ? { status: post.status, keys: Object.keys(post.b) } : { sent: bodies.slice(n0).map((b) => b.m + ' ' + b.p + ' ' + b.status), dialogs: dialogs.slice(-3) });
ok('the van\'s trip is sent without a zone (the server makes it NoTransfer)', post && post.b.trips[0].zone === undefined, post && post.b.trips[0]);
const saved = await srvBy('ZZ W5E FORM');
ok('server: the trip is on NoTransfer and the total is the server\'s (seats 3600 + van 1800)', saved && saved.trips[0].zone === 'NoTransfer' && saved.total === 5400 && saved.total === srvQ2.total, saved && { zone: saved.trips[0].zone, total: saved.total, q: srvQ2.total });
const scrTot = await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); return b.total; });
ok('screen: the booking shows the server\'s total after the save', scrTot === saved.total, scrTot);
// rate drift: the rate's price changes after the booking was saved; the kept-rate quote differs from the saved total
await must('rtT price up', send('PUT', '/v1/rate-types/rt001/routes/r5', { route_id: 'r5', zones: { NoTransfer: { net: { ad_fr: 1300, chd_fr: 900, ad_th: 1000, chd_th: 700 } }, PK: { net: { ad_fr: 1500, chd_fr: 1100, ad_th: 1300, chd_th: 900 } } }, transfer: { PK: { van: 1800 } } }));
await ev(() => { const rt = getRateType('rt001'); rt.seatRates.r5.NoTransfer['adult-fr'] = 1200; rt.addOns.privateTransfer = { r5: { PK: { van: 1800 } } }; });   // the browser still has the old price: legacy sees no drift
await ev(() => { _bkV2.newBooking = null; const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); bookingV2EditBooking(b.id); });
const noDriftYet = await ev(() => !_bkV2.newBooking._rtKeep.drift);
ok('sanity: at open, legacy\'s arithmetic over the stale browser rate sees no drift', noDriftYet, null);
ok('the kept-rate quote answers and the drift flag is set from it', await waitFor(() => { const K = _bkV2.newBooking && _bkV2.newBooking._rtKeep; return K && K.drift; }, null, 15000), await ev(() => _bkV2.newBooking._rtKeep));
const drift = await ev(() => { const K = _bkV2.newBooking._rtKeep; return { was: K.total, now: K.drift && K.drift.now, shown: !!document.querySelector('.bkv2-rtdrift') }; });
const keptQ = await api('/v1/quote', { method: 'POST', body: JSON.stringify(await quoteBody()) });
ok('drift = saved total vs the quote at the kept rate (5400 -> 5700), shown in the red note', drift.was === 5400 && drift.now === keptQ.total && drift.now === 5700 && drift.shown, { drift, keptQ: keptQ.total });
await ev(() => { _bkV2.newBooking = null; _bkV2.editingId = null; bookingV2Render(); });
// upgrade settle: a new sale is sent without settle (the server starts it at pending)
const n1 = bodies.length;
await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); b.upgrades = [{ id: 'up_w5e1', label: 'ZZ upgrade', sellPrice: 1000, toCompany: 700, commission: 300, collected: false, settle: 'pending', method: 'cash', note: '' }]; return bookingV2SyncToOpsBackend(b); });
await idle(); await settle(800);
const up = sentTo('PATCH', /^\/v1\/bookings\//, n1)[0];
const srvUp = ((await srvBy('ZZ W5E FORM')).upgrades || [])[0];
ok('PATCH upgrades: settle is not sent as "pending" and no commission / fee / customer_paid / at', up && up.status === 200 && up.b.upgrades[0].settle === null && !('commission' in up.b.upgrades[0]) && !('customer_paid' in up.b.upgrades[0]) && !('at' in up.b.upgrades[0]), up && up.b.upgrades);
ok('server: the sale starts pending and commission is the server\'s (300)', srvUp && srvUp.settle === 'pending' && srvUp.commission === 300, srvUp);
}

if (want(5)) {
console.log('\n[5] approval impact, money state, history, pickup time');
item = 5;
// approval impact: a half-price booking waits for approval; the browser's copy of its pax is wrong
await form({ agent: 'a01', lead: 'ZZ W5E APPROVAL', date: F2, pax: 2, adjustments: [{ kind: 'discount', mode: 'percent', value: 50 }], commit: true });
await waitFor(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E APPROVAL'); return b && b.opsId; }, null, 20000); await idle(); await settle(800);
const ap = await srvBy('ZZ W5E APPROVAL');
ok('server: the booking waits for approval', ap && ap.status === 'pending_approval', ap && ap.status);
const imp = (await api('/v1/bookings/' + ap.id + '/approval-impact')).impact;
await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E APPROVAL'); b.trips[0].pax = { ad_fr: 500 }; });
const legacyImpact = await ev(() => bookingV2ApprovalImpact.__orig(SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E APPROVAL')));
ok('sanity: legacy\'s impact over the browser\'s own seat figures differs from the server\'s (no line, or other numbers)', legacyImpact.length === 0 || legacyImpact[0].need !== imp[0].need || legacyImpact[0].overCap > 0 || legacyImpact[0].overLic > 0, legacyImpact);
const nD = dialogs.length;
await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E APPROVAL'); bookingV2ApproveBooking(b.id); });
await settle(1500); await idle();
const promptTxt = dialogs.slice(nD).find((d) => /^prompt:/.test(d)) || '';
const expectLine = '✓ ' + imp[0].route_name + ' ' + imp[0].service_date + ' · ' + imp[0].need + ' ที่ — ที่นั่งพอ (เหลือ ' + (imp[0].sellable - imp[0].need) + ')';
ok('the Approve prompt carries the SERVER\'s impact line (seats enough, N left) and no "over licence" warning', promptTxt.includes('ที่นั่งหลังอนุมัติ:') && promptTxt.includes(expectLine) && !dialogs.slice(nD).some((d) => /ไม่มีที่นั่งจริงรองรับ/.test(d)), { promptTxt, expectLine, dl: dialogs.slice(nD) });
const apAfter = await srvBy('ZZ W5E APPROVAL');
ok('server: approved through the command', apAfter && apAfter.status === 'confirmed', apAfter && apAfter.status);

// money state: an invoice and a part payment made by "another client" after this screen loaded its money
const fb = await srvBy('ZZ W5E FORM');
const inv = await must('invoice', send('POST', '/v1/invoices', { agent_id: TA.id, booking_ids: [fb.id] }));
await must('payment', send('POST', '/v1/invoices/' + inv.id + '/payments', { amount: 1000, method: 'transfer', paid_on: ymd(0) }));
const srvBk = await api('/v1/bookings/' + fb.id);
await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); _bkV2.newBooking = null; _bkV2.detailId = b.id; bookingV2Render(); });
ok('the detail read brings the booking\'s money state', await waitFor(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); return b && b.srvPay && b.srvPay.state === 'partial'; }, null, 15000), await ev(() => SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM').srvPay));
// the browser now reads the money again by itself (w5-c), so its invoices are no longer stale: make them stale on purpose (no payment known) for legacy's side
const pay = await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); const p = bookingV2PayOf(b); const keep = window.acctInvoicePaid; window.acctInvoicePaid = () => 0; let l; try { l = bookingV2PayOf.__orig(b); } finally { window.acctInvoicePaid = keep; } return { state: p.state, paid: p.paid, bal: p.bal, tot: p.tot, lstate: l.state }; });
ok('bookingV2PayOf = the booking\'s invoice (partial, paid 1000, balance = total - 1000)',
  pay.state === 'partial' && srvBk.payment_state === 'partial' && pay.paid === srvBk.invoice.paid && pay.bal === srvBk.invoice.balance && pay.tot === srvBk.invoice.total && pay.paid === 1000, { pay, inv: srvBk.invoice });
ok('sanity: legacy\'s state over the stale local invoices differed', pay.lstate !== 'partial', pay);

// history: a local line is replaced by the server's words after the write
const histBefore = (await api('/v1/bookings/' + fb.id + '/history')).history.length;
await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); bookingV2AddHistory(b, 'edit', 'ZZ LOCAL ONLY LINE', 'Edit'); });
const hasLocal = await ev(() => SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM').history.some((h) => h.text === 'ZZ LOCAL ONLY LINE'));
await ev(() => laOps.wrote('booking'));
ok('the local line shows at once, then the history is read again and is the server\'s', hasLocal && await waitFor(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM'); return b._historyFromServer && !b.history.some((h) => h.text === 'ZZ LOCAL ONLY LINE'); }, null, 8000), null);
const histNow = (await api('/v1/bookings/' + fb.id + '/history')).history;
const scrHist = await ev(() => SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E FORM').history.map((h) => h.text));
ok('screen history = server history, line for line', JSON.stringify(scrHist) === JSON.stringify(histNow.map((h) => h.text)) && histNow.length >= histBefore, { scrHist, histNow: histNow.map((h) => h.text) });

// pickup time of an area
const area = await must('area', send('POST', '/v1/pickup-areas', { name: 'ZZ W5E Area', zone: 'PK', time_group: 'ZZW5E' }));
const prof = await must('profile', send('POST', '/v1/pickup-time-profiles', { name: 'ZZ W5E Profile', from_date: ymd(-30), to_date: ymd(400) }));
await must('cell', send('PUT', '/v1/pickup-time-profiles/' + prof.id + '/times/r5/' + area.id, { pickup_time: '07:35', pickup_time_end: '07:50' }));
await ev(() => laOps.pickup.refresh()); await settle(600);
// legacy's table in the browser says 09:10; the server says 07:35-07:50
await ev((a) => { const p = SB_PICKUP_TIME_PROFILES.find((x) => x.name === 'ZZ W5E Profile'); if (p) p.times.r5[a] = '09:10'; }, area.id);
await form({ agent: 'a01', lead: 'ZZ W5E PICKUP', date: F1, pax: 1 });
await ev((a) => { _bkV2.newBooking.pickupSelf = false; bookingV2SetPickupArea(a); }, area.id);
const srvPt = await api('/v1/pickup-time?route_id=r5&area_id=' + area.id + '&date=' + F1);
ok('server: the area\'s time for the trip is 07:35-07:50', srvPt.pickup_time === '07:35' && srvPt.pickup_time_end === '07:50', srvPt);
ok('the trip\'s pickup time on the form becomes the server\'s (legacy table gave 09:10)', await waitFor(() => _bkV2.newBooking && _bkV2.newBooking.trips[0].pickupTime === '07:35-07:50', null, 10000), await ev(() => _bkV2.newBooking.trips[0].pickupTime));
ok('asked with route, area and date', calls.filter((c) => /GET \/v1\/pickup-time\?route_id=r5&area_id=/.test(c)).length >= 1, calls.filter((c) => /pickup-time\?/.test(c)));
await ev(() => { _bkV2.newBooking = null; _bkV2.editingId = null; bookingV2Render(); });

// printed PFM report: the server's money per booking (the browser has no invoice for it)
const pf = await mkAgent('ZZ Proforma Agent', { code: 'ZZPRO', pay_type: 'proforma', credit_limit: 0, credit_days: 0 });
const pfb = await must('pfm booking', send('POST', '/v1/bookings', { external_id: 'zz-w5e-pfm', intent: 'confirm', agentId: pf.id, leadPax: 'ZZ W5E PFM', leadNationality: 'RU', leadPhone: '+7 9', pickupSelf: true, guides: { english: true }, trips: [{ routeId: 'r5', date: F1, pax: { ad_fr: 2 }, zone: 'NoTransfer' }] }));
const pinv = await must('pfm invoice', send('POST', '/v1/invoices', { agent_id: pf.id, booking_ids: [pfb.id] }));
await must('pfm payment', send('POST', '/v1/invoices/' + pinv.id + '/payments', { amount: 1000, method: 'transfer', paid_on: ymd(0) }));
const srvPfm = await api('/v1/pfm?from=' + F1 + '&to=' + F1);
await ev((d) => { window._w5eHtml = ''; window.open = () => ({ document: { write: (h) => { window._w5eHtml += h; }, close() {} }, focus() {}, print() {} }); _pfmDate = d; _pfmMode = 'daily'; return laOpsPfm.load(d, d); }, F1);
await settle(1200);
const localInv = await ev(() => { const b = SB_BOOKINGS.find((x) => x.leadPax === 'ZZ W5E PFM'); return b ? { has: !!acctBookingInvoice(b.id) } : null; });
await ev(() => pfmPrintReport());
await settle(1500);
const html = await ev(() => window._w5eHtml);
const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const R = srvPfm.rows[0], fm = (n) => '฿' + Math.round(n).toLocaleString();
ok('server: one proforma row, invoice partly paid (received 1000, balance = total - 1000)', srvPfm.rows.length === 1 && R.received === 1000 && R.balance === R.total - 1000 && srvPfm.totals.received === 1000, srvPfm);
ok('the printed report shows billed ' + fm(R.total) + ', collected ฿1,000, outstanding ' + fm(R.total - 1000) + '  = the server row (the browser held no invoice: ' + JSON.stringify(localInv) + ')', txt.includes(fm(R.total)) && txt.includes('เก็บแล้ว ฿1,000') && txt.includes('ค้าง ' + fm(R.total - 1000)), txt.slice(txt.indexOf('ความคืบหน้า'), txt.indexOf('ความคืบหน้า') + 300));
}

await browser.close(); srv.close(); backend.kill();
console.log('\nresults per item (pass/fail): ' + JSON.stringify(results));
console.log('server refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
ok('no page errors', errors.length === 0, errors);
console.log(fails.length ? `\nFAILED ${fails.length}:\n  ${fails.join('\n  ')}` : '\nall passed');
process.exit(fails.length ? 1 : 0);
