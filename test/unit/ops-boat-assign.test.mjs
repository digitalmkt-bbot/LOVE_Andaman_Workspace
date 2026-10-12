import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const DEPLOY = fs.readFileSync('allotment_v2/js/ops/20-ops-deployments.js', 'utf8');
const SOURCE = fs.readFileSync('allotment_v2/js/ops/37-ops-boat-assign.js', 'utf8');
const D = '2026-10-02';
const R = 'r1';
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const LEGACY = ['bookingV2AssignBoat', 'bookingV2BoatSplitApply', 'bookingV2BoatUnsplit', 'bookingV2BoatAssignSelected', 'baAutoAssign'];

function bookings() {
  return [
    { id: 'b1', opsId: 'lg_1', status: 'confirmed', leadPax: 'Ann', trips: [{ date: D, routeId: R, opsTripId: 't1', pax: { ad_fr: 3, chd_fr: 1 } }], ops: { boatId: 'boatA' }, history: [] },
    { id: 'b2', opsId: 'lg_2', status: 'confirmed', leadPax: 'Bob', trips: [{ date: D, routeId: R, opsTripId: 't2' }], ops: { boatId: 'boatA', boatSplits: [
      { boatId: 'boatA', pax: 2, ad: 2, chd: 0, inf: 0, foc: 0 }, { boatId: 'boatC', pax: 1, ad: 1, chd: 0, inf: 0, foc: 0 }] } },
    { id: 'b3', status: 'confirmed', leadPax: 'NoOps', trips: [{ date: D, routeId: R }], ops: {} },
  ];
}
const tripRes = (id, ops) => ({ body: { trip: { id, operations: { boat_id: null, boat_splits: [], boat_pulled: false, ...ops } }, warnings: [] } });

function runtime({ enabled = true, handlers = {}, bks = bookings(), prompt = () => null, confirm = () => true, mayRaise = true, extra = {} } = {}) {
  const requests = [], toasts = [], legacyCalls = [], alerts = [], timers = [];
  const renders = { n: 0 };
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Number, String, Math, Date,
    LA_LEGACY_UNAVAILABLE: enabled,
    sessionStorage: { getItem: () => (enabled ? 'tok' : null) },
    SB_BOOKINGS: bks,
    BOATS: [{ id: 'boatA', name: 'Boat A', cap: 30 }, { id: 'boatB', name: 'Boat B', cap: 30 }, { id: 'boatC', name: 'Boat C', cap: 30 }],
    TRIPS: {}, BOAT_CAP_OVR: {},
    _bkV2: { boatAssignMode: true },
    alert: (m) => alerts.push(m),
    prompt: (...a) => prompt(...a),
    confirm: (...a) => confirm(...a),
    laSaveToast: (o) => toasts.push(plain(o)),
    bookingV2Render: () => { renders.n++; },
    boatCapMayRaise: () => mayRaise,
    getBoat: (id) => ({ id, cap: 30 }),
    boatCapFor: () => 30,
    save: () => {},
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: (id) => { if (id) timers[id - 1] = null; },
    ...extra,
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body });
    const key = opts.method + ' ' + path.split('?')[0];
    const h = handlers[key];
    if (h === undefined) throw new Error('unexpected request ' + key);
    const r = typeof h === 'function' ? await h(body, path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  LEGACY.forEach((n) => { ctx[n] = (...args) => { legacyCalls.push([n, args]); return 'legacy:' + n; }; });
  const isFirst = (b, date) => { const ds = [...new Set((b.trips || []).map((t) => t.date))].sort(); return !date || ds.length <= 1 || date === ds[0]; };
  ctx.bkOpsRead = (b, date) => { if (!b) return {}; if (isFirst(b, date)) return b.ops || {}; const t = (b.trips || []).find((x) => x.date === date); return (t && t.ops) || {}; };
  ctx.bkOpsFor = (b, date) => { if (isFirst(b, date)) return (b.ops = b.ops || {}); const t = (b.trips || []).find((x) => x.date === date); return (t.ops = t.ops || {}); };
  ctx.bkOpsDate = (b, date) => date || ((b.trips || [])[0] || {}).date || '';
  ctx.bkSplitPax = (s) => ({ ad: s.ad, chd: s.chd, inf: s.inf, foc: s.foc });
  vm.createContext(ctx);
  // legacy functions the adapter wraps by snapshot (defined as the app does, so their mutation is real)
  vm.runInContext(`
    function pckMoveSave(bkId){ var b=SB_BOOKINGS.find(function(x){return x.id===bkId;}); bkOpsFor(b,'${D}').boatId=_pckTarget; b.history.push({t:'move'}); return true; }
    function bop2RpMoveBookings(d, fromId, toId){ var n=0; SB_BOOKINGS.forEach(function(b){ var o=bkOpsRead(b,d); var hit=false;
      if(Array.isArray(o.boatSplits)) o.boatSplits.forEach(function(s){ if(s.boatId===fromId){ s.boatId=toId; hit=true; } });
      if(o.boatId===fromId){ bkOpsFor(b,d).boatId=toId; hit=true; } if(hit) n++; }); return n; }
  `, ctx);
  vm.runInContext(CORE, ctx);
  vm.runInContext(DEPLOY, ctx);
  vm.runInContext(SOURCE, ctx);
  const settle = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 0)); };
  const fire = async () => { const fns = timers.splice(0).filter(Boolean); fns.forEach((f) => f()); await settle(); };
  return { ctx, requests, toasts, legacyCalls, alerts, renders, settle, fire, O: ctx.laOps, bks };
}
const byId = (rt, id) => rt.bks.find((b) => b.id === id);
const writes = (rt) => rt.requests.filter((r) => r.method !== 'GET').map((r) => [r.method, r.path, r.body]);

// ── one booking ─────────────────────────────────────────────────────────────

test('assigning a boat is a trip-ops PATCH and the answer sets the local boat', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/trip-ops/t1': tripRes('t1', { boat_id: 'boatB' }) } });
  rt.ctx.bookingV2AssignBoat('b1', 'boatB', D);
  assert.equal(byId(rt, 'b1').ops.boatId, 'boatA', 'nothing changes before the server answers');
  await rt.settle();
  assert.deepEqual(writes(rt), [['PATCH', '/operations/trip-ops/t1', { boat_id: 'boatB' }]]);
  assert.equal(byId(rt, 'b1').ops.boatId, 'boatB');
  assert.ok(rt.renders.n > 0);
});

test('clearing the boat sends null', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/trip-ops/t1': tripRes('t1', {}) } });
  rt.ctx.bookingV2AssignBoat('b1', '', D);
  await rt.settle();
  assert.deepEqual(rt.requests[0].body, { boat_id: null });
  assert.equal(byId(rt, 'b1').ops.boatId, null);
});

test('a refused boat leaves the booking as it was and shows the server\'s message', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/trip-ops/t1': { status: 409, body: { message: 'Boat boatB is chartered', code: 'boat_chartered' } } } });
  rt.ctx.bookingV2AssignBoat('b1', 'boatB', D);
  await rt.settle();
  assert.equal(byId(rt, 'b1').ops.boatId, 'boatA');
  assert.equal(rt.toasts.at(-1).kind, 'error');
  assert.match(rt.toasts.at(-1).title, /boat_chartered/);
});

test('boat_full asks for a reason and resends with raise_capacity', async () => {
  const rt = runtime({ prompt: () => 'Extra guests from the agent', handlers: {
    'PATCH /operations/trip-ops/t1': (b) => (b.raise_capacity ? tripRes('t1', { boat_id: 'boatB' }) : { status: 409, body: { message: 'Boat boatB would carry 33', code: 'boat_full' } }),
  } });
  rt.ctx.bookingV2AssignBoat('b1', 'boatB', D);
  await rt.settle();
  assert.deepEqual(writes(rt).map((w) => w[2]), [{ boat_id: 'boatB' }, { boat_id: 'boatB', raise_capacity: { reason: 'Extra guests from the agent' } }]);
  assert.equal(byId(rt, 'b1').ops.boatId, 'boatB');
});

test('boat_full without the unlock right does not ask', async () => {
  let asked = false;
  const rt = runtime({ mayRaise: false, prompt: () => { asked = true; return 'x'; }, handlers: {
    'PATCH /operations/trip-ops/t1': { status: 409, body: { message: 'full', code: 'boat_full' } } } });
  rt.ctx.bookingV2AssignBoat('b1', 'boatB', D);
  await rt.settle();
  assert.equal(asked, false);
  assert.equal(rt.requests.length, 1);
  assert.equal(byId(rt, 'b1').ops.boatId, 'boatA');
});

test('a booking the server does not hold yet is refused without a request', async () => {
  const rt = runtime();
  rt.ctx.bookingV2AssignBoat('b3', 'boatB', D);
  await rt.settle();
  assert.equal(rt.requests.length, 0);
  assert.match(rt.toasts.at(-1).title, /not_synced/);
});

test('replacing a split with one boat asks first', async () => {
  const rt = runtime({ confirm: () => false });
  rt.ctx.bookingV2AssignBoat('b2', 'boatB', D);
  await rt.settle();
  assert.equal(rt.requests.length, 0);
});

// ── splits ──────────────────────────────────────────────────────────────────

test('the split popup sends boat_splits per pax type and keeps the first boat as ops.boatId', async () => {
  let closed = false;
  const rt = runtime({ handlers: { 'PATCH /operations/trip-ops/t1': (b) => tripRes('t1', { boat_splits: b.boat_splits }) },
    extra: { bookingV2BoatSplitClose: () => { closed = true; },
      _bkBoatM: { bkId: 'b1', date: D, pool: { ad: 3, chd: 1, inf: 0, foc: 0 }, parts: [
        { boatId: 'boatA', ad: 2, chd: 1, inf: 0, foc: 0 }, { boatId: 'boatB', ad: 1, chd: 0, inf: 0, foc: 0 }, { boatId: '', ad: 0, chd: 0, inf: 0, foc: 0 }] } } });
  rt.ctx.bookingV2BoatSplitApply();
  await rt.settle();
  assert.deepEqual(rt.requests[0].body, { boat_splits: [
    { boat_id: 'boatA', ad: 2, chd: 1, inf: 0, foc: 0 }, { boat_id: 'boatB', ad: 1, chd: 0, inf: 0, foc: 0 }] });
  const o = byId(rt, 'b1').ops;
  assert.equal(o.boatId, 'boatA');
  assert.deepEqual(plain(o.boatSplits.map((s) => [s.boatId, s.pax])), [['boatA', 3], ['boatB', 1]]);
  assert.equal(closed, true);
});

test('a split of one part is a single boat', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/trip-ops/t1': tripRes('t1', { boat_id: 'boatC' }) },
    extra: { bookingV2BoatSplitClose: () => {}, _bkBoatM: { bkId: 'b1', date: D, pool: { ad: 3, chd: 1, inf: 0, foc: 0 },
      parts: [{ boatId: 'boatC', ad: 3, chd: 1, inf: 0, foc: 0 }] } } });
  rt.ctx.bookingV2BoatSplitApply();
  await rt.settle();
  assert.deepEqual(rt.requests[0].body, { boat_id: 'boatC' });
});

test('a split that names a boat twice is stopped in the popup', async () => {
  const rt = runtime({ extra: { _bkBoatM: { bkId: 'b1', date: D, pool: { ad: 2, chd: 0, inf: 0, foc: 0 },
    parts: [{ boatId: 'boatA', ad: 1, chd: 0, inf: 0, foc: 0 }, { boatId: 'boatA', ad: 1, chd: 0, inf: 0, foc: 0 }] } } });
  rt.ctx.bookingV2BoatSplitApply();
  await rt.settle();
  assert.equal(rt.requests.length, 0);
  assert.equal(rt.alerts.length, 1);
});

test('unsplit puts everyone on the first boat', async () => {
  const rt = runtime({ handlers: { 'PATCH /operations/trip-ops/t2': tripRes('t2', { boat_id: 'boatA' }) } });
  rt.ctx.bookingV2BoatUnsplit('b2', D);
  await rt.settle();
  assert.deepEqual(rt.requests[0].body, { boat_id: 'boatA' });
  assert.equal(byId(rt, 'b2').ops.boatSplits, undefined);
});

// ── ticked rows ─────────────────────────────────────────────────────────────

test('bulk assign sends one PATCH per row and lists the refused ones', async () => {
  const sel = { b1: true, b2: true };
  const rt = runtime({ handlers: {
    'PATCH /operations/trip-ops/t1': tripRes('t1', { boat_id: 'boatB' }),
    'PATCH /operations/trip-ops/t2': { status: 409, body: { message: 'full', code: 'boat_full' } },
  }, extra: { _bkV2BoatSel: sel } });
  rt.ctx.bookingV2BoatAssignSelected(D, R, 'boatB');
  await rt.settle();
  assert.equal(byId(rt, 'b1').ops.boatId, 'boatB');
  assert.equal(byId(rt, 'b2').ops.boatId, 'boatA');
  assert.deepEqual(plain(sel), { b2: true }, 'only the assigned row is unticked');
  assert.match(rt.alerts[0], /Skipped 1: Bob \(boat_full\)/);
});

// ── pier move (snapshot / restore) ──────────────────────────────────────────

test('pier move: the form runs, the server decides, a refusal puts the boat and history back', async () => {
  const ok = runtime({ handlers: { 'PATCH /operations/trip-ops/t1': tripRes('t1', { boat_id: 'boatC' }) }, extra: { _pckTarget: 'boatC' } });
  assert.equal(ok.ctx.pckMoveSave('b1'), true);
  await ok.settle();
  assert.deepEqual(ok.requests[0].body, { boat_id: 'boatC' });
  assert.equal(byId(ok, 'b1').ops.boatId, 'boatC');

  const no = runtime({ handlers: { 'PATCH /operations/trip-ops/t1': { status: 409, body: { message: 'not deployed', code: 'boat_not_deployed' } } }, extra: { _pckTarget: 'boatC' } });
  no.ctx.pckMoveSave('b1');
  await no.settle();
  assert.equal(byId(no, 'b1').ops.boatId, 'boatA');
  assert.equal(byId(no, 'b1').history.length, 0);
});

// ── Boat Operation replace (inside the deployment sync) ─────────────────────

function deployHandlers(over = {}) {
  return {
    'GET /operations/deployments': { body: { deployments: [{ service_date: D, boat_id: 'boatA', route_id: R, capacity: 30 }] } },
    'POST /operations/deployments': { status: 201, body: {} },
    'DELETE /operations/deployments/2026-10-02/boatA': { status: 204 },
    'DELETE /operations/deployments/2026-10-02/boatB': { status: 204 },
    'PATCH /operations/trip-ops/t1': tripRes('t1', { boat_id: 'boatB' }),
    'PATCH /operations/trip-ops/t2': (b) => tripRes('t2', b.boat_splits ? { boat_splits: b.boat_splits } : { boat_id: b.boat_id }),
    ...over,
  };
}
async function replaceAtoB(rt) {
  await rt.O.deployments.load();
  rt.requests.length = 0;
  rt.ctx.TRIPS[D].boatB = { ...rt.ctx.TRIPS[D].boatA };
  delete rt.ctx.TRIPS[D].boatA;
  rt.ctx.bop2RpMoveBookings(D, 'boatA', 'boatB');
  rt.ctx.save('operations');
  await rt.fire();
}

test('replace boat: deploy B, move the bookings, then remove A', async () => {
  const rt = runtime({ handlers: deployHandlers() });
  await replaceAtoB(rt);
  assert.deepEqual(writes(rt).map((w) => w[0] + ' ' + w[1]), [
    'POST /operations/deployments', 'PATCH /operations/trip-ops/t1', 'PATCH /operations/trip-ops/t2', 'DELETE /operations/deployments/2026-10-02/boatA']);
  assert.deepEqual(rt.requests.find((r) => r.path.endsWith('/t2')).body, { boat_splits: [
    { boat_id: 'boatB', ad: 2, chd: 0, inf: 0, foc: 0 }, { boat_id: 'boatC', ad: 1, chd: 0, inf: 0, foc: 0 }] });
  assert.equal(byId(rt, 'b1').ops.boatId, 'boatB');
});

test('replace boat: a refused move undoes what went through and puts the bookings back', async () => {
  const rt = runtime({ handlers: deployHandlers({ 'PATCH /operations/trip-ops/t2': { status: 409, body: { message: 'full', code: 'boat_full' } },
    'PATCH /operations/trip-ops/t1': (b) => tripRes('t1', { boat_id: b.boat_id }) }) });
  await replaceAtoB(rt);
  const w = writes(rt).map((x) => x[0] + ' ' + x[1] + (x[2] && x[2].boat_id ? ' ' + x[2].boat_id : ''));
  assert.deepEqual(w, ['POST /operations/deployments boatB', 'PATCH /operations/trip-ops/t1 boatB', 'PATCH /operations/trip-ops/t2',
    'PATCH /operations/trip-ops/t1 boatA', 'DELETE /operations/deployments/2026-10-02/boatB']);
  assert.equal(byId(rt, 'b1').ops.boatId, 'boatA');
  assert.equal(byId(rt, 'b2').ops.boatSplits[0].boatId, 'boatA');
  assert.ok(rt.ctx.TRIPS[D].boatA, 'Boat Operation is rolled back too');
});

// ── the rest ────────────────────────────────────────────────────────────────

test('auto-assign is refused in ops mode', async () => {
  const rt = runtime();
  rt.ctx.baAutoAssign(D, R);
  assert.equal(rt.requests.length, 0);
  assert.equal(rt.toasts.at(-1).status, 'NOT YET');
});

test('legacy mode delegates and sends nothing', async () => {
  const rt = runtime({ enabled: false });
  rt.ctx.bookingV2AssignBoat('b1', 'boatB', D);
  rt.ctx.baAutoAssign(D, R);
  await rt.settle();
  assert.equal(rt.requests.length, 0);
  assert.deepEqual(rt.legacyCalls.map((c) => c[0]), ['bookingV2AssignBoat', 'baAutoAssign']);
});
