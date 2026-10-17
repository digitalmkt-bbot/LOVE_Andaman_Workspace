// t_walk_vanjobs · the Van Job Order sheet is drawn from the server's rows (Q41), against a REAL operation-backend (in-process, seeded).
//   node test/ui/t_walk_vanjobs.mjs
// Every check reads BOTH sides: the sheet on the screen (its DOM) and what the server answers when asked directly
// (GET /operations/van-jobs/{date}/{key}). The seed is test/ui/_vanjobs_seed.mjs (2 rounds, a merged row, a cancelled booking,
// returns on other vans, a no-show tag, an overnight out and its return leg).
import { serve } from './_harness.mjs';
import { seedVanJobs, D, D2 } from './_vanjobs_seed.mjs';
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
const apiRaw = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init.headers || {}) } });
  const txt = r.status === 204 ? '' : await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (_) { body = txt; }
  return { status: r.status, body };
};
const api = async (p, init = {}) => (await apiRaw(p, init)).body;
const send = (m, p, b) => apiRaw(p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) });

const seeded = await seedVanJobs(send);

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
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postData() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  calls.push(req.method() + ' ' + u.pathname + ' ' + r.status);
  await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: buf });
});
const page = await ctx.newPage();
const popups = [];
ctx.on('page', (p) => { if (p !== page) popups.push(p); });
const errors = [];
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => d.accept());

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + String(JSON.stringify(got)).slice(0, 600))); if (!cond) fails.push(name); };
const settle = (ms = 700) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, ms = 10000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (_) { return false; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// what the screen shows: one object per section (rows, totals cells, footer text), parsed from a sheet's HTML
const PARSE = `(function(html){
  const root = document.createElement('div'); root.innerHTML = html;
  const txt = (el) => el ? el.textContent.replace(/\\s+/g, ' ').trim() : '';
  const first = (td) => { const n = [...td.childNodes].find((x) => x.nodeType === 3 && x.textContent.trim()); return n ? n.textContent.trim() : txt(td.firstElementChild); };
  const sections = [];
  root.querySelectorAll('table').forEach((tb) => {
    const sec = { kind: /RETURN/.test(tb.previousElementSibling ? tb.previousElementSibling.textContent : '') ? 'ret' : 'out', rows: [], totals: null, footer: '' };
    tb.querySelectorAll('tbody > tr').forEach((tr) => {
      const td = [...tr.children];
      if (td[1] && /แวะ/.test(td[1].textContent)) { sec.rows.push({ kind: 'stop', no: +txt(td[0]), label: txt(td[2]).replace(/^\\S+\\s/, '').split(' คนติดรถ')[0], time: txt(td[7]), place: first(td[8]) }); return; }
      sec.rows.push({ kind: 'booking', no: txt(td[0]), voucher: txt(td[1]), lead: first(td[2]), tags: txt(td[2]), ad: +txt(td[3]), chd: +txt(td[4]), inf: +txt(td[5]), foc: +txt(td[6]),
        time: txt(td[7]), pickup: first(td[8]), pickupTh: txt(td[8].querySelector('.pkth')), room: txt(td[9]), zone: first(td[10]), drop: txt(td[11]), bags: txt(td[12]), sreq: txt(td[13]), struck: txt(td[0]) === '✗' });
    });
    const f = [...tb.querySelectorAll('tfoot td')];
    if (f.length) { sec.totals = { ad: +txt(f[1]), chd: +txt(f[2]), inf: +txt(f[3]), foc: +txt(f[4]) }; sec.footer = txt(f[5]); }
    sections.push(sec);
  });
  const all = txt(root);
  return { sections, banner: (all.match(/เส้นทางนี้ยังมี (\\d+) booking \\((\\d+) คน\\)/) || []).slice(1).map(Number), round: (all.match(/รอบ (\\d+) \\/ (\\d+)/) || []).slice(1).map(Number),
    noteRound1: /ขากลับไม่ได้อยู่ในใบนี้/.test(all), noteRound1Pax: +((all.match(/รถวิ่งส่งเที่ยวเดียว \\((\\d+) คน\\)/) || [])[1] || -1), metaOut: +((all.match(/ขาไป (\\d+) คน/) || [])[1] || -1),
    metaRet: +((all.match(/ขากลับ (\\d+) คน/) || [])[1] || -1), empty: /No bookings assigned/.test(all), loading: /Loading the job order/.test(all), driverLine: (all.match(/คนขับ .*?(?= รถ|รถร่วม|$)/) || [''])[0].slice(0, 60), text: all };
})`;
const screenSheet = (sel) => ev(`(function(){ const el = document.querySelector(${JSON.stringify(sel)}); return el ? (${PARSE})(el.innerHTML) : null; })()`);

// ── boot: the Van Job Orders screen on day D ──
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 });
await settle(1000);
const openDay = async (date) => {
  await ev((d) => { _vanJobsDate = d; const el = document.querySelector('.nav-item[data-view="vanjobs"]'); if (el) nav(el); renderVanJobs(); }, date);
  await waitFor(() => document.querySelector('#vanjobs-host tbody tr'), null, 20000);
  await settle(2200);
};
const preview = async (legacyKey) => {
  await ev((k) => vanJobsOpenPreview(k), legacyKey);
  await waitFor(() => { const p = document.getElementById('vjo-page'); return p && !/Loading the job order/.test(p.innerText) && p.querySelector('.hd'); }, null, 15000);
  await settle(500);
};
const serverSheet = async (date, key) => api(`/operations/van-jobs/${date}/${encodeURIComponent(key)}`);
const dayJobs = (date) => api('/operations/van-jobs?date=' + date);

// the server's rows, as the same shape the screen is parsed to
const expectRows = (sec) => (sec ? sec.rows : []).map((r) => r.kind === 'stop'
  ? { kind: 'stop', no: r.no, time: r.time || '' }
  : { kind: 'booking', no: r.struck ? '✗' : String(r.no), voucher: r.voucher, lead: r.lead_pax || '-', ad: r.ad, chd: r.chd, inf: r.inf, foc: r.foc, time: r.pickup_time || '-', room: r.room || '-', struck: !!r.struck });

console.log('\n[1] the day: rows, totals, warnings, struck rows = the server\'s');
await openDay(D);
const day = await dayJobs(D);
const alpha1 = day.jobs.find((j) => j.van_id === seeded.vanAlpha.id && j.round && j.round.no === 1);
const alpha2 = day.jobs.find((j) => j.van_id === seeded.vanAlpha.id && j.round && j.round.no === 2);
const bravo = day.jobs.find((j) => j.van_id === seeded.vanBravo.id);
ok('server: Van Alpha runs two rounds, Van Bravo one', !!alpha1 && !!alpha2 && !!bravo && alpha1.round.of === 2, day.jobs.map((j) => [j.van.name, j.round]));
const legacyKey = (j) => `${j.van_id}~${j.route_id}` + (j.round && j.round.of > 1 ? '~' + j.group_number : '');

for (const [label, job] of [['Alpha round 1', alpha1], ['Alpha round 2', alpha2], ['Bravo', bravo]]) {
  await preview(legacyKey(job));
  const S = await serverSheet(D, job.key);
  const scr = await screenSheet('#vjo-page');
  const outExp = expectRows(S.out), retExp = S.ret && !(job.round && job.round.no > 1) ? expectRows(S.ret) : [];
  const outScr = scr.sections.find((s) => s.kind === 'out'), retScr = scr.sections.find((s) => s.kind === 'ret');
  const norm = (rows, ret) => rows.map((r) => r.kind === 'stop' ? { kind: 'stop', no: r.no, time: r.time } : { kind: 'booking', no: r.no, voucher: r.voucher, lead: r.lead, ad: r.ad, chd: r.chd, inf: r.inf, foc: r.foc, time: ret ? '-' : r.time, room: r.room, struck: r.struck });
  const normExp = (rows, ret) => rows.map((r) => r.kind === 'stop' ? { kind: 'stop', no: r.no, time: r.time || '-' } : { ...r, time: ret ? '-' : r.time });
  ok(`${label}: outbound rows (number, voucher, name, AD/CHD/INF/FOC, time, room, struck) = server`, eq(norm(outScr ? outScr.rows : [], false), normExp(outExp, false).map((r) => r.kind === 'stop' ? { ...r, time: r.time === '' ? '-' : r.time } : r)), { screen: outScr && outScr.rows.slice(0, 3), server: outExp.slice(0, 3) });
  ok(`${label}: return rows = server`, eq(norm(retScr ? retScr.rows : [], true), normExp(retExp, true)), { screen: retScr && retScr.rows.length, server: retExp.length });
  ok(`${label}: outbound totals AD/CHD/INF/FOC = server out.totals`, !!outScr && eq(outScr.totals, { ad: S.out.totals.ad, chd: S.out.totals.chd, inf: S.out.totals.inf, foc: S.out.totals.foc }), { screen: outScr && outScr.totals, server: S.out.totals });
  ok(`${label}: outbound footer says the server's pax / bookings / struck / stops`, !!outScr && outScr.footer.includes(`${S.out.totals.pax} pax · ${S.out.totals.bookings} booking`)
    && (S.out.totals.struck ? outScr.footer.includes(`ค้างจัดการ ${S.out.totals.struck}`) : !/ค้างจัดการ/.test(outScr.footer))
    && (S.out.totals.stops ? outScr.footer.includes(`จุดแวะ ${S.out.totals.stops}`) && outScr.footer.includes(`= ${S.out.totals.pax + S.out.totals.stop_seats} ที่นั่ง`) : true), { footer: outScr && outScr.footer, totals: S.out.totals });
  if (retExp.length) {
    ok(`${label}: return totals and footer = server ret.totals`, !!retScr && eq(retScr.totals, { ad: S.ret.totals.ad, chd: S.ret.totals.chd, inf: S.ret.totals.inf, foc: S.ret.totals.foc }) && retScr.footer.includes(`${S.ret.totals.pax} pax · ${S.ret.totals.bookings} booking`)
      && (S.ret.totals.struck ? retScr.footer.includes(`ค้างจัดการ ${S.ret.totals.struck}`) : true) && (S.ret.totals.separate_drops ? retScr.footer.includes(`แยกส่ง ${S.ret.totals.separate_drops} จุด`) : true), { footer: retScr && retScr.footer, totals: S.ret.totals });
  }
  ok(`${label}: the unassigned-on-route banner = server (${JSON.stringify(S.unassigned_on_route)})`, S.unassigned_on_route.pax > 0 ? eq(scr.banner, [S.unassigned_on_route.bookings, S.unassigned_on_route.pax]) : scr.banner.length === 0, { screen: scr.banner, server: S.unassigned_on_route });
  ok(`${label}: round label = server round`, job.round ? eq(scr.round, [job.round.no, job.round.of]) : scr.round.length === 0, { screen: scr.round, server: job.round });
  ok(`${label}: header shows the server's head counts (out ${S.out ? S.out.totals.pax : 0}${job.round && job.round.no > 1 ? '' : ', return ' + (S.ret ? S.ret.totals.pax : 0)})`, scr.metaOut === (S.out ? S.out.totals.pax : 0) && (job.round && job.round.no > 1 ? true : scr.metaRet === (S.ret ? S.ret.totals.pax : 0)), { out: scr.metaOut, ret: scr.metaRet });
  ok(`${label}: "return is on round 1" note = server ret_on_round_1${S.ret_on_round_1 ? ' (' + alpha1.ret_pax + ' pax)' : ''}`, scr.noteRound1 === S.ret_on_round_1 && (!S.ret_on_round_1 || scr.noteRound1Pax === alpha1.ret_pax), { screen: [scr.noteRound1, scr.noteRound1Pax], server: [S.ret_on_round_1, alpha1.ret_pax] });
  ok(`${label}: driver, plate and van name = server job`, scr.text.includes(S.job.van.name) && scr.text.includes(S.job.driver.name) && scr.text.includes(S.job.driver.phone) && scr.text.includes(S.job.driver.plate), { driver: S.job.driver });
}

console.log('\n[2] tags and cells that come from single server fields');
await preview(legacyKey(alpha1));
{
  const S = await serverSheet(D, alpha1.key);
  const scr = await screenSheet('#vjo-page');
  const out = scr.sections.find((s) => s.kind === 'out'), ret = scr.sections.find((s) => s.kind === 'ret');
  const row = (sec, voucher) => sec && sec.rows.find((r) => r.voucher === voucher);
  const srow = (sec, voucher, idx = 0) => sec.rows.filter((r) => r.voucher === voucher)[idx];
  const merged = srow(S.out, 'VJ-TWO');
  ok('merged row: server says merged_parts 2 with pax 3; the screen shows one row, 3 pax, "รับจุดเดียวกัน 2 กลุ่ม"', merged.merged_parts === 2 && merged.pax === 3 && out.rows.filter((r) => r.voucher === 'VJ-TWO').length === 1 && row(out, 'VJ-TWO').ad === 3 && /รับจุดเดียวกัน 2 กลุ่ม/.test(row(out, 'VJ-TWO').tags), { merged, row: row(out, 'VJ-TWO') });
  const ovn = srow(S.out, 'VJ-OVN');
  ok('overnight out: server ovn "out" + return date; the screen tags OVN and says when they come back', ovn.ovn === 'out' && /OVN/.test(row(out, 'VJ-OVN').tags) && row(out, 'VJ-OVN').drop.includes('ค้างคืนบนเกาะ') && row(out, 'VJ-OVN').drop.includes('กลับ ' + ovn.ovn_return_date), { ovn, row: row(out, 'VJ-OVN') });
  const one = srow(S.out, 'VJ-ONE');
  ok('return on another van: server return_van_id; the screen says "ขากลับ โดย" that van\'s name', !!one.return_van_id && row(out, 'VJ-ONE').drop.includes('ขากลับ โดย ' + seeded.vanBravo.name), { one, drop: row(out, 'VJ-ONE').drop });
  ok('bags, special request, room and the Thai pick-up name are the server\'s', row(out, 'VJ-ONE').bags.includes(String(one.bags)) && row(out, 'VJ-ONE').sreq === one.special_request && row(out, 'VJ-ONE').room === one.room && !!one.pickup_th && row(out, 'VJ-ONE').pickupTh === one.pickup_th, { one, row: row(out, 'VJ-ONE') });
  const dropRow = S.ret.rows.find((r) => r.drop_own);
  ok('separate drop-off row (return): server drop_own + drop_off; the screen tags "แยกส่ง" with who and prints the place', !!dropRow && ret.rows.some((r) => r.voucher === 'VJ-TWO' && /แยกส่ง · Mr Drop/.test(r.drop) && r.drop.includes(dropRow.drop_off)), { dropRow });
  const five = S.ret.rows.find((r) => r.voucher === 'VJ-FIVE');
  ok('return row from another van: server from_van_id; the screen says "มาจากรถอื่น (ขาไป <that van>)"', !!five.from_van_id && /มาจากรถอื่น/.test(row(ret, 'VJ-FIVE').drop) && row(ret, 'VJ-FIVE').drop.includes(seeded.vanBravo.name), { five, drop: row(ret, 'VJ-FIVE').drop });
  const stop = S.out.rows.find((r) => r.kind === 'stop');
  ok('van stop: server row (label, time, place, seats); the screen row shows them and the stop count/seats in the footer', !!stop && out.rows.some((r) => r.kind === 'stop' && r.time === stop.time && r.place === stop.place && r.label.includes(stop.label)) && out.footer.includes(`ติดรถ ${S.out.totals.stop_seats}`), { stop, footer: out.footer });
  const struck = S.ret.rows.find((r) => r.struck);
  ok('cancelled booking still in its group: server struck "cancelled", no number, in no total; the screen strikes it (✗, "ยกเลิกแล้ว", clear button) and the totals leave it out',
    struck.struck === 'cancelled' && struck.no === null && row(ret, 'VJ-FOUR').struck && /ยกเลิกแล้ว/.test(row(ret, 'VJ-FOUR').tags) && /ล้างออก/.test(row(ret, 'VJ-FOUR').tags) && S.ret.totals.struck === 1, { struck, row: row(ret, 'VJ-FOUR') });
}
await preview(legacyKey(bravo));
{
  const S = await serverSheet(D, bravo.key);
  const scr = await screenSheet('#vjo-page');
  const ret = scr.sections.find((s) => s.kind === 'ret');
  const six = S.ret.rows.find((r) => r.voucher === 'VJ-SIX');
  ok('check-in loss: server loss {no_show 2} on a 2-pax row; the screen tags it "ไม่ได้เดินทาง · ไม่ต้องรอ"', six.loss && six.loss.no_show === 2 && six.pax === 2 && ret.rows.find((r) => r.voucher === 'VJ-SIX').tags.includes('ไม่ได้เดินทาง'), { six, tags: ret.rows.find((r) => r.voucher === 'VJ-SIX').tags });
  const one = ret.rows.find((r) => r.voucher === 'VJ-ONE');
  ok('"มาจากรถอื่น" names the outbound van from the server\'s from_van_id', one.drop.includes('มาจากรถอื่น (ขาไป ' + seeded.vanAlpha.name + ')'), one.drop);
}
console.log('\n[3] the overnight return day (a return-only sheet)');
await openDay(D2);
{
  const d2 = await dayJobs(D2);
  const j = d2.jobs.find((x) => x.van_id === seeded.vanBravo.id);
  ok('server: a return-only job (key van~route, no outbound)', !!j && !j.group_id && j.has_ret && !j.has_out, j);
  await preview(`${j.van_id}~${j.route_id}`);
  const S = await serverSheet(D2, j.key);
  const scr = await screenSheet('#vjo-page');
  const ret = scr.sections.find((s) => s.kind === 'ret');
  ok('return-only sheet: no outbound table; the return row = server; the overnight-leg tag and "ส่งกลับ · มาจากเกาะ"', scr.sections.length === 1 && !!ret && ret.rows.length === S.ret.rows.length && S.ret.rows[0].ovn === 'leg' && /OVN/.test(ret.rows[0].tags) && ret.rows[0].drop.includes('ส่งกลับ · มาจากเกาะ'), { screen: ret && ret.rows, server: S.ret.rows[0] });
}

console.log('\n[4] the browser does not count: the sheet is the same with no booking in the browser');
await openDay(D);
await preview(legacyKey(alpha1));
{
  const before = await screenSheet('#vjo-page');
  const held = await ev(() => { window.__held = SB_BOOKINGS.splice(0); return window.__held.length; });
  await ev(() => renderVanJobs()); await settle(600);
  const during = await screenSheet('#vjo-page');
  await ev(() => { SB_BOOKINGS.push(...window.__held); });
  const strip = (s) => s.sections.map((x) => ({ ...x, rows: x.rows.map((r) => ({ ...r, tags: undefined })) }));
  ok(`with the ${held} local bookings taken out, every row, number and total on the sheet is unchanged`, eq(strip(before), strip(during)) && eq(before.banner, during.banner) && eq(before.round, during.round), { before: before.sections.length, during: during.sections.length });
}

console.log('\n[5] rounds come from the server\'s day read');
{
  const r1 = await ev((a) => vjRoundOf(a.d, a.v, a.r, a.g), { d: D, v: alpha1.van_id, r: alpha1.route_id, g: alpha1.group_number });
  const r2 = await ev((a) => vjRoundOf(a.d, a.v, a.r, a.g), { d: D, v: alpha2.van_id, r: alpha2.route_id, g: alpha2.group_number });
  const rb = await ev((a) => vjRoundOf(a.d, a.v, a.r, a.g), { d: D, v: bravo.van_id, r: bravo.route_id, g: bravo.group_number });
  ok('vjRoundOf = server job.round (no / of / time)', r1.no === 1 && r1.tot === 2 && r1.tm === alpha1.round.time && r2.no === 2 && r2.tot === 2 && r2.tm === alpha2.round.time && rb === null, { r1, r2, rb });
}

console.log('\n[6] a change on the server shows on the sheet (no reload)');
{
  const put = await send('PUT', `/operations/van-days/${D}/${seeded.vanAlpha.id}`, { driver: 'Driver Of The Day', route_ids: ['r5'] });
  ok('server: day driver override accepted', put.status < 300, put);
  await settle(1800);
  await ev(() => renderVanJobs());                          // first draw may be the old sheet; the refresh redraws
  const shown = await waitFor(() => /Driver Of The Day/.test((document.getElementById('vjo-page') || {}).innerText || ''), null, 10000);
  const S = await serverSheet(D, alpha1.key);
  ok('the sheet shows the new driver and the "updated today" pin; the server\'s sheet says override', shown && S.job.driver.name === 'Driver Of The Day' && S.job.driver.override === true && /อัปเดตวันนี้/.test(await ev(() => document.getElementById('vjo-page').innerText)), S.job.driver);
}

console.log('\n[7] print window and image: the same sheet, loaded first when not in hand');
{
  await ev((a) => { const c = window.laOps.vanJobs.sheet.cache; Object.keys(c).forEach((k) => delete c[k]); }, null);
  const before = popups.length;
  await ev((d) => bookingV2VanJobOrder(d, 'veh01', 'r5', 'out', 1), D);
  const t0 = Date.now(); while (popups.length === before && Date.now() - t0 < 10000) await settle(100);
  const w = popups[popups.length - 1];
  await settle(800);
  const txt = popups.length > before ? await w.evaluate(() => document.body.innerText) : '';
  const S = await serverSheet(D, alpha1.key);
  ok('print window opened with the sheet\'s rows (cache empty before)', popups.length > before && txt.includes('VJ-ONE') && txt.includes('VJ-TWO') && txt.includes('Van Alpha') && /รอบ 1 \/ 2/.test(txt) && txt.includes(`${S.out.totals.pax} pax`), txt.slice(0, 200));
  ok('print window carries the round in its title', popups.length > before && /รอบ 1 \/ 2/.test(await w.title()), popups.length > before ? await w.title() : '');
  if (popups.length > before) await w.close().catch(() => {});
}

console.log('\n[8] what the screen asked for');
{
  const sheetCalls = calls.filter((c) => /^GET \/operations\/van-jobs\/\d{4}-\d{2}-\d{2}\//.test(c));
  ok('the sheets were read from GET /operations/van-jobs/{date}/{key}', sheetCalls.length >= 5 && sheetCalls.every((c) => / 200$/.test(c)), sheetCalls.slice(0, 5));
  ok('no page errors', errors.length === 0, errors.slice(0, 4));
}

console.log(fails.length ? `\nFAILED ${fails.length}:\n  ` + fails.join('\n  ') : '\nALL OK');
process.exit(fails.length ? 1 : 0);
