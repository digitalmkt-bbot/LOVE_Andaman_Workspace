// Market Data Sales / Agents tabs load the period first (99-ops-md-sales-load.js)
//   node --test test/unit/ops-md-sales-load.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// ── 13 ──────────────────────────────────────────────────────────────────────
const MD_SRC = fs.readFileSync('allotment_v2/js/ops/99-ops-md-sales-load.js', 'utf8');
function mdRuntime({ enabled = true, ensure, tab = 'sales' }) {
  const calls = [], draws = [], ensured = [];
  const window = {
    laOps: { enabled: () => enabled, activeView: () => 'marketdata' },
    mdTabSales: (days) => { calls.push('sales'); return 'SALES-HTML'; },
    mdTabAgents: (days) => { calls.push('agents'); return 'AGENTS-HTML'; },
    mdNote: (t) => 'NOTE:' + t,
    renderMarketData: () => draws.push('draw'),
    bookingV2OpsEnsureCreated: (from, to) => { ensured.push([from, to]); return ensure(from, to); },
  };
  vm.runInNewContext(MD_SRC, { window, console, Date, Promise, _mdTab: tab });
  return { window, calls, draws, ensured };
}
const tick = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };

test('13: the Sales tab asks for the last 12 months of bookings, shows a loading note, then draws again from the loaded bookings', async () => {
  let release;
  const rt = mdRuntime({ ensure: () => new Promise((r) => { release = () => r({ bookings: [], via: 'recent' }); }) });
  const out = rt.window.mdTabSales([]);
  assert.match(out, /^NOTE:Loading bookings/);
  assert.deepEqual(rt.calls, [], 'legacy adds nothing up on the partial list');
  assert.equal(rt.ensured.length, 1);
  const [from, to] = rt.ensured[0];
  const days = (Date.parse(to) - Date.parse(from)) / 864e5;
  assert.ok(days >= 364 && days <= 367, 'about a year: ' + from + ' to ' + to);
  release(); await tick();
  assert.deepEqual(rt.draws, ['draw']);
});

test('13: once loaded (the loader answers null) the legacy tab draws; a failed load draws once from what is loaded and is not retried', async () => {
  const loaded = mdRuntime({ ensure: () => null });
  assert.equal(loaded.window.mdTabAgents([]), 'AGENTS-HTML');
  const failed = mdRuntime({ tab: 'agents', ensure: () => Promise.resolve(null) });
  assert.match(failed.window.mdTabAgents([]), /^NOTE:/);
  await tick();
  assert.deepEqual(failed.draws, ['draw']);
  assert.equal(failed.window.mdTabAgents([]), 'AGENTS-HTML', 'the redraw gets the legacy tab, no second request');
  assert.equal(failed.ensured.length, 1);
});

test('13: legacy mode does not load anything', () => {
  const rt = mdRuntime({ enabled: false, ensure: () => { throw new Error('must not load'); } });
  assert.equal(rt.window.mdTabSales([]), 'SALES-HTML');
  assert.equal(rt.ensured.length, 0);
});

