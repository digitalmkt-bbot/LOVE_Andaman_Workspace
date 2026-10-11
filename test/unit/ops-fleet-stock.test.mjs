import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/25-ops-fleet-stock.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false, today: () => '2026-10-12', onChange: () => {} } };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, Math });
  return window.__laOpsFleetStockCompat;
}

test('stock, consumable, and memo mappers preserve server movement-derived quantities and exclude local stocks/history from PATCH', () => {
  const c = compat();
  assert.equal(c.normalizeWarehouse('คลัง Tub Lamu'), 'tublamu');
  assert.equal(c.normalizeWarehouse('คลัง Visit Panwa'), 'panwa');
  assert.equal(c.normalizeWarehouse('คลัง Ranong'), 'ranong');

  const item = c.fromServerStockItem({
    id: 'inv_1',
    name: 'Oil Filter',
    part_no: 'OF-100',
    category: 'engine',
    supplier: 'Honda',
    unit: 'ชิ้น',
    min_qty: 5,
    cost: 450,
    total_qty: 12,
    primary_warehouse: 'tublamu',
    primary_warehouse_name: 'คลัง Tub Lamu',
    below_min: false,
    stocks: [{ warehouse: 'tublamu', warehouse_name: 'คลัง Tub Lamu', qty: 10 }, { warehouse: 'panwa', warehouse_name: 'คลัง Visit Panwa', qty: 2 }],
    movements: [{ id: 'mv_1', seq: 1, date: '2026-10-01', type: 'receive', warehouse: 'tublamu', delta: 10, note: 'Initial' }]
  });
  assert.equal(item.totalQty, 12);
  assert.equal(item.primaryLocation, 'คลัง Tub Lamu');
  assert.equal(item.stocks.length, 2);
  assert.equal(item.history.length, 1);

  const patch = c.toStockPatchBody({
    name: 'Oil Filter Updated',
    partNo: 'OF-100',
    cost: 480,
    stocks: [{ location: 'tublamu', qty: 999 }],
    qty: 999,
    totalQty: 999,
    history: [{ type: 'fake' }]
  });
  assert.equal('stocks' in patch, false, 'PATCH never submits stocks array');
  assert.equal('qty' in patch, false, 'PATCH never submits qty');
  assert.equal('total_qty' in patch, false, 'PATCH never submits total_qty');
  assert.equal('history' in patch, false, 'PATCH never submits movement history');
  assert.equal('movements' in patch, false, 'PATCH never submits movements');

  assert.deepEqual(JSON.parse(JSON.stringify(c.toStockReceiveBody('คลัง Tub Lamu', 5, '2026-10-12', 'Restock'))), {
    warehouse: 'tublamu',
    qty: 5,
    date: '2026-10-12',
    note: 'Restock'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toStockTransferBody('คลัง Tub Lamu', 'คลัง Visit Panwa', 3, '2026-10-12', 'Move'))), {
    from: 'tublamu',
    to: 'panwa',
    qty: 3,
    date: '2026-10-12',
    note: 'Move'
  });
});

function createRuntime(){
  const calls = [];
  let nextResolver = null;
  let serverItems = [{
    id: 'inv_1', name: 'Filter', part_no: 'F-1', category: 'engine', unit: 'ชิ้น', min_qty: 2, cost: 300,
    total_qty: 10, primary_warehouse: 'tublamu', stocks: [{ warehouse: 'tublamu', warehouse_name: 'คลัง Tub Lamu', qty: 10 }]
  }];
  let serverMemos = [{
    id: 'mo_1', no: 'MO-001', title: 'Buy filters', boat_id: 'b1', memo_type: 'parts', scope: 'vessel',
    memo_date: '2026-10-10', status: 'pending_approval', current_step: 1, amount: 3000,
    lines: [{ id: 'ml_1', name: 'Filter', qty: 10, price: 300, discount_pct: 0, category: 'parts', unit: 'ชิ้น', item_id: 'inv_1', received_qty: 0 }]
  }];
  let serverConsumables = [];

  const FL_INVENTORY = [];
  const FL_MEMOS = [];
  const FL_CONSUMABLE_LOGS = [];
  const window = {};
  const O = {
    enabled: () => true,
    today: () => '2026-10-12',
    clone: v => v == null ? v : JSON.parse(JSON.stringify(v)),
    get: async (path) => {
      calls.push({ method: 'GET', path });
      if(path === '/v1/fleet/stock-items') return { items: JSON.parse(JSON.stringify(serverItems)) };
      if(path === '/v1/fleet/memos') return { memos: JSON.parse(JSON.stringify(serverMemos)) };
      if(path === '/v1/fleet/consumables') return { consumables: JSON.parse(JSON.stringify(serverConsumables)) };
      if(path === '/v1/fleet/warehouses') return { warehouses: [] };
      if(path === '/v1/fleet/suppliers') return { suppliers: [] };
      return {};
    },
    post: (path, body) => new Promise((resolve, reject) => {
      calls.push({ method: 'POST', path, body });
      nextResolver = { resolve, reject };
    }),
    patch: (path, body) => new Promise((resolve, reject) => {
      calls.push({ method: 'PATCH', path, body });
      nextResolver = { resolve, reject };
    }),
    del: (path) => new Promise((resolve, reject) => {
      calls.push({ method: 'DELETE', path });
      nextResolver = { resolve, reject };
    }),
    queue: fn => Promise.resolve().then(fn),
    fail: (title, err) => calls.push({ fail: title, message: err && err.message }),
    wrote: kind => calls.push({ wrote: kind }),
    onChange: () => {}
  };
  window.laOps = O;
  window.flSaveAddStock = () => 'legacy';
  window.flSaveInvEdit = () => 'legacy';
  window.flSaveReceive = () => 'legacy';
  window.flSaveTransfer = () => 'legacy';
  window.flMaintAddPart = () => 'legacy';
  window.flMaintRemovePart = () => 'legacy';
  window.flConsumeSubmit = () => 'legacy';
  window.flConsumeDelete = () => 'legacy';
  window.flSaveApprove = () => 'legacy';
  window.flAdvanceMemo = () => 'legacy';
  window.memoShortClose = () => 'legacy';
  window.flCancelMemo = () => 'legacy';

  const elements = {
    'receive-item-sel': { value: 'inv_1' },
    'receive-qty': { value: '4' },
    'receive-location': { value: 'คลัง Tub Lamu' },
    'receive-date': { value: '2026-10-12' },
    'receive-note': { value: 'New batch' },
    'approve-by': { value: 'Khun Boss' },
    'approve-date': { value: '2026-10-12' },
    'approve-note': { value: 'Approved' }
  };

  const context = {
    window,
    document: { getElementById: id => elements[id] || null },
    console,
    Number,
    String,
    Object,
    Array,
    JSON,
    Date,
    Promise,
    encodeURIComponent,
    parseFloat,
    parseInt,
    Math,
    confirm: () => true,
    prompt: () => 'Cancelled order',
    alert: msg => calls.push({ alert: msg }),
    FL_INVENTORY,
    FL_MEMOS,
    FL_CONSUMABLE_LOGS,
    _receiveMemoId: null,
    _receiveItemId: 'inv_1',
    _approveMemoId: 'mo_1'
  };
  vm.runInNewContext(SOURCE, context);
  return {
    window,
    context,
    calls,
    FL_INVENTORY,
    FL_MEMOS,
    FL_CONSUMABLE_LOGS,
    resolveNext: val => nextResolver.resolve(val),
    rejectNext: err => nextResolver.reject(err),
    tick: () => new Promise(r => setImmediate(r))
  };
}

test('stock receive and memo approve/advance commands are server-first and do not mutate on failure', async () => {
  const rt = createRuntime();
  await rt.tick();
  await rt.tick();
  assert.equal(rt.FL_INVENTORY[0].totalQty, 10);

  // Receive stock: no local mutation before server response
  const recvP = rt.window.flSaveReceive();
  await rt.tick();
  assert.equal(rt.FL_INVENTORY[0].totalQty, 10, 'quantity unchanged before response');
  const recvCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/stock-items/inv_1/receive');
  assert.ok(recvCall);
  assert.deepEqual(JSON.parse(JSON.stringify(recvCall.body)), {
    warehouse: 'tublamu',
    qty: 4,
    date: '2026-10-12',
    note: 'New batch'
  });

  // Reject receive -> quantity stays 10
  rt.rejectNext(new Error('failed'));
  await recvP;
  assert.equal(rt.FL_INVENTORY[0].totalQty, 10);

  // Approve memo -> POST /v1/fleet/memos/mo_1/approve
  const appP = rt.window.flSaveApprove();
  await rt.tick();
  const appCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/fleet/memos/mo_1/approve');
  assert.ok(appCall);
  assert.deepEqual(JSON.parse(JSON.stringify(appCall.body)), {
    approved_by: 'Khun Boss',
    approved_date: '2026-10-12',
    note: 'Approved'
  });
  rt.resolveNext({
    id: 'mo_1', no: 'MO-001', title: 'Buy filters', memo_type: 'parts', status: 'approved', current_step: 2,
    approved_by: 'Khun Boss', approved_date: '2026-10-12', lines: []
  });
  await appP;
  assert.equal(rt.FL_MEMOS[0].status, 'approved');
});

test('legacy mode delegates to original stock/memo/consumable functions without API calls', () => {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => false,
      today: () => '2026-10-12',
      get: () => { calls.push('api'); return Promise.resolve({}); },
      post: () => { calls.push('api'); return Promise.resolve({}); },
      onChange: () => {}
    },
    flSaveReceive: () => { calls.push('receive'); return 'legacy'; },
    flConsumeSubmit: () => { calls.push('consume'); return 'legacy'; }
  };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, Math });
  assert.equal(window.flSaveReceive(), 'legacy');
  assert.equal(window.flConsumeSubmit(), 'legacy');
  assert.equal(calls.includes('api'), false);
});
