// §batchReads (2026-11-26, UI parity: the fan-out reads) · the screens that asked once per boat now ask once per window / day:
// capacity overrides (93-ops-w6c-boats.js, §capAllOne) and the guide-order lead (85-ops-pier-w5.js, §sheetsOne). Each falls back
// to the one-boat reads when the batch is refused. The pier job reads (§jobsOne) are in ops-pier-job.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const flush = async () => { for (let i = 0; i < 10; i++) { await new Promise((r) => setTimeout(r, 5)); await new Promise((r) => setImmediate(r)); } };
const qs = (q) => (q ? '?' + Object.keys(q).map((k) => k + '=' + q[k]).join('&') : '');

function capRuntime({ batch = true } = {}) {
  const calls = [], draws = [];
  const day = (boat, d, cap) => ({ boat_id: boat, service_date: d, capacity: cap, normal: cap, ceiling: cap + 5, overridden: false, reason: null, set_by: null, set_at: null });
  const win = {
    laOps: {
      enabled: () => true, onWrite: () => {}, busy: () => false, activeView: () => 'operation',
      get: (p, q) => {
        calls.push(p + qs(q));
        if (p === '/v1/capacity-overrides') return batch ? Promise.resolve({ overrides: q.boat_ids.split(',').map((b, i) => day(b, '2026-11-20', 10 + i)) }) : Promise.reject(new Error('400'));
        const m = /^\/v1\/boats\/([^/]+)\/capacity-overrides$/.exec(p);
        if (m) return Promise.resolve({ overrides: [day(m[1], '2026-11-20', 30)] });
        return Promise.reject(new Error('no answer ' + p));
      },
    },
    boatCapInfo: () => 'legacy', baAssignedPax: () => 0, baAssignedBookings: () => ({}),
    renderOp: () => draws.push('renderOp'),
  };
  const ctx = vm.createContext({ window: win, console, Promise, Array, Object, Error, String, Number, JSON, Math, Date, encodeURIComponent, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync('allotment_v2/js/ops/93-ops-w6c-boats.js', 'utf8'), ctx);
  return { w: win, calls, draws };
}

test('§capAllOne: the boats one draw asks about are read in ONE request for the window, and drawn again once', async () => {
  const rt = capRuntime();
  ['b1', 'b2', 'b3'].forEach((b) => assert.equal(rt.w.boatCapInfo(b, '2026-11-20'), 'legacy', 'legacy until the answer is in'));
  await flush();
  assert.equal(rt.calls.length, 1);
  assert.match(rt.calls[0], /^\/v1\/capacity-overrides\?from=\d{4}-\d\d-\d\d&to=\d{4}-\d\d-\d\d&all=true&boat_ids=b1,b2,b3$/);
  assert.deepEqual(['b1', 'b2', 'b3'].map((b) => rt.w.boatCapInfo(b, '2026-11-20').cap), [10, 11, 12], 'each boat gets its own days (boat_id of each row)');
  assert.deepEqual(rt.draws, ['renderOp']);
  rt.w.boatCapInfo('b1', '2026-11-21'); await flush();
  assert.equal(rt.calls.length, 1, 'the window is read once');
});

test('§capAllOne: a refused batch reads each boat on its own, as before', async () => {
  const rt = capRuntime({ batch: false });
  rt.w.boatCapInfo('b1', '2026-11-20'); rt.w.boatCapInfo('b2', '2026-11-20');
  await flush();
  assert.equal(rt.calls.length, 3);
  assert.deepEqual(rt.calls.slice(1).map((c) => c.split('?')[0]), ['/v1/boats/b1/capacity-overrides', '/v1/boats/b2/capacity-overrides']);
  assert.equal(rt.w.boatCapInfo('b2', '2026-11-20').cap, 30);
});
