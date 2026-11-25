import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const LOADER = fs.readFileSync('allotment_v2/js/booking/bookingV2LoadFromOpsBackend.js', 'utf8');
const SOURCE = fs.readFileSync('allotment_v2/js/ops/55-ops-foc-b2b.js', 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

// local-date helpers mirroring 00-ops-core's ymd/shift (never toISOString: +07:00 shift)
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shift = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const TODAY = ymd(new Date());

// server booking → the few client fields these screens read (stands in for laOpsFromServer)
const fromServer = (ob) => ({
  id: ob.id, opsId: ob.id, status: ob.status || 'confirmed',
  bookingDate: ob.booking_date || null, createdAt: ob.created_at || null, agentId: ob.agent_id || 'ag1',
  trips: (ob.trips || []).map((t) => ({ date: t.service_date, routeId: t.route_id || 'r1', pax: t.pax || {} })),
});

function runtime({ enabled = true, handlers = {}, bookings = [], view = 'focdetail', b2d } = {}) {
  const requests = [], renders = { renderFocDetail: [], renderB2BDash: [] };
  const host = { firstChild: null, inserted: [], insertBefore(el) { this.inserted.push(el); this.firstChild = el; } };
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Number, String, Math, Date,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    SB_BOOKINGS: bookings,
    _b2d: b2d || { basis: 'bd', mode: 'mom', ref: null, T: 10, tab: 'overview', trip: null, stack: [], screen: null },
    document: {
      querySelector: () => ({ dataset: { view } }),
      getElementById: (id) => (id === 'foc-host' ? host : null),
      createElement: () => ({ style: {}, textContent: '' }),
    },
    setTimeout, clearTimeout,
    bookingV2FromOpsBooking: fromServer,
  };
  ctx.window = ctx;
  // the legacy renders under test: snapshot what SB_BOOKINGS holds when they run
  ['renderFocDetail', 'renderB2BDash'].forEach((n) => {
    ctx[n] = () => { renders[n].push(ctx.SB_BOOKINGS.map((b) => b.id)); return 'legacy:' + n; };
  });
  ctx.laOpsFetch = async (path, opts = {}) => {
    requests.push({ method: opts.method || 'GET', path });
    const key = (opts.method || 'GET') + ' ' + path.split('?')[0];
    const h = handlers[key];
    if (h === undefined) throw new Error('unexpected request ' + key);
    const r = typeof h === 'function' ? await h(path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, json: async () => out, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);
  vm.runInContext(LOADER, ctx);
  vm.runInContext(SOURCE, ctx);
  const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
  return { ctx, requests, renders, host, settle };
}

const sb = (id, over = {}) => ({ id, opsId: id, status: 'confirmed', agentId: 'ag1', trips: [], ...over });
const srv = (id, over = {}) => ({ id, status: 'confirmed', agent_id: 'ag1', trips: [], ...over });

// ── FOC Detail ───────────────────────────────────────────────────────────────

test('FOC Detail reads GET /v1/bookings/foc-detail once (no booking paging) and draws the legacy render over its stand-in bookings', async () => {
  const rt = runtime({
    bookings: [sb('cached', { trips: [{ date: TODAY, routeId: 'r1', pax: { foc: 2 } }] })],
    handlers: { 'GET /v1/bookings/foc-detail': { body: {
      foc: [{ booking_id: 'F1', agent_id: 'ag1', channel: null, value: 900, reason: 'Guide', approval: 'approved', trips: [{ date: TODAY, route_id: 'r1', pax: 3, foc: 1 }] }],
      shares: [{ agent_id: 'ag1', route_id: 'r1', pax: 4, value: 2000 }], agents: [{ agent_id: 'ag1', value: 2000 }],
    } } },
  });
  rt.ctx.renderFocDetail();
  await rt.settle();
  assert.deepEqual(rt.requests.map((r) => r.path), ['/v1/bookings/foc-detail'], 'one summary read, never GET /v1/bookings');
  assert.equal(rt.renders.renderFocDetail.length, 1, 'no partial first paint: drawn once the answer is in');
  assert.deepEqual(plain(rt.renders.renderFocDetail[0]), ['F1', 'focd_s0'], 'the FOC booking whole, the folded share as one stand-in');
  assert.deepEqual(plain(rt.ctx.SB_BOOKINGS.map((b) => b.id)), ['cached'], 'SB_BOOKINGS itself is restored after the swap');
});

test('FOC Detail does not refetch within a minute and does not loop', async () => {
  let hits = 0;
  const rt = runtime({ handlers: { 'GET /v1/bookings/foc-detail': () => { hits++; return { body: { foc: [], shares: [], agents: [] } }; } } });
  rt.ctx.renderFocDetail();
  await rt.settle();
  rt.ctx.renderFocDetail();
  await rt.settle();
  assert.equal(hits, 1, 'read once');
  assert.equal(rt.renders.renderFocDetail.length, 2, 'the answer redraws, then the second open draws from the cache');
});

// ── B2B Dashboard ── see ops-b2b-dash.test.mjs (§b2dParity: whole confirmed history, real legacy render)

// ── legacy mode ──────────────────────────────────────────────────────────────

test('legacy mode delegates both renders untouched and sends nothing', async () => {
  const rt = runtime({ enabled: false, bookings: [sb('old', { trips: [{ date: '2025-01-05' }] })] });
  rt.ctx.renderFocDetail();
  rt.ctx.renderB2BDash();
  await rt.settle();
  assert.equal(rt.requests.length, 0);
  assert.deepEqual(plain(rt.renders.renderFocDetail), [['old']], 'legacy render sees the full local store');
  assert.equal(rt.ctx._b2d.ref, null, 'legacy keeps its latest-booking-date reference behaviour');
});
