// Parity R2 2026-11-26 · charter cells come from GET /operations/deployments (charter_booking_id, charter_agent, charter),
// not only from the bookings this browser loaded; the Boat Operation "Charter" pick goes to the server as `charter`.
//   node --test test/unit/ops-parity-charter-1126.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const DEP = fs.readFileSync('allotment_v2/js/ops/20-ops-deployments.js', 'utf8');
const D = '2026-11-27';
const clone = (x) => JSON.parse(JSON.stringify(x));
const restoreInPlace = (t, s) => { Object.keys(t).forEach((k) => delete t[k]); Object.assign(t, clone(s)); };
const tick = () => new Promise((r) => setImmediate(r));

function load(rows) {
  const calls = [], timers = [];
  let chain = Promise.resolve();
  const O = {
    enabled: () => true, clone, restoreInPlace, busy: () => false, activeView: () => '', wrote() {}, toast() {}, onWrite() {},
    shift: (d) => d, today: () => D, fail() {},
    queue: (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; },
    get: (p) => { calls.push(['GET', p]); return Promise.resolve({ deployments: clone(rows) }); },
    post: (p, b) => { calls.push(['POST', p, b]); return Promise.resolve({}); },
    del: (p) => { calls.push(['DELETE', p]); return Promise.resolve(null); },
    anyway: (send) => send({}),
    runBatch: (ops) => ops.reduce((p, op) => p.then(op.run), Promise.resolve()),
  };
  const ctx = {
    console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, encodeURIComponent,
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {},
    document: { getElementById: () => null }, alert() {},
    TRIPS: {}, BOAT_CAP_OVR: {}, getBoat: (id) => ({ id, cap: 30 }), save() {}, laOps: O,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(DEP, ctx);
  const runTimers = async () => { while (timers.length) { timers.shift()(); await tick(); } };
  return { ctx, calls, runTimers, ready: ctx.laOps.deployments.load() };
}
const row = (boat_id, extra = {}) => ({ boat_id, route_id: 'r10', service_date: D, capacity: 30, trip_type: 'early', charter: false, charter_booking_id: null, charter_agent: null, chartered: false, ...extra });

test('load: a charter booking\'s boat and a Charter pick become legacy\'s charter cells, with the agent for the fleet calendar', async () => {
  const L = load([row('b1', { charter_booking_id: 'lg_BK-1', charter_agent: 'THREELAN', chartered: true }), row('b2', { charter: true, chartered: true }), row('b3')]);
  await L.ready;
  const day = L.ctx.TRIPS[D];
  assert.deepEqual(clone(day.b1), { route: 'r10', type: 'charter', booked: 0, charterBookingId: 'lg_BK-1', charterAgent: 'THREELAN' });
  assert.deepEqual(clone(day.b2), { route: 'r10', type: 'charter', booked: 0 });
  assert.deepEqual(clone(day.b3), { route: 'r10', type: 'early', booked: 0 });
  // nothing changed locally: the sync sends nothing (a charter booking's cell is not sent as a Charter pick)
  L.ctx.save('operations'); await L.runTimers();
  assert.deepEqual(L.calls.filter((c) => c[0] !== 'GET'), []);
});

test('sync: picking Charter sends charter:true once; Early sends trip_type with charter:false', async () => {
  const L = load([row('b3')]);
  await L.ready;
  L.ctx.TRIPS[D].b3.type = 'charter';
  L.ctx.save('operations'); await L.runTimers();
  let posts = L.calls.filter((c) => c[0] === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0][2].charter, true);
  assert.equal(posts[0][2].trip_type, undefined);
  L.ctx.save('operations'); await L.runTimers();
  assert.equal(L.calls.filter((c) => c[0] === 'POST').length, 1, 'the server now holds the mark: nothing more to send');
  L.ctx.TRIPS[D].b3.type = 'normal';
  L.ctx.save('operations'); await L.runTimers();
  posts = L.calls.filter((c) => c[0] === 'POST');
  assert.equal(posts.length, 2);
  assert.deepEqual([posts[1][2].charter, posts[1][2].trip_type], [false, 'normal']);
});
