// §eqLink (ops/23-ops-fleet-assets.js): the equipment bay's link by position asks operation-backend first
// (POST /v1/fleet/{family}/{id}/link | unlink), then refetches the engine → gearbox → propeller chain and closes the picker.
// The legacy functions (which change FL_* and call flSave, a no-op here) never run in ops mode.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { runtime, plain } from './fe-harness.mjs';

const PRE = `
var FL_ENGINES = [{ id: 'e1', serial: 'E1', boatId: 'b1', pos: 'Port' }, { id: 'e2', serial: 'E2', boatId: 'b1', pos: 'Std' }];
var FL_GEARBOXES = [{ id: 'g1', serial: 'G1', engineId: 'e1' }];
var FL_PROPELLERS = [{ id: 'p0', serial: 'P0', gearboxId: 'g1', status: 'spare' }, { id: 'p1', serial: 'P1', gearboxId: 'g1', status: 'active' }];
let _flEqPick = null;
var legacy = [], renders = 0;
function flEqChoose(){ legacy.push('choose'); }
function flEqTakeOut(){ legacy.push('takeout'); }
function flEqLinkPair(){ legacy.push('pair'); }
function flEqQuickLink(){ legacy.push('quick'); }
function _flEqEng(id){ var m = /^pos:([^:]+):(.+)$/.exec(id); if(m) return { id: id, virt: true, boatId: m[1], pos: m[2] }; return FL_ENGINES.find(function(e){ return e.id === id; }); }
function _flEqReadLoc(){ return 'pier:tublamu'; }
function flRenderEquip(){ renders++; }
function getBoat(id){ return { id: id, name: 'Romeo' }; }
`;

// The server after the change: what refetchChain() reads back.
const SERVER = {
  engines: [{ id: 'e1', serial: 'E1', boat_id: 'b1', pos: 'Port', status: 'ready', base_hours: 0 }, { id: 'e2', serial: 'E2', boat_id: 'b1', pos: 'Std', status: 'ready', base_hours: 0 }],
  gearboxes: [{ id: 'g2', serial: 'G2', engine_id: 'e1', boat_id: 'b1', status: 'ready', base_hours: 0 }, { id: 'g1', serial: 'G1', engine_id: null, boat_id: null, status: 'spare', spare_location: 'pier:tublamu', base_hours: 0 }],
  propellers: [{ id: 'p1', serial: 'P1', gearbox_id: 'g2', boat_id: 'b1', status: 'active' }],
};
const reads = {
  'GET /v1/fleet/engines': { body: { engines: SERVER.engines } },
  'GET /v1/fleet/gearboxes': { body: { gearboxes: SERVER.gearboxes } },
  'GET /v1/fleet/propellers': { body: { propellers: SERVER.propellers } },
};
const refused = (code, message) => ({ status: 409, body: { statusCode: 409, code, message } });

function boot({ handlers = {}, confirm, enabled = true, moveProp = false } = {}) {
  const document = {
    getElementById: (id) => (id === 'fl-eq-moveprop' ? { checked: moveProp } : null),
    querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {},
  };
  const r = runtime({ files: ['23-ops-fleet-assets.js'], pre: PRE, handlers: { ...reads, ...handlers }, globals: { document }, confirm, enabled });
  r.pick = (v) => vm.runInContext(v === undefined ? '_flEqPick' : `_flEqPick = ${JSON.stringify(v)}`, r.ctx);
  r.posts = () => r.requests.filter((q) => q.method === 'POST').map((q) => [q.path, q.body]);
  return r;
}

test('choosing a gearbox for an engine: the server first, its "move it?" 409 is the confirm, then the chain is refetched and the picker closes', async () => {
  let calls = 0;
  const r = boot({
    moveProp: true,
    handlers: { 'POST /v1/fleet/gearboxes/g2/link': (b) => (++calls === 1 ? refused('gearbox_on_other_engine', 'Gearbox G2 is on engine E9. Move it to E1?') : { body: { id: 'g2' } }), 'GET /v1/fleet/gearboxes/g2': { body: SERVER.gearboxes[0] } },
  });
  r.pick({ kind: 'gb', engId: 'e1' });
  assert.equal(await r.ctx.flEqChoose('g2'), true);
  await r.settle();
  assert.deepEqual(plain(r.posts()), [
    ['/v1/fleet/gearboxes/g2/link', { engine_id: 'e1', spare_location: 'pier:tublamu', move_propeller: true }],
    ['/v1/fleet/gearboxes/g2/link', { engine_id: 'e1', spare_location: 'pier:tublamu', move_propeller: true, move_anyway: true }],
  ]);
  assert.deepEqual(r.confirms, ['Gearbox G2 is on engine E9. Move it to E1?']);
  assert.deepEqual(plain(r.ctx.FL_GEARBOXES.map((g) => [g.id, g.engineId, g.spareLocation])),[['g2', 'e1', null], ['g1', null, 'pier:tublamu']], 'the browser shows what the server answered');
  assert.equal(r.pick(), null, 'picker closed');
  assert.ok(r.ctx.renders > 0);
  assert.deepEqual(plain(r.ctx.legacy), [], 'the legacy save never ran');
  assert.deepEqual(r.toasts.filter((t) => t.kind === 'error'), []);
});

test('Cancel on the "move it?" question changes nothing: no error toast, no refetch, the picker stays open', async () => {
  const r = boot({ confirm: () => false, handlers: { 'POST /v1/fleet/propellers/p9/link': refused('propeller_on_other_gearbox', 'Propeller P9 is on gearbox G7. Move it here?') } });
  r.pick({ kind: 'prop', engId: 'e1' });
  assert.equal(await r.ctx.flEqChoose('p9'), false);
  assert.deepEqual(plain(r.posts()), [['/v1/fleet/propellers/p9/link', { gearbox_id: 'g1', spare_location: 'pier:tublamu' }]]);
  assert.equal(r.requests.filter((q) => q.method === 'GET').length, 0);
  assert.deepEqual(r.toasts, []);
  assert.deepEqual(plain(r.pick()), { kind: 'prop', engId: 'e1' });
  assert.equal(r.ctx.FL_GEARBOXES[0].engineId, 'e1', 'browser arrays untouched');
});

test('an engine into an empty drive position, or in place of one; a refusal is the server\'s red toast and the picker stays', async () => {
  const r = boot({
    handlers: {
      'POST /v1/fleet/engines/e5/link': refused('position_taken', 'Position Std of Romeo already holds engine E2.'),
      'POST /v1/fleet/engines/e6/link': { body: { id: 'e6' } }, 'GET /v1/fleet/engines/e6': { body: { id: 'e6', boat_id: 'b1', pos: 'Port' } },
    },
  });
  r.pick({ kind: 'eng', engId: 'pos:b1:Starboard' });
  assert.equal(await r.ctx.flEqChoose('e5'), false);
  assert.deepEqual(plain(r.posts()), [['/v1/fleet/engines/e5/link', { boat_id: 'b1', pos: 'Std' }]]);
  assert.equal(r.toasts.at(-1).title, 'Could not put the engine in');
  assert.match(r.toasts.at(-1).sub, /already holds engine E2/);
  assert.equal(r.confirms.length, 0, 'position_taken is not a "do it anyway"');
  assert.deepEqual(plain(r.pick()), { kind: 'eng', engId: 'pos:b1:Starboard' });

  r.pick({ kind: 'eng', engId: 'e1' });
  assert.equal(await r.ctx.flEqChoose('e6'), true);
  assert.deepEqual(plain(r.posts().at(-1)), ['/v1/fleet/engines/e6/link', { replace_id: 'e1', spare_location: 'pier:tublamu' }]);
  assert.equal(r.pick(), null);
});

test('take out: the engine (gearbox stays waiting on the boat), the gearbox, or the active propeller of that engine', async () => {
  const ok = (id) => ({ body: { id } });
  const r = boot({ handlers: { 'POST /v1/fleet/engines/e1/unlink': ok('e1'), 'POST /v1/fleet/gearboxes/g1/unlink': ok('g1'), 'POST /v1/fleet/propellers/p1/unlink': ok('p1'), 'GET /v1/fleet/engines/e1': { body: { id: 'e1' } } , 'GET /v1/fleet/gearboxes/g1': { body: { id: 'g1' } }, 'GET /v1/fleet/propellers/p1': { body: { id: 'p1' } } } });
  // each take-out refetches the chain, so put the local rows back between calls
  const reset = () => vm.runInContext(`FL_GEARBOXES.length = 0; FL_GEARBOXES.push({ id: 'g1', serial: 'G1', engineId: 'e1' }); FL_PROPELLERS.length = 0; FL_PROPELLERS.push({ id: 'p0', serial: 'P0', gearboxId: 'g1', status: 'spare' }, { id: 'p1', serial: 'P1', gearboxId: 'g1', status: 'active' }); FL_ENGINES.length = 0; FL_ENGINES.push({ id: 'e1', serial: 'E1', boatId: 'b1', pos: 'Port' });`, r.ctx);
  reset(); r.pick({ kind: 'prop', engId: 'e1' });
  assert.equal(await r.ctx.flEqTakeOut('prop', 'e1'), true);
  reset(); assert.equal(await r.ctx.flEqTakeOut('gb', 'e1'), true);
  reset(); assert.equal(await r.ctx.flEqTakeOut('eng', 'e1'), true);
  assert.deepEqual(plain(r.posts()), [
    ['/v1/fleet/propellers/p1/unlink', { spare_location: 'pier:tublamu' }],
    ['/v1/fleet/gearboxes/g1/unlink', { spare_location: 'pier:tublamu' }],
    ['/v1/fleet/engines/e1/unlink', { spare_location: 'pier:tublamu' }],
  ]);
  assert.deepEqual(r.confirms, ['Remove propeller P1?', 'Remove gearbox G1? Its propeller goes with it.', 'Remove engine E1 from Romeo? The gearbox stays on the boat at this position (waiting for an engine).']);
  assert.equal(r.pick(), null);
  assert.deepEqual(plain(r.ctx.legacy), []);
});

test('take out answered No sends nothing', async () => {
  const r = boot({ confirm: () => false });
  assert.equal(r.ctx.flEqTakeOut('eng', 'e1'), null);
  assert.deepEqual(r.posts(), []);
});

test('"ผูกคู่นี้เลย" and the gearbox page\'s "ผูกกับ <engine>" link the gearbox to that engine through the server', async () => {
  const r = boot({ handlers: { 'POST /v1/fleet/gearboxes/g2/link': { body: { id: 'g2' } }, 'GET /v1/fleet/gearboxes/g2': { body: SERVER.gearboxes[0] } } });
  assert.equal(await r.ctx.flEqLinkPair('g2', 'e2'), true);
  assert.equal(await r.ctx.flEqQuickLink('g2', 'e1'), true);
  assert.deepEqual(plain(r.posts()), [['/v1/fleet/gearboxes/g2/link', { engine_id: 'e2' }], ['/v1/fleet/gearboxes/g2/link', { engine_id: 'e1' }]]);
  assert.deepEqual(plain(r.ctx.legacy), []);
});

test('outside ops mode (lk-inbox itself) the legacy functions run', () => {
  const r = boot({ enabled: false });
  r.ctx.flEqChoose('g2'); r.ctx.flEqTakeOut('eng', 'e1'); r.ctx.flEqLinkPair('g2', 'e1'); r.ctx.flEqQuickLink('g2', 'e1');
  assert.deepEqual(plain(r.ctx.legacy), ['choose', 'takeout', 'pair', 'quick']);
  assert.deepEqual(r.requests, []);
});
