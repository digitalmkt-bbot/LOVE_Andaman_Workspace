import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/36-ops-day-actions.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false } };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseInt, Math });
  return window.__laOpsDayActionsCompat;
}

test('insurance, meals, check-in, and tour-sale request/response mappers match verified contracts and preserve append-only events', () => {
  const c = compat();
  assert.deepEqual(JSON.parse(JSON.stringify(c.toInsuranceBody('lead', { age: '34', reviewed: true }))), {
    passengers: [{ passenger: 'lead', age: 34, reviewed: true }]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toInsuranceBody('0', { age: '', reviewed: false }))), {
    passengers: [{ passenger: 0, age: null, reviewed: false }]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toMealsBody({ veg: 2, vegan: 1, halal: 0, allergies: 'Peanuts' }))), {
    veg: 2, vegan: 1, halal: 0, allergies: 'Peanuts'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.parseCheckinKindAndSlot('pier:2'))), { kind: 'pier', slot: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(c.parseCheckinKindAndSlot('van'))), { kind: 'van', slot: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(c.parseCheckinKindAndSlot('van#2'))), { kind: 'van', slot: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(c.parseCheckinKindAndSlot('pier#1'))), { kind: 'pier', slot: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(c.parseCheckinKindAndSlot('pier#0'))), { kind: 'pier', slot: 0 });

  const ckBody = c.toCheckinBody(
    { expected: 4, actualPax: 3, at: '2026-10-12T08:00:00Z', by: 'PierA', events: [] },
    [{ type: 'no_show', pax: 1, reasonCode: 'late', note: 'Missed van', at: '07:45', by: 'Van1', ts: '2026-10-12T00:45:00Z', tries: [] }]
  );
  assert.equal(ckBody.expected, 4);
  assert.equal(ckBody.actual_pax, 3);
  assert.equal(ckBody.events.length, 1, 'append-only previous events are preserved when caller sends fewer');
  assert.equal(ckBody.events[0].type, 'no_show');
  assert.equal(ckBody.events[0].reason_code, 'late');

  const sale = c.fromServerTourSale({
    id: 'ex_1',
    booking_id: 'bk_srv_1',
    trip_date: '2026-10-12',
    service: 'Snorkel gear',
    qty: 2,
    unit_price: 150,
    total: 300,
    to_company: 200,
    commission: 100,
    seller: 'Guide A',
    method: 'cash',
    fee_pct: 0,
    fee: 0,
    customer_paid: 300,
    settle: 'done',
    collected_at: '2026-10-12T09:00:00Z',
    sold_at: '2026-10-12T09:00:00Z',
    slips: []
  }, 'bk_client_1');
  assert.equal(sale.bookingId, 'bk_client_1');
  assert.equal(sale.total, 300);
  assert.equal(sale.commission, 100);
  assert.equal(sale.settle, 'done');
});

function createRuntime(){
  const calls = [];
  let nextResolver = null;
  const SB_BOOKINGS = [{
    id: 'bk_client_1',
    opsId: 'bk_srv_1',
    opsVersion: 5,
    leadPax: 'John Doe',
    passengers: [{ seq: 0, name: 'Jane Doe', nationality: 'GB', type: 'AD', foc: false }],
    specialMeals: { veg: 0, vegan: 0, halal: 0, allergies: '' },
    trips: [{ opsTripId: 'trip_srv_1', routeId: 'r1', date: '2026-10-12', pax: { ad: 2 }, ops: {} }],
    ops: {},
    upgrades: [{ id: 'up_1', label: 'Longtail', sellPrice: 1000, toCompany: 800, collected: false }]
  }];
  const SB_EXTRAS = [];
  const window = {};
  const O = {
    enabled: () => true,
    clone: v => v == null ? v : JSON.parse(JSON.stringify(v)),
    get: async (path) => {
      calls.push({ method: 'GET', path });
      if(path === '/v1/bookings/bk_srv_1') return { id: 'bk_srv_1', external_id: 'bk_client_1', version: 6 };
      if(path === '/v1/bookings/bk_srv_1/tour-sales') return { tour_sales: [] };
      return {};
    },
    del: (path) => new Promise((resolve, reject) => {
      calls.push({ method: 'DELETE', path });
      nextResolver = { resolve, reject };
    }),
    call: (method, path, body) => new Promise((resolve, reject) => {
      calls.push({ method, path, body, unversioned: true });
      nextResolver = { resolve, reject };
    }),
    bookingWrite: (method, path, bk, body) => new Promise((resolve, reject) => {
      calls.push({ method, path, body, version: bk && bk.opsVersion });
      nextResolver = {
        resolve: val => {
          if(bk && val && val.version != null) bk.opsVersion = +val.version;
          resolve(val);
        },
        reject
      };
    }),
    queue: fn => Promise.resolve().then(fn),
    fail: (title, err) => calls.push({ fail: title, message: err && err.message }),
    wrote: kind => calls.push({ wrote: kind })
  };
  window.laOps = O;
  window.insPersist = () => calls.push({ persist: 'ins' });
  window.sbExtrasPersist = () => calls.push({ persist: 'extras' });
  window.insEff = () => '';
  window.insOv = () => null;
  window.insSetField = () => 'legacy';
  window.insToggleReviewed = () => 'legacy';
  window.pckMealSave = () => 'legacy';
  window.pckMealClose = () => {};
  window.ckWrite = () => 'legacy';
  window.bookingV2ExtraAdd = () => 'legacy';
  window.bookingV2ExtraSave = () => 'legacy';
  window.bookingV2ExtraDelete = () => 'legacy';
  window.bookingV2ExtraCollect = () => 'legacy';

  const elements = {
    'pck-meal-al': { value: 'No shrimp' },
    'bkx-name': { value: 'Snorkel gear' },
    'bkx-qty': { value: '2' },
    'bkx-price': { value: '150' },
    'bkx-company': { value: '200' },
    'bkx-seller': { value: 'Guide A' }
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
    parseInt,
    Math,
    confirm: () => true,
    alert: msg => calls.push({ alert: msg }),
    SB_BOOKINGS,
    SB_EXTRAS,
    _pckMeal: { bkId: 'bk_client_1', veg: 1, vegan: 0, halal: 2, allergies: 'No shrimp' },
    _bkExtraPay: { m: 'cot', feePct: 0, slips: [] },
    _bkExtraEditId: null
  };
  vm.runInNewContext(SOURCE, context);
  return {
    window,
    context,
    calls,
    SB_BOOKINGS,
    SB_EXTRAS,
    resolveNext: val => nextResolver.resolve(val),
    rejectNext: err => nextResolver.reject(err),
    tick: () => new Promise(r => setImmediate(r))
  };
}

test('insurance, meals, tour-sales, and upgrade-collect use versioned bookingWrite; check-in merges trip.operations without bumping booking version', async () => {
  const rt = createRuntime();

  // 1. Insurance PUT uses bookingWrite with If-Match version 5 and bumps version on response
  const insP = rt.window.insSetField('bk_client_1', 'lead', 'age', '42');
  await rt.tick();
  const insCall = rt.calls.find(x => x.method === 'PUT' && x.path === '/v1/bookings/bk_srv_1/insurance');
  assert.ok(insCall);
  assert.equal(insCall.version, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(insCall.body)), { passengers: [{ passenger: 'lead', age: 42 }] });
  rt.resolveNext({ id: 'bk_srv_1', external_id: 'bk_client_1', version: 6, lead_age: 42 });
  await insP;
  assert.equal(rt.SB_BOOKINGS[0].opsVersion, 6);
  assert.equal(rt.SB_BOOKINGS[0].leadAge, 42);

  // 2. Meals PUT uses bookingWrite with version 6; rejection leaves booking untouched
  const mealP = rt.window.pckMealSave();
  await rt.tick();
  const mealCall = rt.calls.find(x => x.method === 'PUT' && x.path === '/v1/bookings/bk_srv_1/meals');
  assert.ok(mealCall);
  assert.equal(mealCall.version, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(mealCall.body)), { veg: 1, vegan: 0, halal: 2, allergies: 'No shrimp' });
  rt.rejectNext(new Error('stale'));
  await mealP;
  assert.equal(rt.SB_BOOKINGS[0].specialMeals.veg, 0, 'rejected meals write does not mutate local booking');

  // 3. Check-in PUT uses unversioned call, merges trip.operations, and does NOT bump bk.opsVersion
  rt.window.ckWrite(rt.SB_BOOKINGS[0], '2026-10-12', 'pier:0', { expected: 2, actualPax: 2, at: '2026-10-12T08:00:00Z', by: 'PierStaff', events: [] });
  await rt.tick();
  const ckCall = rt.calls.find(x => x.method === 'PUT' && x.path === '/operations/trip-ops/trip_srv_1/checkins/pier/0');
  assert.ok(ckCall);
  assert.equal(ckCall.unversioned, true, 'check-in does not use bookingWrite');
  rt.resolveNext({
    trip: {
      id: 'trip_srv_1',
      operations: {
        checkins: {
          van: [],
          pier: [{ kind: 'pier', slot: 0, expected: 2, actual_pax: 2, no_show: 0, checked_in_at: '2026-10-12T08:00:00Z', checked_in_by: 'PierStaff', events: [] }]
        }
      }
    },
    warnings: []
  });
  await rt.tick();
  assert.equal(rt.SB_BOOKINGS[0].opsVersion, 6, 'check-in does not bump booking version');
  assert.equal(rt.SB_BOOKINGS[0].ops.pierCheckin.actualPax, 2);

  // 4. Tour sale POST and collect use versioned bookingWrite
  const saleP = rt.window.bookingV2ExtraSave('bk_client_1');
  await rt.tick();
  assert.equal(rt.SB_EXTRAS.length, 0, 'no local tour sale before server responds');
  const saleCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/bookings/bk_srv_1/tour-sales');
  assert.ok(saleCall);
  assert.equal(saleCall.version, 6);
  rt.resolveNext({
    id: 'ex_10', booking_id: 'bk_srv_1', trip_date: '2026-10-12', service: 'Snorkel gear',
    qty: 2, unit_price: 150, total: 300, to_company: 200, commission: 100, method: 'cot', settle: 'pending', slips: []
  });
  await saleP;
  assert.equal(rt.SB_EXTRAS.length, 1);
  assert.equal(rt.SB_EXTRAS[0].id, 'ex_10');

  const collP = rt.window.bookingV2ExtraCollect('ex_10', 'bk_client_1');
  await rt.tick();
  const collCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/bookings/bk_srv_1/tour-sales/ex_10/collect');
  assert.ok(collCall);
  assert.deepEqual(JSON.parse(JSON.stringify(collCall.body)), { method: 'cash' });
  rt.resolveNext({
    id: 'ex_10', booking_id: 'bk_srv_1', trip_date: '2026-10-12', service: 'Snorkel gear',
    qty: 2, unit_price: 150, total: 300, to_company: 200, commission: 100, method: 'cash', settle: 'done', slips: []
  });
  await collP;
  assert.equal(rt.SB_EXTRAS[0].settle, 'done');

  // 5. Upgrade collect uses POST /v1/bookings/:id/upgrades/:upgrade_id/collect
  const upgP = rt.window.bookingV2UpgradeCollect('up_1', 'bk_client_1', { method: 'cash' });
  await rt.tick();
  const upgCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/bookings/bk_srv_1/upgrades/up_1/collect');
  assert.ok(upgCall);
  rt.resolveNext({
    id: 'bk_srv_1', external_id: 'bk_client_1', version: 7,
    upgrades: [{ id: 'up_1', label: 'Longtail', sell_price: 1000, to_company: 800, commission: 200, collected: true, settle: 'done', method: 'cash', slips: [] }]
  });
  await upgP;
  assert.equal(rt.SB_BOOKINGS[0].opsVersion, 7);
  assert.equal(rt.SB_BOOKINGS[0].upgrades[0].collected, true);
});

test('legacy mode delegates to original day-action functions without API calls', () => {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => false,
      call: () => { calls.push('api'); return Promise.resolve({}); },
      bookingWrite: () => { calls.push('api'); return Promise.resolve({}); }
    },
    insSetField: () => { calls.push('ins'); return 'legacy'; },
    pckMealSave: () => { calls.push('meal'); return 'legacy'; },
    ckWrite: () => { calls.push('ck'); return 'legacy'; },
    bookingV2ExtraSave: () => { calls.push('extra'); return 'legacy'; }
  };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseInt, Math });
  assert.equal(window.insSetField('b1', 'lead', 'age', 30), 'legacy');
  assert.equal(window.pckMealSave(), 'legacy');
  assert.equal(window.ckWrite({}, '2026-10-12', 'van', {}), 'legacy');
  assert.equal(window.bookingV2ExtraSave('b1'), 'legacy');
  assert.equal(calls.includes('api'), false);
});
