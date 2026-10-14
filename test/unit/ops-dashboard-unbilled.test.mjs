// The Dashboard's "not yet billed" row reads the server's `unbilled {count, baht, agents}`
// (GET /v1/dashboard) instead of the browser's own scan, rounded to whole baht like legacy.
//   node --test test/unit/ops-dashboard-unbilled.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(process.env.DASH_SRC || 'allotment_v2/js/ops/60-ops-dashboard.js', 'utf8');

function runtime({ enabled = true, body } = {}) {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => enabled, busy: () => false, activeView: () => 'dashboard',
      get: async (path, q) => { calls.push(path + ' ' + JSON.stringify(q)); return body; },
      fail() {}, onWrite() {},
    },
    // the legacy local scan: deliberately different numbers so we can tell which one wins
    _dashBoardData: () => ({ pend: 1, unN: 99, unB: 123456, unAg: 9 }),
  };
  const ctx = { window, Promise, Object, String, Math, Error };
  vm.runInNewContext(SOURCE, ctx);
  return { window, calls };
}
const dash = (unbilled, at = '2026-10-15T01:00:00Z') => ({
  version: 1, generated_at: at, summary: {}, routes: [], boats: [], bookings: {}, alerts: [], ...(unbilled ? { unbilled } : {}),
});

test('server unbilled replaces the local scan and baht is rounded to whole baht', async () => {
  const rt = runtime({ body: dash({ count: 7, baht: 12345.67, agents: 3 }) });
  assert.equal(rt.window._dashBoardData().unN, 99, 'before the response the legacy figure stays');
  await rt.window.laOps.dashboard.ensure('2026-10-15', 'day');
  const d = rt.window._dashBoardData();
  assert.deepEqual([d.unN, d.unB, d.unAg], [7, 12346, 3]);
  assert.equal(d.pend, 1, 'the other legacy fields are untouched');
  assert.equal(rt.window._dashBoardData.__ops, true);
});

test('rounding follows Math.round for .5 and tiny amounts', async () => {
  const rt = runtime({ body: dash({ count: 1, baht: 0.4, agents: 1 }) });
  await rt.window.laOps.dashboard.ensure('2026-10-15', 'day');
  assert.equal(rt.window._dashBoardData().unB, 0);
  const rt2 = runtime({ body: dash({ count: 1, baht: 1500.5, agents: 1 }) });
  await rt2.window.laOps.dashboard.ensure('2026-10-15', 'day');
  assert.equal(rt2.window._dashBoardData().unB, 1501);
});

test('a server answer of zero is shown as zero, not replaced by the local scan', async () => {
  const rt = runtime({ body: dash({ count: 0, baht: 0, agents: 0 }) });
  await rt.window.laOps.dashboard.ensure('2026-10-15', 'day');
  const d = rt.window._dashBoardData();
  assert.deepEqual([d.unN, d.unB, d.unAg], [0, 0, 0]);
});

test('with operation-backend off, or a response without unbilled, the legacy scan is kept', async () => {
  const off = runtime({ enabled: false, body: dash({ count: 7, baht: 1, agents: 3 }) });
  assert.equal(off.window._dashBoardData().unN, 99);
  const old = runtime({ body: dash(null) });
  await old.window.laOps.dashboard.ensure('2026-10-15', 'day');
  assert.equal(old.window._dashBoardData().unN, 99);
});
