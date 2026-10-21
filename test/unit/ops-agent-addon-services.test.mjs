import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// An agent's Additional Services (legacy agpAddon*, migration 572 on the server): server first, the answer is the agent's whole list.
const SOURCE = fs.readFileSync('allotment_v2/js/ops/19-ops-addon-services.js', 'utf8');

function runtime({ enabled = true } = {}) {
  const calls = [];
  let next = null;
  const window = {};
  const agent = { id: 'ag_1', name: 'Agent One', addonServices: [{ svcId: 'aos_old', variants: [{ varId: 'v_old', selling: 5, net: 3 }] }] };
  const svc = { id: 'aos_1', name: 'Longtail', icon: 'boat', variants: [{ id: 'v_a', name: 'Join', unit: '' }, { id: 'v_b', name: 'Charter', unit: '' }] };
  const O = {
    enabled: () => enabled,
    clone: (v) => (v == null ? v : JSON.parse(JSON.stringify(v))),
    busy: () => false,
    get: async () => ({ addon_services: [] }),
    call: async (method, path, body) => { calls.push([method, path, body]); if (next instanceof Error) throw next; return next; },
    queue: (fn) => Promise.resolve().then(fn),
    fail: (title, error) => calls.push(['FAIL', title, error.message]),
    wrote: (kind) => calls.push(['WROTE', kind]),
  };
  window.laOps = O;
  window.renderAddonSvc = () => {}; window.aosAddService = () => {}; window.aosEditService = () => {}; window.aosDeleteService = () => {};
  window.aosAddVariant = () => {}; window.aosEditVariant = () => {}; window.aosDeleteVariant = () => {}; window.aosSaveModal = () => {};
  // legacy's own functions (08-app.js), as they are: local edits only
  window.agpAddonAddService = (svcId) => {
    const a = context.sbGetAgent(context._agpAddonAgentId);
    a.addonServices.push({ svcId, variants: svc.variants.map((v) => ({ varId: v.id, selling: 0, net: 0 })) });
    context._agpAddonEditSvcId = svcId; context._agpAddonDraft = { svcId, variants: JSON.parse(JSON.stringify(a.addonServices.at(-1).variants)) };
    calls.push(['LEGACY-ADD', svcId]);
  };
  window.agpAddonSaveVariants = () => { calls.push(['LEGACY-SAVE']); };
  window.agpAddonRemove = (agentId, svcId) => { calls.push(['LEGACY-REMOVE', agentId, svcId]); };
  window.agpAddonCloseModal = () => calls.push(['CLOSE']);
  window.agRenderDetail = (id) => calls.push(['DETAIL', id]);
  const context = {
    window, console, Number, JSON, Date, Promise, document: { querySelector: () => null },
    confirm: () => true, alert: () => {},
    SB_ADDON_SVCS: [svc], sbGetAgent: (id) => (id === 'ag_1' ? agent : null),
    _aosModalType: null, _aosModalSvcId: null, _aosModalVarId: null, _aosModalDraft: null,
    _agpAddonAgentId: 'ag_1', _agpAddonEditSvcId: null, _agpAddonDraft: null,
  };
  vm.runInNewContext(SOURCE, context);
  return { context, window, agent, calls, setResponse: (v) => { next = v; }, wait: () => new Promise((r) => setImmediate(r)) };
}
const J = (x) => JSON.parse(JSON.stringify(x));

test('adding a service: PUT with no body, then the legacy function opens the price modal on a list equal to the server\'s', async () => {
  const r = runtime();
  await r.wait();
  r.setResponse({ addon_services: [{ service_id: 'aos_old', variants: [{ variant_id: 'v_old', selling: 5, net: 3 }] }, { service_id: 'aos_1', variants: [{ variant_id: 'v_a', selling: 0, net: 0 }, { variant_id: 'v_b', selling: 0, net: 0 }] }] });
  await r.window.agpAddonAddService('aos_1');
  assert.deepEqual(J(r.calls.filter((c) => c[0] === 'PUT')), [['PUT', '/v1/agents/ag_1/addon-services/aos_1', {}]]);
  assert.deepEqual(r.agent.addonServices.map((p) => p.svcId), ['aos_old', 'aos_1'], 'one entry, not two: the legacy function adds the entry the server already holds');
  assert.ok(r.calls.some((c) => c[0] === 'LEGACY-ADD'));
});

test('saving the prices: the variants go as typed; the modal closes and the screen redraws only after the server answered', async () => {
  const r = runtime();
  await r.wait();
  r.context._agpAddonEditSvcId = 'aos_1';
  r.context._agpAddonDraft = { svcId: 'aos_1', variants: [{ varId: 'v_a', selling: '350', net: 250 }, { varId: 'v_b', selling: 0, net: 0 }] };
  r.agent.addonServices.push({ svcId: 'aos_1', variants: [] });
  r.setResponse({ addon_services: [{ service_id: 'aos_1', variants: [{ variant_id: 'v_a', selling: 350, net: 250 }, { variant_id: 'v_b', selling: 0, net: 0 }] }] });
  await r.window.agpAddonSaveVariants();
  assert.deepEqual(J(r.calls.find((c) => c[0] === 'PUT')), ['PUT', '/v1/agents/ag_1/addon-services/aos_1', { variants: [{ variant_id: 'v_a', selling: 350, net: 250 }, { variant_id: 'v_b', selling: 0, net: 0 }] }]);
  assert.deepEqual(J(r.agent.addonServices), [{ svcId: 'aos_1', variants: [{ varId: 'v_a', selling: 350, net: 250 }, { varId: 'v_b', selling: 0, net: 0 }] }], 'the list is the server\'s answer');
  assert.ok(r.calls.some((c) => c[0] === 'CLOSE') && r.calls.some((c) => c[0] === 'DETAIL'));
  assert.equal(r.calls.some((c) => c[0] === 'LEGACY-SAVE'), false, 'legacy\'s local-only save is not used');
});

test('a refused save keeps the modal open and the list as it was; removing asks first, then deletes on the server', async () => {
  const r = runtime();
  await r.wait();
  r.context._agpAddonEditSvcId = 'aos_old';
  r.context._agpAddonDraft = { svcId: 'aos_old', variants: [{ varId: 'v_zzz', selling: 1, net: 1 }] };
  r.setResponse(Object.assign(new Error('variants[0].variant_id v_zzz is not a variant of Longtail'), { status: 400 }));
  await r.window.agpAddonSaveVariants();
  assert.deepEqual(r.calls.find((c) => c[0] === 'FAIL').slice(1), ['Could not save the service prices', 'variants[0].variant_id v_zzz is not a variant of Longtail']);
  assert.equal(r.calls.some((c) => c[0] === 'CLOSE'), false, 'the modal stays open');
  assert.equal(r.agent.addonServices.length, 1);

  r.setResponse(null);
  await r.window.agpAddonRemove('ag_1', 'aos_old');
  assert.ok(r.calls.some((c) => c[0] === 'DELETE' && c[1] === '/v1/agents/ag_1/addon-services/aos_old'));
  assert.deepEqual(r.agent.addonServices, []);
  const no = runtime(); await no.wait(); no.context.confirm = () => false;
  await no.window.agpAddonRemove('ag_1', 'aos_old');
  assert.equal(no.calls.some((c) => c[0] === 'DELETE'), false, 'legacy\'s confirm still comes first');
  assert.equal(no.agent.addonServices.length, 1);
});

test('legacy mode (operations off): the legacy functions run and nothing is requested', async () => {
  const r = runtime({ enabled: false });
  await r.wait();
  await r.window.agpAddonAddService('aos_1');
  await r.window.agpAddonSaveVariants();
  await r.window.agpAddonRemove('ag_1', 'aos_old');
  assert.deepEqual(r.calls.map((c) => c[0]), ['LEGACY-ADD', 'LEGACY-SAVE', 'LEGACY-REMOVE']);
});
