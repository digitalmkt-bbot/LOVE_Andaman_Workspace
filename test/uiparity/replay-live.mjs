// Check 3 · rule replay, method B (operation-backend todo/cutover-readiness-model.md): legacy's OWN functions, run in the
// legacy page, against this backend's answer for the same case. For rules whose answer legacy computes on screen and
// never stores, and as the arbiter for a method-A difference (legacy's stored figure vs what legacy computes today).
//
//   LEGACY_DIR=<origin/lk-inbox checkout> OPS_BACKEND_DIR=<operation-backend checkout> \
//   LEGACY_DB=postgres://…localhost…/<copy of legacy> OPS_DB=postgres://…localhost…/<copy of operations> \
//   node test/uiparity/replay-live.mjs [--rules=seats,booking-price] [--cases=<cutover-replay --json output>] [--from=YYYY-MM-DD --to=YYYY-MM-DD] [--out=<dir>]
//
// Rules:
//   seats         · per route-day, legacy `getAllotment(route, date)` (04-data-core.js) vs `GET /v1/availability?from&to`:
//                   seat pool (availableCapacity ↔ deployed_capacity less chartered), booked (seatsConsumed ↔ booked_pax),
//                   locked (lockedSeats ↔ locked_pax), seats left (seatsAvailable ↔ max(0, available_seats)), state.
//   booking-price · with --cases: every booking cutover-replay priced (rule booking-price / trip-price), re-priced by legacy's
//                   own `bkV2CalcQuote` exactly as its edit form does on open (`bkV2EditBooking` clone + `bkV2RtKeepInit`,
//                   §rtKeep drift check), without opening the form (no edit lock is written). Answers, per booking, legacy
//                   stored / legacy today / ours: when legacy today = ours, the stored figure is legacy's own "drift"
//                   (rates edited after the booking was saved; legacy warns the same on open).
//
// Same safety as run.mjs: local databases only, clean child environments. Both servers boot on LEGACY_PORT / OPS_PORT
// (defaults 3931 / 3932, away from run.mjs's). Writes `replay-live.md` and `replay-live.json` to --out.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const LEGACY_DIR = process.env.LEGACY_DIR || 'D:/projects/wt-uip-legacy';
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const LEGACY_DB = process.env.LEGACY_DB || 'postgres://postgres:postgres@localhost:55433/legacy_ui';
const OPS_DB = process.env.OPS_DB || 'postgres://postgres:postgres@localhost:55433/operations_ui';
const USER = process.env.UIP_USER || 'uiparity', PASS = process.env.UIP_PASS || 'uiparity';
const LEGACY_PORT = +(process.env.LEGACY_PORT || 3931), OPS_PORT = +(process.env.OPS_PORT || 3932);
const OUT = path.resolve(arg('out', path.join(HERE, 'out', 'replay-live-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19))));
const bkkToday = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const FROM = arg('from', shift(bkkToday, -30)), TO = arg('to', shift(bkkToday, 60));
const CASES = arg('cases', '');
const ONLY = arg('rules', '') ? arg('rules').split(',') : null;
const want = (r) => !ONLY || ONLY.includes(r);

for (const [k, v] of Object.entries({ LEGACY_DB, OPS_DB })) {
  const h = new URL(v).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(h)) throw new Error(`${k} must be a local database, got ${h}`);
}
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => { console.log(...a); fs.appendFileSync(path.join(OUT, 'run.log'), a.join(' ') + '\n'); };

const kids = [];
function start(name, cmd, args, cwd, env, ready, timeout = 180000) {
  const base = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'ComSpec', 'PATHEXT']) if (process.env[k]) base[k] = process.env[k];
  const p = spawn(cmd, args, { cwd, env: { ...base, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  kids.push(p);
  let buf = '';
  const file = fs.createWriteStream(path.join(OUT, name + '.log'));
  return new Promise((ok, bad) => {
    const t = setTimeout(() => bad(new Error(name + ' did not start:\n' + buf.slice(-2000))), timeout);
    const on = (b) => { buf += b; file.write(b); if (ready.test(buf)) { clearTimeout(t); ok(p); } };
    p.stdout.on('data', on); p.stderr.on('data', on);
    p.on('exit', (c) => { clearTimeout(t); bad(new Error(`${name} exited ${c}:\n` + buf.slice(-2000))); });
  });
}
const cleanup = () => { for (const k of kids) try { k.kill(); } catch (_) {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

log(`replay-live · out ${OUT} · seats ${FROM}..${TO}${CASES ? ' · cases ' + CASES : ''}`);
await start('legacy-server', process.execPath, ['server.js'], LEGACY_DIR, { PORT: String(LEGACY_PORT), DATABASE_URL: LEGACY_DB, SESSION_SECRET: 'uiparity-local', DATA_BACKEND: 'relational' }, /LOVE Andaman on/);
await start('ops-backend', process.execPath, ['--import', 'tsx', 'src/server.ts'], OPS_DIR, { PORT: String(OPS_PORT), HOST: '127.0.0.1', DATABASE_URL: OPS_DB, AUTH_JWT_SECRET: 'uiparity-local', LOG_LEVEL: 'info', NODE_ENV: 'development' }, /Server listening|listening at/i);
const LEG = `http://localhost:${LEGACY_PORT}`, OPS = `http://127.0.0.1:${OPS_PORT}`;
const login = await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) })).json();
if (!login.access_token) throw new Error('operation-backend login failed: ' + JSON.stringify(login));
const api = async (p) => { const r = await fetch(OPS + p, { headers: { authorization: 'Bearer ' + login.access_token } }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${(await r.text()).slice(0, 300)}`); return r.json(); };

const browser = await chromium.launch({ channel: 'chrome' });
kids.push({ kill: () => browser.close() });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
// Legacy's "today" is the browser's UTC date (run.mjs): before 07:00 Bangkok, run at 10:00 Bangkok of today.
const bkk = new Date(Date.now() + 7 * 3600e3);
if (bkk.getUTCHours() < 7) await ctx.clock.install({ time: new Date(bkk.toISOString().slice(0, 10) + 'T10:00:00+07:00') });
const r = await ctx.request.post(LEG + '/api/login', { data: { username: USER, password: PASS } });
if (r.status() !== 200) throw new Error('legacy login failed: ' + r.status());
const page = await ctx.newPage();
// Nothing this script does should write: any legacy write is recorded and reported.
const writes = [];
page.on('request', (q) => { if (q.url().startsWith(LEG + '/api/') && q.method() !== 'GET' && !/\/api\/login/.test(q.url())) writes.push(`${q.method()} ${q.url().slice(LEG.length)}`); });
page.on('dialog', (d) => d.dismiss().catch(() => {}));
await page.goto(LEG + '/allotment_v2/allotment_v2.html', { timeout: 180000 });
await page.waitForFunction(() => typeof window.nav === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0 && !document.getElementById('la-bootfail') && typeof getAllotment === 'function' && typeof SB_BOOKINGS !== 'undefined' && SB_BOOKINGS.length > 0, null, { timeout: 300000 });
log('legacy page booted');

const rules = [];
const rule = (name, title, cases, info = []) => {
  const diff = cases.filter((c) => c.legacy !== c.ours);
  rules.push({ rule: name, title, cases, info, same: cases.length - diff.length, different: diff.length });
  log(`${name}: ${cases.length} cases, ${cases.length - diff.length} same, ${diff.length} different`);
};

// ── seats: getAllotment vs GET /v1/availability ──
if (want('seats')) {
  // The range form answers at most 62 days without a route: ask month-sized windows.
  const list = [];
  for (let a = FROM; a <= TO; a = shift(a, 31)) {
    const b = shift(a, 30) < TO ? shift(a, 30) : TO;
    list.push(...(await api(`/v1/availability?from=${a}&to=${b}`)).days);
  }
  const theirs = await page.evaluate(({ days }) => days.map(([routeId, date]) => {
    const a = getAllotment(routeId, date);
    return { routeId, date, has: a.hasAllotment, pool: a.availableCapacity, booked: a.seatsConsumed, locked: a.lockedSeats || 0, left: a.seatsAvailable, state: a.state, land: !!a.isLand,
      boats: a.assignedBoats.map((b) => `${b.boatId}:${b.capacity}${b.type === 'charter' ? 'c' : ''}`).join(' ') };
  }), { days: list.map((d) => [d.route_id, d.service_date]) });
  const cases = list.map((d, i) => {
    const t = theirs[i];
    const fmt = (o) => `pool ${o.pool} · booked ${o.booked} · locked ${o.locked} · left ${o.left}`;
    const deployed = (d.deployments || []).length > 0 || d.deployed_capacity > 0;
    if (!t.has) return { id: `${d.route_id}@${d.service_date}`, legacy: 'no allotment', ours: d.unlimited || !deployed ? 'no allotment' : fmt({ pool: d.deployed_capacity, booked: d.booked_pax, locked: d.locked_pax, left: Math.max(0, d.available_seats) }), note: t.land ? 'land' : '' };
    const pool = d.available_seats === null ? null : d.available_seats + d.booked_pax + d.locked_pax + (d.unplaced_charter_pax || 0);
    return { id: `${d.route_id}@${d.service_date}`, legacy: fmt(t), ours: fmt({ pool, booked: d.booked_pax, locked: d.locked_pax, left: d.available_seats === null ? null : Math.max(0, d.available_seats) }), note: t.land ? 'land' : `${t.state} · legacy boats ${t.boats} · ours ${(d.deployments || []).map((x) => `${x.boat_id}:${x.capacity}${x.chartered ? 'c' : ''}`).join(' ')}` };
  });
  rule('seats', 'seats per route-day: legacy `getAllotment` vs `GET /v1/availability`', cases, [`${FROM}..${TO}, every route-day the API lists`]);
}

// ── booking-price: legacy's own bkV2CalcQuote on the stored booking ──
if (CASES && want('booking-price')) {
  const replay = JSON.parse(fs.readFileSync(CASES, 'utf8'));
  const byRule = Object.fromEntries(replay.map((r) => [r.rule, r.cases]));
  const bookings = byRule['booking-price'] || [], trips = new Map((byRule['trip-price'] || []).map((c) => [c.id, c]));
  const ids = bookings.map((c) => c.id);
  const live = [];
  for (let i = 0; i < ids.length; i += 500) {
    live.push(...await page.evaluate((chunk) => {
      const saved = { nb: _bkV2.newBooking, ed: _bkV2.editingId };
      const out = chunk.map((id) => {
        const bk = SB_BOOKINGS.find((b) => b.id === id);
        if (!bk) return { id, missing: true };
        try {
          // bkV2EditBooking's clone, without the lock, the render and the screen (08-app.js §rtKeep).
          const clone = JSON.parse(JSON.stringify(bk));
          delete clone.editLock;
          (clone.trips || []).forEach((t) => { if (t && t.ovnOf === 'boatback' && !t.ovnLeg) t.ovnBoatBack = 1; });
          ['addOns', 'passengers', 'adjustments', 'feeItems', 'altPickups'].forEach((k) => { if (!Array.isArray(clone[k])) clone[k] = []; });
          bkV2RtKeepInit(clone, bk);
          _bkV2.newBooking = clone; _bkV2.editingId = bk.id;
          const q = bkV2CalcQuote();
          const tripTotals = (clone.trips || []).map((t) => { try { return Math.round(bkV2TripSubtotal(t).total || 0); } catch (e) { return 'error'; } });
          return { id, total: Math.round(q.grandTotal), trips: tripTotals };
        } catch (e) { return { id, error: String(e && e.message || e).slice(0, 160) }; }
      });
      _bkV2.newBooking = saved.nb; _bkV2.editingId = saved.ed;
      return out;
    }, ids.slice(i, i + 500)));
  }
  const liveOf = new Map(live.map((l) => [l.id, l]));
  const cases = bookings.map((c) => {
    const l = liveOf.get(c.id);
    const today = !l ? 'not run' : l.missing ? 'not in legacy page' : l.error ? 'error ' + l.error : String(l.total);
    return { id: c.id, legacy: today, ours: c.ours, note: `legacy stored ${c.legacy}${c.legacy === today ? '' : ' (legacy drift)'} · ${c.note || ''}` };
  });
  rule('booking-price-live', 'booking total: legacy `bkV2CalcQuote` today (edit-form re-price) vs ours', cases, ['legacy stored = the method-A replay\'s legacy figure']);
  const tripCases = [];
  for (const l of live) {
    if (!l.trips) continue;
    l.trips.forEach((v, k) => {
      const c = [...trips.values()].length && trips.get(`${l.id}#${k}`);
      if (c) tripCases.push({ id: c.id, legacy: String(v), ours: c.ours, note: `legacy stored ${c.legacy} · ${c.note || ''}` });
    });
  }
  rule('trip-price-live', 'trip subtotal: legacy `bkV2TripSubtotal` today vs ours', tripCases);
}

const md = ['# Check 3 · method B · legacy\'s own functions in the legacy page', '', `Run ${new Date().toISOString()} · legacy writes during the run: ${writes.length}${writes.length ? ' (' + [...new Set(writes)].slice(0, 5).join(', ') + ')' : ''}`, '',
  '| rule | cases | same | different |', '|---|---|---|---|', ...rules.map((r) => `| ${r.rule} | ${r.cases.length} | ${r.same} | ${r.different} |`)];
for (const r of rules) {
  md.push('', `## ${r.rule} · ${r.title}`, '', ...r.info.map((i) => `- ${i}`));
  const d = r.cases.filter((c) => c.legacy !== c.ours);
  if (d.length) md.push('', '| case id | legacy | ours | note |', '|---|---|---|---|', ...d.map((c) => `| ${c.id} | ${c.legacy} | ${c.ours} | ${c.note || ''} |`));
}
fs.writeFileSync(path.join(OUT, 'replay-live.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'replay-live.json'), JSON.stringify(rules));
log(`report ${path.join(OUT, 'replay-live.md')}`);
cleanup();
process.exit(rules.some((r) => r.different) ? 1 : 0);
