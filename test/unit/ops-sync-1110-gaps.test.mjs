// lk-inbox sync 2026-11-10 · §opsSwap: a mid-trip boat swap (lk-inbox §bopSwap) goes to operation-backend as one record
// (PUT / DELETE /operations/deployments/{d}/{boat}/mid-trip-swap), never through the deployment diff, and comes back from
// GET /operations/deployments as legacy's cells. §bopOvf: the replace-a-boat confirm lists the days left short of seats.
//   node --test test/unit/ops-sync-1110-gaps.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const DEP = fs.readFileSync('allotment_v2/js/ops/20-ops-deployments.js', 'utf8');
const BULK = fs.readFileSync('allotment_v2/js/ops/80-ops-bop-bulk.js', 'utf8');
const D = '2026-11-10';
const clone = (x) => JSON.parse(JSON.stringify(x));
const restoreInPlace = (t, s) => { Object.keys(t).forEach((k) => delete t[k]); Object.assign(t, clone(s)); };
const tick = () => new Promise((r) => setImmediate(r));

function load(rows, answer) {
  const calls = [], fails = [], timers = [];
  let chain = Promise.resolve();
  const O = {
    enabled: () => true, clone, restoreInPlace, busy: () => false, activeView: () => '', wrote() {}, toast() {}, onWrite() {},
    shift: (d) => d, today: () => D,
    fail: (msg, e) => fails.push([msg, e && e.message]),
    queue: (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; },
    get: (p) => { calls.push(['GET', p]); return Promise.resolve({ deployments: clone(rows) }); },
    post: (p, b) => { calls.push(['POST', p, b]); return Promise.resolve({}); },
    del: (p) => { calls.push(['DELETE', p]); return answer('DELETE', p); },
    call: (m, p, b) => { calls.push([m, p, b]); return answer(m, p, b); },
    anyway: (send) => send({}),
    runBatch: (ops) => ops.reduce((p, op) => p.then(op.run), Promise.resolve()),
  };
  const ctx = {
    console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, encodeURIComponent,
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {},
    document: { getElementById: () => null }, alert() {},
    TRIPS: {}, BOAT_CAP_OVR: {}, BOATS: [{ id: 'zeus', cap: 40 }, { id: 'achilles', cap: 45 }],
    getBoat: (id) => ({ id, cap: id === 'zeus' ? 40 : 45 }),
    save() {}, laOps: O,
  };
  ctx.window = ctx;
  // legacy bop2SwapSave / bop2SwapUndo, as js/04-data-core.js writes the two cells
  ctx.bop2SwapSave = function () {
    const S = ctx._bop2Sw; if (S.refuse) return;
    const day = ctx.TRIPS[S.d], prev = day[S.to] ? clone(day[S.to]) : null;
    day[S.to] = { route: S.route, type: 'rescue', rescueFor: S.from, booked: 0, prev };
    day[S.from].swap = { id: 'sw1', to: S.to, cause: 'engine', mode: 'all', moved: { bk1: 13 }, stay: {}, pax: 13 };
    ctx.save('operations');
  };
  ctx.bop2SwapUndo = function (d, fromId) {
    if (ctx.cancelUndo) return;
    const day = ctx.TRIPS[d], ev = day[fromId].swap, opB = day[ev.to];
    if (opB && opB.type === 'rescue') { if (opB.prev) day[ev.to] = opB.prev; else delete day[ev.to]; }
    delete day[fromId].swap;
    ctx.save('operations');
  };
  vm.createContext(ctx);
  vm.runInContext(DEP, ctx);
  const runTimers = async () => { while (timers.length) { timers.shift()(); await tick(); } };
  return { ctx, O, calls, fails, runTimers, ready: ctx.laOps.deployments.load() };
}
const zeus = { boat_id: 'zeus', route_id: 'r-sim', service_date: D, capacity: 40, trip_type: 'normal' };
const achilles = { boat_id: 'achilles', route_id: 'r-sur', service_date: D, capacity: 45, trip_type: 'early' };

test('§opsSwap load: the server\'s swap columns come back as legacy\'s cells (swap on the broken boat, rescue cell with its prev job)', async () => {
  const L = load([{ ...zeus, mid_trip_swap: { to: 'achilles', cause: 'engine', moved: { bk1: 13 } } },
    { ...achilles, route_id: 'r-sim', rescue_for: 'zeus', rescue_prev: { route_id: 'r-sur', capacity: 45, trip_type: 'early' } }], () => Promise.resolve({}));
  await L.ready;
  const day = L.ctx.TRIPS[D];
  assert.deepEqual(clone(day.zeus), { route: 'r-sim', type: 'normal', booked: 0, swap: { to: 'achilles', cause: 'engine', moved: { bk1: 13 } } });
  assert.deepEqual(clone(day.achilles), { route: 'r-sim', type: 'rescue', rescueFor: 'zeus', booked: 0, prev: { route: 'r-sur', type: 'early', booked: 0 } });
  // nothing changed locally: the sync sends nothing for them
  L.ctx.save('operations'); await L.runTimers();
  assert.deepEqual(L.calls.filter((c) => c[0] !== 'GET'), []);
});

test('§opsSwap record: one PUT with the record, no plain deployment for the rescue boat, the server\'s rows become the cells', async () => {
  const answer = (m, p, b) => Promise.resolve({ deployments: [
    { ...zeus, mid_trip_swap: { ...b.record, at: '2026-11-10T04:00:00Z' } },
    { ...achilles, route_id: 'r-sim', rescue_for: 'zeus', rescue_prev: { route_id: 'r-sur', capacity: 45, trip_type: 'early' } }] });
  const L = load([zeus, achilles], answer);
  await L.ready;
  L.ctx._bop2Sw = { d: D, from: 'zeus', to: 'achilles', route: 'r-sim' };
  L.ctx.bop2SwapSave();
  await L.runTimers(); await tick(); await L.runTimers();
  const writes = L.calls.filter((c) => c[0] !== 'GET');
  assert.equal(writes.length, 1, JSON.stringify(writes));
  assert.deepEqual([writes[0][0], writes[0][1], writes[0][2].to_boat_id, writes[0][2].record.moved], ['PUT', `/operations/deployments/${D}/zeus/mid-trip-swap`, 'achilles', { bk1: 13 }]);
  assert.equal(L.ctx.TRIPS[D].zeus.swap.at, '2026-11-10T04:00:00Z', 'the server\'s row');
  assert.equal(L.ctx.TRIPS[D].achilles.type, 'rescue');
  // a later sync has nothing to send for the two boats
  L.ctx.save('operations'); await L.runTimers();
  assert.equal(L.calls.filter((c) => c[0] !== 'GET').length, 1);
  assert.deepEqual(L.fails, []);
});

test('§opsSwap record refused: the two cells go back to what the server holds, and the server\'s text is shown', async () => {
  const L = load([zeus, achilles], () => Promise.reject(Object.assign(new Error('Achilles cannot be used: chartered'), { status: 409, code: 'charter_boat' })));
  await L.ready;
  L.ctx._bop2Sw = { d: D, from: 'zeus', to: 'achilles', route: 'r-sim' };
  L.ctx.bop2SwapSave();
  await tick(); await tick();
  assert.deepEqual(clone(L.ctx.TRIPS[D].achilles), { route: 'r-sur', type: 'early', booked: 0 });
  assert.equal(L.ctx.TRIPS[D].zeus.swap, undefined);
  assert.deepEqual(L.fails, [['Mid-trip swap not saved', 'Achilles cannot be used: chartered']]);
  await L.runTimers();
  assert.deepEqual(L.calls.filter((c) => c[0] === 'POST' || c[0] === 'DELETE'), [], 'nothing went through the diff');
});

test('§opsSwap legacy refused the form (alert, nothing written): nothing is sent', async () => {
  const L = load([zeus, achilles], () => Promise.resolve({}));
  await L.ready;
  L.ctx._bop2Sw = { d: D, from: 'zeus', to: 'achilles', route: 'r-sim', refuse: true };
  L.ctx.bop2SwapSave();
  await L.runTimers();
  assert.deepEqual(L.calls.filter((c) => c[0] !== 'GET'), []);
});

test('§opsSwap undo: one DELETE; the server\'s rows (and boats removed) become the cells; cancelled at the confirm sends nothing', async () => {
  const rows = [{ ...zeus, mid_trip_swap: { to: 'achilles' } }, { ...achilles, route_id: 'r-sim', rescue_for: 'zeus', rescue_prev: null }];
  const L = load(rows, () => Promise.resolve({ deployments: [zeus], removed: ['achilles'] }));
  await L.ready;
  L.ctx.cancelUndo = true; L.ctx.bop2SwapUndo(D, 'zeus'); await L.runTimers();
  assert.deepEqual(L.calls.filter((c) => c[0] !== 'GET'), []);
  L.ctx.cancelUndo = false; L.ctx.bop2SwapUndo(D, 'zeus');
  await L.runTimers(); await tick(); await L.runTimers();
  assert.deepEqual(L.calls.filter((c) => c[0] !== 'GET').map((c) => c.slice(0, 2)), [['DELETE', `/operations/deployments/${D}/zeus/mid-trip-swap`]]);
  assert.deepEqual(clone(L.ctx.TRIPS[D]), { zeus: { route: 'r-sim', type: 'normal', booked: 0 } });
});

test('§opsSwap undo of a record the server never had (404): the two cells go as plain deployments', async () => {
  // e.g. recorded in ops mode before this adapter: the server has the rescue boat as a plain deployment, no record
  const L = load([zeus, { ...achilles, route_id: 'r-sim' }], () => Promise.reject(Object.assign(new Error('No mid-trip swap recorded'), { status: 404, code: 'no_swap' })));
  await L.ready;
  L.ctx.TRIPS[D].zeus.swap = { to: 'achilles' };
  L.ctx.TRIPS[D].achilles = { route: 'r-sim', type: 'rescue', rescueFor: 'zeus', booked: 0, prev: { route: 'r-sur', type: 'early', booked: 0 } };
  L.ctx.bop2SwapUndo(D, 'zeus');
  await L.runTimers(); await tick(); await L.runTimers();
  const writes = L.calls.filter((c) => c[0] !== 'GET');
  assert.equal(writes[0][0], 'DELETE');
  assert.deepEqual(writes.slice(1).map((c) => [c[0], c[1], c[2] && c[2].boat_id, c[2] && c[2].route_id]), [['POST', '/operations/deployments', 'achilles', 'r-sur']]);
  assert.deepEqual(L.fails, []);
});

test('§bopOvf replace-a-boat confirm (ops mode) lists the days the preview found short of seats, in legacy\'s words', async () => {
  const asked = [];
  const ctx = {
    console, Promise, Object, Array, String, JSON, Math, Error,
    document: { getElementById: (id) => ({ 'bop2rp-from': { value: 'zeus' }, 'bop2rp-to': { value: 'achilles' }, 'bop2rp-d1': { value: D }, 'bop2rp-d2': { value: D } })[id] || null },
    alert() {}, confirm: (m) => { asked.push(m); return false; }, laGuardEdit: () => true,
    bop2OvfD: (d) => '10 พ.ย.', BOATS: [], bop2ApplyReplace() { throw new Error('legacy should not run'); },
    _bop2RpImpact: [{ d: D, routeName: 'Similan', over: 7 }],
  };
  ctx.window = ctx;
  ctx.laOps = new Proxy({ enabled: () => true, deployments: { isReady: () => true }, queue: (fn) => fn(),
    post: () => Promise.resolve({ moved: [{ service_date: D, route_id: 'r-sim' }], dropped: [], skipped: [], from_boat: { name: 'Zeus' }, to_boat: { name: 'Achilles' } }) },
  { get: (t, k) => (k in t ? t[k] : () => null) });
  vm.createContext(ctx);
  vm.runInContext(BULK, ctx);
  await ctx.bop2ApplyReplace();
  assert.equal(asked.length, 1);
  assert.match(asked[0], /Move Zeus -> Achilles on 1 day\(s\)/);
  assert.match(asked[0], /⚠ ที่นั่งไม่พอ 1 รอบ: 10 พ.ย. Similan -7/);
  ctx._bop2RpImpact = [];
  await ctx.bop2ApplyReplace();
  assert.doesNotMatch(asked[1], /ที่นั่งไม่พอ/);
});
