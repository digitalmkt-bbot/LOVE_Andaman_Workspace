import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const SOURCE = fs.readFileSync('allotment_v2/js/ops/56-ops-rep-pickupmap.js', 'utf8');
const J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

function setupTest(opts = {}) {
  const {
    enabled = true,
    activeView = 'rep-ops',
    repStVal = { from: '2026-10-01', to: '2026-10-31' },
    repPrevRangeVal = { from: '2026-09-01', to: '2026-09-30' },
  } = opts;

  const loads = [];
  const availLoads = [];
  const legacyCalls = [];
  const elements = {};

  function getEl(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        style: {},
        textContent: '',
        children: [],
        insertBefore(node, ref) {
          this.children.unshift(node);
          elements[node.id] = node;
        },
        remove() {
          delete elements[id];
        },
      };
    }
    return elements[id];
  }

  // Pre-create host containers
  getEl('rep-host-ops');
  getEl('pickupmap-wrap');

  const ctx = {
    console,
    Promise,
    Error,
    JSON,
    Object,
    Array,
    Number,
    String,
    Math,
    Date,
    parseInt,
    isNaN,
    setTimeout,
    clearTimeout,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: (k) => (enabled ? 'tok' : null) },
    laOpsFetch: async () => ({ status: 200, ok: true, text: async () => '{}' }),
    document: {
      getElementById: (id) => elements[id] || null,
      createElement: (tag) => ({
        id: '',
        style: {},
        textContent: '',
        remove() {
          if (this.id && elements[this.id]) delete elements[this.id];
        },
      }),
    },
    renderReport: function(kind) {
      legacyCalls.push(['renderReport', kind]);
    },
    renderPickupMap: function() {
      legacyCalls.push(['renderPickupMap']);
    },
    pmapRefresh: function() {
      legacyCalls.push(['pmapRefresh']);
    },
    repSt: function(kind) {
      return repStVal;
    },
    repPrevRange: function(from, to) {
      return repPrevRangeVal;
    },
    bookingV2EnsureOpsRange: function(range) {
      loads.push(range);
      return Promise.resolve(true);
    },
  };
  ctx.window = ctx;

  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);

  let currentView = activeView;
  ctx.laOps.activeView = () => currentView;
  ctx.laOps.availability = {
    ensure: (date) => {
      availLoads.push(date);
      return Promise.resolve(true);
    },
  };

  vm.runInContext(SOURCE, ctx);

  return {
    ctx,
    loads,
    availLoads,
    legacyCalls,
    elements,
    setView: (v) => { currentView = v; },
  };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

test('legacy mode: passes straight through to legacy functions without triggering ops loads', async () => {
  const t = setupTest({ enabled: false });

  t.ctx.renderReport('ops');
  assert.equal(t.legacyCalls.length, 1);
  assert.equal(t.legacyCalls[0][0], 'renderReport');
  assert.equal(t.loads.length, 0);
  assert.equal(t.availLoads.length, 0);

  t.ctx.renderPickupMap();
  assert.equal(t.legacyCalls.length, 2);
  assert.equal(t.legacyCalls[1][0], 'renderPickupMap');
  assert.equal(t.loads.length, 0);
});

test('rep-ops: non-ops report kind does not trigger ops range loads', async () => {
  const t = setupTest({ activeView: 'rep-sales' });

  t.ctx.renderReport('sales');
  assert.equal(t.legacyCalls.length, 1);
  assert.equal(t.legacyCalls[0][1], 'sales');
  assert.equal(t.loads.length, 0);
  assert.equal(t.availLoads.length, 0);
});

test('rep-ops: loads both current and comparison ranges, then redraws on settle', async () => {
  const t = setupTest({ activeView: 'rep-ops' });

  t.ctx.renderReport('ops');
  // Initially calls original renderReport synchronously
  assert.equal(t.legacyCalls.length, 1);
  assert.equal(t.legacyCalls[0][1], 'ops');

  // Both current and comparison periods queued
  assert.deepEqual(J(t.loads), [
    { from: '2026-09-01', to: '2026-09-30' },
    { from: '2026-10-01', to: '2026-10-31' },
  ]);
  // Availability queued for both starts
  assert.deepEqual(J(t.availLoads), ['2026-10-01', '2026-09-01']);

  // Loading banner shown
  assert.ok(t.elements['rep-ops-period']);
  assert.match(t.elements['rep-ops-period'].textContent, /Loading comparison period/);

  await settle();

  // Redraw called after loads resolve
  assert.equal(t.legacyCalls.length, 2);
  assert.equal(t.legacyCalls[1][1], 'ops');
  // Banner removed after redraw
  assert.equal(t.elements['rep-ops-period'], undefined);
});

test('rep-ops: does not redraw if active view changed before loads completed', async () => {
  const t = setupTest({ activeView: 'rep-ops' });

  t.ctx.renderReport('ops');
  assert.equal(t.legacyCalls.length, 1);

  // Switch view away before loads settle
  t.setView('pickupmap');
  await settle();

  // No second renderReport call
  assert.equal(t.legacyCalls.length, 1);
});

test('pickupmap: month mode loads current month and previous month, then refreshes', async () => {
  const t = setupTest({ activeView: 'pickupmap' });
  t.ctx._pmapMode = 'month';
  t.ctx._pmapAnchor = '2026-10-14';

  t.ctx.renderPickupMap();
  assert.equal(t.legacyCalls.length, 1);
  assert.equal(t.legacyCalls[0][0], 'renderPickupMap');

  assert.deepEqual(J(t.loads), [
    { from: '2026-09-01', to: '2026-09-30' },
    { from: '2026-10-01', to: '2026-10-31' },
  ]);

  await settle();

  // Refreshed after completion
  assert.equal(t.legacyCalls.length, 2);
  assert.equal(t.legacyCalls[1][0], 'pmapRefresh');
  assert.equal(t.elements['pmap-ops-period'], undefined);
});

test('pickupmap: week mode loads current week and previous week, then refreshes', async () => {
  const t = setupTest({ activeView: 'pickupmap' });
  t.ctx._pmapMode = 'week';
  // Wednesday 2026-10-14 -> Monday 2026-10-12 .. Sunday 2026-10-18
  // Previous week: Monday 2026-10-05 .. Sunday 2026-10-11
  t.ctx._pmapAnchor = '2026-10-14';

  t.ctx.pmapRefresh();
  assert.equal(t.legacyCalls.length, 1);
  assert.equal(t.legacyCalls[0][0], 'pmapRefresh');

  assert.deepEqual(J(t.loads), [
    { from: '2026-10-05', to: '2026-10-11' },
    { from: '2026-10-12', to: '2026-10-18' },
  ]);

  await settle();

  assert.equal(t.legacyCalls.length, 2);
  assert.equal(t.legacyCalls[1][0], 'pmapRefresh');
});

test('pickupmap: year mode avoids downloading entire database and shows informative banner', async () => {
  const t = setupTest({ activeView: 'pickupmap' });
  t.ctx._pmapMode = 'year';
  t.ctx._pmapAnchor = '2026-10-14';

  t.ctx.renderPickupMap();
  assert.equal(t.legacyCalls.length, 1);
  assert.equal(t.legacyCalls[0][0], 'renderPickupMap');

  // Must NOT trigger booking loads for the whole year
  assert.equal(t.loads.length, 0);

  // Banner informs user
  assert.ok(t.elements['pmap-ops-period']);
  assert.match(t.elements['pmap-ops-period'].textContent, /Year view: showing loaded bookings/);

  await settle();
  // No refresh kicked
  assert.equal(t.legacyCalls.length, 1);
});
