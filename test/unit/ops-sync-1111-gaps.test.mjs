import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Sync 11-11 gaps, adapter side.
// 1. Trip P&L van cost per run / per-run zone (§pxVanRun, §pxVanJoin): the server's tripVanCost answers it; ops/44 shows the
//    server's vans[] as it comes (one entry per run, so a van can appear twice), nothing to send.
// 2. Rescue boat costing (§bopSwap2, carried from 11-10): the server says rescue / swap on the trip; ops/44 passes both to
//    legacy's renderers (pxSwPill reads t.rescue.for, t.swap.to / cause, and t.ctx.date).
const SOURCE = fs.readFileSync('allotment_v2/js/ops/44-ops-costing-pl.js', 'utf8');
function load() {
  const O = {
    enabled: () => true, today: () => '2026-11-11', onWrite: () => {}, wrote: () => {}, fail: () => {}, loadingHtml: () => '',
    get: () => Promise.resolve({}), post: () => Promise.resolve({}), patch: () => Promise.resolve({}), del: () => Promise.resolve(null),
    call: () => Promise.resolve({}), queue: (fn) => Promise.resolve().then(fn),
  };
  const window = { laOps: O, _px: { date: '2026-11-11', pier: '', tab: 'd', an: 47, mon: '2026-11' }, _ct: { pid: '' } };
  for (const k of ['ctRead', 'ctWrite', 'renderTripPL', 'ctRender', 'pxDay', 'pxTrip', 'pxDayAgg', 'pxAnalysis', 'pxClose', 'pxRan', 'pxOvSave']) window[k] = () => null;
  const ctx = { window, console, document: { getElementById: () => null }, Number, String, Object, Array, JSON, Date, Promise, Math, encodeURIComponent, setTimeout, isFinite, confirm: () => true, alert: () => {} };
  vm.runInNewContext(SOURCE, ctx);
  return window.__laOpsCostingCompat;
}
const trip = (extra) => ({ date: '2026-11-11', boat_id: 'b1', name: 'B1', status: 'est', pax: {}, rows: [], upsell: {}, longtail: {}, fuel_price: {}, ...extra });

test('§pxVanRun: the server\'s per-run van shares reach the renderer as they are (same van twice = two runs)', () => {
  const vans = [{ van_id: 'V1', name: 'Love7', day: 1700, share: 1, zone: 'PK' }, { van_id: 'V1', name: 'Love7', day: 1700, share: 0.5, zone: 'KL' }];
  const t = load().legacyTrip(trip({ vans }));
  assert.deepEqual(JSON.parse(JSON.stringify(t.vans)), vans);
});

test('§bopSwap2: a rescue trip carries rescue.for, the broken boat carries swap.to / cause, a plain trip neither', () => {
  const c = load();
  const r = c.legacyTrip(trip({ boat_id: 'R', rescue: { for: 'X' }, swap: null }));
  assert.deepEqual(JSON.parse(JSON.stringify(r.rescue)), { for: 'X' });
  assert.equal(r.swap, null);
  assert.equal(r.ctx.date, '2026-11-11', 'pxSwPill reads the date from t.ctx');
  const x = c.legacyTrip(trip({ boat_id: 'X', swap: { to: 'R', cause: 'engine' } }));
  assert.deepEqual(JSON.parse(JSON.stringify(x.swap)), { to: 'R', cause: 'engine' });
  assert.equal(x.rescue, null);
  const p = c.legacyTrip(trip({}));
  assert.deepEqual([p.rescue, p.swap], [null, null], 'an older server with no fields: no pills, as before');
  const noCause = c.legacyTrip(trip({ swap: { to: 'R' } }));
  assert.equal(noCause.swap.cause, '');
});
