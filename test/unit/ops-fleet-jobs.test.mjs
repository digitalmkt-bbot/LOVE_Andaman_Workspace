import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/24-ops-fleet-jobs.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false, today: () => '2026-10-12', onChange: () => {} } };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseInt });
  return window.__laOpsFleetJobsCompat;
}

test('incident and job mappers preserve boatStatus || (setFixing===false ? available : fixing) and map server fields', () => {
  const c = compat();
  const inc = c.fromServerIncident({
    id: 'inc_1',
    no: 'INC-001',
    boat_id: 'b1',
    date: '2026-10-10',
    time: '09:00',
    title: 'Gearbox noise',
    detail: 'Loud whine',
    remark: 'Crew report',
    priority: 4,
    severity: 'critical',
    status: 'open',
    shown_status: 'inprogress',
    job_id: 'mj_1',
    related_job_ids: ['mj_1'],
    damaged_assets: [{ type: 'gearbox', asset_id: 'g1', label: 'GB-100', swapped: true, swapped_to: 'GB-200', swapped_on: '2026-10-10' }],
    progress_log: [{ date: '2026-10-10', text: 'Opened', by: 'System', created_on: null }]
  });
  assert.equal(inc.boatId, 'b1');
  assert.equal(inc.maintId, 'mj_1');
  assert.equal(inc.damagedAssets[0].gbId, 'g1');
  assert.equal(inc.damagedAssets[0].swappedTo, 'GB-200');

  const jobRunAlongside = c.fromServerJob({
    id: 'mj_1',
    no: 'MJ-001',
    boat_id: 'b1',
    type: 'preventive',
    title: 'Check oil',
    status: 'inprogress',
    boat_status: null,
    set_fixing: false,
    cost: 1200,
    assets: [{ type: 'engine', asset_id: 'e1', label: 'E-1 · Port', status: 'ready' }],
    steps: [{ text: 'Check filter', done: true, done_by: 'tech', done_on: '2026-10-11' }]
  });
  assert.equal(jobRunAlongside.setFixing, false);
  assert.equal(jobRunAlongside.boatStatus, 'available', 'setFixing===false defaults boatStatus to available');
  assert.equal(jobRunAlongside.assets[0].engId, 'e1');
  assert.equal(jobRunAlongside.subs[0].d, 1);

  const jobFixing = c.fromServerJob({
    id: 'mj_2',
    no: 'MJ-002',
    boat_id: 'b1',
    type: 'corrective',
    title: 'Fix engine',
    status: 'pending',
    boat_status: null,
    set_fixing: true
  });
  assert.equal(jobFixing.boatStatus, 'fixing');

  assert.deepEqual(JSON.parse(JSON.stringify(c.toJobCloseBody('success', 'All good', true, false))), {
    outcome: 'success',
    note: 'All good',
    awaiting_invoice: true,
    reset_service: false
  });
});

function createRuntime(){
  const calls = [];
  let nextResolver = null;
  let serverIncidents = [{
    id: 'inc_1', no: 'INC-001', boat_id: 'b1', date: '2026-10-10', title: 'Engine stall', status: 'open',
    damaged_assets: [{ type: 'engine', asset_id: 'e1', label: 'E-1' }], progress_log: []
  }];
  let serverJobs = [{
    id: 'mj_1', no: 'MJ-001', boat_id: 'b1', type: 'corrective', title: 'Engine stall', status: 'pending',
    boat_status: 'fixing', set_fixing: true, assets: [{ type: 'engine', asset_id: 'e1', label: 'E-1' }], parts: [], progress_log: [], steps: []
  }];

  const FL_INCIDENTS = [];
  const FL_MAINT = [];
  const window = {};
  const O = {
    enabled: () => true,
    today: () => '2026-10-12',
    get: async (path) => {
      calls.push({ method: 'GET', path });
      if(path === '/v1/fleet/incidents') return { incidents: JSON.parse(JSON.stringify(serverIncidents)), next_no: 'INC-002' };
      if(path === '/v1/fleet/jobs') return { jobs: JSON.parse(JSON.stringify(serverJobs)), next_no: 'MJ-002' };
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
    queue: fn => Promise.resolve().then(fn),
    fail: (title, err) => calls.push({ fail: title, message: err && err.message }),
    wrote: kind => calls.push({ wrote: kind }),
    onChange: () => {},
    fleetBoats: { refetchBoat: async id => { calls.push({ refetchBoat: id }); } },
    fleetAssets: { refetchChain: async () => { calls.push({ refetchChain: true }); } }
  };
  window.laOps = O;
  window.flMaintCalcCost = () => 0;
  window.flSaveIncident = () => 'legacy';
  window.flDeleteIncident = () => 'legacy';
  window.flAddIncLog = () => 'legacy';
  window.flSaveCreateJob = () => 'legacy';
  window.flMaintStart = () => 'legacy';
  window.flMaintClose = () => 'legacy';
  window.flDeleteMaint = () => 'legacy';
  window.flMaintServiceResetManual = () => 'legacy';
  window.flSaveEditBoatStatus = () => 'legacy';
  window.flMaintAddAsset = () => 'legacy';
  window.flMaintRemoveAsset = () => 'legacy';
  window.flMaintAddLog = () => 'legacy';
  window.flMaintTogglePin = () => 'legacy';
  window.flBoardSubTick = () => 'legacy';
  window.flBoardSubAdd = () => 'legacy';
  window.flBoardSubDel = () => 'legacy';
  window.flBoardSubSplit = () => 'legacy';
  window.flSplitExistingJob = () => 'legacy';

  const context = {
    window,
    document: { getElementById: () => null, querySelectorAll: () => [] },
    console,
    Number,
    String,
    Object,
    Array,
    JSON,
    Date,
    Promise,
    encodeURIComponent,
    parseInt,
    confirm: () => true,
    alert: msg => calls.push({ alert: msg }),
    FL_INCIDENTS,
    FL_MAINT
  };
  vm.runInNewContext(SOURCE, context);
  return {
    window,
    context,
    calls,
    FL_INCIDENTS,
    FL_MAINT,
    setServerJobs: v => { serverJobs = v; },
    resolveNext: val => nextResolver.resolve(val),
    rejectNext: err => nextResolver.reject(err),
    tick: () => new Promise(r => setImmediate(r))
  };
}

test('job start and close commands are server-first, refetch dependent boat and assets, and do not mutate on rejection', async () => {
  const rt = createRuntime();
  await rt.tick();
  await rt.tick();
  assert.equal(rt.FL_MAINT.length, 1);
  assert.equal(rt.FL_MAINT[0].status, 'pending');

  // Start job: no local mutation before response
  const startP = rt.window.flMaintStart('mj_1');
  await rt.tick();
  assert.equal(rt.FL_MAINT[0].status, 'pending', 'job remains pending before server responds');
  const startCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/jobs/mj_1/start');
  assert.ok(startCall);

  // Reject start -> status stays pending
  rt.rejectNext(new Error('already started'));
  await startP;
  assert.equal(rt.FL_MAINT[0].status, 'pending');
  assert.ok(rt.calls.some(x => x.fail === 'Could not start maintenance job'));

  // Successful start -> updates job and refetches boat & asset chain
  const startP2 = rt.window.flMaintStart('mj_1');
  await rt.tick();
  const startedJob = {
    id: 'mj_1', no: 'MJ-001', boat_id: 'b1', type: 'corrective', title: 'Engine stall', status: 'inprogress',
    boat_status: 'fixing', set_fixing: true, assets: [{ type: 'engine', asset_id: 'e1', label: 'E-1' }], parts: [], progress_log: [], steps: []
  };
  rt.setServerJobs([startedJob]);
  rt.resolveNext(startedJob);
  await startP2;
  assert.equal(rt.FL_MAINT[0].status, 'inprogress');
  assert.ok(rt.calls.some(x => x.refetchBoat === 'b1'));
  assert.ok(rt.calls.some(x => x.refetchChain === true));

  // Close job -> sends {outcome, note} and refetches
  const closeP = rt.window.flMaintClose('mj_1', 'success', 'Fixed injector');
  await rt.tick();
  const closeCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/jobs/mj_1/close');
  assert.ok(closeCall);
  assert.deepEqual(JSON.parse(JSON.stringify(closeCall.body)), { outcome: 'success', note: 'Fixed injector' });
  const closedJob = { ...startedJob, status: 'done', outcome: 'success', close_note: 'Fixed injector' };
  rt.setServerJobs([closedJob]);
  rt.resolveNext(closedJob);
  await closeP;
  assert.equal(rt.FL_MAINT[0].status, 'done');
  assert.equal(rt.FL_MAINT[0].outcome, 'success');
});

test('legacy mode delegates to original incident and job functions without API calls', () => {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => false,
      today: () => '2026-10-12',
      get: () => { calls.push('api'); return Promise.resolve({}); },
      post: () => { calls.push('api'); return Promise.resolve({}); },
      onChange: () => {}
    },
    flMaintStart: id => { calls.push(['start', id]); return 'legacy'; },
    flMaintClose: (id, out) => { calls.push(['close', id, out]); return 'legacy'; }
  };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseInt });
  assert.equal(window.flMaintStart('mj_1'), 'legacy');
  assert.equal(window.flMaintClose('mj_1', 'success'), 'legacy');
  assert.equal(calls.includes('api'), false);
});
