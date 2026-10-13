import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (f) => fs.readFileSync('allotment_v2/js/ops/' + f, 'utf8');
const CORE = read('00-ops-core.js'), VANS = read('34-ops-vans.js'), JOBS = read('35-ops-van-jobs.js'), SOURCE = read('35-ops-vehicles.js');
const D = '2026-10-02';
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const VEH = ['renderVehicles', 'vehAdd', 'vehFormSave', 'vehSetField', 'vehDelete', 'vehSetColor', 'vehSetColorLive',
  'vehDaySetZone', 'vehDaySetRoute', 'vehDayToggleRoute', 'vehDayClearRoutes', 'vehDaySetStatus', 'vehStatusCycleDay',
  'vehStatusAdd', 'vehStatusSet', 'vehStatusDel', 'vehZoneAdd', 'vehZoneSet', 'vehZoneDel'];
const LEGACY = [...VEH, 'renderVanJobs', 'renderVanCheckin', 'bookingV2OpsVansDay', 'vanJobsGetPickupTh', 'vanJobsSetDriver',
  'vanJobsResetDriver', 'vanJobsToggleSent', 'vanJobsSetSreq', 'vanJobsResetSreq', 'vanJobsSetPickupTh', 'vsSave', 'vsDel', 'vsSetVan', 'vsCheck'];

const van = (id, over = {}) => ({ id, name: 'Van ' + id, plate: 'P-' + id, type: 'van', capacity: 9, ownership: 'own',
  partner_name: null, zone_base: 'PK', color: null, driver: 'Somchai', driver_phone: '081', active: true, note: null, ...over });
const cell = (vanId, date, over = {}) => ({ van_id: vanId, service_date: date, route_ids: [], status: null, zone: null,
  driver: null, driver_phone: null, plate: null, status_on: null, usable: true, zone_on: 'PK', ...over });

function runtime({ enabled = true, handlers = {}, confirmAnswer = true } = {}) {
  const requests = [], toasts = [], legacyCalls = [], timers = [], alerts = [];
  const base = {
    'GET /operations/van-days': { body: {
      from: '2026-09-01', to: '2026-11-02', vans: [van('veh01'), van('veh02', { ownership: 'partner', partner_name: 'Co' })],
      days: [cell('veh01', D, { route_ids: ['r1'] })],
      status_ranges: [{ id: 7, van_id: 'veh01', status: 'maintenance', from_date: '2026-10-10', to_date: null, note: 'gearbox' }],
      zone_ranges: [{ id: 3, van_id: 'veh01', zone: 'KL', from_date: '2026-10-05', to_date: '2026-10-06' }],
    } },
    'GET /operations/pickup-names-th': { body: { names: [] } },
    'GET /operations/van-groups': { body: { groups: [] } },
    'GET /operations/van-stops': { body: { stops: [] } },
    'GET /operations/van-jobs': { body: { date: D, jobs: [] } },
  };
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Number, String, Math, Date, parseInt,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    SB_BOOKINGS: [], ROUTES: [{ id: 'r1' }],
    SB_VEHICLES: [{ id: 'veh01', name: 'stale', costPerDay: 500 }],
    VAN_STOPS: {}, VANJOB_DRIVER: {}, VANJOB_SENT: {}, VANJOB_SREQ: {}, VANJOB_PICKUP_TH: {},
    _vehDate: D, _vehMonth: '2026-10', _vehCalMonth: '2026-10', _vehForm: null, _vanJobsDate: D, _vanCkDate: D,
    laSaveToast: (o) => toasts.push(plain(o)),
    confirm: () => confirmAnswer, alert: (m) => alerts.push(m),
    setTimeout: (f) => { timers.push(f); return timers.length; },
    clearTimeout: (id) => { timers[id - 1] = null; },
    scrollY: 0, scrollTo: () => {},
    document: { activeElement: null, querySelector: () => ({ dataset: { view: 'vehicles' } }), getElementById: (id) => (id === 'vehicles-host' ? {} : null) },
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body });
    const key = opts.method + ' ' + path.split('?')[0];
    const h = handlers[key] !== undefined ? handlers[key] : base[key];
    if (h === undefined) throw new Error('unexpected request ' + key);
    const r = typeof h === 'function' ? await h(body, path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  LEGACY.forEach((n) => { ctx[n] = (...args) => { legacyCalls.push([n, args]); return 'legacy:' + n; }; });
  ctx.vehFormClose = () => { ctx._vehForm = null; legacyCalls.push(['vehFormClose', []]); };
  ctx.vehFormOpen = (id) => legacyCalls.push(['vehFormOpen', [id]]);
  ctx.vehStatusOpen = (id) => legacyCalls.push(['vehStatusOpen', [id]]);
  ctx.vehZoneOpen = (id) => legacyCalls.push(['vehZoneOpen', [id]]);
  ctx._vehDayRefresh = (id, d) => legacyCalls.push(['_vehDayRefresh', [id, d]]);
  ctx._vehDayRoutes = (v, d) => { const r = v.dayRoute && v.dayRoute[d]; return !r ? [] : Array.isArray(r) ? r : [r]; };
  ctx.bkOpsRead = (b) => (b && b.ops) || {};
  ctx.bkOpsFor = (b) => (b.ops = b.ops || {});
  ctx.bookingV2EffZone = () => 'PK';
  ctx.bookingV2LocalYMD = () => D;
  vm.createContext(ctx);
  for (const src of [CORE, VANS, JOBS, SOURCE]) vm.runInContext(src, ctx);
  const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
  const fire = async () => { const fns = timers.splice(0).filter(Boolean); fns.forEach((f) => f()); await settle(); };
  const loadVans = async () => { await ctx.laOps.vanJobs.loadVans(D); };
  const writes = () => requests.filter((r) => r.method !== 'GET');
  return { ctx, requests, toasts, legacyCalls, alerts, settle, fire, loadVans, writes, O: ctx.laOps };
}

test('legacy mode delegates every wrapped function and sends nothing', async () => {
  const rt = runtime({ enabled: false });
  for (const n of VEH) assert.equal(rt.ctx[n](), 'legacy:' + n);
  await rt.settle();
  assert.equal(rt.requests.length, 0);
});

test('renderVehicles draws, then loads the vans for the screen dates and redraws', async () => {
  const rt = runtime();
  assert.equal(rt.ctx.renderVehicles(), 'legacy:renderVehicles');
  await rt.settle();
  assert.equal(rt.requests.filter((r) => r.path.startsWith('/operations/van-days')).length, 1, 'one window covers the dates');
  assert.deepEqual(rt.ctx.SB_VEHICLES.map((v) => v.id), ['veh01', 'veh02']);
  assert.equal(rt.legacyCalls.filter((c) => c[0] === 'renderVehicles').length, 2, 'redrawn once the vans arrived');
});

test('new vehicle: form save POSTs, adds the server van (server id), closes the form', async () => {
  const rt = runtime({ handlers: { 'POST /operations/vans': (b) => ({ status: 201, body: van('veh07', { name: b.name, capacity: b.capacity, zone_base: b.zone_base, color: b.color }) }) } });
  await rt.loadVans();
  rt.ctx._vehForm = { id: null, name: ' Van 7 ', plate: '', type: 'van', capacity: 12, ownership: 'own', partnerName: 'x', zoneBase: 'KL', driver: '', driverPhone: '', active: true, color: '#aabbcc' };
  rt.ctx.vehFormSave();
  await rt.settle();
  const w = rt.writes();
  assert.equal(w.length, 1);
  assert.equal(w[0].method, 'POST');
  assert.deepEqual(plain(w[0].body), { name: 'Van 7', plate: null, type: 'van', capacity: 12, ownership: 'own', partner_name: null,
    zone_base: 'KL', driver: null, driver_phone: null, active: true, color: '#aabbcc' });
  const v = rt.ctx.SB_VEHICLES.find((x) => x.id === 'veh07');
  assert.ok(v, 'server id used'); assert.equal(v.capacity, 12); assert.equal(v.color, '#aabbcc');
  assert.ok(rt.legacyCalls.some((c) => c[0] === 'vehFormClose'));
});

test('form save: blank name never leaves the browser; a refusal keeps the form and shows the server message', async () => {
  const rt = runtime({ handlers: { 'POST /operations/vans': { status: 400, body: { statusCode: 400, message: 'capacity must be a whole number, 1 or more' } } } });
  await rt.loadVans();
  rt.ctx._vehForm = { id: null, name: '  ', ownership: 'own' };
  rt.ctx.vehFormSave(); await rt.settle();
  assert.equal(rt.writes().length, 0); assert.equal(rt.alerts.length, 1);
  rt.ctx._vehForm = { id: null, name: 'X', capacity: 9, ownership: 'own', zoneBase: 'PK', active: true };
  const before = rt.ctx.SB_VEHICLES.length;
  rt.ctx.vehFormSave(); await rt.settle();
  assert.equal(rt.ctx.SB_VEHICLES.length, before, 'nothing added locally');
  assert.ok(rt.ctx._vehForm, 'form stays open');
  assert.equal(rt.toasts.length, 1); assert.match(JSON.stringify(rt.toasts[0]), /capacity must be a whole number/);
});

test('edit via form PATCHes and keeps the van\'s days, ranges and local cost', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/vans/veh01': (b) => ({ body: van('veh01', { name: b.name, driver: b.driver }) }) } });
  await rt.loadVans();
  rt.ctx.SB_VEHICLES[0].costPerDay = 500;
  rt.ctx._vehForm = { id: 'veh01', name: 'Renamed', plate: 'P-veh01', type: 'van', capacity: 9, ownership: 'own', zoneBase: 'PK', driver: 'New', driverPhone: '081', active: true };
  rt.ctx.vehFormSave(); await rt.settle();
  const v = rt.ctx.SB_VEHICLES.find((x) => x.id === 'veh01');
  assert.equal(v.name, 'Renamed'); assert.equal(v.driver, 'New'); assert.equal(v.costPerDay, 500);
  assert.deepEqual(plain(v.dayRoute[D]), ['r1']);
  assert.equal(v.statusRanges.length, 1); assert.equal(v.zoneOverrides.length, 1);
});

test('vehSetField: active goes now, text is debounced, unknown field refused', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/vans/veh01': (b) => ({ body: van('veh01', b.active === false ? { active: false } : { driver: b.driver }) }) } });
  await rt.loadVans();
  rt.ctx.vehSetField('veh01', 'active', false); await rt.settle();
  assert.deepEqual(plain(rt.writes().map((r) => r.body)), [{ active: false }]);
  assert.equal(rt.ctx.SB_VEHICLES[0].active, false);
  rt.ctx.vehSetField('veh01', 'driver', 'Aa'); rt.ctx.vehSetField('veh01', 'driver', 'Bb');
  await rt.settle(); assert.equal(rt.writes().length, 1, 'typing waits');
  await rt.fire();
  assert.deepEqual(plain(rt.writes()[1].body), { driver: 'Bb' }, 'last value wins');
  rt.ctx.vehSetField('veh01', 'nonsense', 'x'); await rt.settle();
  assert.equal(rt.writes().length, 2); assert.equal(rt.toasts.length, 1);
});

test('delete: only after the server agrees; 409 van_in_use leaves the van on screen', async () => {
  let n = 0;
  const rt = runtime({ handlers: { 'DELETE /operations/vans/veh01': () => (++n === 1
    ? { status: 409, body: { statusCode: 409, code: 'van_in_use', message: 'Van veh01 is used by van groups or the month matrix: set it inactive instead' } }
    : { status: 204, body: null }) } });
  await rt.loadVans();
  rt.ctx.vehDelete('veh01'); await rt.settle();
  assert.ok(rt.ctx.SB_VEHICLES.some((v) => v.id === 'veh01'));
  assert.match(JSON.stringify(rt.toasts[0]), /set it inactive/);
  rt.ctx.vehDelete('veh01'); await rt.settle();
  assert.ok(!rt.ctx.SB_VEHICLES.some((v) => v.id === 'veh01'));
  rt.ctx.confirm = () => false;
  rt.ctx.vehDelete('veh02'); await rt.settle();
  assert.equal(rt.writes().length, 2, 'declined confirm sends nothing');
});

test('day route / toggle / clear / zone / status PUT the van-day and mirror the server cell', async () => {
  let last;
  const rt = runtime({ handlers: { 'PUT /operations/van-days/2026-10-02/veh01': (b) => {
    last = { ...(last || cell('veh01', D, { route_ids: ['r1'] })), ...b };
    return { body: cell('veh01', D, last) };
  } } });
  await rt.loadVans();
  const v = () => rt.ctx.SB_VEHICLES.find((x) => x.id === 'veh01');
  rt.ctx.vehDayToggleRoute('veh01', D, 'r2'); await rt.settle();
  assert.deepEqual(plain(rt.writes()[0].body), { route_ids: ['r1', 'r2'] });
  assert.deepEqual(plain(v().dayRoute[D]), ['r1', 'r2']);
  rt.ctx.vehDaySetRoute('veh01', D, 'r3'); await rt.settle();
  assert.deepEqual(plain(rt.writes()[1].body), { route_ids: ['r3'] });
  rt.ctx.vehDaySetZone('veh01', D, 'KL'); await rt.settle();
  assert.equal(v().dayZone[D], 'KL');
  rt.ctx.vehDaySetZone('veh01', D, ''); await rt.settle();
  assert.deepEqual(plain(rt.writes()[3].body), { zone: null }); assert.equal(v().dayZone[D], undefined);
  rt.ctx.vehStatusCycleDay('veh01', D); await rt.settle();
  assert.deepEqual(plain(rt.writes()[4].body), { status: 'available' }); assert.equal(v().dayStatus[D], 'available');
  rt.ctx.vehDaySetStatus('veh01', D, ''); await rt.settle();
  assert.equal(v().dayStatus[D], undefined);
  rt.ctx.vehDayClearRoutes('veh01', D); await rt.settle();
  assert.deepEqual(plain(rt.writes()[6].body), { route_ids: [] }); assert.equal(v().dayRoute[D], undefined);
});

test('a refused day write leaves the cell as it was and says why', async () => {
  const rt = runtime({ handlers: { 'PUT /operations/van-days/2026-10-02/veh01': { status: 400, body: { statusCode: 400, message: 'route_ids[0]: route zz does not exist' } } } });
  await rt.loadVans();
  rt.ctx.vehDaySetRoute('veh01', D, 'zz'); await rt.settle();
  assert.deepEqual(plain(rt.ctx.SB_VEHICLES[0].dayRoute[D]), ['r1']);
  assert.match(JSON.stringify(rt.toasts[0]), /does not exist/);
});

test('status ranges: add, edit one field, note debounced, delete (and a reload does not bring it back)', async () => {
  const rt = runtime({ handlers: {
    'POST /operations/vans/veh01/status-ranges': (b) => ({ status: 201, body: { id: 9, van_id: 'veh01', status: b.status, from_date: b.from_date, to_date: b.to_date, note: null } }),
    'PATCH /operations/vans/veh01/status-ranges/7': (b) => ({ body: { id: 7, van_id: 'veh01', status: b.status || 'maintenance', from_date: '2026-10-10', to_date: b.to_date === undefined ? null : b.to_date, note: b.note === undefined ? 'gearbox' : b.note } }),
    'DELETE /operations/vans/veh01/status-ranges/9': { status: 204, body: null },
  } });
  await rt.loadVans();
  const v = () => rt.ctx.SB_VEHICLES.find((x) => x.id === 'veh01');
  rt.ctx.vehStatusAdd('veh01'); await rt.settle();
  assert.deepEqual(plain(rt.writes()[0].body), { status: 'maintenance', from_date: D, to_date: D, note: null });
  assert.deepEqual(plain(v().statusRanges.map((r) => r.id)), [7, 9]);
  rt.ctx.vehStatusSet('veh01', 0, 's', 'off'); await rt.settle();
  assert.deepEqual(plain(rt.writes()[1].body), { status: 'off' }); assert.equal(v().statusRanges[0].s, 'off');
  rt.ctx.vehStatusSet('veh01', 0, 'to', ''); await rt.settle();
  assert.deepEqual(plain(rt.writes()[2].body), { to_date: null });
  rt.ctx.vehStatusSet('veh01', 0, 'note', 'a'); rt.ctx.vehStatusSet('veh01', 0, 'note', 'ab');
  await rt.settle(); assert.equal(rt.writes().length, 3);
  await rt.fire(); assert.deepEqual(plain(rt.writes()[3].body), { note: 'ab' });
  rt.ctx.vehStatusDel('veh01', 1); await rt.settle();
  assert.deepEqual(plain(v().statusRanges.map((r) => r.id)), [7]);
  rt.O.vanJobs.invalidate();
  await rt.loadVans();
  assert.deepEqual(plain(v().statusRanges.map((r) => r.id)), [7], 'deleted range stays gone after a reload');
});

test('zone ranges: add (other zone, open both ends), edit, delete; a refusal changes nothing', async () => {
  const rt = runtime({ handlers: {
    'POST /operations/vans/veh01/zone-ranges': (b) => ({ status: 201, body: { id: 11, van_id: 'veh01', zone: b.zone, from_date: b.from_date, to_date: b.to_date } }),
    'PATCH /operations/vans/veh01/zone-ranges/11': (b) => (b.from_date === 'bad'
      ? { status: 400, body: { statusCode: 400, message: 'from_date must be YYYY-MM-DD' } }
      : { body: { id: 11, van_id: 'veh01', zone: 'KL', from_date: b.from_date, to_date: null } }),
    'DELETE /operations/vans/veh01/zone-ranges/3': { status: 204, body: null },
  } });
  await rt.loadVans();
  const v = () => rt.ctx.SB_VEHICLES.find((x) => x.id === 'veh01');
  rt.ctx.vehZoneAdd('veh01'); await rt.settle();
  assert.deepEqual(plain(rt.writes()[0].body), { zone: 'KL', from_date: null, to_date: null });
  assert.deepEqual(plain(v().zoneOverrides[1]), { id: 11, zone: 'KL', from: '', to: '' });
  rt.ctx.vehZoneSet('veh01', 1, 'from', '2026-10-20'); await rt.settle();
  assert.equal(v().zoneOverrides[1].from, '2026-10-20');
  rt.ctx.vehZoneSet('veh01', 1, 'from', 'bad'); await rt.settle();
  assert.equal(v().zoneOverrides[1].from, '2026-10-20', 'local unchanged');
  assert.equal(rt.toasts.length, 1);
  rt.legacyCalls.length = 0;
  rt.ctx.vehZoneDel('veh01', 0); await rt.settle();
  assert.deepEqual(plain(v().zoneOverrides.map((r) => r.id)), [11]);
  assert.ok(rt.legacyCalls.some((c) => c[0] === 'vehZoneOpen'));
});

test('colour: picked colour PATCHes at once, dragging is debounced and the last one wins', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/vans/veh01': (b) => ({ body: van('veh01', { color: b.color }) }) } });
  await rt.loadVans();
  rt.ctx.vehSetColorLive('veh01', '#111111'); rt.ctx.vehSetColorLive('veh01', '#222222'); rt.ctx.vehSetColorLive('veh01', 'nope');
  await rt.settle(); assert.equal(rt.writes().length, 0);
  await rt.fire();
  assert.deepEqual(plain(rt.writes().map((r) => r.body)), [{ color: '#222222' }]);
  assert.equal(rt.ctx.SB_VEHICLES[0].color, '#222222');
  rt.ctx.vehSetColor('veh01', ''); await rt.settle();
  assert.deepEqual(plain(rt.writes()[1].body), { color: null }); assert.equal(rt.ctx.SB_VEHICLES[0].color, undefined);
});

test('vehAdd opens the form (the server needs a name) and sends nothing', async () => {
  const rt = runtime();
  rt.ctx.vehAdd(); await rt.settle();
  assert.deepEqual(plain(rt.legacyCalls), [['vehFormOpen', [null]]]);
  assert.equal(rt.writes().length, 0);
});

test('edit via form does not send color unless the user picked one (legacy form state has no color)', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/vans/veh01': (b) => ({ body: van('veh01', { color: '#8b5cf6' }) }) } });
  await rt.loadVans();
  rt.ctx._vehForm = { id: 'veh01', name: 'Van', plate: 'P', type: 'van', capacity: 9, ownership: 'own', zoneBase: 'PK', driver: '', driverPhone: '', active: true };
  rt.ctx.vehFormSave(); await rt.settle();
  assert.equal('color' in plain(rt.writes()[0].body), false, 'a no-change save must not wipe the stored colour');
  // picking "auto" in the form (vehFormSetColor sets '') is an explicit request to clear it
  rt.ctx._vehForm = { id: 'veh01', name: 'Van', plate: 'P', type: 'van', capacity: 9, ownership: 'own', zoneBase: 'PK', driver: '', driverPhone: '', active: true, color: '' };
  rt.ctx.vehFormSave(); await rt.settle();
  assert.equal(plain(rt.writes()[1].body).color, null);
});
