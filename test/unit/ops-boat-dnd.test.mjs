import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// §opsBopDnd: Boat Operation's drag board Save goes to POST /operations/deployments/plan (ops/20-ops-deployments.js).
const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const DEPLOY = fs.readFileSync('allotment_v2/js/ops/20-ops-deployments.js', 'utf8');
const D = '2099-03-02';
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

function runtime({ handlers = {}, confirm = () => true } = {}) {
  const requests = [], alerts = [], toasts = [], legacy = [], refreshed = [];
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Number, String, Math, Date,
    LA_LEGACY_UNAVAILABLE: true,
    sessionStorage: { getItem: () => 'tok' },
    SB_BOOKINGS: [], TRIPS: {}, BOAT_CAP_OVR: {},
    BOATS: [{ id: 'A', name: 'Boat A', cap: 30 }, { id: 'B', name: 'Boat B', cap: 30 }, { id: 'C', name: 'Boat C', cap: 30 }],
    getBoat: (id) => ({ id, cap: 30 }),
    alert: (m) => alerts.push(String(m)), confirm: (...a) => confirm(...a),
    flShowToast: (m) => toasts.push(m),
    save: () => {}, renderOp: () => {},
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} },
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, remove() {}, addEventListener() {} }) },
    setTimeout: (fn) => { fn(); return 1; }, clearTimeout: () => {},
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body });
    const h = handlers[opts.method + ' ' + path.split('?')[0]];
    if (h === undefined) throw new Error('unexpected request ' + opts.method + ' ' + path);
    const r = typeof h === 'function' ? await h(body, path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  vm.createContext(ctx);
  // legacy's board, as 04-data-core.js has it: a drop that passes applies to the draft and adds a log line
  vm.runInContext(`
    var _bopD = { start:'', work:{}, base:{}, map:{}, log:[] };
    var _bopDPaxMemo = { x: 1 };
    var _bopDDrag = null;
    function bopDTgt(el){ return el; }
    function bopDDrop(ev){ var t = ev.target; if(t.refuse) return; _bopDDrag = null; _bopD.log.push('drop ' + t.kind); }
    function bopDReset(silent){ _bopD.work = {}; _bopD.base = {}; _bopD.map = {}; _bopD.log = []; }
    function bopDSave(){ __legacySave(); }
  `, ctx);
  ctx.__legacySave = () => legacy.push('bopDSave');
  vm.runInContext(CORE, ctx);
  vm.runInContext(DEPLOY, ctx);
  ctx.laOps.bookings = { refreshDay: (d) => { refreshed.push(d); return Promise.resolve(); } };
  const settle = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r)); };
  const drag = (bid, target) => { ctx._bopDDrag = { d: D, bid }; ctx.bopDDrop({ target: { d: D, ...target } }); };
  return { ctx, requests, alerts, toasts, legacy, refreshed, settle, drag, O: ctx.laOps };
}
const rows = (list) => ({ body: { deployments: list.map(([boat_id, route_id]) => ({ boat_id, route_id, service_date: D, capacity: 30, trip_type: 'normal' })) } });

test('each accepted drop is recorded; Save sends them with the board the server confirmed, then takes the server\'s deployments', async () => {
  let plan = null;
  const handlers = {
    'GET /operations/deployments': rows([['A', 'r1'], ['B', 'r2']]),
    'POST /operations/deployments/plan': (body) => { plan = body; return { body: { dry_run: false, days: [{ service_date: D, log: ['x'], bookings_moved: 3 }], over: [], kept: [{ ref: 'BK-1', service_date: D }], warnings: [] } }; },
  };
  const rt = runtime({ handlers });
  await rt.O.deployments.load(); await rt.settle();
  rt.drag('A', { kind: 'chip', bid: 'B' });
  rt.drag('C', { kind: 'route', route: 'r3' });
  rt.drag('B', { kind: 'free', refuse: true });            // legacy refused it: nothing recorded
  assert.equal(rt.ctx._bopD.log.length, 2);
  handlers['GET /operations/deployments'] = rows([['A', 'r2'], ['B', 'r1'], ['C', 'r3']]);
  rt.ctx.bopDSave(); await rt.settle();
  assert.deepEqual(plain(plan), {
    moves: [{ service_date: D, boat_id: 'A', to: { boat_id: 'B' } }, { service_date: D, boat_id: 'C', to: { route_id: 'r3' } }],
    seen: { [D]: [{ boat_id: 'A', route_id: 'r1' }, { boat_id: 'B', route_id: 'r2' }] },
  });
  assert.deepEqual(rt.legacy, [], 'legacy\'s browser-only save does not run');
  assert.deepEqual(plain(rt.ctx.TRIPS[D]).A.route, 'r2');
  assert.deepEqual(plain(rt.ctx.TRIPS[D]).C.route, 'r3');
  assert.equal(rt.ctx._bopD.log.length, 0, 'the draft is cleared');
  assert.deepEqual(rt.refreshed, [D], 'that day\'s bookings are read again');
  assert.deepEqual(rt.toasts, ['บันทึกการจัดเรือ 2 รายการ · ย้ายบุคกิ้ง 3 ใบ']);
  assert.match(rt.alerts[0], /ไม่ได้ย้าย 1 บุคกิ้งที่สัญญาเรือไว้กับลูกค้า: BK-1/);
  assert.deepEqual(plain(rt.O.dnd.moves()), []);
});

test('over the seats: the server\'s question, then the same plan with capacity_anyway', async () => {
  const sent = [];
  const handlers = {
    'GET /operations/deployments': rows([['A', 'r1']]),
    'POST /operations/deployments/plan': (body) => {
      sent.push(body);
      if (!body.capacity_anyway) return { status: 409, body: { code: 'over_capacity', message: '⚠ Mon 2 Boat C 12/8 เกินที่นั่ง · send capacity_anyway: true to save anyway' } };
      return { body: { days: [], over: [], kept: [], warnings: [] } };
    },
  };
  const asked = [];
  const rt = runtime({ handlers, confirm: (q) => { asked.push(q); return true; } });
  await rt.O.deployments.load(); await rt.settle();
  rt.drag('C', { kind: 'chip', bid: 'A' });
  rt.ctx.bopDSave(); await rt.settle();
  assert.equal(sent.length, 2);
  assert.equal(sent[1].capacity_anyway, true);
  assert.match(asked[1], /12\/8 เกินที่นั่ง\n\nยังจะจัดแบบนี้ไหม\?/);
});

test('a board someone else saved meanwhile: legacy\'s alert, nothing taken', async () => {
  const handlers = {
    'GET /operations/deployments': rows([['A', 'r1']]),
    'POST /operations/deployments/plan': { status: 409, body: { code: 'plan_stale', message: 'มีคนแก้การจัดเรือของ Mon 2 ไปแล้วระหว่างที่คุณลากอยู่' } },
  };
  const rt = runtime({ handlers });
  await rt.O.deployments.load(); await rt.settle();
  rt.drag('A', { kind: 'free' });
  rt.ctx.bopDSave(); await rt.settle();
  assert.match(rt.alerts.at(-1), /มีคนแก้การจัดเรือ/);
  assert.equal(plain(rt.ctx.TRIPS[D]).A.route, 'r1');
  assert.equal(rt.ctx._bopD.log.length, 1, 'the draft stays, as legacy leaves it for "ย้อนกลับ"');
});
