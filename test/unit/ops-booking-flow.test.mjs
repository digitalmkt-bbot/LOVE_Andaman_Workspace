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
function loadAdapter({ enabled = true, daily, created, range, get, view = 'bookingflow' } = {}) {
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
    ...(get ? { get } : {}),
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

/* ── §bfSrvMk: the by-market bars ── */
// The browser store holds only this month's/last month's slice; the older bars used to
// fall into gray "other" because the market split was counted from loaded bookings only.
test('bfSrvMk: every bar is split by the server\'s market counts and the legend is ranked over the whole window', () => {
  const host = { innerHTML: '' };
  const now = new Date();
  const mon = (back) => ymd(new Date(now.getFullYear(), now.getMonth() - back, 1));
  const today = ymd(now);
  const dcFrom = mon(5);
  const dc = {};
  // oldest month: 100 bookings, all of them in the top markets; hpk is the biggest overall
  dc[mon(3).slice(0, 7) + '-05'] = { bk: 100, pax: 0, mk: { hpk: 50, ru: 30, ota: 12, b2c: 8 } };
  dc[mon(1).slice(0, 7) + '-05'] = { bk: 200, pax: 0, mk: { hpk: 90, ru: 60, ota: 30, b2c: 20 } };
  dc[mon(0) + ''] = { bk: 10, pax: 0, mk: { ota: 10 } };
  const MK = { hpk: ['Hotel Phuket', '#0F6E56'], ru: ['Russian Market', '#A05A1A'], ota: ['Online Travel Agent', '#185FA5'], b2c: ['B2C', '#E0457F'] };
  // a loaded slice that, ranked alone, would put ota first (the old wrong legend order)
  const mk = (ds) => ({ status: 'confirmed', bookingDate: ds, agentId: 'a1', marketSnapshot: { market: 'ota' }, trips: [{ routeId: 'r1', date: ds, pax: { ad_fr: 2 } }] });
  const ctx = {
    console, Promise, Date, String, Error, Math, Object, Array, JSON, isNaN, Number,
    document: { getElementById: (id) => (id === 'bookingflow-host' ? host : null) },
    SB_BOOKINGS: [mk(mon(0)), mk(mon(0).slice(0, 8) + '02'), mk(mon(1).slice(0, 8) + '05')],
    bookingV2LocalYMD: ymd,
    bookingV2PaxAllTot: (p) => Object.values(p || {}).reduce((s, x) => s + (+x || 0), 0),
    laMonAbbrTH: () => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
    pmMarket: (b) => (b.marketSnapshot && b.marketSnapshot.market) || 'unassigned',
    sbGetMarket: (c) => (MK[c] ? { name: MK[c][0], color: MK[c][1] } : null),
    _opsBfDaily: { from: dcFrom, to: today },
    bookingV2OpsDailyCounts: (from, to) => (from === dcFrom && to === today ? dc : null),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(sliceRender(), ctx);
  ctx.renderBookingFlow();
  const html = host.innerHTML;
  const legend = [...html.matchAll(/<span><i style="background:[^"]+"><\/i>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(legend.slice(0, 4), ['Hotel Phuket', 'Russian Market', 'Online Travel Agent', 'B2C']);
  const rects = [...html.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="([\d.]+)" fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => ({ h: +m[1], fill: m[2] }));
  const gray = rects.filter((r) => r.fill === '#94A3B8' && r.h > 0);
  assert.equal(gray.length, 0, 'no bar has a gray "other" remainder: the split is complete for every month');
  assert.ok(rects.some((r) => r.fill === '#0F6E56' && r.h > 0), 'Hotel Phuket is drawn on the older bars');
});

/* ── §bfSrvLead: Lead-Time Distribution ── */
const LEAD = { total: 100, buckets: [10, 40, 20, 10, 10, 10].map((count, i) => ({ key: 'k' + i, count })) };

test('bfSrvLead: the adapter reads /v1/bookings/lead-times before drawing and hands the buckets to the render', async () => {
  const reads = [];
  // the flow read fails here, so the fallback path draws (with the lead-time counts)
  const { ctx, host, calls } = loadAdapter({ get: (p) => { reads.push(p); return p === '/v1/bookings/flow' ? Promise.reject(new Error('down')) : Promise.resolve(LEAD); } });
  await ctx.renderBookingFlow();
  assert.deepEqual(reads, ['/v1/bookings/flow', '/v1/bookings/lead-times']);
  assert.equal(ctx._opsBfLead, LEAD);
  assert.equal(calls.filter((c) => c.render).length, 1);
  assert.equal(host.innerHTML, 'FLOW');
});

test('bfSrvLead: a failed lead-times read draws anyway from the loaded bookings', async () => {
  const { ctx, calls } = loadAdapter({ get: () => Promise.reject(new Error('boom')) });
  await ctx.renderBookingFlow();
  assert.equal(ctx._opsBfLead, null);
  assert.equal(calls.filter((c) => c.render).length, 1);
});

test('bfSrvLead: the histogram is drawn from the server counts, not the loaded slice', () => {
  const host = { innerHTML: '' };
  const now = new Date();
  const ds = ymd(now);
  const mk = (d) => ({ status: 'confirmed', bookingDate: d, trips: [{ routeId: 'r1', date: d, pax: { ad_fr: 2 } }] });   // loaded: all same-day
  const ctx = {
    console, Promise, Date, String, Error, Math, Object, Array, JSON, isNaN, Number,
    document: { getElementById: (id) => (id === 'bookingflow-host' ? host : null) },
    SB_BOOKINGS: [mk(ds), mk(ds), mk(ds)],
    bookingV2LocalYMD: ymd,
    bookingV2PaxAllTot: (p) => Object.values(p || {}).reduce((s, x) => s + (+x || 0), 0),
    laMonAbbrTH: () => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
    _opsBfLead: LEAD,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(sliceRender(), ctx);
  ctx.renderBookingFlow();
  const svg = host.innerHTML.slice(host.innerHTML.indexOf('max-width:560px'));
  const pcts = [...svg.matchAll(/font-weight="700" fill="#39404b">(\d+)%</g)].map((m) => +m[1]);
  assert.deepEqual(pcts, [10, 40, 20, 10, 10, 10]);
});

/* ── §bfSrvFlow: the whole page from GET /v1/bookings/flow ── */
function flowAnswer(mode, today) {
  const shiftD = (n) => shift(today, n);
  return {
    mode, today,
    buckets: [{ label: 'ต.ค.', from: '2026-10-01', to: '2026-10-31', total: 4110, markets: { ru: 2000, ota: 800, __other: 1310 } },
              { label: 'พ.ย.', from: today.slice(0, 8) + '01', to: today.slice(0, 8) + '28', total: 5691, markets: { ru: 3025, ota: 850, __other: 1816 } }],
    markets: [{ code: 'ru', name: 'Russian Market', color: '#c43a2e' }, { code: 'ota', name: 'Online Travel Agent', color: '#185FA5' }, { code: '__other', name: 'อื่นๆ', color: '#94A3B8' }],
    moving_avg: [0, 0],
    in_vs_travel: Array.from({ length: 30 }, (_, i) => ({ date: shiftD(i - 14), dow: 'Mon', in: i === 13 ? 681 : 0, travel: i === 14 ? 569 : 0, today: i === 14 })),
    kpi: { bookings: 5691, pax: 14065, avg_lead: 9.3, top_market: { code: 'ru', name: 'Russian Market', color: '#c43a2e', count: 3025 },
      top_sales: { id: 's05', name: 'MISHA', color: '#6c5ce7', count: 3027, pax: 6957 }, change_pct: 38, previous_total: 4110, range: { from: '2026-06-01', to: '2026-11-30' } },
    sales: [{ id: 's05', name: 'MISHA', color: '#6c5ce7', pax: 6957, count: 3027 }, { id: '__none', name: '(ไม่ระบุเซลล์)', color: '#B8B3C8', pax: 1677, count: 538 }],
    markets_top: [{ code: 'ru', name: 'Russian Market', color: '#c43a2e', count: 3025, pct: 53 }],
    families: [{ id: 'f1', name: 'Similan Islands', color: '#1683C7', pax: 7000, pct: 52 }],
    calendar: { month: today.slice(0, 7), days: Array.from({ length: 28 }, (_, i) => ({ day: i + 1, pax: i === 0 ? 522 : 0 })) },
    cohort: { rows: [shiftD(-13)], cols: [shiftD(-13), shiftD(-12)], cells: [[7, 0]] },
  };
}

test('bfSrvFlow: the adapter reads /v1/bookings/flow and the lead times, pages no bookings and draws once', async () => {
  const reads = [];
  const F = flowAnswer('month', '2026-10-14');
  const { ctx, host, calls } = loadAdapter({ get: (p, q) => { reads.push(p + (q && q.mode ? '?mode=' + q.mode : '')); return Promise.resolve(p === '/v1/bookings/flow' ? F : LEAD); } });
  await ctx.renderBookingFlow();
  assert.deepEqual(reads.sort(), ['/v1/bookings/flow?mode=month', '/v1/bookings/lead-times']);
  assert.equal(ctx._opsBfFlow, F);
  assert.equal(calls.filter((c) => c.daily || c.created || c.range).length, 0, 'no booking range is paged');
  assert.equal(calls.filter((c) => c.render).length, 1);
  assert.equal(host.innerHTML, 'FLOW');
  await ctx.renderBookingFlow();   // a second draw within the minute reads nothing
  assert.equal(reads.length, 2);
  assert.equal(calls.filter((c) => c.render).length, 2);
});

test('bfSrvFlow: a failed flow read falls back to the paged loads', async () => {
  const { ctx, calls } = loadAdapter({ get: (p) => (p === '/v1/bookings/flow' ? Promise.reject(new Error('down')) : Promise.resolve(LEAD)), daily: () => Promise.resolve(true) });
  await ctx.renderBookingFlow();
  assert.equal(ctx._opsBfFlow, null);
  assert.ok(calls.some((c) => c.daily), 'the daily counts are read instead');
  assert.equal(calls.filter((c) => c.render).length, 1);
});

test('bfSrvFlow: the render takes every figure from the answer, with no booking in the browser', () => {
  const host = { innerHTML: '' };
  const today = ymd(new Date());
  const F = flowAnswer('month', today);
  const ctx = {
    console, Promise, Date, String, Error, Math, Object, Array, JSON, isNaN, Number,
    document: { getElementById: (id) => (id === 'bookingflow-host' ? host : null) },
    SB_BOOKINGS: [],
    bookingV2LocalYMD: ymd,
    bookingV2PaxAllTot: () => 0,
    laMonAbbrTH: () => ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    sbGetMarket: (c) => ({ ru: { name: 'Russian Market', color: '#c43a2e' }, ota: { name: 'Online Travel Agent', color: '#185FA5' } })[c] || null,
    _opsBfFlow: F, _opsBfLead: LEAD,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(sliceRender(), ctx);
  ctx.renderBookingFlow();
  const html = host.innerHTML;
  assert.doesNotMatch(html, /ยังไม่มีบุคกิ้ง/, 'an empty browser store is not "no bookings"');
  assert.match(html, /5[,.  ]?691/);
  assert.match(html, /▲ 38% vs last month/);
  assert.match(html, /14[,.  ]?065/);
  assert.match(html, /9\.3 <span>days/);
  assert.match(html, /Russian Market<\/div><div class="bfw-kd">53% of bookings/);
  assert.match(html, /MISHA<\/div><div class="bfw-kd">3027 bookings/);
  assert.match(html, /6957 \(3027\)/);
  assert.match(html, /1677 \(538\)/);
  assert.match(html, /Similan Islands<\/div>.*?52%/s);
  const legend = [...html.matchAll(/<span><i style="background:[^"]+"><\/i>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(legend.slice(0, 3), ['Russian Market', 'Online Travel Agent', 'อื่นๆ']);
  assert.match(html, /title="522 pax ออกเดินทาง"/);
  assert.match(html, /· 7 pax" style="background:rgba\(22,131,199/);
});
