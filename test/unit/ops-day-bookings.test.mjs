// Rows 42 / 66 / 67 / 80 / 84-86 / 89 / 90 / 95 / 105 · the day screens that sum SB_BOOKINGS for one date asked
// for nothing, so they drew from whatever another view had loaded.  57-ops-day-bookings.js runs the legacy
// render at once, loads the date (bookingV2OpsEnsureDay) and renders once more when the load lands.
//   node --test test/unit/ops-day-bookings.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(process.env.DAYBK_SRC || 'allotment_v2/js/ops/57-ops-day-bookings.js', 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

function runtime({ enabled = true, cached = new Set(), failLoad = false, view = 'piercheckin' } = {}) {
  const renders = [], ensured = [], vanDays = [], legacy = [];
  const O = {
    enabled: () => enabled, busy: () => false, activeView: () => view, today: () => '2026-10-15',
    vanJobs: { loadDay: async (d) => { vanDays.push(d); return true; } },
    onWrite() {},
  };
  const ctx = {
    console, Promise, Date, Array, Object, String, setImmediate,
    document: { getElementById: (id) => (id === 'piercheckin-host' ? {} : null) },
    laOps: O,
    _pckDate: '2026-10-20', _poDate: '2026-10-21', _vehDate: '2026-10-16', _bkV2LockManageId: null,
    SB_SEAT_LOCKS: [{ id: 'L1', date: '2026-10-22' }, { id: 'L2', date: '2026-10-22', scope: 'bulk' }],
    bookingV2LockSpansDays: (l) => l.scope === 'bulk',
    bookingV2OpsEnsureDay: (d) => { ensured.push(d); if (cached.has(d)) return null; cached.add(d); return Promise.resolve(failLoad ? null : { bookings: [] }); },
    bookingV2Render: () => renders.push('bookingV2Render'),
  };
  ctx.window = ctx;                // a browser's window IS the global scope
  const w = ctx;
  w.renderPierCheckin = () => { renders.push('pier:' + ctx._pckDate); return 'r'; };
  w.renderPierJob = () => { renders.push('job:' + ctx._poDate); };
  w.renderVehicles = () => { renders.push('veh'); };
  w.bookingV2LockManageOpen = (id) => { ctx._bkV2LockManageId = id; legacy.push('manage:' + id); };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { w, ctx, renders, ensured, vanDays, legacy };
}

test('Pier Check-in: renders at once, loads its date, renders again when the load lands', async () => {
  const rt = runtime();
  assert.equal(rt.w.renderPierCheckin(), 'r');
  assert.deepEqual(rt.renders, ['pier:2026-10-20']);
  await tick();
  assert.deepEqual(rt.ensured, ['2026-10-20']);
  assert.deepEqual(rt.renders, ['pier:2026-10-20', 'pier:2026-10-20']);
});

test('a date already loaded: one render, no second pass (the chain stops)', async () => {
  const rt = runtime({ cached: new Set(['2026-10-20']) });
  rt.w.renderPierCheckin(); await tick();
  assert.deepEqual(rt.renders, ['pier:2026-10-20']);
});

test('a failed load does not re-render (and cannot loop)', async () => {
  const rt = runtime({ failLoad: true });
  rt.w.renderPierCheckin(); await tick();
  assert.deepEqual(rt.renders, ['pier:2026-10-20']);
});

test('the date changed while loading: the newer render owns the screen', async () => {
  const rt = runtime();
  rt.w.renderPierCheckin(); rt.ctx._pckDate = '2026-10-25'; await tick();
  assert.deepEqual(rt.renders, ['pier:2026-10-20']);
});

test('Boat job sheet loads _poDate the same way', async () => {
  const rt = runtime();
  rt.w.renderPierJob(); await tick();
  assert.deepEqual(rt.ensured, ['2026-10-21']);
  assert.deepEqual(rt.renders, ['job:2026-10-21', 'job:2026-10-21']);
});

test('Seat lock page: a day lock loads its date and redraws; a bulk lock loads nothing', async () => {
  const rt = runtime();
  rt.w.bookingV2LockManageOpen('L1'); await tick();
  assert.deepEqual(rt.ensured, ['2026-10-22']);
  assert.deepEqual(rt.renders, ['bookingV2Render']);
  const bulk = runtime();
  bulk.w.bookingV2LockManageOpen('L2'); await tick();
  assert.deepEqual(bulk.ensured, []);
  assert.deepEqual(bulk.legacy, ['manage:L2']);
});

test('Transfer Fleet loads today, the matrix day and the summary day through the van adapter, throttled', async () => {
  const rt = runtime({ view: 'vehicles' });
  rt.ctx.window._vehSumDay = '2026-10-18';
  rt.w.renderVehicles(); await tick();
  assert.deepEqual(rt.vanDays.sort(), ['2026-10-15', '2026-10-16', '2026-10-18']);
  assert.deepEqual(rt.renders, ['veh', 'veh']);
  rt.w.renderVehicles(); await tick();                       // within 5 s: no second kick
  assert.equal(rt.vanDays.length, 3);
  assert.deepEqual(rt.renders, ['veh', 'veh', 'veh']);
});

test('legacy mode: the originals, zero loads', async () => {
  const rt = runtime({ enabled: false });
  rt.w.renderPierCheckin(); rt.w.renderPierJob(); rt.w.renderVehicles(); rt.w.bookingV2LockManageOpen('L1'); await tick();
  assert.deepEqual(rt.ensured, []);
  assert.equal(rt.vanDays.length, 0);
  assert.deepEqual(rt.renders, ['pier:2026-10-20', 'job:2026-10-21', 'veh']);
});
