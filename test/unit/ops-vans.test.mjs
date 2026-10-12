import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const SOURCE = fs.readFileSync('allotment_v2/js/ops/34-ops-vans.js', 'utf8');
const D = '2026-10-02';
const R = 'r1';
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const LEGACY = [
  'bookingV2VanGroupSetVan', 'bookingV2AssignVan', 'bookingV2VanGroupSetTime', 'bookingV2VanGroupDisband',
  'bookingV2VanGroupSelected', 'bookingV2VanGroupSave', 'bookingV2VanGroupClearSeq', 'bookingV2VanGroupSetReturn',
  'bookingV2AssignVanReturn', 'bookingV2AssignVanReturnSplit', 'bookingV2SetReturnSameVan', 'bookingV2VanSplit',
  'bookingV2VanUnsplit', 'bookingV2VanClearRoute', 'bookingV2VanAutoAssign', 'bookingV2VanGroupHeal',
];

// one booking, one trip on D/r1 in zone PK, with a server trip id
const trip = (n, zone = 'PK', extra = {}) => ({ date: D, routeId: R, zone, opsTripId: 'trip_' + n, pax: { ad_fr: 2 }, ...extra });
function bookings() {
  return [
    { id: 'b1', opsId: 'lg_1', status: 'confirmed', pickupZone: 'PK', trips: [trip(1)], ops: {} },
    { id: 'b2', opsId: 'lg_2', status: 'confirmed', pickupZone: 'PK', trips: [trip(2)], ops: {} },
    { id: 'b3', opsId: 'lg_3', status: 'confirmed', pickupZone: 'PK', trips: [trip(3)], ops: { vanGroup: 5, vanSeq: 1, vanId: 'veh01' } },
    { id: 'b4', opsId: 'lg_4', status: 'confirmed', pickupZone: 'PK', trips: [trip(4)], ops: { vanGroup: 2, vanSeq: 1, vanId: 'veh01', pickupTimeFinal: '07:00' } },
    { id: 'b5', opsId: 'lg_5', status: 'confirmed', pickupZone: 'PK', trips: [trip(5)], ops: {} },
    { id: 'b6', opsId: 'lg_6', status: 'confirmed', pickupZone: 'NoTransfer', pickupSelf: true, trips: [trip(6, 'NoTransfer')], ops: {} },
    { id: 'b7', status: 'confirmed', pickupZone: 'PK', trips: [trip(7)], ops: {} }, // no opsId yet
    { id: 'b8', opsId: 'lg_8', status: 'cancelled', pickupZone: 'PK', trips: [trip(8)], ops: { vanGroup: 3, vanId: 'veh07' } },
    { id: 'b9', opsId: 'lg_9', status: 'confirmed', pickupZone: 'PK', trips: [trip(9, 'PK', { date: '2026-10-03' })], ops: {} },
  ];
}

const group = (over = {}) => ({
  id: 'vgrp_3', service_date: D, route_id: R, zone: 'PK', number: 3, van_id: 'veh07', return_van_id: null,
  pickup_time: '06:40', pax: 2, members: [
    { trip_id: 'trip_1', booking_id: 'lg_1', idx: 0, sequence: 1, return_van_id: null, pickup_time: '06:40' },
    { trip_id: 'trip_2', booking_id: 'lg_2', idx: 0, sequence: 2, return_van_id: 'veh09', pickup_time: '06:40' },
  ], ...over,
});

function runtime({ enabled = true, handlers = {}, bks = bookings(), sel = {} } = {}) {
  const requests = [];
  const toasts = [];
  const legacyCalls = [];
  const alerts = [];
  const renders = { n: 0 };
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Number, String, Math,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    SB_BOOKINGS: bks,
    _bkV2VanSel: sel,
    alert: (m) => alerts.push(m),
    laSaveToast: (o) => toasts.push(plain(o)),
    acctPersistBookings: () => { throw new Error('legacy persist in ops mode'); },
    bookingV2RenderKeep: () => { renders.n++; },
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body });
    const key = opts.method + ' ' + path.split('?')[0];
    const h = handlers[key];
    if (h === undefined) throw new Error('unexpected request ' + key);
    const r = typeof h === 'function' ? await h(body, path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  // legacy functions, captured by the adapter before it wraps them
  LEGACY.forEach((n) => { ctx[n] = (...args) => { legacyCalls.push([n, args]); return 'legacy:' + n; }; });
  // legacy helpers the adapter reads (same semantics as 08-app.js)
  const isFirst = (b, date) => { const ds = [...new Set((b.trips || []).map((t) => t.date))].sort(); return !date || ds.length <= 1 || date === ds[0]; };
  ctx.bkOpsRead = (b, date) => { if (!b) return {}; if (isFirst(b, date)) return b.ops || {}; const t = (b.trips || []).find((x) => x.date === date); return (t && t.ops) || {}; };
  ctx.bkOpsFor = (b, date) => { if (!b) return {}; if (isFirst(b, date)) return (b.ops = b.ops || {}); const t = (b.trips || []).find((x) => x.date === date); if (!t) return (b.ops = b.ops || {}); return (t.ops = t.ops || {}); };
  ctx.bkOpsDate = (b, date) => date || ((b.trips || [])[0] || {}).date || '';
  ctx.bookingV2EffZone = (b, t) => (t && t.zone) || (b && b.pickupZone) || '';
  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);
  vm.runInContext(SOURCE, ctx);
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { ctx, requests, toasts, legacyCalls, alerts, renders, flush, bks, sel, O: ctx.laOps };
}

const byId = (bks, id) => bks.find((b) => b.id === id);
const flat = (rt) => (rt.O.vans ? rt.O.vans : {});

// ── loader ──────────────────────────────────────────────────────────────────

test('loader maps group members onto bookings by opsId and clears what the server does not list', async () => {
  const rt = runtime({ handlers: { ['GET ' + '/operations/van-groups']: { body: { service_date: D, route_id: R, groups: [group()] } } } });
  await rt.O.vans.load(D, R);
  assert.deepEqual(plain(rt.requests), [{ method: 'GET', path: '/operations/van-groups?service_date=2026-10-02&route_id=r1' }]);
  const b1 = byId(rt.bks, 'b1').ops;
  assert.deepEqual(plain({ vanGroup: b1.vanGroup, vanId: b1.vanId, vanSeq: b1.vanSeq, pickupTimeFinal: b1.pickupTimeFinal, vanReturnId: b1.vanReturnId }),
    { vanGroup: 3, vanId: 'veh07', vanSeq: 1, pickupTimeFinal: '06:40', vanReturnId: null });
  const b2 = byId(rt.bks, 'b2').ops;
  assert.equal(b2.vanSeq, 2);
  assert.equal(b2.vanReturnId, 'veh09');
  // not listed on the server: cleared
  const b3 = byId(rt.bks, 'b3').ops;
  assert.deepEqual(plain({ vanGroup: b3.vanGroup, vanId: b3.vanId }), { vanGroup: 0, vanId: null });
  const b4 = byId(rt.bks, 'b4').ops;
  assert.deepEqual(plain({ vanGroup: b4.vanGroup, vanId: b4.vanId, pickupTimeFinal: b4.pickupTimeFinal }), { vanGroup: 0, vanId: null, pickupTimeFinal: '' });
  // other date untouched
  assert.equal(byId(rt.bks, 'b9').ops.vanGroup, undefined);
  // cancelled booking keeps nothing it was given (not listed)
  assert.equal(byId(rt.bks, 'b8').ops.vanGroup, 0);
});

test('loader does not write when the server fails, and keeps local van fields', async () => {
  const rt = runtime({ handlers: { 'GET /operations/van-groups': { status: 500, body: { message: 'boom' } } } });
  const r = await rt.O.vans.load(D, R);
  assert.equal(r, null);
  assert.equal(byId(rt.bks, 'b3').ops.vanId, 'veh01');
  assert.equal(byId(rt.bks, 'b4').ops.vanGroup, 2);
});

test('loader makes no request in legacy mode', async () => {
  const rt = runtime({ enabled: false });
  const r = await rt.O.vans.load(D, R);
  assert.equal(r, null);
  assert.equal(rt.requests.length, 0);
});

// ── assign ──────────────────────────────────────────────────────────────────

test('assign a van to a group the server has: PATCH van_id, local follows the answer', async () => {
  const rt = runtime({ handlers: {
    'GET /operations/van-groups': { body: { groups: [group()] } },
    'PATCH /operations/van-groups/vgrp_3': (body) => ({ body: group({ van_id: body.van_id }) }),
  } });
  await rt.O.vans.load(D, R);
  rt.requests.length = 0;
  rt.ctx.bookingV2VanGroupSetVan(D, R, 'PK', 3, 'veh10');
  await rt.flush(); await rt.flush();
  assert.deepEqual(plain(rt.requests), [{ method: 'PATCH', path: '/operations/van-groups/vgrp_3', body: { van_id: 'veh10' } }]);
  assert.equal(byId(rt.bks, 'b1').ops.vanId, 'veh10');
  assert.equal(rt.renders.n, 1);
});

test('assign a van to a group the server has not got: POST with zone, members and van_id', async () => {
  const rt = runtime({ handlers: {
    'POST /operations/van-groups': (body) => ({ status: 201, body: group({ id: 'vgrp_9', number: 4, van_id: body.van_id, members: [
      { trip_id: 'trip_3', booking_id: 'lg_3', idx: 0, sequence: 1, return_van_id: null } ] }) }),
  } });
  // local group 5 with booking b3, no server group yet
  rt.ctx.bookingV2VanGroupSetVan(D, R, 'PK', 5, 'veh10');
  await rt.flush(); await rt.flush();
  assert.deepEqual(plain(rt.requests), [{ method: 'POST', path: '/operations/van-groups', body: {
    service_date: D, route_id: R, zone: 'PK', members: [{ trip_id: 'trip_3', idx: 0 }], van_id: 'veh10' } }]);
  assert.equal(byId(rt.bks, 'b3').ops.vanGroup, 4);
  assert.equal(byId(rt.bks, 'b3').ops.vanId, 'veh10');
  assert.equal(rt.O.vans.serverIdOf(D, R, 4), 'vgrp_9');
});

test('assign a van to one booking with no group: POST a group of its own', async () => {
  const rt = runtime({ handlers: {
    'POST /operations/van-groups': (body) => ({ status: 201, body: group({ id: 'vgrp_7', number: 6, van_id: body.van_id, members: [
      { trip_id: 'trip_5', booking_id: 'lg_5', idx: 0, sequence: 1, return_van_id: null } ] }) }),
  } });
  rt.ctx.bookingV2AssignVan('b5', 'veh02', D);
  await rt.flush(); await rt.flush();
  assert.deepEqual(plain(rt.requests), [{ method: 'POST', path: '/operations/van-groups', body: {
    service_date: D, route_id: R, zone: 'PK', members: [{ trip_id: 'trip_5', idx: 0 }], van_id: 'veh02' } }]);
  assert.equal(byId(rt.bks, 'b5').ops.vanId, 'veh02');
});

test('assign shows a 409 van_over_capacity, sends nothing else, and changes nothing locally', async () => {
  const rt = runtime({ handlers: {
    'GET /operations/van-groups': { body: { groups: [group()] } },
    'PATCH /operations/van-groups/vgrp_3': { status: 409, body: { code: 'van_over_capacity', message: 'van holds 1 seat' } },
  } });
  await rt.O.vans.load(D, R);
  rt.requests.length = 0;
  rt.toasts.length = 0;
  rt.ctx.bookingV2VanGroupSetVan(D, R, 'PK', 3, 'veh01');
  await rt.flush(); await rt.flush();
  assert.equal(rt.requests.length, 1);
  assert.equal(byId(rt.bks, 'b1').ops.vanId, 'veh07');
  const err = rt.toasts.find((t) => t.kind === 'error');
  assert.ok(err, 'error toast shown');
  assert.match(err.title, /van_over_capacity/);
  assert.equal(rt.renders.n, 0);
});

test('a 409 van_not_in_pool on a new group also changes nothing', async () => {
  const rt = runtime({ handlers: {
    'POST /operations/van-groups': { status: 409, body: { code: 'van_not_in_pool', message: 'not in pool' } },
  } });
  rt.ctx.bookingV2VanGroupSetVan(D, R, 'PK', 5, 'veh99');
  await rt.flush(); await rt.flush();
  assert.equal(byId(rt.bks, 'b3').ops.vanGroup, 5);
  assert.equal(byId(rt.bks, 'b3').ops.vanId, 'veh01');
  assert.match(rt.toasts.find((t) => t.kind === 'error').title, /van_not_in_pool/);
});

test('no local change before the server answers', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const rt = runtime({ handlers: {
    'GET /operations/van-groups': { body: { groups: [group()] } },
    'PATCH /operations/van-groups/vgrp_3': async (body) => { await gate; return { body: group({ van_id: body.van_id }) }; },
  } });
  await rt.O.vans.load(D, R);
  rt.ctx.bookingV2VanGroupSetVan(D, R, 'PK', 3, 'veh10');
  await rt.flush(); await rt.flush();
  assert.equal(byId(rt.bks, 'b1').ops.vanId, 'veh07', 'still the old van while the request is out');
  release();
  await rt.flush(); await rt.flush(); await rt.flush();
  assert.equal(byId(rt.bks, 'b1').ops.vanId, 'veh10');
});

test('warnings on an answer are an info toast, not an error, and the change lands', async () => {
  const rt = runtime({ handlers: {
    'GET /operations/van-groups': { body: { groups: [group()] } },
    'PATCH /operations/van-groups/vgrp_3': (body) => ({ body: { ...group({ van_id: body.van_id }), warnings: [{ code: 'van_in_other_group', message: 'veh10 is in group 2 at 07:00' }] } }),
  } });
  await rt.O.vans.load(D, R);
  rt.toasts.length = 0;
  rt.ctx.bookingV2VanGroupSetVan(D, R, 'PK', 3, 'veh10');
  await rt.flush(); await rt.flush();
  assert.equal(byId(rt.bks, 'b1').ops.vanId, 'veh10');
  assert.equal(rt.toasts.filter((t) => t.kind === 'error').length, 0);
  assert.equal(rt.toasts.filter((t) => t.kind === 'neutral').length, 1);
});

test('NoTransfer and self-arrive bookings are refused with no request', async () => {
  const bks = bookings();
  byId(bks, 'b5').pickupZone = 'NoTransfer';
  byId(bks, 'b5').trips[0].zone = 'NoTransfer';
  const rt = runtime({ bks });
  rt.ctx.bookingV2AssignVan('b5', 'veh02', D);
  rt.ctx.bookingV2AssignVan('b6', 'veh02', D);
  await rt.flush();
  assert.equal(rt.requests.length, 0);
  assert.equal(byId(rt.bks, 'b5').ops.vanId, undefined);
  assert.equal(rt.toasts.filter((t) => t.kind === 'error').length, 2);
});

test('a booking without an opsId is refused with no request', async () => {
  const rt = runtime();
  rt.ctx.bookingV2AssignVan('b7', 'veh02', D);
  await rt.flush();
  assert.equal(rt.requests.length, 0);
  assert.equal(rt.toasts.length, 1);
});

// ── pickup time, disband, create from ticked rows ───────────────────────────

test('pickup time: PATCH pickup_time, local follows the answer', async () => {
  const rt = runtime({ handlers: {
    'GET /operations/van-groups': { body: { groups: [group()] } },
    'PATCH /operations/van-groups/vgrp_3': (body) => ({ body: group({ pickup_time: body.pickup_time }) }),
  } });
  await rt.O.vans.load(D, R);
  rt.requests.length = 0;
  rt.ctx.bookingV2VanGroupSetTime(D, R, 'PK', 3, ' 07:15 ');
  await rt.flush(); await rt.flush();
  assert.deepEqual(plain(rt.requests), [{ method: 'PATCH', path: '/operations/van-groups/vgrp_3', body: { pickup_time: '07:15' } }]);
  assert.equal(byId(rt.bks, 'b2').ops.pickupTimeFinal, '07:15');
});

test('disband: DELETE, then the members lose the group and their van, keep their pickup time', async () => {
  const rt = runtime({ handlers: {
    'GET /operations/van-groups': { body: { groups: [group()] } },
    'DELETE /operations/van-groups/vgrp_3': { status: 204 },
  } });
  await rt.O.vans.load(D, R);
  rt.requests.length = 0;
  rt.ctx.bookingV2VanGroupDisband(D, R, 'PK', 3);
  await rt.flush(); await rt.flush();
  assert.deepEqual(plain(rt.requests), [{ method: 'DELETE', path: '/operations/van-groups/vgrp_3' }]);
  const o = byId(rt.bks, 'b1').ops;
  assert.deepEqual(plain({ vanGroup: o.vanGroup, vanId: o.vanId, vanReturnId: o.vanReturnId, pickupTimeFinal: o.pickupTimeFinal }),
    { vanGroup: 0, vanId: null, vanReturnId: null, pickupTimeFinal: '06:40' });
  assert.equal(rt.O.vans.serverIdOf(D, R, 3), null);
});

test('disband with the answer still pending changes nothing locally', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const rt = runtime({ handlers: {
    'GET /operations/van-groups': { body: { groups: [group()] } },
    'DELETE /operations/van-groups/vgrp_3': async () => { await gate; return { status: 204 }; },
  } });
  await rt.O.vans.load(D, R);
  rt.ctx.bookingV2VanGroupDisband(D, R, 'PK', 3);
  await rt.flush(); await rt.flush();
  assert.equal(byId(rt.bks, 'b1').ops.vanGroup, 3);
  release();
  await rt.flush(); await rt.flush(); await rt.flush();
  assert.equal(byId(rt.bks, 'b1').ops.vanGroup, 0);
});

test('create a group from ticked rows: POST members only, in tick order, then re-read the day', async () => {
  const sel = { b2: 2, b1: 1 };
  const rt = runtime({ sel, handlers: {
    'POST /operations/van-groups': { status: 201, body: group({ id: 'vgrp_12', number: 7, van_id: null, members: [
      { trip_id: 'trip_1', booking_id: 'lg_1', idx: 0, sequence: 1, return_van_id: null },
      { trip_id: 'trip_2', booking_id: 'lg_2', idx: 0, sequence: 2, return_van_id: null } ] }) },
    'GET /operations/van-groups': { body: { groups: [] } },
  } });
  rt.ctx.bookingV2VanGroupSelected(D, R, 'PK', 'new');
  await rt.flush(); await rt.flush(); await rt.flush();
  assert.deepEqual(plain(rt.requests.filter((r) => r.method === 'POST')), [{ method: 'POST', path: '/operations/van-groups', body: {
    service_date: D, route_id: R, zone: 'PK', members: [{ trip_id: 'trip_1', idx: 0 }, { trip_id: 'trip_2', idx: 0 }] } }]);
  assert.equal(rt.requests[rt.requests.length - 1].method, 'GET');
  assert.deepEqual(plain(rt.sel), {});
});

test('create from ticked rows refuses rows from two zones, with no request', async () => {
  const sel = { b1: 1, b5: 2 };
  const bks = bookings();
  byId(bks, 'b5').trips[0].zone = 'KL';
  byId(bks, 'b5').pickupZone = 'KL';
  const rt = runtime({ bks, sel });
  rt.ctx.bookingV2VanGroupSelected(D, R, 'PK', 'new');
  await rt.flush();
  assert.equal(rt.requests.length, 0);
  assert.equal(Object.keys(rt.sel).length, 2);
});

// ── out of scope in ops mode ────────────────────────────────────────────────

test('out-of-scope actions in ops mode: refused with a toast, no request, no legacy write', async () => {
  const rt = runtime({ sel: { b1: 1 } });
  rt.ctx.bookingV2AssignVanReturn('b1', 'veh02', D);
  rt.ctx.bookingV2SetReturnSameVan('b1', true, D);
  rt.ctx.bookingV2VanGroupSetReturn(D, R, 'PK', 3, 'veh02');
  rt.ctx.bookingV2VanSplit('b1', D);
  rt.ctx.bookingV2VanUnsplit('b1', D);
  rt.ctx.bookingV2VanGroupClearSeq(D, R, 'PK', 3);
  rt.ctx.bookingV2VanGroupSave(D);
  rt.ctx.bookingV2VanClearRoute(D, R);
  await rt.flush();
  assert.equal(rt.requests.length, 0);
  assert.equal(rt.legacyCalls.length, 0);
  assert.equal(rt.bks.find((b) => b.id === 'b1').ops.vanId, undefined);
  const notYet = rt.toasts.filter((t) => t.kind === 'pending');
  assert.equal(notYet.length, 8);
  assert.ok(notYet.every((t) => /not on operation-backend yet|vans is not/.test(t.title)), JSON.stringify(notYet));
  assert.equal(rt.alerts.length, 0);
});

test('ticks on a pickup-order save are refused, but a save with nothing ticked is silent', async () => {
  const rt = runtime({ sel: {} });
  rt.ctx.bookingV2VanGroupSave(D);
  assert.equal(rt.toasts.length, 0);
  rt.ctx._bkV2VanSel = { b1: 1 };
  rt.ctx.bookingV2VanGroupSave(D);
  assert.equal(rt.toasts.length, 1);
  assert.equal(rt.requests.length, 0);
});

// ── legacy mode ─────────────────────────────────────────────────────────────

test('legacy mode: every wrapped function delegates to the original and makes no API call', async () => {
  const rt = runtime({ enabled: false });
  const calls = [
    ['bookingV2VanGroupSetVan', [D, R, 'PK', 3, 'veh01']],
    ['bookingV2AssignVan', ['b1', 'veh01', D]],
    ['bookingV2VanGroupSetTime', [D, R, 'PK', 3, '07:00']],
    ['bookingV2VanGroupDisband', [D, R, 'PK', 3]],
    ['bookingV2VanGroupSelected', [D, R, 'PK', 'new']],
    ['bookingV2AssignVanReturn', ['b1', 'veh01', D]],
    ['bookingV2VanSplit', ['b1', D]],
    ['bookingV2VanAutoAssign', [D, R]],
    ['bookingV2VanGroupHeal', [D]],
  ];
  calls.forEach(([n, args]) => rt.ctx[n](...args));
  await rt.flush();
  assert.equal(rt.requests.length, 0);
  assert.deepEqual(plain(rt.legacyCalls.map((c) => c[0])), calls.map((c) => c[0]));
  assert.equal(rt.toasts.length, 0);
});
