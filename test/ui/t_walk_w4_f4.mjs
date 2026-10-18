// t_walk_w4_f4 · group F4 (fleet strips, memos, agent contract clock) against a REAL operation-backend (in-process store). Screen figures = the server answer.
//   node test/ui/t_walk_w4_f4.mjs
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
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m){ clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const api = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  return r.status === 204 ? null : r.json();
};

// ── app ──
const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });

const cleanup = () => {
  try { backend.kill(); } catch (_) {}
  try { srv.close(); } catch (_) {}
  try { browser.close(); } catch (_) {}
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], refusals = [], bodies = [];      // refusals: every 4xx/5xx the server answered the app (listed at the end)
let fakeDup = null;       // item 9 puts the server's duplicate report here (the API cannot make clashing numbers, only imported data can)
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  if (fakeDup && req.method() === 'GET' && u.pathname === '/v1/fleet/duplicates') { calls.push('GET /v1/fleet/duplicates'); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(fakeDup) }); }
  calls.push(req.method() + ' ' + u.pathname); if (req.method() !== 'GET') bodies.push([req.method() + ' ' + u.pathname, req.postData() || '']);
  // forward what the client means: its login, body type, and If-Match (lock writes and booking writes after
  // the create carry the version they read; operation-backend checks it · src/routes/operations.ts seat-lock
  // routes "Every write to one lock needs its version", c9bbf2d). Dropping it made every lock edit fail here.
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type', 'if-match']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  if (r.status >= 400) refusals.push(req.method() + ' ' + u.pathname + ' → ' + r.status + ' ' + buf.toString().slice(0, 220));
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); d.type() === 'prompt' ? d.accept('Tester') : d.accept(); });

const fails = [];
let s, b1;
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + JSON.stringify(got).slice(0, 500))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const idle = () => page.evaluate(() => window.laOps.queue(() => null));
const ev = (fn, arg) => page.evaluate(fn, arg);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const findings = {}; let cur = 0;
const item = (n, title) => { cur = n; findings[n] = []; console.log(`\n[${n}] ${title}`); };
const chk = (name, cond, got) => { ok(name, cond, got); findings[cur].push([name, !!cond, cond ? '' : JSON.stringify(got).slice(0, 300)]); };
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b) });
const postRaw = async (p, b, method = 'POST') => { const r = await fetch(OPS + p, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1500);
const TD = day(0);
const jobId = (r) => (r && (r.id || (r.jobs && r.jobs[0] && r.jobs[0].id))) || null;
let jobSeq = 800; const mkJob = async (boat, title, extra) => post('/v1/fleet/jobs', Object.assign({ no: 'MJ-' + (++jobSeq), boat_id: boat, title, type: 'corrective', boat_status: 'fixing', assets: [], create_anyway: true }, extra || {}));
let moSeq = 800; const mkMemo = async (extra) => post('/v1/fleet/memos', Object.assign({ no: 'MX-' + (++moSeq), title: 'Walk memo', memo_type: 'labor', scope: 'vessel', boat_id: 'b6', memo_date: TD, vat_enabled: true, vat_rate: 7, discount_pct: 0, discount_amt: 0, lines: [{ name: 'Labour', qty: 1, price: 1000, category: 'labor' }] }, extra || {}));
const reload = async () => { await ev(async () => { await laOps.fleetJobs.load(); await laOps.fleetStock.load(); await laOps.catalogue.load(); }); await settle(500); };
const goto = async (view) => { await ev((v) => { nav(document.querySelector('[data-view="' + v + '"]')); }, view); await settle(1500); };
const wrapText = (id) => ev((i) => { const w = document.getElementById(i); return w ? w.innerText.replace(/\s+/g, ' ') : ''; }, id);

// ── seed through the API ──
const jPend = jobId(await mkJob('b6', 'F4 pending job'));
const jProg = jobId(await mkJob('b7', 'F4 in progress job', { type: 'preventive' })); await post('/v1/fleet/jobs/' + jProg + '/start', {});
const jAwait = jobId(await mkJob('b13', 'F4 awaiting invoice job', { type: 'scheduled' })); await post('/v1/fleet/jobs/' + jAwait + '/start', {});
const jPaid = jobId(await mkJob('b1', 'F4 paid job')); await post('/v1/fleet/jobs/' + jPaid + '/start', {});
const mAwait = await mkMemo({ job_id: jAwait, boat_id: 'b13' });          // pending approval: the job keeps waiting
const mPaid = await mkMemo({ job_id: jPaid, boat_id: 'b1' });
await post('/v1/fleet/memos/' + mPaid.id + '/approve', { approved_by: 'Walk' });
await post('/v1/fleet/memos/' + mPaid.id + '/pay', { paid_date: TD });
await post('/v1/fleet/jobs/' + jAwait + '/close', { outcome: 'success', note: 'walk', awaiting_invoice: true });
await post('/v1/fleet/jobs/' + jPaid + '/close', { outcome: 'success', note: 'walk', awaiting_invoice: true });
await post('/v1/fleet/incidents', { no: 'INC-F41', boat_id: 'b6', date: TD, title: 'F4 open incident', priority: 2, damaged_assets: [{ type: 'hull', label: 'hull' }] });
const inc2 = await post('/v1/fleet/incidents', { no: 'INC-F42', boat_id: 'b7', date: TD, title: 'F4 second incident', priority: 4, damaged_assets: [{ type: 'hull', label: 'hull' }] }); if (!inc2 || !inc2.id) console.log('   INC2 FAILED', JSON.stringify(inc2).slice(0, 300));
await post('/v1/fleet/stock-items', { name: 'F4 oil', category: 'general', unit: 'L', min_qty: 5, cost: 40, qty: 10, warehouse: 'tublamu' });
const si2 = await post('/v1/fleet/stock-items', { name: 'F4 gasket', category: 'engine', unit: 'pcs', min_qty: 3, cost: 250.5, qty: 2, warehouse: 'panwa' });
await reload();

item(1, 'Maintenance Jobs · flRenderMaint draws the server strip (GET /v1/fleet/jobs kpis)');
const jk = (await api('/v1/fleet/jobs')).kpis;
chk('the server counts the seed (4 jobs, 1 pending, 1 in progress, 2 done, 1 awaiting)', jk.total === 4 && jk.pending === 1 && jk.in_progress === 1 && jk.done === 2 && jk.awaiting_invoice === 1, jk);
await goto('fl-maintenance');
let t = await wrapText('fl-maint-pink-wrap');
const stripLine = `YTD spend ฿${jk.ytd_spend.toLocaleString()} · avg ฿${jk.avg_cost.toLocaleString()}/job · ${jk.boats_serviced} boats serviced`;
chk('screen: total, active, pending, the YTD line, avg days open = the server kpis', new RegExp(jk.total + ' jobs').test(t) && t.includes(jk.active + ' active') && t.includes(jk.pending + ' pending') && t.includes(stripLine) && t.includes('avg ' + jk.avg_days_open + ' days open'), { t: t.slice(0, 500), stripLine });
const tabs = await ev(() => Array.from(document.querySelectorAll('#fl-maint-pink-wrap button[onclick^="maintSetArchive"]')).map((b) => b.innerText.replace(/\s+/g, ' ').trim()));
chk('three tab buttons carry the server tab sizes (kpis.tabs)', tabs.length === 3 && tabs[0].endsWith(String(jk.tabs.active)) && tabs[1].endsWith(String(jk.tabs.awaiting)) && tabs[2].endsWith(String(jk.tabs.archive)), { tabs, tabsSrv: jk.tabs });
// the browser's own copy is made wrong; the screen has to show the server's answer where legacy's arithmetic would differ
s = await ev((a) => { const m = FL_MAINT.find((x) => x.id === a.p); m.status = 'done'; const memos = FL_MEMOS.splice(0, FL_MEMOS.length); flRenderMaint(); const text = document.getElementById('fl-maint-pink-wrap').innerText.replace(/\s+/g, ' '); maintSetArchive('awaiting'); const aw = Array.from(document.querySelectorAll('#fl-maint-pink-wrap [onclick^="flSelMaint"]')).map((e) => e.innerText.replace(/\s+/g, ' ')).join(' | '); Array.prototype.push.apply(FL_MEMOS, memos); m.status = 'pending'; maintSetArchive('active'); return { text, aw }; }, { p: jPend });
chk('browser copy made wrong (a pending job turned done): the strip still shows the server pending / active counts', s.text.includes(jk.pending + ' pending') && s.text.includes(jk.active + ' active'), { t: s.text.slice(0, 300) });
chk('Awaiting Invoice list = the server ids (the job whose memo is not paid), whatever the browser memos say (legacy would list both jobs with no memos)', s.aw.includes('F4 awaiting invoice job') && !s.aw.includes('F4 paid job'), { aw: s.aw });
const awJobs = (await api('/v1/fleet/jobs?awaiting_invoice=true')).jobs.map((j) => j.id);
chk('server list ?awaiting_invoice=true = kpis.awaiting_invoice_job_ids', JSON.stringify(awJobs) === JSON.stringify(jk.awaiting_invoice_job_ids) && awJobs[0] === jAwait, { awJobs, ids: jk.awaiting_invoice_job_ids });

item(2, 'the strip follows a write: pay the memo, the job leaves "Awaiting Invoice"');
let c1 = calls.length;
await post('/v1/fleet/memos/' + mAwait.id + '/approve', { approved_by: 'Walk' }); await post('/v1/fleet/memos/' + mAwait.id + '/pay', { paid_date: TD });
await ev(() => laOps.wrote('walk-test')); await ev(() => flRenderMaint()); await settle(1500);
const jk2 = (await api('/v1/fleet/jobs')).kpis;
chk('the screen asked the server again for the strip after the write', calls.slice(c1).filter((c) => c === 'GET /v1/fleet/jobs').length >= 1, calls.slice(c1));
const tabs2 = await ev(() => Array.from(document.querySelectorAll('#fl-maint-pink-wrap button[onclick^="maintSetArchive"]')).map((b) => b.innerText.replace(/\s+/g, ' ').trim()));
chk('Awaiting tab is gone (0 waiting) and Archive still counts the 2 closed jobs', jk2.awaiting_invoice === 0 && tabs2.length === 2 && tabs2[1].endsWith(String(jk2.tabs.archive)), { tabs: jk2.tabs, tabs2 });

item(3, 'Incidents · flRenderIncident draws the server strip (GET /v1/fleet/incidents kpis)');
const ik = (await api('/v1/fleet/incidents')).kpis;
await goto('fl-incident');
t = await wrapText('fl-inc-pink-wrap');
chk('screen: total, active, boats affected / jobs created / damage, avg fix days = the server kpis', new RegExp(ik.total + ' incidents').test(t) && t.includes(ik.active + ' active') && t.includes(`${ik.boats_affected} boats affected · ${ik.jobs_created} jobs created · ฿${ik.damage_total.toLocaleString()} total damage`) && t.includes('avg ' + ik.avg_fix_days + ' days fix'), { t: t.slice(0, 400), ik });
s = await ev(() => { const keep = FL_INCIDENTS.splice(0, FL_INCIDENTS.length); flRenderIncident(); const text = document.getElementById('fl-inc-pink-wrap').innerText.replace(/\s+/g, ' '); Array.prototype.push.apply(FL_INCIDENTS, keep); return text; });
chk('browser copy made wrong (incident list emptied): the strip still shows the server total', new RegExp(ik.total + ' incidents').test(s) && ik.total >= 2, { s: s.slice(0, 200) });

item(4, 'Inventory · flRenderInventory draws the server strip; item.value is the server\'s');
const sk = (await api('/v1/fleet/stock-items')).kpis;
const srvItem = await api('/v1/fleet/stock-items/' + si2.id);
await goto('fl-inventory');
t = await wrapText('fl-inv-pink-wrap');
chk('screen: item count, total value, warehouse split, low stock = the server kpis', t.includes(String(sk.total_items)) && t.includes('฿' + sk.total_value.toLocaleString()) && t.includes(`Tub Lamu (${sk.by_warehouse.tublamu}) · Visit Panwa (${sk.by_warehouse.panwa})`) && (sk.low_stock === 0 || t.includes(sk.low_stock + ' low stock')), { t: t.slice(0, 500), sk });
const tabsI = await ev(() => Array.from(document.querySelectorAll('#fl-inv-pink-wrap button[onclick^="invSwitchTab"]')).map((b) => b.innerText.replace(/\s+/g, ' ').trim()));
chk('the Memorandum tab count = kpis.memos.total', tabsI.length === 2 && tabsI[1].endsWith(String(sk.memos.total)), { tabsI, memos: sk.memos });
const loc = await ev((id) => { const i = FL_INVENTORY.find((x) => x.id === id); return { value: i.value, qty: i.qty }; }, si2.id);
chk('item.value on the browser item = the server value (2 x 250.5 = 501)', loc.value === srvItem.value && srvItem.value === 501, { loc, srv: srvItem.value });
s = await ev((id) => { const i = FL_INVENTORY.find((x) => x.id === id); const q = i.qty; i.qty = 9999; flRenderInventory(); const text = document.getElementById('fl-inv-pink-wrap').innerText.replace(/\s+/g, ' '); i.qty = q; return text; }, si2.id);
chk('browser copy made wrong (qty 9999): the strip value is still the server total', s.includes('฿' + sk.total_value.toLocaleString()), { s: s.slice(0, 300) });

item(5, 'memoAddItem · 409 part_no_required: the server\'s message, then the person picks the part number');
await post('/v1/fleet/stock-items', { name: 'F4 filter', part_no: 'PN-AAA', category: 'general', unit: 'pcs', min_qty: 1, cost: 100, qty: 4, warehouse: 'tublamu' });
const sk2 = await post('/v1/fleet/stock-items', { name: 'F4 filter', part_no: 'PN-BBB', category: 'general', unit: 'pcs', min_qty: 1, cost: 120, qty: 4, warehouse: 'tublamu' });
await reload();
// a line that reached the form with no item chosen (a stale list) and wants auto-registration
await ev(() => { _memoType = 'parts'; _memoScope = 'vessel'; _memoMaintId = null; _memoEditId = null; _memoItems = [{ name: 'F4 filter', qty: 2, price: 100, invId: null, fromInventory: false, autoRegister: true, unit: 'pcs', category: 'parts' }];
  document.getElementById('memo-subject').value = 'F4 filter memo'; memoRenderItems(); });
const direct = await postRaw('/v1/fleet/memos', { no: 'MO-9XX', title: 'probe', memo_type: 'parts', scope: 'general', general_category: 'x', memo_date: TD, lines: [{ name: 'F4 filter', qty: 1, price: 1, category: 'parts', auto_register: true }] });
chk('the server refuses the line: 409 part_no_required listing the candidate items', direct.status === 409 && direct.body.code === 'part_no_required' && direct.body.item_ids.length === 2, direct);
const d0 = dialogs.length;
await ev(() => { flSaveMemo(); }); await idle(); await settle(900);
const al = dialogs.slice(d0).find((d) => d.startsWith('alert'));
chk('the alert is the server\'s text as it is', al && al === 'alert: ' + direct.body.message && /ชื่อ "F4 filter" มีในคลัง 2 รายการ/.test(al), { al, srv: direct.body.message });
s = await ev(() => ({ lines: _memoItems.length, name: document.getElementById('memo-new-name').value, dd: document.getElementById('memo-inv-dropdown').style.display, pns: Array.from(document.querySelectorAll('#memo-inv-dropdown [onmousedown*="memoSelectInv"]')).map((e) => (e.innerText.match(/PN-[A-Z]+/) || [''])[0]).sort() }));
chk('the line goes back to the add row and the picker lists both part numbers', s.lines === 0 && s.name === 'F4 filter' && s.dd === 'block' && JSON.stringify(s.pns) === JSON.stringify(['PN-AAA', 'PN-BBB']), s);
chk('nothing was created by the refused save', (await api('/v1/fleet/memos')).memos.every((m) => m.title !== 'F4 filter memo'), null);
// pick PN-BBB from the dropdown, add the line, save again
await ev((id) => { memoSelectInv(id); document.getElementById('memo-new-qty').value = '2'; memoAddItem(); }, sk2.id);
b1 = bodies.length;
await ev(() => { flSaveMemo(); }); await idle(); await settle(900);
const made = (await api('/v1/fleet/memos')).memos.find((m) => m.title === 'F4 filter memo');
chk('after the pick the memo is created and the line is linked to the chosen item (PN-BBB)', made && made.lines[0].item_id === sk2.id, { made: made && made.lines });
const mb = bodies.slice(b1).find((x) => x[0] === 'POST /v1/fleet/memos');
const mbody = mb && JSON.parse(mb[1]);
chk('the memo body carries no computed field (no amount, subtotal, discount total, status, value, kpis)', mbody && !['amount', 'subtotal', 'after_discount', 'discount', 'vat', 'status', 'value', 'kpis'].some((k) => k in mbody), mbody && Object.keys(mbody));

item(6, 'moLiveLegacyDisc / moLiveTotals · the memo\'s totals are the server\'s');
const mq = await mkMemo({ memo_type: 'mixed', lines: [{ name: 'F4 labour zero qty', qty: 0, price: 500, category: 'labor' }, { name: 'F4 part', qty: 2, price: 100, discount_pct: 10, category: 'parts', auto_register: false }], discount_pct: 5, discount_amt: 20 });
if (!mq || !mq.id) console.log('   MEMO FAILED', JSON.stringify(mq).slice(0, 300));
await reload();
const mqs = await api('/v1/fleet/memos/' + mq.id);
s = await ev((id) => { const mo = FL_MEMOS.find((x) => x.id === id); const T = moLiveTotals(mo, mo.items.map((i) => Object.assign({}, i))); const legacySub = mo.items.reduce((a, i) => a + (+i.qty || 0) * (+i.price || 0), 0); mo.discount = 777; const lump = moLiveLegacyDisc(mo); mo.discount = 0; return { T, legacySub, lump }; }, mq.id);
chk('unedited memo: moLiveTotals = the server totals; legacy arithmetic would give another subtotal (a qty 0 line counts 0 there, 1 on the server)', s.T.total === mqs.amount && s.T.sub === mqs.subtotal && s.T.discTotal === mqs.discount && s.T.afterDisc === mqs.after_discount && s.T.vat === mqs.vat && s.legacySub !== mqs.subtotal, { T: s.T, srv: [mqs.subtotal, mqs.discount, mqs.after_discount, mqs.vat, mqs.amount], legacySub: s.legacySub });
chk('a server memo has no lump discount in the browser (the server holds it as discount_amt), even with a stray local discount figure', s.lump === 0, s);
b1 = bodies.length;
await ev((id) => { moLiveStart(id); moLiveSet(1, 'qty', 5); }, mq.id);
s = await ev(() => document.getElementById('molive-total') ? document.getElementById('molive-total').innerText.replace(/\s+/g, ' ') : '');
chk('while typing, the preview shows a total (legacy formula on the typed lines)', /รวมทั้งสิ้น/.test(s), { s });
await ev(() => { moLiveSave(); }); await idle(); await settle(900);
const pb = bodies.slice(b1).find((x) => x[0] === 'PATCH /v1/fleet/memos/' + mq.id);
const pbody = pb && JSON.parse(pb[1]);
const mqs2 = await api('/v1/fleet/memos/' + mq.id);
chk('Save: PATCH carries lines only (no totals, no discount figure)', pbody && Object.keys(pbody).join() === 'lines', pbody && Object.keys(pbody));
s = await ev((id) => FL_MEMOS.find((x) => x.id === id).amount, mq.id);
chk('after Save the browser memo carries the server\'s new total', s === mqs2.amount && mqs2.amount !== mqs.amount, { scr: s, srv: mqs2.amount, before: mqs.amount });

item(7, 'agents · ctDaysUntilExpiry / ctIsExpiringSoon / ctIsExpired / ctCountExpiringAgents are the server\'s');
const mkAg = async (name, end) => { const a = await post('/v1/agents', { name, market_id: 'ru', pay_type: 'cot', vat_mode: 'none', rate_type_id: 'rt001', create_anyway: true, company: { legal_name: name + ' Co', address: '1 Test Rd' } }); const r = await postRaw('/v1/agents/' + a.id + '/renew', { version: 'v2027-1', start: day(-300), end }); if (r.status >= 400) console.log('   RENEW FAILED', JSON.stringify(r.body).slice(0, 200)); return a.id; };
const agSoon = await mkAg('F4 Soon Agent', day(10)), agEdge = await mkAg('F4 Edge Agent', TD), agGone = await mkAg('F4 Gone Agent', day(-5)), agFar = await mkAg('F4 Far Agent', day(100));
await reload();
const lst = await api('/v1/agents?active=all');
const by = (id) => lst.agents.find((a) => a.id === id);
const clock = [agSoon, agEdge, agGone, agFar].map((id) => [by(id).contract_days_left, by(id).contract_expiring, by(id).contract_expired]);
chk('the server list carries the clock: 10 days (expiring), 0 (expiring), -5 (expired), 100 (neither)', JSON.stringify(clock) === JSON.stringify([[10, true, false], [0, true, false], [-5, false, true], [100, false, false]]), clock);
const want = JSON.stringify(clock);
s = await ev((ids) => ids.map((id) => { const a = SB_AGENTS.find((x) => x.id === id); return [ctDaysUntilExpiry(a), ctIsExpiringSoon(a), ctIsExpired(a)]; }), [agSoon, agEdge, agGone, agFar]);
chk('screen functions return the server\'s days / expiring / expired', JSON.stringify(s) === want, s);
s = await ev((ids) => { const real = window.TODAY_STR; window.TODAY_STR = '2031-01-01'; const r = ids.map((id) => { const a = SB_AGENTS.find((x) => x.id === id); return [ctDaysUntilExpiry(a), ctIsExpiringSoon(a), ctIsExpired(a)]; }); window.TODAY_STR = real; return r; }, [agSoon, agEdge, agGone, agFar]);
chk('browser clock made wrong (TODAY_STR 2031): the answers do not move, they are not worked out in the browser', JSON.stringify(s) === want, s);
s = await ev(() => { agUpdateExpiringBadge(); const b = document.querySelector('.nav-item[data-view="agents"] .ct-nav-badge'); return { count: ctCountExpiringAgents(), badge: b ? b.textContent : null }; });
chk('badge count = expiring_count of the list (counted by the server over every agent)', s.count === lst.expiring_count && String(s.badge) === String(lst.expiring_count) && lst.expiring_count >= 3, { s, srv: lst.expiring_count });
s = await ev(() => laOps.contractClock && laOps.contractClock.get());
chk('the list\'s expiring_count was kept by the adapter', s === lst.expiring_count, { s, srv: lst.expiring_count });
const wrong = await postRaw('/v1/agents', { name: 'F4 wrong', contract_days_left: 5 });
const wrongP = await postRaw('/v1/agents/' + agFar, { contract_expired: true }, 'PATCH');
chk('a wrong value sent to the server is refused (400), not applied', wrong.status === 400 && wrongP.status === 400, { c: wrong.status, p: wrongP.status });

item(9, 'duplicate scan · laDupScan and laDupKind take the report of the server (GET /v1/fleet/duplicates)');
await goto('fl-cost'); await settle(800);
const dsrv = await api('/v1/fleet/duplicates');
s = await ev(() => { const keep = FL_MEMOS.slice(); FL_MEMOS.push(Object.assign({}, FL_MEMOS[0], { id: 'copy_of_first' })); const D = laDupScan(); const memo = D.sets.find((x) => x.k === 'memo'); const out = { extra: memo.extra, nDup: D.nDup }; FL_MEMOS.length = 0; keep.forEach((m) => FL_MEMOS.push(m)); return out; });
chk('browser copy made wrong (a memo duplicated locally): the scan still counts 0 copies of the server', dsrv.copies_extra === 0 && s.extra === 0, { s, srv: dsrv.copies_extra });
const m0 = await api('/v1/fleet/memos'); const two = m0.memos.slice(0, 2);
fakeDup = { numbers: [{ kind: 'memo', label: 'memo', total: 9, extra: 1, groups: [{ no: 'MO-077', kind: 'stage', diff: ['status'], can_drop: false, members: two.map((m) => ({ id: m.id, no: 'MO-077', status: m.status })) }] },
  { kind: 'job', label: 'job', total: 4, extra: 0, groups: [] }, { kind: 'incident', label: 'incident', total: 2, extra: 0, groups: [] }],
  copies: [{ kind: 'memo', label: 'memo', total: 9, extra: 0, groups: [] }, { kind: 'job', label: 'job', total: 4, extra: 2, groups: [{ no: 'MJ-1', name: 'MJ-1 · x', keep_id: 'j1', drop_ids: ['j2', 'j3'], members: [] }] }, { kind: 'incident', label: 'incident', total: 2, extra: 0, groups: [] }], numbers_extra: 1, copies_extra: 2 };
await ev(() => laOps.wrote('walk-test')); await ev(() => laDupScan()); await settle(1200);
s = await ev((ids) => { const D = laDupScan(); const kind = laDupKind(ids.map((id) => FL_MEMOS.find((m) => m.id === id))); return { maint: D.sets.find((x) => x.k === 'maint').extra, memo: D.sets.find((x) => x.k === 'memo').extra, noMemo: D.nums.find((x) => x.k === 'noMemo').extra, nDup: D.nDup, nNo: D.nNo, kind }; }, two.map((m) => m.id));
chk('job copies 2 (maint set), memo numbers 1 (noMemo), totals follow; legacy saw none', s.maint === 2 && s.memo === 0 && s.noMemo === 1 && s.nDup >= 2 && s.nNo >= 1, s);
chk('laDupKind gives the kind of the server and differing fields for that group (stage / status), not the comparison of the browser', s.kind && s.kind.kind === 'stage' && JSON.stringify(s.kind.diff) === '["status"]', s.kind);
fakeDup = null;

item(8, 'no computed field in any request made through the screens');
const computedKeys = ['kpis', 'invoice_pending', 'awaiting_invoice_job_ids', 'value', 'total_value', 'contract_days_left', 'contract_expiring', 'contract_expired', 'expiring_count', 'subtotal', 'after_discount'];
const badBodies = bodies.filter((b) => b[1] && /^(POST|PATCH|PUT)/.test(b[0]) && (() => { try { const j = JSON.parse(b[1]); return computedKeys.some((k) => k in j); } catch (_) { return false; } })());
chk('requests made by the screens carry none of: ' + computedKeys.join(', '), badBodies.length === 0, badBodies.map((b) => b[0]));

console.log('\nserver refusals the app received (' + refusals.length + '):\n  ' + refusals.join('\n  '));
console.log('\npage errors: ' + errors.length + '\n  ' + errors.slice(0, 10).join('\n  '));
console.log('\nSUMMARY');
for (const n of Object.keys(findings)) { const f = findings[n]; console.log(` item ${n}: ${f.filter((x) => x[1]).length}/${f.length} ok` + f.filter((x) => !x[1]).map((x) => '\n     FAIL ' + x[0]).join('')); }
await browser.close(); srv.close(); backend.kill();
process.exit(fails.length || errors.length ? 1 : 0);
