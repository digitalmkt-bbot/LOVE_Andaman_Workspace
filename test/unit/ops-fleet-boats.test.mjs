import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/22-ops-fleet-boats.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false, today: () => '2026-10-12', onChange: () => {} } };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat });
  return window.__laOpsFleetBoatsCompat;
}

test('boat projection maps capacity/license_pax/registered_persons/name_th/documents/status_log and preserves home pier vs pier_today', () => {
  const c = compat();
  const boat = c.mapBoat({
    id: 'b1',
    name: 'Love 1',
    name_th: 'เลิฟ 1',
    capacity: 45,
    license_pax: 50,
    registered_persons: 54,
    pier: 'tublamu',
    pier_today: 'panwa',
    at_shop: null,
    status_effective: 'available',
    blocked_by: [],
    documents: [{ name: 'ใบอนุญาตใช้เรือ', expires_on: '2027-05-01', renew_status: 'processing' }],
    status_log: [{ id: 'sl_1', status: 'fixing', from_date: '2026-10-01', to_date: '2026-10-05', loc: 'Sak Marine' }]
  });
  assert.equal(boat.cap, 45);
  assert.equal(boat.licensePax, 50);
  assert.equal(boat.totalcap, 54);
  assert.equal(boat.nameTh, 'เลิฟ 1');
  assert.equal(boat.pier, 'tublamu', 'home pier is preserved and not overwritten by pier_today');
  assert.equal(boat.pierToday, 'panwa');
  assert.deepEqual(JSON.parse(JSON.stringify(boat.docs[0])), {
    name: 'ใบอนุญาตใช้เรือ',
    exp: '2027-05-01',
    renewStatus: 'processing',
    docType: null,
    status: null,
    daysLeft: null,
    current: true
  });
  assert.equal(boat.log[0].s, 'fixing');
  assert.equal(boat.log[0].from, '2026-10-01');
  assert.equal(boat.log[0].to, '2026-10-05');

  assert.deepEqual(JSON.parse(JSON.stringify(c.toAssignmentBody({
    type: 'temporary',
    fromPier: 'tublamu',
    toPier: 'panwa',
    startDate: '2026-10-12',
    endDate: '2026-10-20',
    reason: 'Peak cover',
    cost: 2500
  }))), {
    type: 'temporary',
    from_pier: 'tublamu',
    to_pier: 'panwa',
    start_date: '2026-10-12',
    end_date: '2026-10-20',
    reason: 'Peak cover',
    cost: 2500
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toRenewDocBody('ประกันภัยเรือ', 'ok', '2027-12-31'))), {
    name: 'ประกันภัยเรือ',
    state: 'ok',
    expires_on: '2027-12-31'
  });
});

function createRuntime(){
  const calls = [];
  let nextResolver = null;
  let boatDetail = {
    id: 'b1',
    name: 'Love 1',
    name_th: 'เลิฟ 1',
    capacity: 45,
    license_pax: 50,
    registered_persons: 54,
    pier: 'tublamu',
    pier_today: 'tublamu',
    status_effective: 'available',
    blocked_by: [],
    documents: [{ name: 'ประกันภัยเรือ', expires_on: '2026-10-01', renew_status: null }],
    status_log: [{ id: 's1', status: 'available', from_date: '2026-01-01', to_date: null }]
  };
  let asnResponse = { assignments: [], pier_today: 'tublamu' };
  const BOATS = [{ id: 'b1', name: 'Love 1', cap: 45, pier: 'tublamu', assignments: [], docs: [], log: [] }];
  const elements = {
    'asn-from': { value: 'tublamu' },
    'asn-to': { value: 'panwa' },
    'asn-type': { value: 'temporary' },
    'asn-start': { value: '2026-10-12' },
    'asn-end': { value: '2026-10-19' },
    'asn-reason': { value: 'Support Panwa' },
    'asn-cost': { value: '1800' },
    'dep-exp-input': { value: '2027-10-01' }
  };
  const window = {};
  const O = {
    enabled: () => true,
    today: () => '2026-10-12',
    clone: v => v == null ? v : JSON.parse(JSON.stringify(v)),
    get: async (path, q) => {
      calls.push({ method: 'GET', path, q });
      if(path === '/v1/boats') return { boats: [JSON.parse(JSON.stringify(boatDetail))] };
      if(path === '/v1/boats/b1') return JSON.parse(JSON.stringify(boatDetail));
      if(path === '/v1/boats/b1/assignments') return JSON.parse(JSON.stringify(asnResponse));
      if(path === '/v1/fleet/certificates') return { date: '2026-10-12', boats: [], counts: {} };
      if(path === '/v1/fleet/availability') return { days: [{ boat_id: 'b1', service_date: '2026-10-12', status: 'available', blocked_by: [] }] };
      return {};
    },
    post: (path, body) => new Promise((resolve, reject) => {
      calls.push({ method: 'POST', path, body });
      nextResolver = { resolve, reject };
    }),
    queue: fn => Promise.resolve().then(fn),
    fail: (title, err) => calls.push({ fail: title, message: err && err.message }),
    wrote: kind => calls.push({ wrote: kind }),
    onChange: () => {}
  };
  window.laOps = O;
  window.flSave = () => calls.push({ persist: 'flSave' });
  window.getBoatCurrentPier = b => b.pier || 'tublamu';
  window.flSaveAssignment = () => 'legacy-asn';
  window.flCancelAssignment = () => 'legacy-cancel';
  window.depSave = () => 'legacy-dep';
  window.flRenderDocsList = () => calls.push({ render: 'docs' });
  window.renderBoats = () => calls.push({ render: 'boats' });
  window.closeModal = () => {};
  window.depClose = () => {};
  window.flShowToast = () => {};

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
    confirm: () => true,
    alert: msg => calls.push({ alert: msg }),
    BOATS,
    PIER_LABELS: { tublamu: 'Tub Lamu', panwa: 'Visit Panwa', ranong: 'Ranong' },
    _pierAsnBoatId: 'b1',
    _depBoatId: 'b1',
    _depDocName: 'ประกันภัยเรือ',
    _depSt: 'ok'
  };
  vm.runInNewContext(SOURCE, context);
  return {
    window,
    context,
    calls,
    BOATS,
    setBoatDetail: v => { boatDetail = v; },
    setAsnResponse: v => { asnResponse = v; },
    resolveNext: val => nextResolver.resolve(val),
    rejectNext: err => nextResolver.reject(err),
    tick: () => new Promise(r => setImmediate(r))
  };
}

test('assignment create/cancel and document renew are server-first, refetch the boat, and never overwrite home pier with pier_today', async () => {
  const rt = createRuntime();
  await rt.tick();
  await rt.tick();

  // Create temporary assignment: no local mutation before response
  const saveP = rt.window.flSaveAssignment();
  await rt.tick();
  assert.equal(rt.BOATS[0].assignments.length, 0, 'no local assignment before server responds');
  const postCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/boats/b1/assignments');
  assert.ok(postCall);
  assert.deepEqual(JSON.parse(JSON.stringify(postCall.body)), {
    type: 'temporary',
    from_pier: 'tublamu',
    to_pier: 'panwa',
    start_date: '2026-10-12',
    end_date: '2026-10-19',
    reason: 'Support Panwa',
    cost: 1800
  });

  // Rejected assignment leaves BOATS untouched
  rt.rejectNext(new Error('invalid pier'));
  await saveP;
  assert.equal(rt.BOATS[0].assignments.length, 0);
  assert.ok(rt.calls.some(x => x.fail === 'Could not save boat assignment'));

  // Successful temporary assignment refetches boat + assignments; pier_today='panwa' does not overwrite home pier 'tublamu'
  rt.context._pierAsnBoatId = 'b1';
  const saveP2 = rt.window.flSaveAssignment();
  await rt.tick();
  rt.setAsnResponse({
    assignments: [{
      id: 'asn_1',
      boat_id: 'b1',
      type: 'temporary',
      from_pier: 'tublamu',
      to_pier: 'panwa',
      start_date: '2026-10-12',
      end_date: '2026-10-19',
      reason: 'Support Panwa',
      cost: 1800,
      status: 'active',
      cancelled: false
    }],
    pier_today: 'panwa'
  });
  rt.resolveNext({ assignment: { id: 'asn_1', status: 'active' }, boat_pier: 'tublamu' });
  await saveP2;
  assert.equal(rt.BOATS[0].assignments.length, 1);
  assert.equal(rt.BOATS[0].pier, 'tublamu', 'home pier remains tublamu');
  assert.equal(rt.BOATS[0].pierToday, 'panwa');

  // Cancel assignment sends POST /v1/boats/:id/assignments/:asn_id/cancel and refetches
  const cancelP = rt.window.flCancelAssignment('b1', 'asn_1');
  await rt.tick();
  assert.ok(rt.calls.some(x => x.method === 'POST' && x.path === '/v1/boats/b1/assignments/asn_1/cancel'));
  rt.setAsnResponse({
    assignments: [{
      id: 'asn_1',
      boat_id: 'b1',
      type: 'temporary',
      from_pier: 'tublamu',
      to_pier: 'panwa',
      start_date: '2026-10-12',
      end_date: '2026-10-19',
      status: 'cancelled',
      cancelled: true
    }],
    pier_today: 'tublamu'
  });
  rt.resolveNext({ id: 'asn_1', status: 'cancelled' });
  await cancelP;
  assert.equal(rt.BOATS[0].assignments[0].status, 'cancelled');

  // Renew document sends POST /v1/boats/:id/documents/renew and refetches boat
  const renewP = rt.window.depSave();
  await rt.tick();
  const renewCall = rt.calls.find(x => x.method === 'POST' && x.path === '/v1/boats/b1/documents/renew');
  assert.ok(renewCall);
  assert.deepEqual(JSON.parse(JSON.stringify(renewCall.body)), {
    name: 'ประกันภัยเรือ',
    state: 'ok',
    expires_on: '2027-10-01'
  });
  rt.setBoatDetail({
    id: 'b1',
    name: 'Love 1',
    capacity: 45,
    pier: 'tublamu',
    documents: [{ name: 'ประกันภัยเรือ', expires_on: '2027-10-01', renew_status: null }],
    status_log: []
  });
  rt.resolveNext({ documents: [{ name: 'ประกันภัยเรือ', expires_on: '2027-10-01', renew_status: null }] });
  await renewP;
  assert.equal(rt.BOATS[0].docs[0].exp, '2027-10-01');
  assert.equal(rt.calls.some(x => x.persist === 'flSave'), false, 'flSave is blocked in ops mode');
});

test('legacy mode delegates to original functions without API requests', () => {
  const calls = [];
  const window = {
    laOps: {
      enabled: () => false,
      today: () => '2026-10-12',
      get: () => { calls.push('api'); return Promise.resolve({}); },
      post: () => { calls.push('api'); return Promise.resolve({}); },
      onChange: () => {}
    },
    flSaveAssignment: () => { calls.push('saveAsn'); return 'legacy'; },
    flCancelAssignment: () => { calls.push('cancelAsn'); return 'legacy'; },
    depSave: () => { calls.push('depSave'); return 'legacy'; }
  };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat });
  assert.equal(window.flSaveAssignment(), 'legacy');
  assert.equal(window.flCancelAssignment('b1', 'a1'), 'legacy');
  assert.equal(window.depSave(), 'legacy');
  assert.equal(calls.includes('api'), false);
});
