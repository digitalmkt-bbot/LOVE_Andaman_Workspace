import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/19-ops-addon-services.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false } };
  vm.runInNewContext(SOURCE, { window, console, Number, JSON, Date });
  return window.__laOpsAddonServiceCompat;
}

test('add-on service API projection keeps legacy renderer fields and server prices', () => {
  const c = compat();
  const legacy = c.fromServer({
    id: 'aos_api', name: 'Private Van', type: 'van', description: 'Hotel transfer', active: true, sort: 4,
    variants: [{ id: 'v_one', name: 'Tub Lamu', unit: 'per van', selling: 1400, net: 1200 }]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(legacy)), {
    id: 'aos_api', name: 'Private Van', icon: 'van', desc: 'Hotel transfer', active: true, sort: 4,
    variants: [{ id: 'v_one', name: 'Tub Lamu', unit: 'per van', selling: 1400, net: 1200 }]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toCreateBody({ name: 'Guide', icon: 'guide', desc: '', variants: [{ id: 'v_g', name: 'English', unit: 'per guide' }] }))), {
    name: 'Guide', type: 'guide', description: null, variants: [{ id: 'v_g', name: 'English', unit: 'per guide', selling: null, net: null }]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(c.toPatch({ name: 'Guide', icon: 'guide', desc: 'Updated' }))), {
    name: 'Guide', type: 'guide', description: 'Updated'
  });
});

test('variant payload replaces the complete server list without booking add-on mapping', () => {
  const c = compat();
  assert.deepEqual(JSON.parse(JSON.stringify(c.variantsPatch([
    { id: 'v_old', name: 'Old', unit: '', selling: 10, net: null },
    { id: 'v_new', name: 'New', unit: 'per boat' }
  ]))), {
    variants: [
      { id: 'v_old', name: 'Old', unit: null, selling: 10, net: null },
      { id: 'v_new', name: 'New', unit: 'per boat', selling: null, net: null }
    ]
  });
  assert.equal(SOURCE.includes('SB_ADDON_TYPES'), false, 'custom booking add-on types stay outside this adapter');
});

function runtime(){
  const calls = [];
  let nextResponse = null;
  const serverRows = [{ id: 'aos_1', name: 'Van', type: 'van', description: 'Transfer', active: true, sort: null,
    variants: [{ id: 'v_1', name: 'One way', unit: 'per van', selling: 1000, net: 800 }] }];
  const window = {};
  const active = { dataset: { view: 'addonsvc' } };
  const O = {
    enabled: () => true,
    clone: value => value == null ? value : JSON.parse(JSON.stringify(value)),
    busy: () => false,
    get: async (path, query) => { calls.push(['GET', path, query]); return { addon_services: serverRows.map(x => JSON.parse(JSON.stringify(x))) }; },
    call: async (method, path, body) => { calls.push([method, path, body]); if (nextResponse instanceof Error) throw nextResponse; return nextResponse; },
    queue: fn => Promise.resolve().then(fn),
    fail: (title, error) => { calls.push(['FAIL', title, error.message]); },
    wrote: kind => calls.push(['WROTE', kind])
  };
  window.laOps = O;
  window.renderAddonSvc = () => { calls.push(['RENDER']); };
  window.aosAddService = () => {};
  window.aosEditService = () => {};
  window.aosDeleteService = () => {};
  window.aosAddVariant = () => {};
  window.aosEditVariant = () => {};
  window.aosDeleteVariant = () => {};
  window.aosSaveModal = () => {};
  window.aosCloseModal = () => { calls.push(['CLOSE']); };
  const context = {
    window, console, Number, JSON, Date, Promise,
    document: { querySelector: () => active },
    confirm: () => true,
    alert: message => calls.push(['ALERT', message]),
    SB_ADDON_SVCS: serverRows.map(x => JSON.parse(JSON.stringify(x))),
    _aosModalType: null, _aosModalSvcId: null, _aosModalVarId: null, _aosModalDraft: null,
    SB_ADDON_TYPES: [{ key: 'custom_booking_type' }]
  };
  vm.runInNewContext(SOURCE, context);
  return { context, window, calls, setResponse: value => { nextResponse = value; }, wait: () => new Promise(resolve => setImmediate(resolve)) };
}

test('operations writes are server-first and failed responses do not mutate the projection', async () => {
  const r = runtime();
  await r.wait();
  assert.deepEqual(r.context.SB_ADDON_SVCS.map(x => x.id), ['aos_1']);

  r.context._aosModalType = 'service';
  r.context._aosModalSvcId = null;
  r.context._aosModalDraft = { name: 'Guide', icon: 'guide', desc: 'Language support', variants: [] };
  const createdService = { id: 'aos_2', name: 'Guide', type: 'guide', description: 'Language support', active: true, sort: null, variants: [] };
  r.setResponse(createdService);
  await r.window.aosSaveModal();
  assert.deepEqual(r.context.SB_ADDON_SVCS.map(x => x.id), ['aos_1', 'aos_2']);
  r.setResponse(null);
  await r.window.aosDeleteService('aos_2');
  assert.deepEqual(r.context.SB_ADDON_SVCS.map(x => x.id), ['aos_1']);
  assert.ok(r.calls.some(x => x[0] === 'POST' && x[1] === '/v1/addon-services'));
  assert.ok(r.calls.some(x => x[0] === 'DELETE' && x[1] === '/v1/addon-services/aos_2'));

  r.context._aosModalType = 'variant';
  r.context._aosModalSvcId = 'aos_1';
  r.context._aosModalVarId = null;
  r.context._aosModalDraft = { id: 'v_2', name: 'Return', unit: 'per van' };
  const created = { id: 'aos_1', name: 'Van', type: 'van', description: 'Transfer', active: true, sort: null,
    variants: [{ id: 'v_1', name: 'One way', unit: 'per van', selling: 1000, net: 800 }, { id: 'v_2', name: 'Return', unit: 'per van', selling: null, net: null }] };
  r.setResponse(created);
  const pending = r.window.aosSaveModal();
  assert.equal(r.context.SB_ADDON_SVCS[0].variants.length, 1, 'local projection waits for API response');
  await pending;
  assert.equal(r.context.SB_ADDON_SVCS[0].variants.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.find(x => x[0] === 'PATCH')[2])), {
    variants: [
      { id: 'v_1', name: 'One way', unit: 'per van', selling: 1000, net: 800 },
      { id: 'v_2', name: 'Return', unit: 'per van', selling: null, net: null }
    ]
  });

  const before = JSON.stringify(r.context.SB_ADDON_SVCS);
  r.context._aosModalDraft = { id: 'v_2', name: 'Rejected', unit: 'per van' };
  r.setResponse(new Error('forbidden'));
  await r.window.aosSaveModal();
  assert.equal(JSON.stringify(r.context.SB_ADDON_SVCS), before, 'failed response leaves server projection unchanged');
  assert.ok(r.calls.some(x => x[0] === 'FAIL' && x[1] === 'Could not save Add-on Service variant'));
  assert.deepEqual(r.context.SB_ADDON_TYPES, [{ key: 'custom_booking_type' }], 'booking-priced add-on types are untouched');
});

test('legacy mode delegates the Add-on Services entry points unchanged', () => {
  const calls = [];
  const window = { laOps: { enabled: () => false }, renderAddonSvc: () => calls.push('render'), aosSaveModal: () => 'legacy-save', aosDeleteService: () => 'legacy-delete' };
  vm.runInNewContext(SOURCE, { window, console, Number, JSON, Date });
  assert.equal(window.aosSaveModal(), 'legacy-save');
  assert.equal(window.aosDeleteService('legacy'), 'legacy-delete');
  window.renderAddonSvc();
  assert.deepEqual(calls, ['render']);
});
