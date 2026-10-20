// Rate Types owner select (rtSetOwner): legacy set rt.owner and called rtPersist (a no-op in ops mode), so the owner
// was lost on reload. Now PATCH /v1/rate-types/{id} {owner}; a refusal shows the server's message and keeps the old owner.
//   node --test test/unit/ops-rate-type-owner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

const RT = { id: 'rt1', code: 'A', name: 'A', active: true, owner: 'sOld', routes: [] };
const PRE = `
  var SB_RATE_TYPES = []; var _legacyOwnerCalls = 0, _draws = 0, _admin = true;
  function getRateType(id){ return SB_RATE_TYPES.find(function(x){ return x.id === id; }); }
  function laIsAdmin(){ return _admin; }
  function rtRenderList(){ _draws++; } function rtRenderDetail(){ _draws++; }
  function rtSetOwner(){ _legacyOwnerCalls++; }
`;
function setup(handlers = {}, enabled = true) {
  return runtime({ files: ['17-ops-rate-types.js'], pre: PRE, enabled, handlers: {
    'GET /v1/rate-types': { body: { rate_types: [{ id: 'rt1' }] } },
    'GET /v1/rate-types/rt1': { body: RT },
    ...handlers } });
}
const owner = (r) => vm_get(r, 'SB_RATE_TYPES[0].owner');
import vm from 'node:vm';
const vm_get = (r, expr) => vm.runInContext(expr, r.ctx);

test('the owner is saved on the server: PATCH {owner}, then the local rate type shows the answer', async () => {
  const r = setup({ 'PATCH /v1/rate-types/rt1': (b) => ({ body: { ...RT, owner: b.owner } }) });
  await r.settle();
  r.ctx.rtSetOwner('rt1', 'sNew'); await r.settle();
  const p = r.requests.filter((x) => x.method === 'PATCH');
  assert.deepEqual(plain(p.map((x) => [x.path, x.body])), [['/v1/rate-types/rt1', { owner: 'sNew' }]]);
  assert.equal(owner(r), 'sNew');
  assert.equal(vm_get(r, '_legacyOwnerCalls'), 0, 'the legacy no-op persist path is not used');
});

test('"shared" (empty owner) is sent as null', async () => {
  const r = setup({ 'PATCH /v1/rate-types/rt1': (b) => ({ body: { ...RT, owner: b.owner } }) });
  await r.settle();
  r.ctx.rtSetOwner('rt1', ''); await r.settle();
  assert.equal(r.requests.find((x) => x.method === 'PATCH').body.owner, null);
  assert.equal(owner(r), '');
});

test('a refusal keeps the old owner, redraws, and shows the server message', async () => {
  const r = setup({ 'PATCH /v1/rate-types/rt1': { status: 403, body: { statusCode: 403, message: 'Only an admin can change the owner', code: 'forbidden' } } });
  await r.settle();
  const draws = vm_get(r, '_draws');
  r.ctx.rtSetOwner('rt1', 'sNew'); await r.settle();
  assert.equal(owner(r), 'sOld');
  assert.ok(vm_get(r, '_draws') > draws, 'select drawn again from the saved owner');
  assert.match(JSON.stringify(r.toasts), /Only an admin can change the owner/);
});

test('a non-admin is stopped before any request; legacy mode calls the original', async () => {
  const r = setup();
  await r.settle();
  vm.runInContext('_admin = false', r.ctx);
  r.ctx.rtSetOwner('rt1', 'sNew'); await r.settle();
  assert.equal(r.requests.filter((x) => x.method === 'PATCH').length, 0);
  assert.equal(r.alerts.length, 1);
  const off = setup({}, false);
  off.ctx.rtSetOwner('rt1', 'x');
  assert.equal(vm_get(off, '_legacyOwnerCalls'), 1);
});
