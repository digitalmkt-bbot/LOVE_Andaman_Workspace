import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Sync 11-16 gaps, adapter side (lk-inbox 0fffe6a9..ff9462e4).
// 1. §docNo: the memo / incident / job / split creates send no number; operation-backend issues it under a lock (ops/24, ops/25),
//    and legacy's laDocNo no longer asks lk-inbox's /api/v1/_docno.
// 3. §pxForecast: ctRead/ctWrite('px_central') are the config store's (ops/61).
// 4. §pxSteps / §pxForecast: the day aggregate carries legacy's profit-by-step split (pxStAdd), and the Forecast tab reads the
//    month's days, the month before and the booking-pace window (ops/44).
// 5. §tsCotSep: server only (operation-backend collectOf).
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 12; i++) await tick(); };
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const src = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return s.slice(i, j); };

test('§docNo: the creates send no number of their own; the server issues it', () => {
  const jobs = src('allotment_v2/js/ops/24-ops-fleet-jobs.js');
  const inc = between(jobs, "wrap('flSaveIncident'", "wrap('flDeleteIncident'");
  assert.doesNotMatch(inc, /computeNextNo\('INC'/, 'the incident create no longer counts the browser list');
  assert.match(inc, /res && res\.no/, "the toast shows the server's number");
  const create = between(jobs, "wrap('flSaveCreateJob'", '/* POST /v1/fleet/jobs/{id}/start');
  assert.doesNotMatch(create, /body\.nos? = 'MJ-|body\.nos = inc\.damagedAssets/, 'no MJ numbers in the job create');
  assert.match(create, /body\.per_asset = true/);
  const splits = [between(jobs, "wrap('flEngSplitIntoJobs'", "O.wrote('fleet-job-split')"), between(jobs, "wrap('flSplitExistingJob'", "O.wrote('fleet-job-split')")];
  assert.match(splits[0], /\{ by: 'boat_engines' \}/);
  assert.match(splits[1], /\{ by: 'job_engines' \}/);

  const stock = src('allotment_v2/js/ops/25-ops-fleet-stock.js');
  assert.doesNotMatch(stock, /d\.no = 'MO-'/, 'the memo create no longer counts the browser list');
  assert.match(stock, /if\(!isPatch && text\(d\.no\)\) body\.no = text\(d\.no\);/, 'a create sends a number only when it has one');
});

test("§docNo: in ops mode legacy's laDocNo answers the local guess, with no request to lk-inbox's /api/v1/_docno", () => {
  const jobs = src('allotment_v2/js/ops/24-ops-fleet-jobs.js');
  const block = between(jobs, "if(typeof window.laDocNo === 'function') wrap('laDocNo'", "wrap('flDeleteIncident'");
  const sent = [];
  const window = {
    laDocNo: () => { sent.push('xhr'); return 'MO-999'; },
    laDocNoPeek: (k) => `${k}-378`,
  };
  const ctx = vm.createContext({ window, enabled: () => true, originals: {}, console });
  vm.runInContext(`function wrap(name, fn){ var orig = window[name]; originals[name] = orig; window[name] = function(){ if(!enabled()) return orig.apply(this, arguments); return fn.apply(this, [orig].concat([].slice.call(arguments))); }; }\n${block}`, ctx);
  assert.equal(window.laDocNo('mo'), 'MO-378');
  assert.deepEqual(sent, []);
});

function configStore(entries) {
  const calls = [];
  const O = {
    enabled: () => true, state: { loaded: true }, busy: () => false, clone, wrote() {}, onWrite() {},
    fail: (t, e) => calls.push(['fail', t, e && e.message]),
    get: (p) => { calls.push(['GET', p]); return Promise.resolve(p === '/v1/config' ? { entries } : {}); },
    call: (m, p, b) => { calls.push([m, p, b]); return Promise.resolve({ key: p.split('/').pop(), value: b.value, version: (b.version || 0) + 1 }); },
    queue: (fn) => Promise.resolve().then(fn),
  };
  const legacyWrites = [];
  const window = {
    laOps: O, LA_ME: { username: 'acct' },
    ctRead: (k) => { legacyWrites.push(['read', k]); return null; },
    ctWrite: (k, v) => { legacyWrites.push(['write', k, v]); },
  };
  window.window = window;
  const ctx = vm.createContext(Object.assign(window, { document: { querySelector: () => null, getElementById: () => null }, setTimeout, clearTimeout, console }));
  vm.runInContext(src('allotment_v2/js/ops/61-ops-config-store.js'), ctx);
  return { window, calls, legacyWrites };
}

test('§pxForecast: px_central reads from GET /v1/config and saves with PUT /v1/config/px_central, never the blob', async () => {
  const { window, calls, legacyWrites } = configStore([{ key: 'px_central', value: { '2026-11': { pw: 644497 } }, version: 2 }]);
  assert.equal(window.ctRead('px_central'), null, 'before the answer: null, so pxFcSaved reads {} and the Oct seed stands');
  await flush();
  assert.deepEqual(clone(window.ctRead('px_central')), { '2026-11': { pw: 644497 } });
  window.ctWrite('px_central', { '2026-11': { pw: 644497, sm: 564355 } });
  window.ctWrite('px_central', { '2026-11': { pw: 644497, sm: 564355, ut: 68150 } });
  await new Promise((r) => setTimeout(r, 1600));
  await flush();
  const puts = calls.filter((c) => c[0] === 'PUT');
  assert.deepEqual(clone(puts.map((c) => [c[1], c[2]])), [['/v1/config/px_central', { value: { '2026-11': { pw: 644497, sm: 564355, ut: 68150 } }, version: 2 }]], 'two fields typed in a row go as one save');
  assert.deepEqual(legacyWrites, []);
  assert.equal(calls.filter((c) => c[0] === 'fail').length, 0);
});

function costingPL() {
  const gets = [], ranges = [], stAdds = [];
  const trip = (date) => ({ date, boat_id: 'b1', name: 'Zeus', route_id: 'r1', capacity: 40, pax: { total: 20, bookings: 5 }, revenue: 50000, cost: 30000, profit: 20000,
    rows: [{ id: 'fuel', group: 'น้ำมัน', label: 'Fuel', estimate: 9000, use: 9000 }, { id: 'dep', group: 'ค่าเสื่อม', label: 'Depreciation', estimate: 3000, use: 3000 }] });
  const O = {
    enabled: () => true, today: () => '2026-11-03', fail() {}, wrote() {}, onWrite() {}, loadingHtml: () => '', queue: (fn) => Promise.resolve().then(fn),
    shift: (ds, n) => { const d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    get: (p, q) => {
      gets.push([p, clone(q)]);
      if (p === '/v1/reports/trip-pl') return Promise.resolve({ date: q.date, trips: [trip(q.date)], bands: [], agents: [] });
      if (p === '/v1/reports/trip-pl/days') { const days = []; for (let d = q.from; d <= q.to; d = O.shift(d, 1)) days.push({ date: d, trips: [trip(d)], bands: [], agents: [] }); return Promise.resolve({ from: q.from, to: q.to, pier: null, days }); }
      if (p === '/v1/reports/trip-pl/pace') { ranges.push({ from: q.from, to: q.to }); return Promise.resolve({ from: q.from, to: q.to, days: { '2026-11-02': [{ booked: '2026-10-30', pier: 'tublamu', heads: 4 }, { booked: '2026-11-01', pier: 'panwa', heads: 2 }] } }); }
      if (p === '/v1/reports/trip-pl/month') return Promise.resolve({ month: q.month, days: [], rent_idle: null });
      return Promise.resolve({});
    },
  };
  let drawn = 0;
  const window = {
    laOps: O, _px: { tab: 'f', pier: '', date: '2026-11-03', mon: '2026-11' },
    renderTripPL: () => { drawn++; }, pxDay() {}, pxTrip() {}, pxDayAgg() { return { legacy: true }; }, pxAgents() {}, pxRentIdle() {},
    pxStAdd: (a, t) => { stAdds.push(t.bid); a.st = a.st || {}; a.st.r1 = { n: 1, op: t.rows.filter((r) => r.id !== 'dep').reduce((s, r) => s + r.use, 0), dep: 3000 }; },
    pxDaysOf: (ym) => (ym === '2026-11' ? ['2026-11-01', '2026-11-02'] : ['2026-10-30', '2026-10-31']),
    bookingV2LoadFromOpsBackend: () => { throw new Error('the pace must not page bookings'); },
    pxPaceRows: () => [{ c: 'browser', n: 1 }],
    pxCSS: () => '', pxBar: () => '',
  };
  window.window = window;
  const ctx = vm.createContext(Object.assign(window, { document: { getElementById: () => null, querySelector: () => null }, setTimeout, clearTimeout, console }));
  vm.runInContext(src('allotment_v2/js/ops/44-ops-costing-pl.js'), ctx);
  return { window, gets, ranges, stAdds, drawn: () => drawn };
}

test('§pxForecast: the Forecast tab reads the days of the month and of the month before, and the booking-pace window', async () => {
  const t = costingPL();
  t.window.renderTripPL();
  await flush();
  assert.equal(t.gets.filter((g) => g[0] === '/v1/reports/trip-pl').length, 0, 'no call per day (§plDays: it made 168)');
  const days = t.gets.filter((g) => g[0] === '/v1/reports/trip-pl/days').map((g) => g[1].from + '..' + g[1].to).sort();
  assert.deepEqual(days, ['2026-10-30..2026-10-31', '2026-11-01..2026-11-02'], 'this month so far and the month before, each with its trips (steps need them), one range read each');
  assert.deepEqual(clone(t.ranges), [{ from: '2026-10-05', to: '2026-11-30' }], '28 travel days back from yesterday, to the month end: one GET /v1/reports/trip-pl/pace (§plPace)');
  assert.deepEqual(clone(t.window.pxPaceRows('2026-11-02', '')), [{ c: '2026-10-30', n: 4 }, { c: '2026-11-01', n: 2 }], 'legacy pxPaceRows reads the server rows');
  assert.deepEqual(clone(t.window.pxPaceRows('2026-11-02', 'panwa')), [{ c: '2026-11-01', n: 2 }], 'by pier');
  assert.deepEqual(clone(t.window.pxPaceRows('2026-09-01', '')), [{ c: 'browser', n: 1 }], 'outside the window: legacy rows');
  assert.equal(t.drawn(), 1, 'drawn once everything landed');
  t.window.renderTripPL();
  await flush();
  assert.equal(t.ranges.length, 1, 'not read again while fresh');
});

test("§pxSteps: the day aggregate built from the server's trips carries legacy's profit-by-step split", async () => {
  const t = costingPL();
  t.window._px.tab = 'd';
  t.window.renderTripPL();
  await flush();
  const a = t.window.pxDayAgg('2026-11-03', '');
  assert.deepEqual(t.stAdds, ['b1']);
  assert.deepEqual(clone(a.st), { r1: { n: 1, op: 9000, dep: 3000 } });
  assert.equal(a.rev, 50000);
});
