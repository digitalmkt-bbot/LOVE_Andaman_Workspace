// §b2dParity · B2B Sales Dashboard on operation-backend must show what lk-inbox shows.
// These tests run the REAL legacy dashboard code (the b2b-dash section of 08-app.js) under the
// adapter (js/ops/55-ops-foc-b2b.js), against a fake operation-backend, and compare with the same
// legacy code run directly over the whole dataset (= lk-inbox, which holds every booking).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const LOADER = fs.readFileSync('allotment_v2/js/booking/bookingV2LoadFromOpsBackend.js', 'utf8');
const SOURCE = fs.readFileSync(process.env.B2D_ADAPTER || 'allotment_v2/js/ops/55-ops-foc-b2b.js', 'utf8');
const APP = fs.readFileSync('allotment_v2/js/08-app.js', 'utf8');
const LEGACY = (() => {
  const a = APP.indexOf('window._b2d = window._b2d ||');
  const b = APP.lastIndexOf('/*', APP.indexOf('§pierOffice · Office', a));
  assert.ok(a > 0 && b > a, 'b2b-dash section found in 08-app.js');
  return APP.slice(a, b);
})();

// server booking → client shape (the fields the dashboard reads; stands in for laOpsFromServer)
const fromServer = (ob) => ({
  id: ob.external_id || ob.id, opsId: ob.id, opsVersion: ob.version, status: ob.status,
  agentId: ob.agent_id, bookingDate: ob.booking_date || '', createdAt: ob.created_at || '',
  priceBreakdown: { total: ob.total },
  trips: (ob.trips || []).map((t) => ({ date: t.service_date, routeId: t.route_id, pax: t.pax })),
});

// ── a fake dataset: 14 months of B2B bookings, a few deliberately awkward ones ──
const AGENTS = [{ id: 'ag1', name: 'Alpha', code: 'A' }, { id: 'ag2', name: 'Bravo', code: 'B' }, { id: 'ag3', name: 'Charlie', code: 'C' }];
function dataset() {
  const out = [];
  let n = 0;
  const add = (bd, td, agent, total, pax, over = {}) => {
    n++;
    out.push({ id: 'ops' + String(n).padStart(4, '0'), external_id: 'BK-' + String(n).padStart(4, '0'), version: 1,
      status: 'confirmed', agent_id: agent, booking_date: bd, created_at: bd + 'T03:00:00.000Z', total,
      trips: [{ service_date: td, route_id: n % 2 ? 'r7' : 'r1', pax: { ad_fr: pax } }], ...over });
  };
  // one booking per agent per month, Sep 2025 .. Oct 2026, uneven amounts → a jagged monthly line
  const months = [];
  for (let y = 2025, m = 9; y < 2026 || m <= 10; m++) { if (m > 12) { m = 1; y++; } months.push(y + '-' + String(m).padStart(2, '0')); if (y === 2026 && m === 10) break; }
  months.forEach((ym, i) => {
    add(ym + '-05', ym + '-20', 'ag1', 10000 + (i % 3) * 7000, 2 + (i % 4));
    add(ym + '-11', ym + '-25', 'ag2', 5000 + (i % 5) * 3000, 1 + (i % 3));
    if (i % 2) add(ym + '-02', ym + '-28', 'ag3', 8000, 3);
  });
  // the newest booking date in the data is 2026-10-13 (lk-inbox's default reference date)
  add('2026-10-13', '2026-12-29', 'ag3', 6700, 3);
  // created long before its booking date — a created-date window never finds it
  add('2026-08-20', '2026-08-30', 'ag2', 44000, 6, { created_at: '2026-03-01T03:00:00.000Z' });
  // not confirmed / B2C: the legacy filter drops them; the server filter must not resurrect them
  add('2026-10-01', '2026-10-02', 'ag1', 99999, 9, { status: 'cancelled' });
  add('2026-10-01', '2026-10-02', 'a_b2c', 77777, 9);
  return out;
}

function fakeServer(rows, requests) {
  return async (path, opts = {}) => {
    requests.push(path);
    const [p, q] = path.split('?');
    const qs = new URLSearchParams(q || '');
    let list = rows.slice();
    if (p === '/v1/bookings') {
      if (qs.get('status')) list = list.filter((b) => qs.get('status').split(',').includes(b.status));
      if (qs.get('from')) list = list.filter((b) => b.trips.some((t) => t.service_date >= qs.get('from') && t.service_date <= qs.get('to')));
    } else if (p === '/v1/bookings/recent') {
      list = list.filter((b) => b.created_at.slice(0, 10) >= qs.get('created_from') && b.created_at.slice(0, 10) <= qs.get('created_to'));
    } else throw new Error('unexpected request ' + path);
    const start = +(qs.get('cursor') || 0), limit = +(qs.get('limit') || 100);
    const page = list.slice(start, start + limit);
    const body = { bookings: page, ...(start + limit < list.length ? { next_cursor: String(start + limit) } : {}) };
    return { status: 200, ok: true, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

function runtime({ rows = dataset(), bookings = [], enabled = true, b2d, adapter = true } = {}) {
  const requests = [];
  const wrapEl = { innerHTML: '' };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, Promise, Error, JSON, Object, Array, Number, String, Math, Date, URLSearchParams,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    SB_BOOKINGS: bookings, SB_AGENTS: AGENTS, SB_SALES: [], SB_MARKETS: [],
    document: {
      activeElement: null,
      querySelector: () => ({ dataset: { view: 'b2b-dash' } }),
      getElementById: (id) => (id === 'b2bdash-wrap' ? wrapEl : null),
      createElement: () => ({ style: {}, textContent: '' }),
    },
    setTimeout, clearTimeout,
    bookingV2FromOpsBooking: fromServer,
  };
  if (b2d) ctx._b2d = b2d;
  ctx.window = ctx;
  ctx.laOpsFetch = fakeServer(rows, requests);
  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);
  vm.runInContext(LOADER, ctx);
  vm.runInContext(LEGACY, ctx);
  if (adapter) vm.runInContext(SOURCE, ctx);
  const settle = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 0)); };
  const open = async () => { ctx.renderB2BDash(); await settle(); };
  const snap = () => ({ html: wrapEl.innerHTML, w: JSON.parse(JSON.stringify(ctx._b2dW || null)) });
  return { ctx, requests, wrapEl, settle, open, snap };
}

// lk-inbox: the same legacy code over every booking it holds (no adapter, whole store)
function lkView(b2d) {
  const rt = runtime({ adapter: false, bookings: dataset().map(fromServer).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), b2d });
  rt.ctx.renderB2BDash();
  return rt.snap();
}
// points of the KPI sparkline paths: one per data point ("M x y" + one "C … x y" per segment)
const sparkPoints = (html) => [...html.matchAll(/<path d="(M [^"]+)" fill="none"/g)].map((m) => 1 + (m[1].match(/ C /g) || []).length);

test('reference date: newest booking date in the whole dataset, as lk-inbox — not today', async () => {
  const rt = runtime();
  await rt.open();
  assert.equal(rt.ctx._b2dW.ref, '2026-10-13', 'Month (MoM) opens on the newest booking date');
  assert.deepEqual([rt.ctx._b2dW.cs, rt.ctx._b2dW.ce, rt.ctx._b2dW.ps, rt.ctx._b2dW.pe], ['2026-09-14', '2026-10-13', '2026-08-15', '2026-09-13']);
  assert.equal(rt.ctx._b2d.ref, null, 'the default is never pinned: it follows the data and the basis');
  assert.match(rt.wrapEl.innerHTML, /type="date" value="2026-10-13"/);
  assert.equal(rt.snap().w.ref, lkView().w.ref);
  // travel-date basis: newest travel date, as lk-inbox
  rt.ctx.b2dSet('basis', 'td');
  await rt.settle();
  assert.equal(rt.ctx._b2dW.ref, '2026-12-29');
  assert.equal(rt.ctx._b2dW.ref, lkView({ basis: 'td', mode: 'mom', ref: null, T: 10, tab: 'overview', trip: null, stack: [], screen: null }).w.ref);
});

test('previous period does not depend on what the browser loaded before', async () => {
  const all = dataset();
  // A: dashboard opened first, empty cache
  const a = runtime();
  await a.open();
  // B: other screens loaded some bookings first — including the one created months before its booking date
  const pre = all.filter((b) => b.booking_date >= '2026-08-01' && b.booking_date <= '2026-09-30').map(fromServer);
  const b = runtime({ bookings: pre });
  await b.open();
  // C: a cache holding only stray far-away bookings
  const c = runtime({ bookings: all.filter((x) => x.booking_date < '2026-01-01').map(fromServer) });
  await c.open();
  const lk = lkView();
  assert.equal(a.snap().html, lk.html, 'opened first: identical to lk-inbox, byte for byte');
  assert.equal(b.snap().html, lk.html, 'opened after other screens: identical');
  assert.equal(c.snap().html, lk.html, 'with stray cached bookings: identical');
  assert.match(lk.html, /vs ฿[0-9,.K]+ last period/);
  assert.equal(b.ctx.SB_BOOKINGS.length, pre.length, 'the snapshot is not merged into SB_BOOKINGS');
});

test('sparklines: one point per month over the whole history, as lk-inbox', async () => {
  const rt = runtime();
  await rt.open();
  const months = new Set(dataset().filter((b) => b.status === 'confirmed' && b.agent_id !== 'a_b2c').map((b) => b.booking_date.slice(0, 7))).size;
  assert.equal(months, 14);
  assert.deepEqual(sparkPoints(rt.wrapEl.innerHTML), [14, 14, 14, 14], 'four KPI cards, 14 monthly points each');
  assert.deepEqual(sparkPoints(rt.wrapEl.innerHTML), sparkPoints(lkView().html));
  const series = rt.ctx.b2dMonthlySeries(rt.ctx._b2dL);
  assert.deepEqual(series.map((s) => s.ym)[0], '2025-09');
  assert.deepEqual(JSON.parse(JSON.stringify(series)), JSON.parse(JSON.stringify((() => { const l = runtime({ adapter: false, bookings: dataset().map(fromServer) }); l.ctx.renderB2BDash(); return l.ctx.b2dMonthlySeries(l.ctx._b2dL); })())));
});

test('every tab and a chosen date match lk-inbox', async () => {
  const rt = runtime();
  await rt.open();
  for (const tab of ['overview', 'staff', 'trip', 'market', 'growth', 'loss', 'stable']) {
    rt.ctx.b2dTab(tab);
    await rt.settle();
    assert.equal(rt.snap().html, lkView({ basis: 'bd', mode: 'mom', ref: null, T: 10, tab, trip: null, stack: [], screen: null }).html, 'tab ' + tab);
  }
  rt.ctx.b2dTab('overview');
  rt.ctx.b2dSet('ref', '2026-08-20');
  await rt.settle();
  assert.equal(rt.snap().html, lkView({ basis: 'bd', mode: 'mom', ref: '2026-08-20', T: 10, tab: 'overview', trip: null, stack: [], screen: null }).html);
});

test('one paged read of confirmed bookings; no refetch while fresh', async () => {
  const rows = dataset();
  for (let i = 0; i < 1500; i++) rows.push({ ...rows[0], id: 'pad' + String(i).padStart(4, '0'), external_id: 'PAD-' + String(i).padStart(4, '0'), status: 'cancelled' });
  for (let i = 0; i < 1200; i++) rows.push({ ...rows[0], id: 'old' + String(i).padStart(4, '0'), external_id: 'OLD-' + String(i).padStart(4, '0'), booking_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z', trips: [{ service_date: '2025-01-02', route_id: 'r1', pax: { ad_fr: 1 } }] });
  const rt = runtime({ rows });
  await rt.open();
  assert.ok(rt.requests.length === 2 && rt.requests.every((p) => p.startsWith('/v1/bookings?status=confirmed&limit=1000')), rt.requests.join(' '));
  assert.ok(rt.requests[1].endsWith('&cursor=1000'), 'second page follows the cursor');
  rt.ctx.renderB2BDash(); rt.ctx.b2dTab('staff');
  await rt.settle();
  assert.equal(rt.requests.length, 2, 'cached snapshot: no further reads');
});

test('a booking edited in this browser (newer opsVersion) replaces its snapshot copy', async () => {
  const rt = runtime();
  await rt.open();
  const before = rt.ctx._b2dL.filter((l) => l.bkid === 'BK-0001').length;
  assert.equal(before, 1);
  const edited = { ...fromServer(dataset()[0]), opsVersion: 2, status: 'cancelled' };
  rt.ctx.SB_BOOKINGS.push(edited);
  rt.ctx.renderB2BDash();
  assert.equal(rt.ctx._b2dL.filter((l) => l.bkid === 'BK-0001').length, 0, 'the cancel made here shows at once');
  const stale = { ...fromServer(dataset()[1]), opsVersion: 0, status: 'cancelled' };
  rt.ctx.SB_BOOKINGS.push(stale);
  rt.ctx.renderB2BDash();
  assert.equal(rt.ctx._b2dL.filter((l) => l.bkid === 'BK-0002').length, 1, 'an older cached copy never overrides the snapshot');
});

test('a failed read shows an error once, does not loop, and Retry reads again', async () => {
  const rt = runtime();
  let fail = true;
  const real = rt.ctx.laOpsFetch;
  rt.ctx.laOpsFetch = async (p, o) => { if (fail) { rt.requests.push(p); return { status: 500, ok: false, json: async () => ({}), text: async () => '{"message":"boom"}' }; } return real(p, o); };
  await rt.open();
  assert.equal(rt.requests.length, 1, 'one attempt, no fetch-fail-redraw loop');
  assert.match(rt.wrapEl.innerHTML, /did not load/);
  fail = false;
  rt.ctx.b2dOpsRetry();
  await rt.settle();
  assert.match(rt.wrapEl.innerHTML, /B2B Sales Dashboard/);
});

test('legacy mode: the original render over the local store, nothing sent', async () => {
  const rt = runtime({ enabled: false, bookings: dataset().map(fromServer) });
  await rt.open();
  assert.equal(rt.requests.length, 0);
  assert.equal(rt.ctx._b2dW.ref, '2026-10-13');
});
