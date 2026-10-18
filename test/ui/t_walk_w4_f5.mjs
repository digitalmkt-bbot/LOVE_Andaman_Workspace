// t_walk_w4_f5 · wave 4 group F5: the Van Job Orders LIST band (hero numbers, jobs, warnings, order, expanded panel), the overnight
// charter hold on every screen, pjBoatSt's ovn state, ckHasArrange (aboard.has_arrange || legacy), against a REAL operation-backend
// (in-process store). The sheet itself is walked by t_walk_vanjobs.mjs.
//
//   node test/ui/t_walk_w4_f5.mjs        (OPS_BACKEND_DIR, default D:/projects/operation-backend)
import { serve } from './_harness.mjs';
import { seedVanJobs, D } from './_vanjobs_seed.mjs';
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

const seeded = await seedVanJobs(send);

// an overnight charter (Q39): b13 out on r10 for 3 nights
const OV = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];
for (const d of [OV[0], OV[3]]) await seed('POST', '/operations/deployments', { boat_id: 'b13', route_id: 'r10', service_date: d, capacity: 38, deploy_anyway: true });
const ovnBk = await seed('POST', '/v1/bookings', { external_id: 'b2c_f5_ovn', total: 9000, leadPax: 'F5 OVERNIGHT', leadNationality: 'RU', leadPhone: '+7 900 1', pickupSelf: true,
  trips: [{ routeId: 'r10', date: OV[0], pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13', ovn: 'return', ovnReturnDate: OV[3] },
          { routeId: 'r10', date: OV[3], pax: { ad_fr: 2 }, zone: 'NoTransfer', bookingMode: 'charter', charterBoatId: 'b13', ovnLeg: true, ovnOf: 0 }] });

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
  calls.push({ m: req.method(), p: u.pathname + u.search, status: r.status, req: body });
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const errors = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\/|fonts\.g/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => d.accept());

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 700))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 10000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1000);

// ═══ 1 · the Van Job Orders list ═══
const legacyKey = (j) => `${j.van_id}~${j.route_id}` + (j.round && j.round.of > 1 ? '~' + j.group_number : '');
const listShot = () => ev(() => {
  const host = document.getElementById('vanjobs-host'); if (!host) return null;
  const rows = [...host.querySelectorAll('tbody tr[onclick^="vanJobsOpenPreview"]')].map((tr) => {
    const k = /vanJobsOpenPreview\('([^']+)'\)/.exec(tr.getAttribute('onclick'))[1];
    const td0 = tr.children[0], t0 = td0.innerText.replace(/\s+/g, ' ').trim();
    const m = /(\d+)\/(\d+|\?)\s*$/.exec(t0);
    return { key: k, name: td0.querySelector('div > div > div').firstChild.textContent.trim(), pax: m ? +m[1] : -1, cap: m ? m[2] : '', over: /เกินจุ/.test(tr.innerText), round: (/รอบ (\d+)\/(\d+)/.exec(t0) || []).slice(1).map(Number),
      retBadge: (/↩ ขากลับ (\d+)/.exec(t0) || [])[1] || null, struck: (/ค้าง (\d+)/.exec(t0) || [])[1] || null, driver: tr.children[2].innerText.replace(/\s+/g, ' ').trim(), sent: tr.children[7].innerText.trim() };
  });
  const txt = host.innerText.replace(/\s+/g, ' ');
  const hero = host.querySelector('[style*="border-radius:14px"][style*="color:#fff"]');
  return { rows, hero: hero ? hero.innerText.replace(/\s+/g, ' ').trim() : '', count: +((/ใบงานวันนี้ (\d+) งาน/.exec(txt) || [])[1] || -1), totPax: +((/งาน · (\d+) pax/.exec(txt) || [])[1] || -1),
    unNote: (/(\d+) pax ยังไม่จัด/.exec(txt) || [])[1] || null, sx: (/ค้างจัดการ (\d+)/.exec(txt) || [])[1] || null, selfWarn: /เช็ค self-arrive/.test(txt), retWarn: /ต้องจัดรถกลับ/.test(txt), text: txt };
});
const openList = async (date) => {
  await ev((d) => { _vanJobsDate = d; const el = document.querySelector('.nav-item[data-view="vanjobs"]'); if (el) nav(el); renderVanJobs(); }, date);
  await waitFor(() => document.querySelector('#vanjobs-host tbody tr[onclick^="vanJobsOpenPreview"]'), null, 20000);
  await settle(2200);
};

console.log('\n[1] Van Job Orders list: jobs, pax / seats, rounds, order, hero numbers, warnings = the server\'s day read');
const mark = calls.length;
await openList(D);
const day = await api('/operations/van-jobs?date=' + D);
let shot = await listShot();
const srvRows = day.jobs.map((j) => ({ key: legacyKey(j), pax: j.pax, cap: String(j.van.capacity || '?'), name: j.van.name }));
ok('the list has one row per server job, in the server\'s order (return-only jobs last)', eq(shot.rows.map((r) => r.key), srvRows.filter((r) => day.jobs.find((j) => legacyKey(j) === r.key).has_out || !day.jobs.find((j) => legacyKey(j) === r.key).has_ret).map((r) => r.key).concat(srvRows.filter((r) => { const j = day.jobs.find((x) => legacyKey(x) === r.key); return !j.has_out && j.has_ret; }).map((r) => r.key))), { screen: shot.rows.map((r) => r.key), server: srvRows.map((r) => r.key) });
ok('every row shows the server\'s van name and "pax / seats"', shot.rows.every((r) => { const s = srvRows.find((x) => x.key === r.key); return s && r.name === s.name && r.pax === s.pax && r.cap === s.cap; }), { screen: shot.rows.map((r) => [r.name, r.pax, r.cap]), server: srvRows.map((r) => [r.name, r.pax, r.cap]) });
const alpha1 = day.jobs.find((j) => j.van_id === seeded.vanAlpha.id && j.round && j.round.no === 1);
ok('the guide riding along counts in the row\'s pax (server job.pax = customers + stop seats), not only the customers', alpha1.stop_seats === 1 && alpha1.pax === alpha1.out_pax + 1 && shot.rows.find((r) => r.key === legacyKey(alpha1)).pax === alpha1.pax, { alpha1: { pax: alpha1.pax, out: alpha1.out_pax, stops: alpha1.stop_seats } });
ok('round tags: the screen says "รอบ n/of" (with the time) for the van that runs twice, nothing for the others', shot.rows.every((r) => { const j = day.jobs.find((x) => legacyKey(x) === r.key); return j.round ? eq(r.round, [j.round.no, j.round.of]) : r.round.length === 0; }), shot.rows.map((r) => [r.key, r.round]));
ok('driver column = server job.driver.name', shot.rows.every((r) => { const j = day.jobs.find((x) => legacyKey(x) === r.key); return r.driver.startsWith(j.driver.name || '—'); }), shot.rows.map((r) => r.driver));
ok('the count line "N งาน · M pax" = the server\'s jobs and their outbound pax', shot.count === day.jobs.filter((j) => j.has_out || !j.has_ret).length && shot.totPax === day.jobs.filter((j) => j.has_out || !j.has_ret).reduce((s, j) => s + j.pax, 0), { shot: [shot.count, shot.totPax], day: day.jobs.length });
ok('hero (red): "N pax ยังไม่จัด" = server unassigned.pax and the programme line names the server\'s route', day.unassigned.pax > 0 && shot.unNote === String(day.unassigned.pax) && shot.hero.includes(String(day.unassigned.pax) + ' pax'), { hero: shot.hero, un: day.unassigned });
ok('"ค้างจัดการ N" = server struck (the cancelled booking still in its group); the van carrying it has the "ค้าง" badge', day.struck >= 1 && shot.sx === String(day.struck) && shot.rows.some((r) => r.struck === '1'), { sx: shot.sx, struck: day.struck, rows: shot.rows.map((r) => r.struck) });
const retBadgeBefore = shot.rows.filter((r) => r.retBadge).map((r) => r.key);
ok('the return-from-another-van badge needs the sheet: none yet (MISSING-SERVER-FIELD ret_extra_*)', retBadgeBefore.length === 0, retBadgeBefore);
ok('nothing was written to open the list (only reads)', calls.slice(mark).every((c) => c.m === 'GET'), calls.slice(mark).filter((c) => c.m !== 'GET'));

console.log('\n[2] the server\'s answer, not the browser\'s arithmetic: with every booking taken out of the browser the list is the same');
const before = shot;
const emptied = await ev(() => { window.__bk = SB_BOOKINGS.slice(); SB_BOOKINGS.length = 0; laOps.vanJobs.redraw(); return SB_BOOKINGS.length; });
await settle(300);
const after = await listShot();
ok('with 0 bookings in the browser: same rows, same pax / seats, same hero and warnings', emptied === 0 && eq(after.rows.map((r) => [r.key, r.name, r.pax, r.cap, r.round]), before.rows.map((r) => [r.key, r.name, r.pax, r.cap, r.round])) && after.unNote === before.unNote && after.sx === before.sx && after.count === before.count, { before: before.text.slice(0, 200), after: after.text.slice(0, 200) });
// the legacy walk, run on the same empty browser, shows nothing: proves it is the server that fills the screen
const legacyEmpty = await ev(() => { const f = window.opsVanJobsList; window.opsVanJobsList = null; laOps.vanJobs.redraw(); const n = document.querySelectorAll('#vanjobs-host tbody tr[onclick^="vanJobsOpenPreview"]').length; window.opsVanJobsList = f; return n; });
ok('(control) legacy\'s own walk over the same empty browser draws no job at all', legacyEmpty === 0, legacyEmpty);
await ev(() => { laOps.vanJobs.redraw(); });
ok('and the server\'s rows are back when the hook is back', (await listShot()).rows.length === before.rows.length, null);

console.log('\n[3] the expanded edit panel: the bookings are the sheet\'s rows (also with no booking in the browser)');
const a1key = legacyKey(alpha1);
await ev((k) => { _vanJobsExpand = {}; _vanJobsExpand[k] = true; laOps.vanJobs.redraw(); }, a1key);
await waitFor((k) => document.querySelectorAll('#vanjobs-host input[data-bk]').length > 0, a1key, 15000);
await settle(300);
const sheetA1 = await api(`/operations/van-jobs/${D}/${encodeURIComponent(alpha1.key)}`);
const srvLeads = [...new Set(sheetA1.out.rows.filter((r) => r.kind === 'booking' && !r.struck).map((r) => r.lead_pax))].sort();
const panelLeads = await ev(() => [...document.querySelectorAll('#vanjobs-host input[data-bk]')].map((i) => i.closest('div').querySelector('span').textContent.trim()).sort());
ok('the panel lists the sheet\'s bookings of Van Alpha round 1 (names = server out.rows, once each, struck rows left out)', eq(panelLeads, srvLeads), { panelLeads, srvLeads });
const panelSreq = await ev(() => [...document.querySelectorAll('#vanjobs-host input[data-bk]')].map((i) => [i.closest('div').querySelector('span').textContent.trim(), i.value]));
ok('a stub booking (not in the browser) shows the server\'s special request as the text to edit', panelSreq.some(([n, v]) => n === 'WALK ONE' && v === 'Wait in the lobby'), panelSreq);
await ev(() => { SB_BOOKINGS.length = 0; window.__bk.forEach((b) => SB_BOOKINGS.push(b)); delete window.__bk; _vanJobsExpand = {}; laOps.vanJobs.redraw(); });

console.log('\n[4] a write: the "sent" tick sends no computed field and the list follows the server');
const mark4 = calls.length;
await ev((k) => vanJobsToggleSent(_vanJobsDate, k), a1key);
await waitFor(() => /✓|sent|ส่งแล้ว/.test(document.getElementById('vanjobs-host').innerText), null, 8000);
await settle(1500);
const put = calls.slice(mark4).find((c) => c.m === 'PUT' && /\/sent$/.test(c.p));
ok('PUT …/sent with no body at all (the time and the name are the server\'s)', !!put && put.status === 200 && (put.req === undefined || put.req === ''), put);
const dayAfter = await api('/operations/van-jobs?date=' + D);
ok('server: the job is sent by the login, and the list row shows it', dayAfter.jobs.find((j) => j.key === alpha1.key).sent && dayAfter.jobs.find((j) => j.key === alpha1.key).sent.by, dayAfter.jobs.find((j) => j.key === alpha1.key).sent);

// ═══ 2 · overnight hold on every screen ═══
console.log('\n[5] overnight charter hold: bkOvnHoldMap / bkOvnHoldOn / baCharterBoatMap answer from the server\'s availability rows');
await ev(async (r) => { await bookingV2EnsureOpsRange({ from: r.from, to: r.to, refresh: true }); }, { from: OV[0], to: OV[3] });
await waitFor((id) => SB_BOOKINGS.some((b) => b.opsId === id || b.id === id), ovnBk.id, 15000);
const night = OV[1];
const srvRow = ((await api(`/v1/fleet/availability?from=${night}&to=${night}`)).days || []).find((r) => r.boat_id === 'b13');
ok('server: b13 is held on the middle night (availability row ovn_hold from the 1st to the 4th)', !!srvRow && !!srvRow.ovn_hold && srvRow.ovn_hold.from === OV[0] && srvRow.ovn_hold.to === OV[3], srvRow);
const legacyHas = await ev((n) => { bkOvnHoldMemoClear(); return bkOvnHoldMap.__orig(n).has('b13'); }, night);
ok('legacy\'s own walk agrees while the booking is in the browser', legacyHas === true, legacyHas);
// the booking leaves the browser: legacy would now say "free"
const gone = await ev((id) => { window.__bk2 = SB_BOOKINGS.slice(); const i = SB_BOOKINGS.findIndex((b) => b.opsId === id || b.id === id); if (i >= 0) SB_BOOKINGS.splice(i, 1); bkOvnHoldMemoClear(); return bkOvnHoldMap.__orig('2026-12-02').has('b13'); }, ovnBk.id);
ok('(control) with the booking taken out of the browser legacy\'s walk says b13 is free that night', gone === false, gone);
const mark5 = calls.length;
await ev((n) => { bkOvnHoldMemoClear(); bkOvnHoldMap(n); }, night);   // first ask: legacy answers, the read goes out
await waitFor((n) => laOps.ovnHold.map(n) !== null, night, 15000);
const srvHold = await ev((n) => { bkOvnHoldMemoClear(); const m = bkOvnHoldMap(n), h = m.get('b13'); return h ? { from: h.from, to: h.to, routeId: h.routeId, bkId: h.bkId } : null; }, night);
ok('bkOvnHoldMap: b13 is held 1st to 4th on route r10, booking = the server\'s booking_id (nothing in the browser says so)', srvHold && srvHold.from === OV[0] && srvHold.to === OV[3] && srvHold.routeId === 'r10' && srvHold.bkId === srvRow.ovn_hold.booking_id, srvHold);
const others = await ev((n) => { bkOvnHoldMemoClear(); return { on: !!bkOvnHoldOn('b13', n), onOther: bkOvnHoldOn('b11', n), ch: baCharterBoatMap(n).has('b13') }; }, night);
ok('bkOvnHoldOn and baCharterBoatMap (which sit on it) say the same: held, and a charter boat that night', others.on === true && others.onOther === null && others.ch === true, others);
ok('the read was GET /v1/fleet/availability and nothing was written', calls.slice(mark5).some((c) => c.m === 'GET' && /\/v1\/fleet\/availability/.test(c.p)) && calls.slice(mark5).every((c) => c.m === 'GET'), calls.slice(mark5).map((c) => c.m + ' ' + c.p));
// a night that is not held: the server's map has no entry
const free = await ev(async () => { const d = '2026-12-10'; bkOvnHoldMap(d); await new Promise((r) => setTimeout(r, 1500)); bkOvnHoldMemoClear(); return { has: bkOvnHoldMap(d).size, fresh: laOps.ovnHold.map(d) !== null }; });
ok('a night nobody holds: the server\'s map is empty and fresh', free.fresh && free.has === 0, free);

console.log('\n[6] pjBoatSt: the server\'s state "ovn" wins (no legacy exception)');
const boat13 = (await api('/v1/boats')).boats.find((b) => b.id === 'b13');
const pier = boat13.pier || 'tublamu';
await ev(async (a) => { laOps.pier.dayBoats.want(a.pier, a.d, function () {}); await new Promise((r) => setTimeout(r, 2500)); }, { pier, d: night });
const srvFleet = ((await api(`/v1/pier-office/${pier}/days/${night}/boats`)).fleet || []).find((f) => f.boat_id === 'b13');
const st = await ev((a) => { const b = BOATS.find((x) => x.id === 'b13'); const s = pjBoatSt(a.d, b, null); return { k: s.k }; }, { d: night });
ok('server: the pier board says b13 is "ovn" on the middle night', srvFleet && srvFleet.state === 'ovn', srvFleet);
ok('screen: pjBoatSt(…).k = "ovn" although the browser holds no booking (legacy would say idle)', st.k === 'ovn', st);
await ev(() => { SB_BOOKINGS.length = 0; window.__bk2.forEach((b) => SB_BOOKINGS.push(b)); delete window.__bk2; });

// ═══ 3 · ckHasArrange ═══
console.log('\n[7] ckHasArrange = aboard.has_arrange || legacy');
const hv = await ev(() => {
  const mk = (aboard, ops) => ({ id: 'x', status: 'cancelled', ops, trips: [{ date: '2026-12-20', aboard, aboardDate: '2026-12-20', ops }] });
  return {
    srvYesLocalNo: ckHasArrange(mk({ has_arrange: true }, {}), '2026-12-20'),
    srvNoLocalYes: ckHasArrange(mk({ has_arrange: false }, { vanId: 'veh1' }), '2026-12-20'),
    srvNoLocalNo: ckHasArrange(mk({ has_arrange: false }, {}), '2026-12-20'),
    noBlockLocalYes: ckHasArrange({ id: 'y', status: 'cancelled', ops: { boatId: 'b1' }, trips: [{ date: '2026-12-20' }] }, '2026-12-20'),
    noBlockLocalNo: ckHasArrange({ id: 'y', status: 'cancelled', ops: {}, trips: [{ date: '2026-12-20' }] }, '2026-12-20'),
  };
});
ok('server yes, browser nothing -> true', hv.srvYesLocalNo === true, hv);
ok('server no, but a van was assigned in the browser after the read -> true (the local arrangement counts)', hv.srvNoLocalYes === true, hv);
ok('server no, browser nothing -> false', hv.srvNoLocalNo === false, hv);
ok('no block (draft / not read): legacy\'s rule alone', hv.noBlockLocalYes === true && hv.noBlockLocalNo === false, hv);
const realAb = await ev((id) => { const b = SB_BOOKINGS.find((x) => x.opsId === id || x.id === id); if (!b) return null; const t = b.trips[0]; return { has: t.aboard && t.aboard.has_arrange, now: ckHasArrange(b, t.date) }; }, seeded.bk.three.id);
ok('a real arranged booking: the server\'s block says has_arrange and the function answers true', realAb && realAb.has === true && realAb.now === true, realAb);

ok('no page errors', errors.length === 0, errors.slice(0, 4));
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(' | ')}` : '\nALL OK');
cleanup();
process.exit(fails.length ? 1 : 0);
