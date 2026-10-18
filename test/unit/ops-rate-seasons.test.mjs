// Row 34 · rate seasons never reached the server.  rtmSave (an agent's season tab) and rtExpBulkApply
// (set the whole group from the Rate Expiry panel) set a.rateSeasons and called sbAgentsPersist, a no-op in
// ops mode: the table vanished on reload.  They now PUT /v1/agents/:id/rate-seasons.  The server's own
// {rate_type_id, from, to:null} spelling is also mapped to legacy's {rt, from, to:''} (laSeasonsOf keeps only rows
// with an `rt`, so seasons read from the server were invisible and a save would have wiped the real table).
//   node --test test/unit/ops-rate-seasons.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(process.env.AGENTS_SRC || 'allotment_v2/js/ops/16-ops-agents.js', 'utf8');
class LaOpsError extends Error { constructor(m, code) { super(m); this.code = code; } }

function runtime({ enabled = true, refuse = {}, server = {} } = {}) {
  const calls = [], failures = [], legacy = [], toasts = [];
  const SB_AGENTS = [
    { id: 'a1', code: 'ONE', name: 'One', rateTypeId: 'old' },
    { id: 'a2', code: 'TWO', name: 'Two', rateTypeId: 'old' },       // already has a table on the server
    { id: 'a3', code: 'THREE', name: 'Three', rateTypeId: 'old' },
  ];
  const tables = Object.assign({ a1: [], a2: [{ rate_type_id: 'mid', from: '2026-03-01', to: null }], a3: [] }, server);
  const O = {
    enabled: () => enabled, onWrite: () => {}, onChange: () => {},
    get: async (path) => {
      const m = /^\/v1\/agents\/(\w+)(\/.*)?$/.exec(path);
      if (m[2] === '/rate-seasons') return { seasons: tables[m[1]] };
      if (m[2] === '/activity') return { activity: [{ at: 'T', text: 'server line' }] };
      return { id: m[1], name: m[1], active: true, rate_type_id: 'old', rate_seasons: tables[m[1]] };
    },
    call: async (method, path, body) => {
      calls.push(method + ' ' + path + ' ' + JSON.stringify(body));
      const id = path.split('/')[3];
      if (refuse[id]) throw new LaOpsError(refuse[id].message, refuse[id].code);
      tables[id] = body.seasons.map((s) => ({ rate_type_id: s.rate_type_id, from: s.from, to: s.to }));
      return { seasons: tables[id] };
    },
    queue: (fn) => Promise.resolve().then(fn),
    wrote() {}, fail: (title, e) => failures.push({ title, message: e && e.message }),
  };
  const ctx = {
    console, Promise, Array, Object, Error, String, Number, JSON, Set, encodeURIComponent,
    laOps: O, SB_AGENTS, _rtmAgent: '', _rtmDraft: null, _rtExpBulkRt: 'old',
    agRenderList() {}, renderAgKPI() {}, rtmInit: (id) => legacy.push('rtmInit:' + id), rtmRedraw: () => legacy.push('rtmRedraw'),
    flShowToast: (t) => toasts.push(t), rtExpRender: () => legacy.push('rtExpRender'),
    rtExpBulkPlan: () => ({ total: 3, groups: [{ ags: SB_AGENTS.slice() }] }),
    laSeasonsOf: (a) => (a.rateSeasons || []).filter((x) => x && x.rt && x.from),
    rtmSave: () => { legacy.push('legacy rtmSave'); },
  };
  ctx.window = ctx;
  // legacy rtExpBulkApply: skips an agent that already has a table, else sets old -> new and logs an activity line
  ctx.rtExpBulkApply = () => {
    legacy.push('legacy bulk');
    SB_AGENTS.forEach((a) => {
      if (ctx.laSeasonsOf(a).length) return;
      a.rateSeasons = [{ rt: 'old', from: '2026-01-01', to: '2026-10-14' }, { rt: 'new', from: '2026-10-15', to: '' }];
      a.activity = (a.activity || []).concat([{ at: 'local', text: 'local line' }]);
    });
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, calls, failures, legacy, toasts, SB_AGENTS, tables };
}

const NEW_TABLE = [{ rate_type_id: 'old', from: '2026-01-01', to: '2026-10-14' }, { rate_type_id: 'new', from: '2026-10-15', to: null }];

test('rtmSave PUTs the draft as the server spells it, then redraws from the server table', async () => {
  const rt = runtime();
  rt.ctx._rtmAgent = 'a1';
  rt.ctx._rtmDraft = [{ rt: 'new', from: '2026-10-15', to: '' }, { rt: 'old', from: '2026-01-01', to: '2026-10-14' }, { rt: '', from: '2026-12-01', to: '' }];
  await rt.ctx.rtmSave();
  assert.deepEqual(rt.calls, ['PUT /v1/agents/a1/rate-seasons ' + JSON.stringify({ seasons: NEW_TABLE })]);
  // the agent now holds the SERVER's table in legacy's spelling, so laSeasonsOf can see it
  assert.equal(JSON.stringify(rt.SB_AGENTS[0].rateSeasons), JSON.stringify([
    { rt: 'old', from: '2026-01-01', to: '2026-10-14' }, { rt: 'new', from: '2026-10-15', to: '' }]));
  assert.equal(rt.SB_AGENTS[0].activity[0].text, 'server line');
  assert.ok(rt.legacy.includes('rtmInit:a1') && rt.legacy.includes('rtmRedraw'));
  assert.deepEqual(rt.toasts, ['บันทึกตารางฤดูกาลแล้ว']);
  assert.ok(!rt.legacy.includes('legacy rtmSave'));
});

test('rtmSave refused: red toast, nothing applied locally, no success toast', async () => {
  const rt = runtime({ refuse: { a1: { message: 'Two seasons start on 2026-10-15', code: 'bad_request' } } });
  rt.ctx._rtmAgent = 'a1'; rt.ctx._rtmDraft = [{ rt: 'new', from: '2026-10-15', to: '' }];
  await rt.ctx.rtmSave();
  assert.equal(rt.SB_AGENTS[0].rateSeasons, undefined);
  assert.equal(rt.failures.length, 1);
  assert.deepEqual(rt.toasts, []);
});

test('bulk apply reads each table first, leaves the agent that already has one, PUTs only the changed ones', async () => {
  const rt = runtime();
  await rt.ctx.rtExpBulkApply();
  const put = (id) => 'PUT /v1/agents/' + id + '/rate-seasons ' + JSON.stringify({ seasons: NEW_TABLE });
  assert.deepEqual(rt.calls.sort(), [put('a1'), put('a3')]);
  // a2's real table survived (the list response had none: without the read the PUT would have replaced it)
  assert.equal(JSON.stringify(rt.tables.a2), JSON.stringify([{ rate_type_id: 'mid', from: '2026-03-01', to: null }]));
  assert.equal(rt.SB_AGENTS[1].rateSeasons[0].rt, 'mid');
  assert.equal(rt.SB_AGENTS[0].activity.length, 1);           // the server's line replaced the local one
  assert.equal(rt.SB_AGENTS[0].activity[0].text, 'server line');
  assert.equal(rt.failures.length, 0);
});

test('bulk apply: a refused agent goes back to its snapshot, the others proceed, ONE red toast', async () => {
  const rt = runtime({ refuse: { a3: { message: 'Rate type new is inactive', code: 'rate_type_inactive' } } });
  await rt.ctx.rtExpBulkApply();
  assert.equal(rt.SB_AGENTS[2].rateSeasons.length, 0);          // back to the table the server holds (none)
  assert.equal(rt.SB_AGENTS[2].activity.length, 0);
  assert.equal(rt.SB_AGENTS[0].rateSeasons.length, 2);
  assert.equal(rt.failures.length, 1);
  assert.match(rt.failures[0].message, /THREE: Rate type new is inactive \[rate_type_inactive\]/);
});

test('legacy mode: both savers are the original ones, zero requests', async () => {
  const rt = runtime({ enabled: false });
  rt.ctx._rtmAgent = 'a1';
  await rt.ctx.rtmSave(); await rt.ctx.rtExpBulkApply();
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.legacy.filter((x) => x.startsWith('legacy')), ['legacy rtmSave', 'legacy bulk']);
});
