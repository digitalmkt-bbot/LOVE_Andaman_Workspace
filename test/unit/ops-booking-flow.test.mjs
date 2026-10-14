// Booking Flow (js/ops/53-ops-booking-flow.js + §bfSrvTot in 08-app.js):
// - the adapter loads the screen's creation window, trip window and the 6-month
//   server daily-counts before the legacy renderBookingFlow sums SB_BOOKINGS;
// - §bfSrvTot makes renderBookingFlow take its intake-bucket TOTALS from the
//   server's daily-counts, so an unloaded month (last month: 1171 bookings,
//   789 loaded) no longer yields a bogus MoM delta.
//   node --test test/unit/ops-booking-flow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ADAPTER = fs.readFileSync('allotment_v2/js/ops/53-ops-booking-flow.js', 'utf8');
const APP = fs.readFileSync('allotment_v2/js/08-app.js', 'utf8');

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function shift(ds, n) {
  const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d);
}

/* ── the adapter ── */
function loadAdapter({ enabled = true, daily, created, range, view = 'bookingflow' } = {}) {
  const host = { innerHTML: '', firstChild: null };
  const calls = [];
  const ctx = {
    console, Promise, Date, String, Error,
    TODAY_STR: '2026-10-14',
    document: { getElementById: (id) => (id === 'bookingflow-host' ? host : null) },
    renderBookingFlow() { calls.push({ render: true }); host.innerHTML = 'FLOW'; host.firstChild = {}; },
    bookingV2OpsEnsureDailyCounts(from, to) { calls.push({ daily: [from, to] }); return daily ? daily(from, to) : null; },
    bookingV2OpsEnsureCreated(from, to) { calls.push({ created: [from, to] }); return created ? created(from, to) : null; },
    bookingV2EnsureOpsRange(opt) { calls.push({ range: opt }); return range ? range(opt) : null; },
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => enabled,
    today: () => '2026-10-14',
    ymd, shift,
    activeView: () => view,
    loadingHtml: (label) => 'SPIN:' + label,
  };
  vm.createContext(ctx);
  vm.runInContext(ADAPTER, ctx);
  return { ctx, host, calls };
}

test('loads 6 months of daily counts, the comparison creation window and the travel window, then draws once', async () => {
  const releases = [];
  const pend = () => new Promise((r) => releases.push(r));
  const { ctx, host, calls } = loadAdapter({ daily: pend, created: pend, range: pend });
  const p = ctx.renderBookingFlow();
  assert.deepEqual(calls.find((c) => c.daily).daily, ['2026-05-01', '2026-10-14']);
  // earliest of: 1st of month (10-01) · Monday 7 weeks back (08-24) · today−13 (10-01)
  assert.deepEqual(calls.find((c) => c.created).created, ['2026-08-24', '2026-10-14']);
  const r = calls.find((c) => c.range).range;
  assert.deepEqual([r.from, r.to], ['2026-09-30', '2026-10-31']);
  assert.deepEqual([ctx._opsBfDaily.from, ctx._opsBfDaily.to], ['2026-05-01', '2026-10-14']);
  assert.match(host.innerHTML, /^SPIN:/);
  releases.forEach((rel) => rel({ ok: true }));
  await p;
  assert.equal(calls.filter((c) => c.render).length, 1);
  assert.equal(host.innerHTML, 'FLOW');
});

test('windows already in memory draw straight away', () => {
  const { ctx, host, calls } = loadAdapter();
  ctx.renderBookingFlow();
  assert.equal(host.innerHTML, 'FLOW');
  assert.equal(calls.filter((c) => c.render).length, 1);
});

test('legacy mode calls the original untouched', () => {
  const { ctx, calls } = loadAdapter({ enabled: false });
  ctx.renderBookingFlow();
  assert.deepEqual(calls, [{ render: true }]);
});

/* ── §bfSrvTot in the legacy render ── */
// Slice renderBookingFlow (with its _bfMode state) out of 08-app.js and run it
// against a browser store that holds only part of each month, plus the server's
// daily-counts. Without §bfSrvTot the KPI counts the partial store (bogus MoM).
function sliceRender() {
  const start = APP.indexOf("let _bfMode='month';");
  const end = APP.indexOf('function renderInsurance()');
  assert.ok(start > 0 && end > start, 'renderBookingFlow not found in 08-app.js');
  return APP.slice(start, end);
}

function runRender({ serverCounts } = {}) {
  const host = { innerHTML: '' };
  const now = new Date();
  const curM = ymd(new Date(now.getFullYear(), now.getMonth(), 1)).slice(0, 7);
  const prevM = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const today = ymd(now);
  // the browser store holds only a slice of each month: 3 of this month, 1 of last
  const mk = (ds) => ({ status: 'confirmed', bookingDate: ds, trips: [{ routeId: 'r1', date: ds, pax: { ad_fr: 2 } }] });
  const SB = [mk(curM + '-01'), mk(curM + '-02'), mk(curM + '-03'), mk(prevM + '-05')];
  const dcFrom = ymd(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const dc = {};
  if (serverCounts) { dc[curM + '-01'] = { bk: 1002, pax: 0 }; dc[prevM + '-05'] = { bk: 1171, pax: 0 }; }
  const ctx = {
    console, Promise, Date, String, Error, Math, Object, Array, JSON, isNaN, Number,
    document: { getElementById: (id) => (id === 'bookingflow-host' ? host : null) },
    SB_BOOKINGS: SB,
    bookingV2LocalYMD: ymd,
    bookingV2PaxAllTot: (p) => Object.values(p || {}).reduce((s, x) => s + (+x || 0), 0),
    laMonAbbrTH: () => ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    _opsBfDaily: serverCounts ? { from: dcFrom, to: today } : undefined,
    bookingV2OpsDailyCounts: (from, to) => (serverCounts && from === dcFrom && to === today ? dc : null),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(sliceRender(), ctx);
  ctx.renderBookingFlow();
  return host.innerHTML;
}

test('bfSrvTot: intake-bucket totals come from the server daily-counts, not the partial store', () => {
  const html = runRender({ serverCounts: true });
  // this month = 1,002 and last month = 1,171 → ▼ 14%, however few bookings are loaded
  assert.match(html, /1[,.  ]?002/);   // toLocaleString grouping varies by machine locale
  assert.match(html, /▼ 14%/);
  assert.doesNotMatch(html, /▲ 200%/);
});

test('bfSrvTot: without server counts the render still works on what is loaded', () => {
  const html = runRender({ serverCounts: false });
  assert.match(html, /New bookings/);
});
