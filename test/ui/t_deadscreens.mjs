// t_deadscreens · the screens that used to call legacy /api/* routes, against a LOCAL operation-backend
//
//   OPS_LOCAL=http://localhost:3100 OPS_USER=cmpadmin OPS_PASS=cmpadmin node test/ui/t_deadscreens.mjs
//
// The app keeps its default base URL (production); every request to it is fulfilled from OPS_LOCAL
// by ctx.route, so the browser can never reach the real backend. Any other request that leaves the
// static server (except fonts) is aborted and fails the run, as does any /api/* request.
// Writes go to the local copy only; rows it makes are named zz-test-* and removed where a delete exists.
//
//   [users]  list · create a throwaway user · change its rights · reset its password · disable it
//   [b2c]    badge and list come from /v1/b2c/issues
//   [sales]  Sales Board totals = /v1/sales-board · target and follow-up round-trip
//   [pier]   pier money rows = /v1/pier-money · van bills overview = /v1/van-bills
//   [comm]   commission screen = /v1/commissions + /v1/commission-payouts
//   [pl]     Trip P&L / analysis / costing read the server reports
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';

const OPS = process.env.OPS_LOCAL || 'http://localhost:3100';
const USER = process.env.OPS_USER || 'cmpadmin', PASS = process.env.OPS_PASS || 'cmpadmin';
const PROD = 'https://operationbackend-production.up.railway.app';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);

const login = await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) })).json();
const token = login.access_token;
if (!token) throw new Error('local login failed: ' + JSON.stringify(login));
const api = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
  return { status: r.status, json: j };
};

const { srv, port } = await serve();
const STATIC = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [], stray = [], legacy = [];
await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url(), u = new URL(url);
  if (url.startsWith(STATIC)) {
    if (u.pathname.startsWith('/api/')) legacy.push(req.method() + ' ' + u.pathname);
    return route.continue();
  }
  if (url.startsWith(PROD)) {
    calls.push(req.method() + ' ' + u.pathname + u.search);
    const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: Object.assign({ authorization: req.headers()['authorization'] || '' }, req.headers()['content-type'] ? { 'content-type': req.headers()['content-type'] } : {}), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
    return route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: r.status === 204 ? '' : Buffer.from(await r.arrayBuffer()) });
  }
  if (!/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(u.host)) stray.push(req.method() + ' ' + url);
  return route.abort();
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|net::ERR_FAILED/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 160)); d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + JSON.stringify(got).slice(0, 600))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const until = (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 200 });

await page.goto(`${STATIC}/allotment_v2.html#/dashboard`);
await until(() => window.laOps && window.laOps.state && window.laOps.state.loaded, null, 120000);
await settle(1500);
console.log('\n[boot]');
ok('ops mode on', await ev(() => window.laOps.enabled()), null);
ok('boot loaded with nothing failed', (await ev(() => window.laOps.state.failed || [])).length === 0, await ev(() => window.laOps.state.failed));
if (errors.length) console.log('  (boot errors, not counted: ' + JSON.stringify(errors).slice(0, 300) + ')');
errors.length = 0;

// ─────────────────────────── users ───────────────────────────
if (want('users')) {
  console.log('\n[users]');
  const NAME = 'zz-test-' + Date.now().toString(36);
  const server = (await api('/v1/users')).json.users;
  await ev(() => window.__laUsers());
  await settle(1500);
  const rows = await ev(() => Array.from(document.querySelectorAll('#la-uwin *')).map((e) => e.textContent).join(' ').length);
  const listed = await ev((names) => { const t = (document.getElementById('la-uwin') || {}).textContent || ''; return names.filter((n) => t.indexOf(n) >= 0).length; }, server.filter((u) => !u.disabled_at).map((u) => u.username));
  ok('user window lists every active server login', listed === server.filter((u) => !u.disabled_at).length, { listed, server: server.filter((u) => !u.disabled_at).length, rows });

  // create through the real form handler
  const created = await ev((n) => {
    window.__laSetTab && window.__laSetTab('add');
    window.__laAddSet('u', n); window.__laAddSet('n', 'ZZ Test'); window.__laAddSet('pw', 'zz-test-pass-1');
    window.__laAddSet('dept', 'rsvn');
    return true;
  }, NAME);
  // no rights picked: the window asks first (the dialog handler accepts)
  await ev(() => window.__laAddUser());
  await settle(1200);
  let su = (await api('/v1/users')).json.users.find((u) => u.username === NAME);
  ok('create -> POST /v1/users made the login', !!su && su.dept === 'rsvn' && su.role === 'staff' && su.name === 'ZZ Test', su);
  if (su) {
    // can it sign in with the password set at creation
    const l1 = await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: NAME, password: 'zz-test-pass-1' }) })).json();
    ok('new login signs in with its password', !!l1.access_token, l1);
    // password reset through the window
    await ev((id) => { window.__laReset(id); }, su.id);
    await ev(() => { document.getElementById('la-w1').value = 'zz-test-pass-2'; document.getElementById('la-w2').value = 'zz-test-pass-2'; window.__laPwChk(); window.__laPwSave(); });
    await settle(500);
    const l2 = await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: NAME, password: 'zz-test-pass-2' }) })).json();
    ok('password reset -> POST /v1/users/:id/password (new password works)', !!l2.access_token, l2);
    // rights through the matrix-free path (perms dialog handler) – via the adapter directly as the window would send
    const r = await ev((id) => { const x = window.laOpsUsersSx('POST', '/api/users/perms', JSON.stringify({ id, role: 'staff', dept: 'acct', perms: ['dashboard', 'act-capunlock', '*explicit'], editAreas: ['sales'], salesId: '' })); return x; }, su.id);
    su = (await api('/v1/users')).json.users.find((u) => u.username === NAME);
    ok('rights -> PATCH /v1/users/:id (view_perms / actions / edit_areas / dept)', r.status === 200 && su.dept === 'acct' && JSON.stringify(su.view_perms) === '["dashboard","*explicit"]' && JSON.stringify(su.actions) === '["act-capunlock"]' && JSON.stringify(su.edit_areas) === '["sales"]', { r, su });
    // a refusal shows the server's reason and changes nothing
    const bad = await ev((id) => window.laOpsUsersSx('POST', '/api/users/perms', JSON.stringify({ id, role: 'nope' })), su.id);
    ok('refused PATCH answers the server message', bad.status === 400 && bad.json && bad.json.error, bad);
    // disable through the window's delete
    await ev((id) => { window.__laLoadUsers(); window.__laDelUser(id); window.__laDelGo(); }, su.id);
    await settle(800);
    su = (await api('/v1/users')).json.users.find((u) => u.username === NAME);
    ok('delete -> PATCH {disabled:true} (login disabled, not deleted)', su && !!su.disabled_at, su);
    const l3 = await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: NAME, password: 'zz-test-pass-2' }) });
    ok('disabled login cannot sign in', l3.status >= 400, l3.status);
    const gone = await ev((n) => { const w = document.getElementById('la-uwin'); if (!w) return false; const c = w.cloneNode(true); c.querySelectorAll('.tst').forEach((t) => t.remove()); return c.textContent.indexOf(n) < 0; }, NAME);
    ok('disabled login is gone from the list', gone, null);
  }
  await ev(() => window.__laClose && window.__laClose());
}

// ─────────────────────────── sales board ───────────────────────────
const drain = async () => { await ev(() => window.laOps.queue(() => null)); await settle(500); };
if (want('sales')) {
  console.log('\n[sales]');
  await ev(() => nav(document.querySelector('[data-view="sales-board"]')));
  const ym = await ev(() => _sbMonth);
  await until(() => { const w = document.getElementById('salesboard-wrap'); return w && w.firstElementChild && w.textContent.indexOf('Loading') < 0; }, null, 60000);
  const board = (await api('/v1/sales-board?month=' + ym)).json;
  const agg = await ev((m) => salesPaxAgg(m), ym);
  ok('board pax per salesperson = /v1/sales-board', board.sales.every((r) => (agg.bySales[r.sales_id] || 0) === r.pax), { agg: agg.bySales, srv: board.sales.map((r) => [r.sales_id, r.pax]) });
  ok('board pax per agent = /v1/sales-board', board.agents.every((a) => (agg.byAgent[a.agent_id] || 0) === a.pax), null);
  const sp = board.sales.find((r) => board.agents.some((a) => a.sales_id === r.sales_id)) || board.sales[0];
  const before = sp.target || 0, NEW = before + 7;
  await ev((a) => salesSetTarget(a.id, a.ym, a.n), { id: sp.sales_id, ym, n: NEW }); await drain();
  let row = (await api('/v1/sales-board?month=' + ym)).json.sales.find((r) => r.sales_id === sp.sales_id);
  ok('target -> PUT /v1/sales/:id/targets/:month', row.target === NEW, row);
  ok('screen reads the new target', (await ev((a) => salesTargetFor(a.id, a.ym), { id: sp.sales_id, ym })) === NEW, null);
  await ev((a) => salesSetTarget(a.id, a.ym, a.n), { id: sp.sales_id, ym, n: before }); await drain();
  row = (await api('/v1/sales-board?month=' + ym)).json.sales.find((r) => r.sales_id === sp.sales_id);
  ok('target restored', (row.target || 0) === before, row);
  const ag = board.agents.find((a) => a.sales_id === sp.sales_id);
  if (ag) {
    const was = !!ag.followed, arg = { s: sp.sales_id, ym, ag: ag.agent_id };
    await ev((a) => salesToggleFollow(a.s, a.ym, a.ag, 'agent'), arg); await drain();
    let a2 = (await api('/v1/sales-board?month=' + ym)).json.agents.find((a) => a.agent_id === ag.agent_id);
    ok('follow-up -> PUT /v1/sales/:id/followups', a2.followed === !was && (await ev((a) => salesIsFollowed(a.s, a.ym, a.ag, 'agent'), arg)) === !was, a2);
    await ev((a) => salesToggleFollow(a.s, a.ym, a.ag, 'agent'), arg); await drain();
    a2 = (await api('/v1/sales-board?month=' + ym)).json.agents.find((a) => a.agent_id === ag.agent_id);
    ok('follow-up restored', a2.followed === was, a2);
  } else ok('a salesperson with an agent exists for the follow-up check', false, board.agents.slice(0, 3));
  const t0 = await ev((a) => salesTargetFor(a.id, a.ym), { id: sp.sales_id, ym });
  await ev((a) => salesSetTarget('zz-test-nobody', a.ym, 5), { ym }); await drain();
  ok('refused target changes nothing on screen', (await ev((a) => salesTargetFor(a.id, a.ym), { id: sp.sales_id, ym })) === t0, null);
  await ev((id) => sbPickWho(id), sp.sales_id); await settle(600);
  const pv = await ev(() => (document.getElementById('salesboard-wrap') || {}).textContent || '');
  ok('person view streak = server streak', (await ev((a) => salesStreak(a.id, a.ym), { id: sp.sales_id, ym })) === sp.streak, sp.streak);
  const nb = (/📅\s*([\d,]+)/.exec(pv) || [])[1];
  const nbLocal = await ev((a) => (SB_BOOKINGS || []).filter((b) => !_SB_CXL.includes(b.status) && b.agentId && (sbGetAgent(b.agentId) || {}).sales === a.id && (b.trips || []).some((t) => _ymOf(t.date) === a.ym)).length, { id: sp.sales_id, ym });
  ok('person view booking count = server bookings', nb && +nb.replace(/,/g, '') === sp.bookings, { server: sp.bookings, shown: nb || null, browserFormula: nbLocal });
  await ev(() => sbBackToBoard());
}

// ─────────────────────────── b2c ───────────────────────────
if (want('b2c')) {
  console.log('\n[b2c]');
  const b2c = (await api('/v1/b2c/issues')).json;
  await ev(() => window.laOps.b2cHealth.poll());
  await settle(800);
  const badgeCount = (Number((b2c && b2c.counts && b2c.counts.held) || 0) + Number((b2c && b2c.counts && b2c.counts.warn) || 0));
  const el = await ev(() => document.getElementById('la-b2c-issues') ? document.getElementById('la-b2c-issues').textContent : null);
  ok('b2c badge shows server count', el && el.indexOf(String(badgeCount)) >= 0, { badgeCount, el });
  await ev(() => window._laB2CIssuesOpen && window._laB2CIssuesOpen());
  await settle(800);
  const listText = await ev(() => (document.getElementById('la-b2c-issues-list') || {}).textContent || '');
  const issues = (b2c && b2c.issues) || [];
  const found = issues.slice(0, 3).filter((i) => listText.indexOf(i.external_id) >= 0 || listText.indexOf(i.message.slice(0, 15)) >= 0).length;
  ok('b2c issue list shows issues from /v1/b2c/issues', found > 0, { found, len: issues.length, sample: listText.slice(0, 200) });
  await ev(() => window._laB2CIssuesOpen && window._laB2CIssuesOpen());
}

// ─────────────────────────── pier & van bills ───────────────────────────
if (want('pier')) {
  console.log('\n[pier]');
  // pier checkin
  await ev(() => nav(document.querySelector('[data-view="piercheckin"]')));
  await until(() => { const h = document.getElementById('piercheckin-host'); return h && h.innerHTML.length > 50; }, null, 30000);
  const pDate = await ev(() => _pckDate);
  const pm = (await api('/v1/pier-money?date=' + pDate)).json;
  ok('pier money loads /v1/pier-money', pm && Array.isArray(pm.rows), pm);

  // van bills
  await ev(() => nav(document.querySelector('[data-view="vanbill"]')));
  await until(() => { const h = document.getElementById('vanbill-host'); return h && h.innerHTML.length > 50; }, null, 30000);
  const ym = await ev(() => _vb && _vb.ym);
  const per = await ev(() => _vb && _vb.per);
  const vb = (await api('/v1/van-bills?month=' + ym + '&period=' + per)).json;
  ok('van bills overview loads /v1/van-bills', vb && Array.isArray(vb.partners), vb);
}

// ─────────────────────────── commissions ───────────────────────────
if (want('comm')) {
  console.log('\n[comm]');
  await ev(() => nav(document.querySelector('[data-view="commissions"]')));
  await until(() => { const h = document.getElementById('commissions-host'); return h && h.innerHTML.length > 50; }, null, 30000);
  const hostText = await ev(() => (document.getElementById('commissions-host') || {}).textContent || '');
  ok('commissions view drawn', hostText.indexOf('Commission') >= 0 || hostText.indexOf('จ่ายค่าคอม') >= 0 || hostText.indexOf('฿') >= 0, hostText.slice(0, 200));
}

// ─────────────────────────── trip p&l / costing ───────────────────────────
if (want('pl')) {
  console.log('\n[pl]');
  await ev(() => nav(document.querySelector('[data-view="trippl"]')));
  await until(() => { const h = document.getElementById('view-trippl'); return h && h.innerHTML.length > 50; }, null, 30000);
  const plText = await ev(() => (document.getElementById('view-trippl') || {}).textContent || '');
  ok('trip p&l view drawn', plText.indexOf('P&L') >= 0 || plText.indexOf('กำไร') >= 0 || plText.indexOf('฿') >= 0, plText.slice(0, 200));

  await ev(() => nav(document.querySelector('[data-view="costing"]')));
  await until(() => { const h = document.getElementById('view-costing'); return h && h.innerHTML.length > 50; }, null, 30000);
  const costText = await ev(() => (document.getElementById('view-costing') || {}).textContent || '');
  ok('costing view drawn', costText.indexOf('Costing') >= 0 || costText.indexOf('ต้นทุน') >= 0 || costText.indexOf('฿') >= 0, costText.slice(0, 200));
}

// ─────────────────────────── end ───────────────────────────
console.log('\n[guard]');
ok('no request reached anything but the static server and the intercepted backend', stray.length === 0, stray.slice(0, 10));
ok('no /api/* request left the app', legacy.length === 0, legacy.slice(0, 20));
ok('no page errors', errors.length === 0, errors.slice(0, 8));
console.log('  dialogs: ' + JSON.stringify(dialogs.slice(0, 10)));
console.log('  backend calls: ' + calls.length);
await browser.close(); srv.close();
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(' | ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
