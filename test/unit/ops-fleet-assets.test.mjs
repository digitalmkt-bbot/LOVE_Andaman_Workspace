import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/23-ops-fleet-assets.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false, onChange: () => {} } };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, isNaN });
  return window.__laOpsFleetAssetsCompat;
}

test('drivetrain mappers normalize Starboard/Stbd to Std and PATCH bodies exclude server-owned links/status/hours/logs', () => {
  const c = compat();
  assert.equal(c.normalizePos('Starboard'), 'Std');
  assert.equal(c.normalizePos('Stbd Outer'), 'Std Outer');
  assert.equal(c.normalizePos('Port'), 'Port');

  const eng = c.fromServerEngine({
    id: 'e1',
    brand: 'Honda',
    model: 'BF250',
    serial: 'SN-1',
    hp: 250,
    boat_id: 'b1',
    pos: 'Starboard',
    status: 'ready',
    base_hours: 120,
    service_interval: 100,
    last_service_hours: 100,
    hours: 155,
    service: { current_hours: 155, interval: 100, base: 100, since: 55, next: 200, left: 45, pct: 55, overdue: false },
    log: [{ date: '2026-10-01', type: 'install', description: 'Fitted', hours: 120 }]
  });
  assert.equal(eng.pos, 'Std');
  assert.equal(eng.hours, 155);
  assert.equal(eng.boatId, 'b1');

  const patchEng = c.toEngineFactsBody({
    brand: 'Honda',
    model: 'BF250',
    serial: 'SN-1',
    hp: 250,
    baseHours: 120,
    serviceInterval: 100,
    status: 'fixing',
    boatId: 'b2',
    pos: 'Port',
    lastServiceHours: 999,
    hours: 999,
    log: [{ type: 'fake' }]
  }, false);
  assert.equal('boat_id' in patchEng, false, 'PATCH never includes boat_id');
  assert.equal('pos' in patchEng, false, 'PATCH never includes pos');
  assert.equal('status' in patchEng, false, 'PATCH never includes status');
  assert.equal('last_service_hours' in patchEng, false, 'PATCH never includes last_service_hours');
  assert.equal('hours' in patchEng, false, 'PATCH never includes computed hours');
  assert.equal('log' in patchEng, false, 'PATCH never includes log');

  assert.deepEqual(JSON.parse(JSON.stringify(c.toInstallEngineBody('b1', 'Stbd', 'mj_1'))), {
    boat_id: 'b1',
    pos: 'Std',
    job_id: 'mj_1'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toInstallGearboxBody('e1'))), { engine_id: 'e1' });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toInstallPropellerBody('g1', 'Starboard'))), { gearbox_id: 'g1', prop_pos: 'Std' });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toSwapBody('e2'))), { with_id: 'e2' });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toServiceBody(210.5))), { hours: 210.5 });
});

function createRuntime(){
  const calls = [];
  let nextResolver = null;
  let serverEngines = [{ id: 'e1', brand: 'Honda', model: 'BF250', serial: 'E-1', boat_id: 'b1', pos: 'Port', status: 'ready', base_hours: 100, hours: 140 }];
  let serverGearboxes = [{ id: 'g1', brand: 'Honda', model: 'GB', serial: 'G-1', engine_id: 'e1', boat_id: 'b1', status: 'ready', base_hours: 100, lifetime_hours: 40 }];
  let serverPropellers = [{ id: 'p1', brand: 'Solas', serial: 'P-1', gearbox_id: 'g1', boat_id: 'b1', status: 'active' }];

  const FL_ENGINES = [];
  const FL_GEARBOXES = [];
  const FL_PROPELLERS = [];
  const window = {};
  const O = {
    enabled: () => true,
    clone: v => v == null ? v : JSON.parse(JSON.stringify(v)),
    get: async (path) => {
      calls.push({ method: 'GET', path });
      if(path === '/v1/fleet/engines') return { engines: JSON.parse(JSON.stringify(serverEngines)) };
      if(path === '/v1/fleet/gearboxes') return { gearboxes: JSON.parse(JSON.stringify(serverGearboxes)) };
      if(path === '/v1/fleet/propellers') return { propellers: JSON.parse(JSON.stringify(serverPropellers)) };
      if(path.startsWith('/v1/fleet/engines/')) return JSON.parse(JSON.stringify(serverEngines[0]));
      if(path.startsWith('/v1/fleet/gearboxes/')) return JSON.parse(JSON.stringify(serverGearboxes[0]));
      if(path.startsWith('/v1/fleet/propellers/')) return JSON.parse(JSON.stringify(serverPropellers[0]));
      return {};
    },
    post: (path, body) => new Promise((resolve, reject) => {
      calls.push({ method: 'POST', path, body });
      nextResolver = { resolve, reject };
    }),
    patch: (path, body) => new Promise((resolve, reject) => {
      calls.push({ method: 'PATCH', path, body });
      nextResolver = { resolve, reject };
    }),
    queue: fn => Promise.resolve().then(fn),
    fail: (title, err) => calls.push({ fail: title, message: err && err.message }),
    wrote: kind => calls.push({ wrote: kind }),
    onChange: () => {}
  };
  window.laOps = O;
  window.flEngHours = () => 0;
  window.flEngServiceState = () => null;
  window.flGbLifetimeHours = () => 0;
  window.flGbServiceState = () => null;
  window.flSaveEngine = () => 'legacy';
  window.flSaveGearbox = () => 'legacy';
  window.flSavePropeller = () => 'legacy';
  window.flSaveAssignEng = () => 'legacy';
  window.flUnassignEng = () => 'legacy';
  window.flEquipSwapDo = () => 'legacy';
  window.flEquipRemove = () => 'legacy';
  window.flConfirmMove = () => 'legacy';
  window.flChangeEngStatus = () => 'legacy';
  window.flEngMarkService = () => 'legacy';
  window.flGbMarkService = () => 'legacy';
  window.flGbSetInterval = () => 'legacy';
  window.flRenderEquip = () => {};

  const context = {
    window,
    document: {
      getElementById: id => {
        if(id === 'fl-assign-eng-sel') return { value: 'e1' };
        if(id === 'fl-assign-eng-pos') return { value: 'Starboard' };
        if(id === 'fl-move-note') return { value: 'To Panwa' };
        return null;
      },
      querySelector: () => ({ value: 'pier:panwa' })
    },
    console,
    Number,
    String,
    Object,
    Array,
    JSON,
    Date,
    Promise,
    encodeURIComponent,
    parseFloat,
    parseInt,
    isNaN,
    confirm: () => true,
    prompt: () => '150',
    alert: msg => calls.push({ alert: msg }),
    FL_ENGINES,
    FL_GEARBOXES,
    FL_PROPELLERS,
    _assignBoatId: 'b2',
    _replaceEngId: null,
    _flSwap: { type: 'eng', id: 'e1' },
    flMoveCtx: { assetType: 'gearbox', assetId: 'g1' }
  };
  vm.runInNewContext(SOURCE, context);
  return {
    window,
    context,
    calls,
    FL_ENGINES,
    FL_GEARBOXES,
    FL_PROPELLERS,
    setServerEngines: v => { serverEngines = v; },
    resolveNext: val => nextResolver.resolve(val),
    rejectNext: err => nextResolver.reject(err),
    tick: () => new Promise(r => setImmediate(r))
  };
}

test('commands (install, swap, move, service) are server-first, refetch the engine->gearbox->propeller chain, and do not mutate on failure', async () => {
  const rt = createRuntime();
  await rt.tick();
  await rt.tick();
  assert.equal(rt.FL_ENGINES.length, 1);
  assert.equal(rt.FL_ENGINES[0].boatId, 'b1');

  // Install engine via flSaveAssignEng normalizes Starboard -> Std and waits for server
  const instP = rt.window.flSaveAssignEng();
  await rt.tick();
  assert.equal(rt.FL_ENGINES[0].boatId, 'b1', 'no local mutation before server responds');
  const instCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/engines/e1/install');
  assert.ok(instCall);
  assert.deepEqual(JSON.parse(JSON.stringify(instCall.body)), { boat_id: 'b2', pos: 'Std' });

  // Reject install -> local state stays b1
  rt.rejectNext(new Error('occupied'));
  await instP;
  assert.equal(rt.FL_ENGINES[0].boatId, 'b1');
  assert.ok(rt.calls.some(x => x.fail === 'Could not assign engine'));

  // Swap engine via flEquipSwapDo -> POST /v1/fleet/engines/e1/swap {with_id:'e2'} and refetches chain
  const swapP = rt.window.flEquipSwapDo('e2');
  await rt.tick();
  const swapCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/engines/e1/swap');
  assert.ok(swapCall);
  assert.deepEqual(JSON.parse(JSON.stringify(swapCall.body)), { with_id: 'e2' });
  rt.setServerEngines([{ id: 'e1', brand: 'Honda', model: 'BF250', serial: 'E-1', boat_id: 'b2', pos: 'Std', status: 'ready', base_hours: 100, hours: 140 }]);
  rt.resolveNext({ id: 'e1' });
  await swapP;
  assert.equal(rt.FL_ENGINES[0].boatId, 'b2');
  assert.equal(rt.FL_ENGINES[0].pos, 'Std');

  // Move spare gearbox -> POST /v1/fleet/gearboxes/g1/move
  const moveP = rt.window.flConfirmMove();
  await rt.tick();
  const moveCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/gearboxes/g1/move');
  assert.ok(moveCall);
  assert.deepEqual(JSON.parse(JSON.stringify(moveCall.body)), { spare_location: 'pier:panwa', note: 'To Panwa' });
  rt.resolveNext({ id: 'g1' });
  await moveP;

  // Service engine -> POST /v1/fleet/engines/e1/service {hours:150}
  const svcP = rt.window.flEngMarkService('e1');
  await rt.tick();
  const svcCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/engines/e1/service');
  assert.ok(svcCall);
  assert.deepEqual(JSON.parse(JSON.stringify(svcCall.body)), { hours: 150 });
  rt.resolveNext({ id: 'e1' });
  await svcP;
});

test('legacy mode delegates to original asset functions without API calls', () => {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => false,
      get: () => { calls.push('api'); return Promise.resolve({}); },
      post: () => { calls.push('api'); return Promise.resolve({}); },
      onChange: () => {}
    },
    flSaveEngine: () => { calls.push('saveEng'); return 'legacy'; },
    flEquipSwapDo: () => { calls.push('swap'); return 'legacy'; }
  };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, isNaN });
  assert.equal(window.flSaveEngine(), 'legacy');
  assert.equal(window.flEquipSwapDo('e2'), 'legacy');
  assert.equal(calls.includes('api'), false);
});
