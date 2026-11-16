import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Sync 11-13 gaps, adapter side (lk-inbox 260f3451..2eb83c8e).
// 1. §memoUseNow: the receive dialog's "เบิกใช้กับงาน MJ-xxx ทันที" tick goes as issue_to_job (ops/25).
// 2. §memoUseNow2: flMaintMemoPending / flMaintWithdrawFromMemos are the server's memo-pending / memo-withdraw (ops/99-memo-withdraw).
// 3. §pkThNat: a Thai ticket seat is not "from the lead" (ops/32 convPerson); the nationality itself is the server's.
// 4. §altMan: server only.
// 5. §boatHist: bhLoad reads GET /v1/reports/trip-pl/boat/{id}; bhCompute sees that read as TRIPS / pxTrip (ops/99-boat-history).
// 6. §engFix / §engBase: one-off legacy repair, not offered in ops mode (ops/99-engine-fix).
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 6; i++) await tick(); };

function core(answer) {
  const calls = [], writes = [];
  const O = {
    enabled: () => true, today: () => '2026-11-13', wrote: (k) => { writes.push(k); if (O._onWrite) O._onWrite(k); }, fail: (t, e) => { calls.push(['fail', t, e && e.message]); },
    get: (p, q) => { calls.push(['GET', p, q]); return Promise.resolve(answer ? answer('GET', p, q) : {}); },
    post: (p, b) => { calls.push(['POST', p, b]); return Promise.resolve(answer ? answer('POST', p, b) : {}); },
    queue: (fn) => Promise.resolve().then(fn),
    onWrite: (fn) => { O._onWrite = fn; },
  };
  return { O, calls, writes };
}

test('§memoUseNow: a job-linked memo received with the tick on sends issue_to_job; untick or no job sends nothing extra', async () => {
  const src = fs.readFileSync('allotment_v2/js/ops/25-ops-fleet-stock.js', 'utf8');
  const start = src.indexOf("  wrap('flSaveReceive', function(){"), end = src.indexOf("  wrap('flSaveTransfer'");
  assert.ok(start > 0 && end > start);
  const run = async (mo, checked) => {
    const { O, calls } = core((m, p) => (m === 'POST' ? { id: mo.id, issued: mo.maintId && checked ? { job_id: 'j1', job_no: 'MJ-9', lines: 1, failed: 0 } : undefined } : {}));
    const toasts = [];
    let jobsLoaded = 0;
    O.fleetJobs = { load: () => { jobsLoaded++; return Promise.resolve(); } };
    const els = { 'receive-date': { value: '2026-11-13' }, 'receive-note': { value: '' }, 'receive-location': { value: 'คลัง Tub Lamu' }, 'recv-qty-0': { value: '2' }, 'recv-use-job': { checked } };
    const window = { closeModal() {}, flShowToast: (t) => toasts.push(t) };
    const ctx = {
      window, O, _receiveMemoId: mo.id, document: { getElementById: (id) => els[id] || null },
      listMemos: () => [mo], normalizeWarehouse: () => 'tublamu', nullable: (v) => v || null, enc: encodeURIComponent,
      upsertMemo() {}, refetchStockAndMemos: () => Promise.resolve(true), redrawStock() {}, upsertInventory() {}, toStockReceiveBody() { return {}; },
      wrap: (name, fn) => { window[name] = function(){ return fn.apply(this, [null].concat([].slice.call(arguments))); }; },
      Math, parseFloat, Promise,
    };
    vm.runInNewContext(src.slice(start, end), ctx);
    await window.flSaveReceive();
    await flush();
    return { post: calls.find((c) => c[0] === 'POST'), toasts, jobsLoaded };
  };
  const mo = { id: 'mo1', no: 'MO-1', maintId: 'j1', items: [{ id: 'l1', name: 'Pump', qty: 2 }] };
  let r = await run(mo, true);
  assert.equal(r.post[1], '/v1/fleet/memos/mo1/receive');
  assert.equal(r.post[2].issue_to_job, true);
  assert.deepEqual(JSON.parse(JSON.stringify(r.post[2].lines)), [{ line_id: 'l1', qty: 2 }]);
  assert.equal(r.jobsLoaded, 1, 'the job is read again');
  assert.match(r.toasts[0], /เบิกลงงาน MJ-9 แล้ว 1 รายการ/);
  r = await run(mo, false);
  assert.equal(r.post[2].issue_to_job, undefined, 'unticked');
  r = await run({ ...mo, maintId: '' }, true);
  assert.equal(r.post[2].issue_to_job, undefined, 'a memo with no job');
});

function loadMemoWithdraw(answer) {
  const src = fs.readFileSync('allotment_v2/js/ops/99-ops-memo-withdraw.js', 'utf8');
  const { O, calls, writes } = core(answer);
  O.fleetStock = { refetch: () => Promise.resolve(true) };
  O.fleetJobs = { load: () => Promise.resolve() };
  const toasts = [], confirms = [], hosts = {};
  let legacyPending = 0, legacyWithdraw = 0;
  const FL_MAINT = [{ id: 'j1', no: 'MJ-7', parts: [] }];
  const window = {
    laOps: O,
    flMaintMemoPending: () => { legacyPending++; return [{ legacy: true }]; },
    flMaintWithdrawFromMemos: () => { legacyWithdraw++; },
    flMaintMemoBtnHtml: (m) => 'BTN:' + window.flMaintMemoPending(m).filter((x) => x.qty > 0).length,
    flMaintRefreshParts() {}, flShowToast: (t) => toasts.push(t),
  };
  const ctx = { window, FL_MAINT, document: { getElementById: (id) => (hosts[id] || (hosts[id] = { innerHTML: '' })) },
    confirm: (t) => { confirms.push(t); return true; }, console, JSON, Date, Promise, encodeURIComponent };
  vm.runInNewContext(src, ctx);
  return { window, O, calls, writes, toasts, confirms, hosts, legacy: () => [legacyPending, legacyWithdraw] };
}

test('§memoUseNow2: the pending list is the server\'s (legacy shape for legacy\'s button), and the withdraw is one POST', async () => {
  const lines = [{ memo_id: 'mo1', memo_no: 'MO-1', line_id: 'l1', item_id: 'i1', item_name: 'Filter', unit: 'ลูก', warehouse: 'tublamu', want: 3, qty: 2 }];
  let left = lines;
  const a = loadMemoWithdraw((m, p) => {
    if (m === 'GET' && p === '/v1/fleet/jobs/j1/memo-pending') return { lines: left };
    if (m === 'POST' && p === '/v1/fleet/jobs/j1/memo-withdraw') { left = []; return { issued: 1, failed: 0 }; }
    return {};
  });
  assert.deepEqual(JSON.parse(JSON.stringify(a.window.flMaintMemoPending({ id: 'j1' }))), [], 'nothing until the server answers');
  await flush();
  const got = a.window.flMaintMemoPending({ id: 'j1' });
  assert.deepEqual(JSON.parse(JSON.stringify(got)), [{ mo: { id: 'mo1', no: 'MO-1' }, it: { id: 'l1' }, inv: { id: 'i1', name: 'Filter', unit: 'ลูก' }, loc: 'คลัง Tub Lamu', want: 3, qty: 2 }]);
  assert.equal(a.hosts['maint-memo-wd-j1'].innerHTML, 'BTN:1', 'the button drawn again when the answer landed');
  assert.equal(a.calls.filter((c) => c[0] === 'GET').length, 1, 'one read, not one per redraw');
  await a.window.flMaintWithdrawFromMemos('j1');
  await flush();
  assert.match(a.confirms[0], /เบิกของจาก Memo ลงงาน MJ-7 ทั้งหมด 1 รายการ/);
  assert.match(a.confirms[0], /Filter × 2 ลูก · คลัง Tub Lamu \(ขาด 1 · ของในคลังไม่พอ\)/);
  assert.ok(a.calls.some((c) => c[0] === 'POST' && c[1] === '/v1/fleet/jobs/j1/memo-withdraw'));
  assert.ok(a.writes.includes('fleet-job-part-add'));
  assert.equal(a.toasts.at(-1), 'เบิกลงงาน MJ-7 แล้ว 1 รายการ');
  assert.deepEqual(a.legacy(), [0, 0], 'legacy\'s browser-only versions never ran');
});

test('§pkThNat: a seat of a Thai ticket type is not marked as borrowed from the lead', () => {
  const src = fs.readFileSync('allotment_v2/js/ops/32-ops-park.js', 'utf8');
  const start = src.indexOf('  function convPerson(p){'), end = src.indexOf('  function routeColor(rid){');
  assert.ok(start > 0 && end > start);
  const ctx = { nat3: (n) => n + '3', natName: (n) => 'N:' + n, String };
  vm.runInNewContext(src.slice(start, end) + '\nthis.convPerson = convPerson;', ctx);
  const p = (cat, nationality) => ctx.convPerson({ ph: true, cat, nationality });
  assert.deepEqual([p('adTH', 'TH').natFromLead, p('chTH', 'TH').natFromLead, p('adFR', 'PT').natFromLead], [false, false, true]);
  assert.equal(p('adTH', 'TH').nat2, 'TH', 'the server\'s nationality');
  assert.equal(ctx.convPerson({ ph: false, cat: 'adFR', nationality: 'DE' }).natFromLead, false);
});

test('§boatHist: bhLoad reads the boat\'s range first; bhCompute sees it as TRIPS / pxTrip and both go back after', async () => {
  const src = fs.readFileSync('allotment_v2/js/ops/99-ops-boat-history.js', 'utf8');
  const trips = [
    { date: '2026-10-02', boat_id: 'B1', route_id: 'r1', no_sail: false, revenue: 1000, cost: 400, profit: 600, pax: { total: 10 }, rows: [] },
    { date: '2026-10-05', boat_id: 'B1', route_id: 'r1', rescue: { for: 'B9' }, no_sail: false, revenue: 0, cost: 200, profit: -200, pax: { total: 0 }, rows: [] },
  ];
  const { O, calls } = core((m, p, q) => (p === '/v1/reports/trip-pl/boat/B1' ? { boat_id: 'B1', from: q.from, to: q.to, trips } : {}));
  O.fleetViews = { read: (p, q) => { calls.push(['READ', p, q]); return null; } };
  const ctx = {
    O, console, JSON, Object, Promise, encodeURIComponent, setTimeout,
    _bh: { id: 'B1' }, TRIPS: { '2026-11-12': { B1: { route: 'r1' } } },
    getBoat: () => ({ name: 'Artemis' }),
    document: { getElementById: (id) => (id === 'bh-ov' ? (ctx._ov || (ctx._ov = { innerHTML: '' })) : null) },
  };
  ctx.window = ctx;
  ctx.laOps = O;
  ctx.__laOpsCostingCompat = { legacyTrip: (t) => ({ legacy: true, rev: t.revenue, cost: t.cost, rescue: t.rescue || null, date: t.date }) };
  ctx.pxTrip = () => ({ fromCache: true });
  ctx.bhRange = () => ['2025-10-01', '2026-11-13'];
  let loads = 0;
  ctx.bhLoad = function(){ loads++; return ctx.bhCompute(ctx._bh.id, '2025-10-01', '2026-11-13'); };
  ctx.bhCompute = function(id){ return Object.keys(TRIPS_OF(ctx)).sort().map((d) => [d, ctx.TRIPS[d][id].type, ctx.pxTrip(d, id).rev]); };
  const TRIPS_OF = (c) => c.TRIPS;
  vm.runInNewContext(src, ctx);
  ctx.bhLoad();
  assert.match(ctx._ov.innerHTML, /กำลังคำนวณ/, 'legacy\'s loading line while the range is read');
  await flush();
  assert.ok(calls.some((c) => c[0] === 'GET' && c[1] === '/v1/reports/trip-pl/boat/B1' && c[2].from === '2025-10-01' && c[2].to === '2026-11-13'));
  assert.ok(calls.some((c) => c[0] === 'READ' && c[2].period === 'all'), 'the all-period cost report is asked for too');
  assert.equal(loads, 1, 'legacy\'s bhLoad ran once the range was in');
  const out = ctx.bhCompute('B1', '2025-10-01', '2026-11-13');
  assert.deepEqual(JSON.parse(JSON.stringify(out)), [['2026-10-02', 'normal', 1000], ['2026-10-05', 'rescue', 0]]);
  assert.deepEqual(Object.keys(ctx.TRIPS), ['2026-11-12'], 'TRIPS back as it was');
  assert.equal(ctx.pxTrip('2026-10-02', 'B1').fromCache, true, 'pxTrip back as it was');
});

test('§engFix / §engBase: no chips and no changes in ops mode; legacy\'s own when ops is off', () => {
  const src = fs.readFileSync('allotment_v2/js/ops/99-ops-engine-fix.js', 'utf8');
  let enabled = true, applied = 0;
  const alerts = [];
  const window = {
    laOps: { enabled: () => enabled },
    flEngFixPending: () => [{ k: 'zeus' }], flEngBaseList: () => [{ id: 'e1' }],
    flEngFixApply: () => { applied++; }, flEngBaseApply: () => { applied++; }, flEngFixOpen: () => { applied++; },
  };
  vm.runInNewContext(src, { window, alert: (t) => alerts.push(t) });
  assert.deepEqual([window.flEngFixPending().length, window.flEngBaseList().length], [0, 0]);
  window.flEngFixApply('zeus'); window.flEngBaseApply(); window.flEngFixOpen();
  assert.equal(applied, 0);
  assert.equal(alerts.length, 3);
  assert.match(alerts[0], /legacy app/);
  enabled = false;
  assert.equal(window.flEngFixPending().length, 1);
  window.flEngFixApply('zeus');
  assert.equal(applied, 1);
});
