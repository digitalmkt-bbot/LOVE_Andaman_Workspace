import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(process.env.AGENTS_SRC || 'allotment_v2/js/ops/16-ops-agents.js', 'utf8');

class LaOpsError extends Error { constructor(m, code) { super(m); this.code = code; } }

function runtime({ enabled = true, refuse = {}, agents } = {}) {
  const calls = [], failures = [], wrote = [], legacy = [], events = [];
  const SB_AGENTS = agents || [
    { id: 'a1', name: 'One', rateTypeId: null },
    { id: 'a2', name: 'Two', rateTypeId: 'rt-x' },
    { id: 'a3', name: 'Three', rateTypeId: 'rt-x' },   // bound here, will be unticked -> unbind
    { id: 'a4', name: 'Four', rateTypeId: 'rt-other' }, // untouched
    { id: 'a5', name: 'Five', rateTypeId: null },
  ];
  const window = {
    laOps: {
      enabled: () => enabled,
      get: async () => ({}),
      call: async (method, path, body) => {
        calls.push(method + ' ' + path + ' ' + JSON.stringify(body));
        // nothing may be applied locally before the server answers
        events.push('call:' + path + ':' + SB_AGENTS.map((a) => a.rateTypeId).join(','));
        const id = path.split('/')[3];
        if (refuse[id]) throw new LaOpsError(refuse[id].message, refuse[id].code);
        return { id, name: id, rate_type_id: body.rate_type_id, active: true };
      },
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (k) => wrote.push(k),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
    },
    rtAgentPickerApply: () => { legacy.push('rtAgentPickerApply'); return 'legacy'; },
  };
  const noop = () => {};
  const ctx = {
    window, SB_AGENTS, console, Promise, Array, Object, Error, String, Number, JSON, Set,
    _rtAgentPickerRtId: 'rt-x',
    _rtAgentPickerSelected: new Set(['a1', 'a2', 'a5']),
    _rtViewMode: 'detail',
    rtAgentPickerClose: () => events.push('close'), rtRenderCards: noop, rtRenderDetail: noop, rtRenderAgentColumn: noop,
    agRenderList: noop, renderAgKPI: noop, encodeURIComponent,
    confirm: () => true, alert: noop,
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, ctx, calls, failures, wrote, legacy, events, SB_AGENTS };
}

test('bulk apply sends one PUT per changed agent only (bind and unbind), then applies locally', async () => {
  const rt = runtime();
  await rt.window.rtAgentPickerApply();
  assert.deepEqual(rt.calls.sort(), [
    'PUT /v1/agents/a1/rate-type {"rate_type_id":"rt-x"}',
    'PUT /v1/agents/a3/rate-type {"rate_type_id":null}',
    'PUT /v1/agents/a5/rate-type {"rate_type_id":"rt-x"}',
  ]);
  const by = Object.fromEntries(rt.SB_AGENTS.map((a) => [a.id, a.rateTypeId]));
  assert.deepEqual(by, { a1: 'rt-x', a2: 'rt-x', a3: null, a4: 'rt-other', a5: 'rt-x' });
  assert.deepEqual(rt.failures, []);
  assert.ok(rt.wrote.includes('agents'));
});

test('nothing is changed locally before the server accepts', async () => {
  const rt = runtime();
  await rt.window.rtAgentPickerApply();
  const first = rt.events.find((e) => e.startsWith('call:/v1/agents/a1'));
  assert.equal(first, 'call:/v1/agents/a1/rate-type:,rt-x,rt-x,rt-other,');
});

test('rate_type_inactive refusal leaves that agent unchanged, is reported once, others proceed', async () => {
  const rt = runtime({ refuse: { a1: { message: 'Rate type X is inactive and cannot be bound', code: 'rate_type_inactive' } } });
  await rt.window.rtAgentPickerApply();
  const by = Object.fromEntries(rt.SB_AGENTS.map((a) => [a.id, a.rateTypeId]));
  assert.equal(by.a1, null);
  assert.equal(by.a5, 'rt-x');
  assert.equal(by.a3, null);
  assert.equal(rt.failures.length, 1);
  assert.match(rt.failures[0].message, /One: .*inactive.*\[rate_type_inactive\]/);
});

test('a wholly refused run changes nothing locally and keeps the picker open', async () => {
  const e = { message: 'inactive', code: 'rate_type_inactive' };
  const rt = runtime({ refuse: { a1: e, a3: e, a5: e } });
  await rt.window.rtAgentPickerApply();
  assert.deepEqual(rt.SB_AGENTS.map((a) => a.rateTypeId), [null, 'rt-x', 'rt-x', 'rt-other', null]);
  assert.equal(rt.failures.length, 1);
  assert.match(rt.failures[0].title, /nothing changed/);
  assert.ok(!rt.events.includes('close'));
  assert.deepEqual(rt.wrote, []);
});

test('legacy mode delegates untouched', async () => {
  const rt = runtime({ enabled: false });
  const r = await rt.window.rtAgentPickerApply();
  assert.equal(r, 'legacy');
  assert.deepEqual(rt.calls, []);
});
