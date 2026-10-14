// Row 134 · "fill programmes to the rate" for many agents (agProgBulkApply) set a.programPeriods and called
// sbAgentsPersist, a no-op in ops mode: the programmes vanished on reload.  Now one queued
// PUT /v1/agents/:id/programs per changed agent.  The PUT replaces the agent's programme list and the list
// response carries route ids only, so each candidate is read in full first (else a fill would have dropped the
// existing programmes' periods and notes).
//   node --test test/unit/ops-agent-programs-bulk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(process.env.AGENTS_SRC || 'allotment_v2/js/ops/16-ops-agents.js', 'utf8');
class LaOpsError extends Error { constructor(m, code) { super(m); this.code = code; } }

function runtime({ enabled = true, refuse = {} } = {}) {
  const calls = [], failures = [], legacy = [];
  // the LIST rows know route ids only (no periods); the detail has the periods and notes
  const SB_AGENTS = [
    { id: 'a1', code: 'ONE', name: 'One', rateTypeId: 'rt', programs: ['r_old'] },
    { id: 'a2', code: 'TWO', name: 'Two', rateTypeId: 'rt', programs: [] },
    { id: 'a3', code: 'THREE', name: 'Three', rateTypeId: 'rt', programs: [] },
  ];
  const detail = {
    a1: { programs: [{ route_id: 'r_old', book_from: '2026-01-01', book_to: '2026-12-31', note: 'keep me' }] },
    a2: { programs: [] }, a3: { programs: [] },
  };
  const O = {
    enabled: () => enabled,
    get: async (path) => {
      const m = /^\/v1\/agents\/(\w+)(\/activity)?$/.exec(path);
      if (m[2]) return { activity: [{ at: 'T', text: 'server line' }] };
      return { id: m[1], name: m[1], active: true, rate_type_id: 'rt', programs: detail[m[1]].programs };
    },
    call: async (method, path, body) => {
      calls.push(method + ' ' + path + ' ' + JSON.stringify(body));
      const id = path.split('/')[3];
      if (refuse[id]) throw new LaOpsError(refuse[id].message, refuse[id].code);
      detail[id] = { programs: body.programs };
      return { id };
    },
    queue: (fn) => Promise.resolve().then(fn),
    wrote() {}, fail: (title, e) => failures.push({ title, message: e && e.message }),
  };
  const ctx = {
    console, Promise, Array, Object, Error, String, Number, JSON, Set, encodeURIComponent,
    laOps: O, SB_AGENTS, _agProgBulkScope: 'empty',
    agRenderList() {}, renderAgKPI() {},
    agProgBulkPlan: () => ({ empty: SB_AGENTS.filter((a) => a.id !== 'a1').map((a) => ({ a })), partial: [SB_AGENTS[0]].map((a) => ({ a })) }),
  };
  ctx.window = ctx;
  // legacy: for every agent in the chosen scope, append the rate's route to programPeriods and mirror programs
  ctx.agProgBulkApply = () => {
    legacy.push('legacy fill');
    const ids = ctx._agProgBulkScope === 'partial' ? ['a1'] : ['a2', 'a3'];
    ids.forEach((id) => {
      const a = SB_AGENTS.find((x) => x.id === id);
      if (!Array.isArray(a.programPeriods)) a.programPeriods = [];
      a.programPeriods.push({ routeId: 'r_new', bookFrom: '', bookTo: '', travelFrom: '', travelTo: '', note: '' });
      a.programs = a.programPeriods.map((x) => x.routeId);
      a.activity = (a.activity || []).concat([{ at: 'local', text: 'local line' }]);
    });
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, calls, failures, legacy, SB_AGENTS, detail };
}

const NEW_ROW = { route_id: 'r_new', book_from: null, book_to: null, note: null };

test('one PUT per changed agent, with the programme list the server held plus the filled route', async () => {
  const rt = runtime();
  await rt.ctx.agProgBulkApply();
  assert.deepEqual(rt.calls.sort(), [
    'PUT /v1/agents/a2/programs ' + JSON.stringify({ programs: [NEW_ROW] }),
    'PUT /v1/agents/a3/programs ' + JSON.stringify({ programs: [NEW_ROW] }),
  ]);
  assert.equal(rt.failures.length, 0);
  assert.equal(rt.SB_AGENTS[1].activity[0].text, 'server line');     // the server's activity, not the local line
});

test('the partial scope keeps the existing programme period and note (read before the PUT replaces the list)', async () => {
  const rt = runtime();
  rt.ctx._agProgBulkScope = 'partial';
  await rt.ctx.agProgBulkApply();
  assert.deepEqual(rt.calls, ['PUT /v1/agents/a1/programs ' + JSON.stringify({ programs: [
    { route_id: 'r_old', book_from: '2026-01-01', book_to: '2026-12-31', note: 'keep me' }, NEW_ROW] })]);
});

test('a refused agent goes back to its snapshot, the others proceed, ONE red toast', async () => {
  const rt = runtime({ refuse: { a3: { message: 'No price for r_new on this rate type', code: 'unpriced_programs' } } });
  await rt.ctx.agProgBulkApply();
  const a3 = rt.SB_AGENTS.find((a) => a.id === 'a3');
  assert.equal((a3.programPeriods || []).length, 0);
  assert.equal(a3.programs.length, 0);
  assert.equal(rt.SB_AGENTS.find((a) => a.id === 'a2').programs.length, 1);
  assert.equal(rt.failures.length, 1);
  assert.match(rt.failures[0].message, /a3: No price for r_new on this rate type \[unpriced_programs\]/);
});

test('legacy mode: the original, zero requests', async () => {
  const rt = runtime({ enabled: false });
  await rt.ctx.agProgBulkApply();
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.legacy, ['legacy fill']);
});
