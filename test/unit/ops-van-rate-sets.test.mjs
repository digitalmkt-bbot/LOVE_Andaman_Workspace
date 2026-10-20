import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// FE-5: Transfer Fleet rate sets live on the server (GET/POST/PUT/DELETE /v1/van-rate-sets, POST /v1/van-rates/apply|copy|pier-fill).
const PRE = `
var _ct = { vsel: {}, vtplEdit: '' }, repaints = 0, legacy = [];
var RATES = { own: { rt: {}, _state: { kind: 'tpl', set_id: 't_pk', set_name: 'PK', diff: 2, label: 'PK + แก้ 2 เส้น' } }, 'p:ODEON': { base: 1200, _state: { kind: 'own', label: 'ตั้งเอง · ฐาน 1,200' } } };
function vanRates(){ return JSON.parse(JSON.stringify(RATES)); }
function ctRender(){ repaints++; }
function mk(n){ return function(){ legacy.push(n); return 'legacy'; }; }
var vanTpls = mk('vanTpls'), vanTplsSave = mk('vanTplsSave'), vanTplSeed = mk('vanTplSeed'), vanTplAutoLink = mk('vanTplAutoLink'), vanTplDesc = mk('vanTplDesc'), vanTplDiff = mk('vanTplDiff'),
  vanGroupState = mk('vanGroupState'), vanTplApply = mk('vanTplApply'), vanTplBulk = mk('vanTplBulk'), vanTplCopy = mk('vanTplCopy'), vanTplNew = mk('vanTplNew'), vanTplDel = mk('vanTplDel'),
  vanTplSet = mk('vanTplSet'), vanPierFill = mk('vanPierFill');
`;
const SETS = { sets: [{ id: 't_pk', name: 'ภูเก็ต 1,700', base: null, cells: { r1: { PK: 1700 } }, desc: 'ภูเก็ต: PK 1,700', groups: ['own'], updated_at: null, updated_by: null }] };
function rt(handlers, globals = {}, enabled = true) {
  const r = runtime({ files: [], handlers, pre: PRE, globals, enabled });
  const applied = [];
  r.O.vanRates = { apply: (v) => applied.push(plain(v)), load: () => Promise.resolve(), repaint: () => {} };
  r.load('99-ops-van-rate-sets.js');
  return { ...r, applied };
}

test('readers: sets from the server, state from the group, description from the server', async () => {
  const r = rt({ 'GET /v1/van-rate-sets': { body: SETS } });
  const before = r.ctx.vanTpls();
  assert.deepEqual(plain(before), {}, 'nothing until the first ctRender loads the sets');
  await r.ctx.ctRender(); await r.settle();
  const T = plain(r.ctx.vanTpls());
  assert.deepEqual(T.t_pk, { name: 'ภูเก็ต 1,700', base: null, rt: { r1: { PK: 1700 } }, desc: 'ภูเก็ต: PK 1,700', groups: ['own'] });
  assert.equal(r.ctx.vanTplDesc(T.t_pk), 'ภูเก็ต: PK 1,700');
  assert.deepEqual([plain(r.ctx.vanGroupState('own')), r.ctx.vanTplDiff('own'), plain(r.ctx.vanGroupState('p:ODEON')), plain(r.ctx.vanGroupState('p:X')), r.ctx.vanTplDiff('p:ODEON')],
    [{ k: 'tpl', t: 'PK + แก้ 2 เส้น', d: 2 }, 2, { k: 'own', t: 'ตั้งเอง · ฐาน 1,200' }, { k: 'def', t: '' }, null]);
});

test('apply, bulk and copy go to the server first; nothing is applied locally', async () => {
  const r = rt({
    'GET /v1/van-rate-sets': { body: SETS },
    'POST /v1/van-rates/apply': { body: { groups: [{ key: 'own', state: { kind: 'tpl' } }], rates: [], defaults: {} } },
    'POST /v1/van-rates/copy': { body: { groups: [], rates: [], defaults: {} } },
  });
  await r.ctx.ctRender();
  r.ctx.vanTplApply('p:ODEON', 't_pk'); await r.settle();
  r.ctx.vanTplApply('p:ODEON', ''); await r.settle();
  r.ctx._ct.vsel = { own: 1, 'p:A': 1 };
  r.ctx.document.getElementById = (id) => (id === 'ct-vtpl-bulk' ? { value: 't_pk' } : id === 'ct-vcopy' ? { value: 'own' } : null);
  r.ctx.vanTplBulk(); await r.settle();
  r.ctx._ct.vsel = { own: 1, 'p:A': 1 };
  r.ctx.vanTplCopy(); await r.settle();
  assert.deepEqual(plain(r.requests.filter((q) => q.method === 'POST').map((q) => q.body)), [
    { set_id: 't_pk', groups: ['p:ODEON'] }, { set_id: null, groups: ['p:ODEON'] }, { set_id: 't_pk', groups: ['own', 'p:A'] }, { from_group: 'own', groups: ['p:A'] }]);
  assert.equal(r.applied.length, 4, 'every answer goes to the van-rates cache');
  assert.deepEqual(plain(r.ctx._ct.vsel), {}, 'ticks are cleared after a success');
});

test('new, set a cell, pier fill and delete', async () => {
  const r = rt({
    'GET /v1/van-rate-sets': { body: SETS },
    'POST /v1/van-rate-sets': { status: 201, body: { ...SETS, id: 't_new' } },
    'PUT /v1/van-rate-sets/t_pk/cells': { body: SETS },
    'POST /v1/van-rates/pier-fill': { body: SETS },
    'DELETE /v1/van-rate-sets/t_pk': { body: { ...SETS, unlinked: 1 } },
  }, { prompt: () => 'Khao Lak 1,800' });
  await r.ctx.ctRender();
  r.ctx.vanTplNew(); await r.settle();
  assert.equal(r.ctx._ct.vtplEdit, 't_new');
  r.ctx.vanTplSet('t_pk', 'r1', 'PK', '1750'); r.ctx.vanTplSet('t_pk', 'r1', 'KL', ''); await r.settle();
  r.ctx.document.getElementById = (id) => (id === 'ct-pf-pk-panwa' ? { value: '1700' } : id === 'ct-pf-kl-panwa' ? { value: '' } : null);
  r.ctx.vanPierFill('tpl', 't_pk', 'panwa'); await r.settle();
  r.ctx.vanPierFill('grp', 'own', 'panwa'); await r.settle();
  r.ctx.vanTplDel('t_pk'); await r.settle();
  const w = r.requests.filter((q) => q.method !== 'GET').map((q) => [q.method, q.path.split('?')[0], plain(q.body)]);
  assert.deepEqual(w, [
    ['POST', '/v1/van-rate-sets', { name: 'Khao Lak 1,800' }],
    ['PUT', '/v1/van-rate-sets/t_pk/cells', { route_id: 'r1', field: 'PK', rate: 1750 }],
    ['PUT', '/v1/van-rate-sets/t_pk/cells', { route_id: 'r1', field: 'KL', rate: null }],
    ['POST', '/v1/van-rates/pier-fill', { pier: 'panwa', set_id: 't_pk', PK: 1700 }],
    ['POST', '/v1/van-rates/pier-fill', { pier: 'panwa', group: 'own', PK: 1700 }],
    ['DELETE', '/v1/van-rate-sets/t_pk', null],
  ]);
  assert.ok(r.confirms.some((c) => /1 group\(s\) keep their current numbers/.test(c)), 'the confirm counts the set\'s groups');
});

test('a refusal shows the server message; both pier fields empty is refused before any call; ops off is legacy', async () => {
  const r = rt({ 'GET /v1/van-rate-sets': { body: SETS }, 'POST /v1/van-rates/apply': { status: 400, body: { statusCode: 400, message: 'No van rate set zz' } } });
  await r.ctx.ctRender();
  r.ctx.vanTplApply('own', 'zz'); await r.settle();
  assert.ok(r.toasts.some((t) => /No van rate set zz/.test(t.sub)));
  r.ctx.document.getElementById = () => ({ value: '' });
  r.ctx.vanPierFill('tpl', 't_pk', 'panwa');
  assert.match(r.alerts.at(-1), /Enter PK and\/or KL first/);
  const off = rt({}, {}, false);
  assert.equal(off.ctx.vanTpls(), 'legacy');
  assert.equal(off.requests.length, 0);
});
