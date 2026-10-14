// Row 154 · "repair location" on a maintenance job (flMaintSetRepairLoc) set m.location, moved the job's spare/fixing
// engines and added a log line in the browser only (flSave is a no-op in ops mode): nothing survived a reload.
// Now PATCH /v1/fleet/jobs/:id {location}, PATCH /v1/fleet/engines/:id {spare_location} for each engine that is spare
// or in the shop (only when a place is filled in, as legacy), a log line, then a re-read.
//   node --test test/unit/ops-fleet-repair-location.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(process.env.FLEETJOBS_SRC || 'allotment_v2/js/ops/24-ops-fleet-jobs.js', 'utf8');

function runtime({ enabled = true, value = 'shop:honda-phuket', refuseEngine = false } = {}) {
  const calls = [], failures = [], legacy = [], redraws = [];
  const FL_MAINT = [{ id: 'job_1', boatId: 'b1', assets: [{ engId: 'e_spare' }, { engId: 'e_fixing' }, { engId: 'e_onboat' }, { gbId: 'g1' }] }];
  const engines = { e_spare: { id: 'e_spare', boatId: null, status: 'spare' }, e_fixing: { id: 'e_fixing', boatId: 'b1', status: 'fixing' }, e_onboat: { id: 'e_onboat', boatId: 'b1', status: 'active' } };
  const jobRow = (loc) => ({ id: 'job_1', boat_id: 'b1', location: loc, assets: [], progress_log: [] });
  const O = new Proxy({
    enabled: () => enabled, today: () => '2026-10-15', onChange() {}, wrote() {},
    queue: (fn) => Promise.resolve().then(fn),
    patch: async (path, body) => {
      calls.push('PATCH ' + path + ' ' + JSON.stringify(body));
      if (refuseEngine && path.includes('/engines/')) { const e = new Error('engine is installed'); throw e; }
      return path.includes('/jobs/') ? jobRow(body.location) : {};
    },
    post: async (path, body) => { calls.push('POST ' + path + ' ' + JSON.stringify(body)); return jobRow(value); },
    fail: (title, e) => failures.push({ title, message: e && e.message }),
    fleetAssets: { refetchChain: async () => { calls.push('refetchChain'); } },
  }, { get: (t, k) => (k in t ? t[k] : async () => ({})) });
  const window = { laOps: O, flMaintSetRepairLoc: () => { legacy.push('legacy'); }, flGetEng: (id) => engines[id], flRenderMaintDetail: (id) => redraws.push('detail:' + id) };
  const ctx = {
    window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, isNaN, Math,
    FL_MAINT, document: { getElementById: (id) => (id === 'fl-maint-reploc-job_1' ? { value: '  ' + value + ' ' } : null) },
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, calls, failures, legacy, redraws, FL_MAINT };
}

test('PATCHes the job, each spare/shop engine, logs a line, re-reads the chain, redraws the detail', async () => {
  const rt = runtime();
  await rt.window.flMaintSetRepairLoc('job_1');
  assert.deepEqual(rt.calls, [
    'PATCH /v1/fleet/jobs/job_1 {"location":"shop:honda-phuket"}',
    'PATCH /v1/fleet/engines/e_spare {"spare_location":"shop:honda-phuket"}',
    'PATCH /v1/fleet/engines/e_fixing {"spare_location":"shop:honda-phuket"}',
    'POST /v1/fleet/jobs/job_1/log ' + JSON.stringify({ text: '📍 ตั้งสถานที่ซ่อม: shop:honda-phuket (อัปเดตเครื่อง 2 ตัว)', by: 'ระบบ' }),
    'refetchChain',
  ]);                                              // e_onboat is installed: untouched, as in legacy
  assert.deepEqual(rt.redraws, ['detail:job_1']);
  assert.equal(rt.failures.length, 0);
  assert.equal(rt.legacy.length, 0);
});

test('an empty place only clears the job location: no engine is moved', async () => {
  const rt = runtime({ value: '' });
  await rt.window.flMaintSetRepairLoc('job_1');
  assert.equal(rt.calls[0], 'PATCH /v1/fleet/jobs/job_1 {"location":""}');
  assert.ok(!rt.calls.some((c) => c.includes('/engines/')));
});

test('an engine refused by the server: red toast, and the screen is re-read, not left showing the typed place', async () => {
  const rt = runtime({ refuseEngine: true });
  await rt.window.flMaintSetRepairLoc('job_1');
  assert.equal(rt.failures.length, 1);
  assert.equal(rt.failures[0].message, 'engine is installed');
  assert.ok(!rt.calls.some((c) => c.startsWith('POST')), 'no log line for a move that did not happen');
  assert.deepEqual(rt.redraws, []);
});

test('legacy mode: the original, zero requests', async () => {
  const rt = runtime({ enabled: false });
  await rt.window.flMaintSetRepairLoc('job_1');
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.legacy, ['legacy']);
});
