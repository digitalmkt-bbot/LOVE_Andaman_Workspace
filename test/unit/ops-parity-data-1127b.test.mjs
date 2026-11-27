// Parity round 7 (agent P, 2026-11-27):
//  P1 · the fleet calendar marks ⚓ a boat a charter takes through a split or dispatch (legacy fcCell's baCharterBoatMapMemo part),
//       from the deployment's charter_taken_by kept on the TRIPS cell (ops/20) and read by the fcCell wrapper (ops/80).
//  P2 · "N ลูก ชั่วโมงตั้งต้น 0 · ตั้งตามมิเตอร์" on the Engines tab comes from GET /v1/fleet/engine-base-hours (ops/99).
//   node --test test/unit/ops-parity-data-1127b.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const DEP = fs.readFileSync('allotment_v2/js/ops/20-ops-deployments.js', 'utf8');
const W5A = fs.readFileSync('allotment_v2/js/ops/80-ops-w5a-reads.js', 'utf8');
const ENG = fs.readFileSync('allotment_v2/js/ops/99-ops-engine-fix.js', 'utf8');
const D = '2026-11-27';
const clone = (x) => JSON.parse(JSON.stringify(x));
const tick = () => new Promise((r) => setImmediate(r));

test('P1 · a deployment taken by a charter keeps charter_taken_by on its cell; the fleet calendar marks it ⚓', async () => {
  const rows = [
    { boat_id: 'tri01', route_id: 'r-selava', service_date: D, capacity: 38, trip_type: 'normal', charter: false, charter_booking_id: null, charter_taken_by: 'lg_b2c_LOV-1643970_1', charter_agent: 'B2C', chartered: true },
    { boat_id: 'zeus', route_id: 'r5', service_date: D, capacity: 40, trip_type: 'normal', charter: false, charter_booking_id: null, charter_taken_by: null, charter_agent: null, chartered: false },
  ];
  const O = {
    enabled: () => true, clone, restoreInPlace() {}, busy: () => false, activeView: () => '', wrote() {}, toast() {}, onWrite() {}, onChange() {}, shift: (d) => d, today: () => D, fail() {},
    queue: (fn) => Promise.resolve().then(fn), get: () => Promise.resolve({ deployments: clone(rows) }), post: () => Promise.resolve({}), del: () => Promise.resolve(null),
    anyway: (send) => send({}), runBatch: (ops) => ops.reduce((p, op) => p.then(op.run), Promise.resolve()), state: { loaded: true },
    // the Boat Operation scope (ops/71): the cell rule (bop2FleetStatus) says neither boat is a charter
    boatOperation: { ensure() {}, run: (orig, self, args) => orig.apply(self, args), day: () => ({ assigned: [{ boat_id: 'tri01', is_charter: false }, { boat_id: 'zeus', is_charter: false }] }) },
  };
  const ctx = {
    console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, encodeURIComponent, setTimeout: () => 0, clearTimeout() {},
    document: { getElementById: () => null }, alert() {}, TRIPS: {}, BOAT_CAP_OVR: {}, getBoat: (id) => ({ id, cap: 38 }), save() {}, laOps: O,
    // legacy fcCell as the browser has it: SB_BOOKINGS holds a window only, so its own baCharterBoatMapMemo misses the charter
    fcCell: (b) => ({ k: 'run', chr: false, pax: 27 }),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(DEP, ctx);
  await ctx.laOps.deployments.load();
  assert.equal(ctx.TRIPS[D].tri01.charterTakenBy, 'lg_b2c_LOV-1643970_1');
  assert.equal(ctx.TRIPS[D].tri01.type, 'normal', 'the cell itself stays a normal one (Boat Operation, Daily)');
  assert.equal(ctx.TRIPS[D].zeus.charterTakenBy, undefined);
  vm.runInContext(W5A, ctx);
  const tri = ctx.fcCell({ id: 'tri01' }, D, {}, {}), zeus = ctx.fcCell({ id: 'zeus' }, D, {}, {});
  assert.deepEqual([tri.chr, tri.ag], [true, 'B2C'], 'legacy: a charter booking that takes the boat makes it a ⚓ Charter cell, with its agent');
  assert.equal(zeus.chr, false);
});

function engineHarness(server) {
  const calls = [], store = {};
  const legacy = {
    list: () => ['legacy'], fixPending: () => ['pending'], openCalls: 0,
  };
  const O = {
    enabled: () => true, wrote() {}, fail(t, e) { calls.push(['FAIL', t, e && e.message]); },
    get: (p) => { calls.push(['GET', p]); return Promise.resolve(clone(server.list)); },
    post: (p, b) => { calls.push(['POST', p, b]); return Promise.resolve(p.endsWith('/apply') ? clone(server.apply) : { undone: 1 }); },
    fleetAssets: { refetchChain: () => { calls.push(['REFETCH']); return Promise.resolve(true); } },
  };
  const ctx = {
    console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp,
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    alert: (m) => calls.push(['ALERT', m]), confirm: () => true, laIsAdmin: () => true, laOps: O,
    FL_ENGINES: [{ id: 'e42', serial: '25005F-040036', boatId: 'b8', pos: 'Std' }],
    flRenderAsset: () => calls.push(['DRAW']),
    flEngFixPending: legacy.fixPending, flEngFixOpen: () => calls.push(['FIXOPEN']), flEngFixApply() {}, flEngFixUndo() {}, flEngFix33Apply() {}, flEngFix33Undo() {},
    flEngBaseList: legacy.list, flEngBaseApply() {}, flEngBaseUndo() {},
    flEngBaseOpen() { calls.push(['BASEOPEN', ctx.flEngBaseList().length]); ctx.flEngFixOpen(); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ENG, ctx);
  return { ctx, calls, store };
}

test('P2 · the base-hours chip lists what the server lists, in legacy\'s shape; apply and undo go to the server', async () => {
  const row = { engine_id: 'e42', serial: '25005F-040036', boat_id: 'b8', pos: 'Std', where: 'Tadeo · Std', now: 39, first: 4124, first_date: '2026-11-14', last: 4163, last_date: '2026-11-23' };
  const H = engineHarness({ list: { count: 1, engines: [row] }, apply: { applied: 1, engines: [row], undo: [{ engine_id: 'e42', base_hours: 0, last_service_hours: null }] } });
  assert.deepEqual(clone(H.ctx.flEngBaseList()), [], 'nothing until the server answers');
  await tick();
  assert.deepEqual(H.calls.filter((c) => c[0] === 'DRAW').length, 1, 'redrawn when the answer comes');
  const L = H.ctx.flEngBaseList();
  assert.equal(L.length, 1);
  assert.equal(L[0].e, H.ctx.FL_ENGINES[0], 'e is the FL_ENGINES record (the dialog prints e.serial and _efWhere(e))');
  assert.deepEqual([L[0].first, L[0].fd, L[0].last, L[0].now], [4124, '2026-11-14', 4163, 39]);
  assert.deepEqual(clone(H.ctx.flEngFixPending()), [], 'the serial repair stays off');

  H.ctx.flEngBaseOpen();
  assert.ok(!H.calls.some((c) => c[0] === 'ALERT'), 'the base dialog borrows the serial-fix frame without the refusal');
  assert.ok(H.calls.some((c) => c[0] === 'FIXOPEN'));
  H.ctx.flEngFixOpen();
  assert.ok(H.calls.some((c) => c[0] === 'ALERT'), 'the serial repair itself is still refused');

  await H.ctx.flEngBaseApply();
  assert.deepEqual(clone(H.calls.find((c) => c[0] === 'POST')), ['POST', '/v1/fleet/engine-base-hours/apply', {}]);
  assert.deepEqual(JSON.parse(H.store.la_engbase_undo).rows, [{ engine_id: 'e42', base_hours: 0, last_service_hours: null }], 'kept in this browser, as legacy');
  assert.ok(H.calls.some((c) => c[0] === 'REFETCH'), 'the engines are read again');

  await H.ctx.flEngBaseUndo();
  assert.deepEqual(clone(H.calls.filter((c) => c[0] === 'POST').at(-1)), ['POST', '/v1/fleet/engine-base-hours/undo', { rows: [{ engine_id: 'e42', base_hours: 0, last_service_hours: null }] }]);
  assert.equal(H.store.la_engbase_undo, undefined);
});

test('P2 · not an admin: apply says so and sends nothing (legacy _efCanEdit)', async () => {
  const H = engineHarness({ list: { count: 0, engines: [] }, apply: {} });
  H.ctx.laIsAdmin = () => false;
  await H.ctx.flEngBaseApply();
  assert.ok(H.calls.some((c) => c[0] === 'ALERT' && c[1] === 'เฉพาะ admin แก้ได้'));
  assert.ok(!H.calls.some((c) => c[0] === 'POST'));
});
