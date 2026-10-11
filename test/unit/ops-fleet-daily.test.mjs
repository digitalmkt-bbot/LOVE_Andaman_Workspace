import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/26-ops-fleet-daily.js', 'utf8');

function compat(){
  const FL_DAILY = { '2026-10-10': { b1: { fuel: 50, trips: {} } } };
  const FL_FUEL_PRICE = { '2026-10-10': { tublamu: 32.5 } };
  const FL_DR_LOCK = { '2026-10-10': { tublamu: true } };
  const window = { laOps: { enabled: () => false, today: () => '2026-10-12', shift: () => '2026-10-01', onChange: () => {} } };
  vm.runInNewContext(SOURCE, {
    window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, isNaN, Math,
    FL_DAILY, FL_FUEL_PRICE, FL_DR_LOCK
  });
  return { compat: window.__laOpsFleetDailyCompat, FL_DAILY, FL_FUEL_PRICE, FL_DR_LOCK };
}

test('daily response replaces cache for only that date, honors server pier locks, and builds exact payloads', () => {
  const { compat: c, FL_DAILY, FL_FUEL_PRICE, FL_DR_LOCK } = compat();

  // Apply daily response for 2026-10-12 -> 2026-10-10 stays untouched
  c.applyDailyDay({
    date: '2026-10-12',
    boats: [{
      boat_id: 'b1',
      pier: 'tublamu',
      fuel_litres: 120,
      pax_actual: 28,
      meters: { normal: { e1: 450.5 } },
      water: { open: 10, close: 15, used: 5 },
      issues: { it_1: 2 },
      extras: [{ id: 'x1', name: 'Ice', qty: 3, unit: 'bag' }]
    }],
    fuel_prices: { tublamu: 33.25 },
    locks: { panwa: { locked_at: '2026-10-12T10:00:00Z', locked_by: 'staff' } },
    requests: {}
  });

  assert.equal(FL_DAILY['2026-10-10'].b1.fuel, 50, 'other date cache is untouched');
  assert.equal(FL_DAILY['2026-10-12'].b1.fuel, 120);
  assert.equal(FL_DAILY['2026-10-12'].b1.paxActual, 28);
  assert.equal(FL_DAILY['2026-10-12'].b1.trips.normal.engines.e1, 450.5);
  assert.equal(FL_FUEL_PRICE['2026-10-12'].tublamu, 33.25);
  assert.equal(FL_DR_LOCK['2026-10-12'].panwa, true);
  assert.equal(FL_DR_LOCK['2026-10-10'].tublamu, true);

  assert.deepEqual(JSON.parse(JSON.stringify(c.toBoatDayPatchBody({
    fuel_litres: 130,
    pax_actual: 30,
    meters: { normal: { e1: 452.1 } }
  }))), {
    fuel_litres: 130,
    pax_actual: 30,
    meters: { normal: { e1: 452.1 } }
  });

  const proj = c.fromServerProject({
    id: 'proj_1',
    no: 'PRJ-001',
    name: 'Annual Drydock',
    boat_id: 'b1',
    type: 'drydock',
    plan_from: '2026-10-01',
    plan_to: '2026-10-20',
    status: 'inprogress',
    planned_budget: 250000,
    cost: 120000,
    plan: [{ id: 'pl_1', text: 'Hull paint', done: true }],
    documents: [],
    vendor_visits: []
  });
  assert.equal(proj.boatId, 'b1');
  assert.equal(proj.plannedBudget, 250000);
  assert.equal(proj.cost, 120000);

  assert.deepEqual(JSON.parse(JSON.stringify(c.toSafetyReplaceBody({
    reason: 'expired',
    description: 'Expired flare',
    date: '2026-10-12',
    source: 'inventory',
    newInventoryId: 'inv_1',
    newSerial: 'SN-NEW',
    installDate: '2026-10-12',
    incNo: 'INC-010',
    mjNo: 'MJ-010'
  }))), {
    reason: 'expired',
    description: 'Expired flare',
    date: '2026-10-12',
    source: 'inventory',
    item_id: 'inv_1',
    serial: 'SN-NEW',
    install_date: '2026-10-12',
    installer: null,
    labour: 0,
    incident_no: 'INC-010',
    job_no: 'MJ-010'
  });
});

function createRuntime(){
  const calls = [];
  let nextResolver = null;
  const FL_PROJECTS = [{ id: 'proj_1', no: 'PRJ-001', name: 'Refit', boatId: 'b1', status: 'inprogress', plan: [] }];
  const FL_DAILY = { '2026-10-12': { b1: { fuel: 80, paxActual: 20, trips: {} } } };
  const FL_FUEL_PRICE = {};
  const FL_DR_LOCK = {};
  const FL_SAFETY = [{ id: 'sf_1', boatId: 'b1', category: 'flare', name: 'Flare', status: 'active' }];
  const FL_INCIDENTS = [];
  const FL_MAINT = [];
  const FL_MEMOS = [];

  const window = {};
  const O = {
    enabled: () => true,
    today: () => '2026-10-12',
    shift: () => '2026-10-01',
    clone: v => v == null ? v : JSON.parse(JSON.stringify(v)),
    get: async (path, q) => {
      calls.push({ method: 'GET', path, q });
      if(path === '/v1/fleet/projects') return { projects: [{ id: 'proj_1', no: 'PRJ-001', name: 'Refit', boat_id: 'b1', status: 'inprogress', plan_from: '2026-10-01', planned_budget: 100000, plan: [], documents: [], vendor_visits: [] }] };
      if(path === '/v1/fleet/safety') return { items: [{ id: 'sf_1', boat_id: 'b1', category: 'flare', name: 'Flare', status: 'active', inspections: [] }] };
      if(path === '/v1/fleet/fuel-budgets') return { budgets: [{ month: '2026-10', amount: 500000 }] };
      if(path === '/v1/fleet/safety-categories') return { categories: [] };
      if(path === '/v1/fleet/daily-log') return { from: '2026-10-01', to: '2026-10-12', days: [{ date: '2026-10-12', boats: [{ boat_id: 'b1', fuel_litres: 80, pax_actual: 20, meters: {} }], fuel_prices: {}, locks: {}, requests: {} }], issue_items: [] };
      if(path === '/v1/fleet/insights') return { period: 'month', summary: {} };
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
    del: (path) => new Promise((resolve, reject) => {
      calls.push({ method: 'DELETE', path });
      nextResolver = { resolve, reject };
    }),
    call: (method, path, body) => new Promise((resolve, reject) => {
      calls.push({ method, path, body });
      nextResolver = { resolve, reject };
    }),
    queue: fn => Promise.resolve().then(fn),
    fail: (title, err) => calls.push({ fail: title, message: err && err.message }),
    wrote: kind => calls.push({ wrote: kind }),
    onChange: () => {},
    fleetJobs: { load: async () => { calls.push({ refetchJobs: true }); } },
    fleetStock: { refetch: async () => { calls.push({ refetchStock: true }); } },
    fleetBoats: { refetchBoat: async id => { calls.push({ refetchBoat: id }); } }
  };
  window.laOps = O;
  window.flDRLocked = (ds, p) => !!(FL_DR_LOCK[ds] && FL_DR_LOCK[ds][p]);
  window.flSaveFuel = () => 'legacy';
  window.flSavePaxActual = () => 'legacy';
  window.flSaveMeter = () => 'legacy';
  window.flSaveFuelPrice = () => 'legacy';
  window.flDRSetLock = () => 'legacy';
  window.flWaterGet = () => ({});
  window.flWaterSet = () => 'legacy';
  window.flIssueItems = () => [];
  window.flIssueGet = () => 0;
  window.flIssueSet = () => 'legacy';
  window.flExtraGet = () => [];
  window.flExtraSet = () => 'legacy';
  window.flExtraDel = () => 'legacy';
  window.flReqGet = () => [];
  window.flReqSet = () => 'legacy';
  window.flReqDel = () => 'legacy';
  window.flProjSaveModal = () => 'legacy';
  window.flProjStart = () => 'legacy';
  window.flProjHold = () => 'legacy';
  window.flProjResume = () => 'legacy';
  window.flProjCancel = () => 'legacy';
  window.flProjReopen = () => 'legacy';
  window.flProjWorkDone = () => 'legacy';
  window.flProjBillBack = () => 'legacy';
  window.flProjMarkComplete = () => 'legacy';
  window.flProjBillClose = () => 'legacy';
  window.flProjSetPhase = () => 'legacy';
  window.flProjAddPlanItemDirect = () => 'legacy';
  window.flProjTogglePlanItem = () => 'legacy';
  window.flProjDeletePlanItem = () => 'legacy';
  window.flSaveSafety = () => 'legacy';
  window.flSaveInspection = () => 'legacy';
  window.swapDocExecute = () => 'legacy';
  window.fuelSetBudget = () => 'legacy';

  const context = {
    window,
    document: { getElementById: () => null },
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
    Math,
    confirm: () => true,
    prompt: () => 'Reason',
    alert: msg => calls.push({ alert: msg }),
    FL_PROJECTS,
    FL_DAILY,
    FL_FUEL_PRICE,
    FL_DR_LOCK,
    FL_SAFETY,
    FL_INCIDENTS,
    FL_MAINT,
    FL_MEMOS,
    _fuelMonth: '2026-10',
    _swapDoc: {
      itemId: 'sf_1',
      reason: 'expired',
      description: 'Replace flare',
      date: '2026-10-12',
      source: 'inventory',
      newInventoryId: 'inv_1',
      newSerial: 'SN-2'
    }
  };
  vm.runInNewContext(SOURCE, context);
  return {
    window,
    context,
    calls,
    FL_PROJECTS,
    FL_DAILY,
    FL_SAFETY,
    FL_INCIDENTS,
    FL_MAINT,
    resolveNext: val => nextResolver.resolve(val),
    rejectNext: err => nextResolver.reject(err),
    tick: () => new Promise(r => setImmediate(r))
  };
}

test('daily row PATCH, project complete, safety replace, and fuel budget PUT are server-first without browser side-effect recreation', async () => {
  const rt = createRuntime();
  await rt.tick();
  await rt.tick();

  // Save fuel: no local mutation before response
  const fuelP = rt.window.flSaveFuel('2026-10-12', 'b1', '150');
  await rt.tick();
  assert.equal(rt.FL_DAILY['2026-10-12'].b1.fuel, 80, 'fuel unchanged before server response');
  const fuelCall = rt.calls.find(x => x.method === 'PATCH' && x.path === '/v1/fleet/daily-log/2026-10-12/boats/b1');
  assert.ok(fuelCall);
  assert.deepEqual(JSON.parse(JSON.stringify(fuelCall.body)), { fuel_litres: 150 });

  // Reject fuel PATCH -> stays 80
  rt.rejectNext(new Error('day locked'));
  await fuelP;
  assert.equal(rt.FL_DAILY['2026-10-12'].b1.fuel, 80);

  // Project complete -> sends POST /v1/fleet/projects/proj_1/complete and does NOT locally push to FL_MAINT
  const compP = rt.window.flProjMarkComplete('proj_1');
  await rt.tick();
  const compCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/projects/proj_1/complete');
  assert.ok(compCall);
  rt.resolveNext({ id: 'proj_1', no: 'PRJ-001', name: 'Refit', boat_id: 'b1', status: 'completed', plan_from: '2026-10-01', plan: [], documents: [], vendor_visits: [] });
  await compP;
  assert.ok(rt.calls.some(x => x.refetchJobs === true));
  assert.ok(rt.calls.some(x => x.refetchBoat === 'b1'));

  // Safety replace -> sends POST /v1/fleet/safety/sf_1/replace and does NOT locally push to FL_INCIDENTS or FL_MAINT
  const repP = rt.window.swapDocExecute();
  await rt.tick();
  assert.equal(rt.FL_INCIDENTS.length, 0, 'browser does not recreate server incident side effect');
  assert.equal(rt.FL_MAINT.length, 0, 'browser does not recreate server job side effect');
  const repCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/safety/sf_1/replace');
  assert.ok(repCall);
  rt.resolveNext({
    old_item: { id: 'sf_1', boat_id: 'b1', category: 'flare', name: 'Flare', status: 'replaced', inspections: [] },
    new_item: { id: 'sf_2', boat_id: 'b1', category: 'flare', name: 'Flare', status: 'active', serial: 'SN-2', inspections: [] }
  });
  await repP;
  assert.equal(rt.FL_SAFETY.find(x => x.id === 'sf_1').status, 'replaced');
  assert.equal(rt.FL_SAFETY.find(x => x.id === 'sf_2').serial, 'SN-2');

  // Fuel budget PUT -> PUT /v1/fleet/fuel-budgets/2026-10
  const budP = rt.window.fuelSetBudget('600000');
  await rt.tick();
  const budCall = rt.calls.find(x => x.method === 'PUT' && x.path === '/v1/fleet/fuel-budgets/2026-10');
  assert.ok(budCall);
  assert.deepEqual(JSON.parse(JSON.stringify(budCall.body)), { amount: 600000 });
  rt.resolveNext({ month: '2026-10', amount: 600000 });
  await budP;
});

test('legacy mode delegates to original daily/project/safety functions without API calls', () => {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => false,
      today: () => '2026-10-12',
      shift: () => '2026-10-01',
      get: () => { calls.push('api'); return Promise.resolve({}); },
      post: () => { calls.push('api'); return Promise.resolve({}); },
      onChange: () => {}
    },
    flSaveFuel: () => { calls.push('fuel'); return 'legacy'; },
    flProjStart: () => { calls.push('proj'); return 'legacy'; }
  };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, isNaN, Math });
  assert.equal(window.flSaveFuel('2026-10-12', 'b1', 100), 'legacy');
  assert.equal(window.flProjStart('proj_1'), 'legacy');
  assert.equal(calls.includes('api'), false);
});
