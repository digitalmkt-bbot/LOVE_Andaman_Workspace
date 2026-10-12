import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const VANS = fs.readFileSync('allotment_v2/js/ops/34-ops-vans.js', 'utf8');
const SOURCE = fs.readFileSync('allotment_v2/js/ops/35-ops-van-jobs.js', 'utf8');
const D = '2026-10-02';
const R = 'r1';
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const LEGACY = ['renderVanJobs', 'renderVanCheckin', 'bookingV2OpsVansDay', 'vanJobsGetPickupTh',
  'vanJobsSetDriver', 'vanJobsResetDriver', 'vanJobsToggleSent', 'vanJobsSetSreq', 'vanJobsResetSreq',
  'vanJobsSetPickupTh', 'vsSave', 'vsDel', 'vsSetVan', 'vsCheck'];

const van = (id, over = {}) => ({ id, name: 'Van ' + id, plate: 'P-' + id, type: 'van', capacity: 9, ownership: 'own',
  partner_name: null, zone_base: 'PK', color: null, driver: 'Somchai', driver_phone: '081', active: true, note: null, ...over });
const cell = (vanId, date, over = {}) => ({ van_id: vanId, service_date: date, route_ids: [], status: null, zone: null,
  driver: null, driver_phone: null, plate: null, status_on: null, usable: true, zone_on: 'PK', ...over });
const group = (id, number, vanId) => ({ id, service_date: D, route_id: R, zone: 'PK', number, van_id: vanId,
  return_van_id: null, pickup_time: null, pax: 0, members: [] });
const stop = (over = {}) => ({ id: 'vs_1', service_date: D, route_id: R, group_id: 'vgrp_1', kind: 'staff', label: 'Guide',
  pax: 1, time: '06:30', place: 'Hotel A', area_id: null, area: 'Patong', leg: 'out', phone: null, note: null, sequence: null,
  checked_in: null, created_at: '2026-10-01T00:00:00Z', created_by: 'ops', updated_at: null, updated_by: null, ...over });
const job = (over = {}) => ({ key: 'vgrp_1', service_date: D, route_id: R, group_id: 'vgrp_1', group_number: 1, van_id: 'veh01',
  round: null, sent: null, ...over });

function handlersBase(over = {}) {
  return {
    'GET /operations/van-days': { body: {
      from: '2026-09-01', to: '2026-11-02', vans: [van('veh01'), van('veh02', { ownership: 'partner', partner_name: 'Co' })],
      days: [cell('veh01', D, { route_ids: [R], status: 'available', driver: 'Day driver', plate: 'TMP-1' }), cell('veh02', D)],
      status_ranges: [{ id: 2, van_id: 'veh02', status: 'maintenance', from_date: '2026-09-30', to_date: null, note: 'gearbox' }],
      zone_ranges: [{ id: 1, van_id: 'veh01', zone: 'KL', from_date: '2026-10-05', to_date: '2026-10-06' }],
    } },
    'GET /operations/pickup-names-th': { body: { names: [{ name: 'Patong Beach', name_th: 'หาดป่าตอง' }] } },
    'GET /operations/van-groups': { body: { groups: [group('vgrp_1', 1, 'veh01'), group('vgrp_2', 2, 'veh02')] } },
    'GET /operations/van-stops': { body: { stops: [stop(), stop({ id: 'vs_2', group_id: 'vgrp_2', kind: 'cargo', pax: 0,
      checked_in: { at: '2026-10-02T06:00:00Z', by: 'pier', seats: 0 } })] } },
    'GET /operations/van-jobs': { body: { date: D, jobs: [
      job({ sent: { at: '2026-10-01T10:00:00Z', by: 'ops', changed_since_sent: false } }),
      job({ key: 'vgrp_2', group_id: 'vgrp_2', group_number: 2, van_id: 'veh02', round: { no: 1, of: 2, time: null } }),
      job({ key: 'veh03~r1', group_id: null, group_number: null, van_id: 'veh03' }),
    ] } },
    ...over,
  };
}

function runtime({ enabled = true, handlers = handlersBase(), bks, confirmAnswer = true } = {}) {
  const requests = [], toasts = [], legacyCalls = [], timers = [];
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Number, String, Math, Date,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    SB_BOOKINGS: bks || [
      { id: 'b1', opsId: 'lg_1', opsVersion: 4, status: 'confirmed', jobNote: 'No luggage', trips: [{ date: D, routeId: R, opsTripId: 't1' }], ops: {} },
      { id: 'b2', opsId: 'lg_2', opsVersion: 1, status: 'confirmed', jobNote: null, trips: [{ date: D, routeId: R, opsTripId: 't2' }], ops: {} },
    ],
    ROUTES: [{ id: R }],
    SB_VEHICLES: [{ id: 'veh01', name: 'stale', log: [{ text: 'kept' }] }, { id: 'veh99', name: 'local only' }],
    VAN_STOPS: { [`${D}::${R}::old`]: { label: 'stale' }, [`2026-10-03::${R}::keep`]: { label: 'other day' } },
    VANJOB_DRIVER: { [`${D}::veh09`]: { driver: 'stale' } },
    VANJOB_SENT: { [`${D}::veh09~r1`]: 'stale' },
    VANJOB_SREQ: { gone: 'stale' },
    VANJOB_PICKUP_TH: { Old: 'เก่า' },
    _vanJobsDate: D, _vanCkDate: D,
    laSaveToast: (o) => toasts.push(plain(o)),
    confirm: () => confirmAnswer,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: (id) => { timers[id - 1] = null; },
    scrollY: 0, scrollTo: () => {},
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body, headers: plain(opts.headers) });
    const key = opts.method + ' ' + path.split('?')[0];
    const h = handlers[key];
    if (h === undefined) throw new Error('unexpected request ' + key);
    const r = typeof h === 'function' ? await h(body, path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  LEGACY.forEach((n) => { ctx[n] = (...args) => { legacyCalls.push([n, args]); return 'legacy:' + n; }; });
  ctx.bkOpsRead = (b) => (b && b.ops) || {};
  ctx.bkOpsFor = (b) => (b.ops = b.ops || {});
  ctx.bookingV2EffZone = () => 'PK';
  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);
  vm.runInContext(VANS, ctx);
  vm.runInContext(SOURCE, ctx);
  const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
  const fire = async () => { const fns = timers.splice(0).filter(Boolean); fns.forEach((f) => f()); await settle(); };
  return { ctx, requests, toasts, legacyCalls, settle, fire, O: ctx.laOps };
}
const el = (value, attrs = {}) => ({ value, getAttribute: (k) => attrs[k] });

// ── loads ───────────────────────────────────────────────────────────────────

test('render loads the day: vans, drivers, stops, sent marks, Thai names, special requests', async () => {
  const rt = runtime();
  rt.ctx.renderVanJobs();
  await rt.settle();
  const { ctx } = rt;

  assert.deepEqual(ctx.SB_VEHICLES.map((v) => v.id), ['veh01', 'veh02'], 'server vans replace the local list');
  const v1 = ctx.SB_VEHICLES[0];
  assert.equal(v1.name, 'Van veh01');
  assert.deepEqual(plain(v1.log), [{ text: 'kept' }], 'the local log of a van is kept');
  assert.deepEqual(plain(v1.dayRoute[D]), [R]);
  assert.equal(v1.dayStatus[D], 'available');
  assert.deepEqual(plain(v1.zoneOverrides), [{ id: 1, zone: 'KL', from: '2026-10-05', to: '2026-10-06' }]);
  assert.equal(ctx.SB_VEHICLES[1].partnerName, 'Co');
  assert.deepEqual(plain(ctx.SB_VEHICLES[1].statusRanges), [{ id: 2, s: 'maintenance', from: '2026-09-30', to: '', note: 'gearbox' }]);

  assert.deepEqual(plain(ctx.VANJOB_DRIVER), { [`${D}::veh01`]: { driver: 'Day driver', phone: '', plate: 'TMP-1' } });

  assert.equal(ctx.VAN_STOPS[`${D}::${R}::old`], undefined, 'the date\'s stale stops go');
  assert.ok(ctx.VAN_STOPS[`2026-10-03::${R}::keep`], 'other dates are left alone');
  const s1 = ctx.VAN_STOPS[`${D}::${R}::vs_1`];
  assert.equal(s1.vanId, 'veh01'); assert.equal(s1.vanGroup, 1); assert.equal(s1.zone, 'Patong'); assert.equal(s1.ck, null);
  const s2 = ctx.VAN_STOPS[`${D}::${R}::vs_2`];
  assert.equal(s2.vanGroup, 2); assert.deepEqual(plain(s2.ck), { at: '2026-10-02T06:00:00Z', by: 'pier', n: 0 });

  assert.deepEqual(plain(ctx.VANJOB_SENT), { [`${D}::veh01~r1~1`]: '2026-10-01T10:00:00Z', [`${D}::veh01~r1`]: '2026-10-01T10:00:00Z' });
  assert.deepEqual(plain(ctx.VANJOB_SREQ), { b1: 'No luggage' });
  assert.deepEqual(plain(ctx.VANJOB_PICKUP_TH), { 'Patong Beach': 'หาดป่าตอง' });
  assert.equal(ctx.vanJobsGetPickupTh('  patong beach '), 'หาดป่าตอง', 'names match as the server keys them');

  const n = rt.requests.length;
  rt.ctx.renderVanCheckin();
  await rt.settle();
  assert.equal(rt.requests.length, n, 'a second render inside 5 s does not re-fetch');
});

test('legacy mode delegates every wrapped function and sends nothing', async () => {
  const rt = runtime({ enabled: false });
  rt.ctx.renderVanJobs();
  rt.ctx.vsCheck('k', true);
  rt.ctx.vanJobsToggleSent(D, 'veh01~r1');
  await rt.settle();
  assert.equal(rt.requests.length, 0);
  assert.deepEqual(rt.legacyCalls.map((c) => c[0]), ['renderVanJobs', 'vsCheck', 'vanJobsToggleSent']);
});

// ── driver of the day ───────────────────────────────────────────────────────

test('typing a driver sends one PUT after the pause, with the server field names', async () => {
  const rt = runtime({ handlers: handlersBase({
    'PUT /operations/van-days/2026-10-02/veh02': (b) => ({ body: cell('veh02', D, { driver: b.driver, driver_phone: b.driver_phone }) }),
  }) });
  rt.ctx.vanJobsSetDriver(D, 'veh02', 'driver', el('Ann'));
  rt.ctx.vanJobsSetDriver(D, 'veh02', 'driver', el('Anna '));
  rt.ctx.vanJobsSetDriver(D, 'veh02', 'phone', el('089'));
  await rt.settle();
  assert.equal(rt.requests.length, 0, 'nothing is sent while typing');
  await rt.fire();
  assert.deepEqual(rt.requests.map((r) => [r.method, r.path, r.body]),
    [['PUT', '/operations/van-days/2026-10-02/veh02', { driver: 'Anna', driver_phone: '089' }]]);
  assert.deepEqual(plain(rt.ctx.VANJOB_DRIVER[`${D}::veh02`]), { driver: 'Anna', phone: '089', plate: '' });
});

test('reset driver clears the three overrides on the server', async () => {
  const rt = runtime({ handlers: handlersBase({ 'PUT /operations/van-days/2026-10-02/veh09': { body: cell('veh09', D) } }) });
  rt.ctx.vanJobsResetDriver(D, 'veh09');
  await rt.settle();
  assert.deepEqual(rt.requests[0].body, { driver: null, driver_phone: null, plate: null });
  assert.equal(rt.ctx.VANJOB_DRIVER[`${D}::veh09`], undefined);
});

// ── sent to driver ──────────────────────────────────────────────────────────

test('ticking sent maps the legacy key to the server job and reads the mark back', async () => {
  let sentAt = null;
  const rt = runtime({ handlers: handlersBase({
    'PUT /operations/van-jobs/2026-10-02/vgrp_2/sent': () => { sentAt = '2026-10-02T05:00:00Z'; return { body: {} }; },
    'GET /operations/van-jobs': () => ({ body: { date: D, jobs: [job({ key: 'vgrp_2', group_id: 'vgrp_2', group_number: 2, van_id: 'veh02',
      round: { no: 1, of: 2, time: null }, sent: sentAt && { at: sentAt, by: 'ops', changed_since_sent: false } })] } }),
  }) });
  rt.ctx.vanJobsToggleSent(D, 'veh02~r1~2');
  await rt.settle();
  assert.ok(rt.requests.some((r) => r.method === 'PUT' && r.path === '/operations/van-jobs/2026-10-02/vgrp_2/sent'));
  assert.equal(rt.ctx.VANJOB_SENT[`${D}::veh02~r1~2`], '2026-10-02T05:00:00Z');
  assert.equal(rt.ctx.VANJOB_SENT[`${D}::veh02~r1`], undefined, 'a van on two rounds has no round-less key');
});

test('a key the server does not know is refused without a write', async () => {
  const rt = runtime();
  rt.ctx.vanJobsToggleSent(D, 'veh77~r1');
  await rt.settle();
  assert.ok(!rt.requests.some((r) => r.method !== 'GET'));
  assert.equal(rt.toasts.at(-1).status, 'REFUSED');
});

// ── special request ─────────────────────────────────────────────────────────

test('special request is a versioned job_note PATCH on the booking', async () => {
  const rt = runtime({ handlers: handlersBase({ 'PATCH /v1/bookings/lg_2': (b) => ({ body: { id: 'lg_2', version: 2, job_note: b.job_note } }) }) });
  rt.ctx.vanJobsSetSreq(el('', { 'data-bk': 'b2' }));
  await rt.fire();
  const r = rt.requests[0];
  assert.deepEqual([r.method, r.path, r.body], ['PATCH', '/v1/bookings/lg_2', { job_note: '' }]);
  assert.equal(r.headers['If-Match'], '"1"');
  assert.equal(rt.ctx.VANJOB_SREQ.b2, '', 'a blanked request is an override');
});

test('reset special request sends null and drops the override', async () => {
  const rt = runtime({ handlers: handlersBase({ 'PATCH /v1/bookings/lg_1': { body: { id: 'lg_1', version: 5, job_note: null } } }) });
  rt.ctx.vanJobsResetSreq('b1');
  await rt.settle();
  assert.deepEqual(rt.requests[0].body, { job_note: null });
  assert.equal('b1' in rt.ctx.VANJOB_SREQ, false);
});

// ── Thai pickup names ───────────────────────────────────────────────────────

test('Thai pickup name is one PUT after typing; empty deletes', async () => {
  const rt = runtime({ handlers: handlersBase({ 'PUT /operations/pickup-names-th': (b) => ({ body: b }) }) });
  rt.ctx.vanJobsSetPickupTh(el('ก', { 'data-pk': 'Kata' }));
  rt.ctx.vanJobsSetPickupTh(el('กะตะ', { 'data-pk': 'Kata' }));
  await rt.fire();
  rt.ctx.vanJobsSetPickupTh(el(' ', { 'data-pk': 'Kata' }));
  await rt.fire();
  assert.deepEqual(rt.requests.map((r) => r.body), [{ name: 'Kata', name_th: 'กะตะ' }, { name: 'Kata', name_th: null }]);
  assert.equal(rt.ctx.VANJOB_PICKUP_TH.Kata, undefined);
});

// ── van stops ───────────────────────────────────────────────────────────────

async function loaded(handlers) {
  const rt = runtime({ handlers: handlersBase(handlers) });
  rt.ctx.renderVanJobs();
  await rt.settle();
  rt.requests.length = 0;
  return rt;
}
const rec = (over = {}) => ({ id: '', date: D, routeId: R, kind: 'staff', label: 'Guide B', pax: 2, time: '06:45', place: 'Hotel B',
  areaId: 'a1', zone: 'Kata', leg: 'both', phone: '', note: 'front seat', vanId: 'veh01', vanGroup: 1, ...over });

test('a new stop is POSTed onto its group and shown from the answer', async () => {
  const rt = await loaded({ 'POST /operations/van-stops': (b) => ({ status: 201, body: stop({ id: 'vs_9', label: b.label, pax: b.pax, leg: b.leg }) }) });
  rt.ctx.vsSave(rec());
  await rt.settle();
  assert.deepEqual(rt.requests[0].body, { kind: 'staff', label: 'Guide B', pax: 2, time: '06:45', place: 'Hotel B', area_id: 'a1',
    area: 'Kata', leg: 'both', phone: null, note: 'front seat', group_id: 'vgrp_1' });
  const s = rt.ctx.VAN_STOPS[`${D}::${R}::vs_9`];
  assert.equal(s.label, 'Guide B'); assert.equal(s.vanGroup, 1);
});

test('a stop with no van group is refused before any request', async () => {
  const rt = await loaded();
  rt.ctx.vsSave(rec({ vanGroup: 0 }));
  await rt.settle();
  assert.equal(rt.requests.length, 0);
  assert.equal(rt.toasts.at(-1).status, 'REFUSED');
});

test('over capacity asks, then resends with seats_anyway', async () => {
  const rt = await loaded({ 'PATCH /operations/van-stops/vs_1': (b) => (b.seats_anyway
    ? { body: stop({ pax: 4 }) }
    : { status: 409, body: { message: 'Not enough seats', code: 'van_over_capacity' } }) });
  rt.ctx.vsSave(rec({ id: 'vs_1', pax: 4 }));
  await rt.settle();
  assert.deepEqual(rt.requests.map((r) => !!r.body.seats_anyway), [false, true]);
  assert.equal(rt.ctx.VAN_STOPS[`${D}::${R}::vs_1`].pax, 4);
});

test('over capacity answered "no" changes nothing', async () => {
  const rt = runtime({ handlers: handlersBase({ 'PATCH /operations/van-stops/vs_1': { status: 409, body: { message: 'Not enough seats', code: 'van_over_capacity' } } }), confirmAnswer: false });
  rt.ctx.renderVanJobs(); await rt.settle(); rt.requests.length = 0;
  rt.ctx.vsSave(rec({ id: 'vs_1', pax: 4 }));
  await rt.settle();
  assert.equal(rt.requests.length, 1);
  assert.equal(rt.ctx.VAN_STOPS[`${D}::${R}::vs_1`].pax, 1);
  assert.equal(rt.toasts.at(-1).kind, 'error');
});

test('delete and check-in go to the stop endpoints', async () => {
  const rt = await loaded({
    'DELETE /operations/van-stops/vs_2': { status: 204 },
    'PUT /operations/van-stops/vs_1/check-in': { body: stop({ checked_in: { at: '2026-10-02T06:10:00Z', by: 'pier', seats: 1 } }) },
    'DELETE /operations/van-stops/vs_1/check-in': { body: stop() },
  });
  rt.ctx.vsDel(`${D}::${R}::vs_2`);
  rt.ctx.vsCheck(`${D}::${R}::vs_1`);
  await rt.settle();
  assert.equal(rt.ctx.VAN_STOPS[`${D}::${R}::vs_2`], undefined);
  assert.deepEqual(plain(rt.ctx.VAN_STOPS[`${D}::${R}::vs_1`].ck), { at: '2026-10-02T06:10:00Z', by: 'pier', n: 1 });
  rt.ctx.vsCheck(`${D}::${R}::vs_1`, false);
  await rt.settle();
  assert.equal(rt.ctx.VAN_STOPS[`${D}::${R}::vs_1`].ck, null);
  assert.deepEqual(rt.requests.map((r) => r.method + ' ' + r.path), [
    'DELETE /operations/van-stops/vs_2', 'PUT /operations/van-stops/vs_1/check-in', 'DELETE /operations/van-stops/vs_1/check-in']);
});

test('a refused check-in leaves the stop as it was', async () => {
  const rt = await loaded({ 'PUT /operations/van-stops/vs_1/check-in': { status: 404, body: { message: 'Van stop vs_1 not found' } } });
  rt.ctx.vsCheck(`${D}::${R}::vs_1`);
  await rt.settle();
  assert.equal(rt.ctx.VAN_STOPS[`${D}::${R}::vs_1`].ck, null);
  assert.equal(rt.toasts.at(-1).kind, 'error');
});
