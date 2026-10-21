import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const DEPLOY = fs.readFileSync('allotment_v2/js/ops/20-ops-deployments.js', 'utf8');

function runtime(rowsByRange) {
  const requests = [];
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Number, String, Math, Date, setTimeout, clearTimeout,
    LA_LEGACY_UNAVAILABLE: true,
    sessionStorage: { getItem: () => 'tok' },
    TRIPS: {}, BOAT_CAP_OVR: {},
    getBoat: (id) => ({ id, cap: 30 }),
    document: { getElementById: () => null, querySelector: () => null },
    save: () => {}, boatCapPersist: () => {},
  };
  ctx.window = ctx;
  ctx.laOpsFetch = async (path) => {
    requests.push(path);
    const u = new URL('http://x' + path);
    const rows = (rowsByRange(u.searchParams.get('from'), u.searchParams.get('to')) || []);
    return { status: 200, ok: true, text: async () => JSON.stringify({ deployments: rows }) };
  };
  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);
  vm.runInContext(DEPLOY, ctx);
  return { ctx, requests, O: ctx.laOps };
}
const dep = (date, boat, route = 'r1', capacity = 30) => ({ service_date: date, boat_id: boat, route_id: route, capacity, trip_type: 'normal' });

test('a day outside the boot window is read on demand and joins TRIPS without being pushed back', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const far = '2031-03-05';
  const rt = runtime((from, to) => (from === far ? [dep(far, 'boatA'), dep(far, 'boatB', 'r2', 25)] : []));
  await rt.O.deployments.load();
  assert.equal(rt.O.deployments.ensure([today]), null, 'a day inside the window asks for nothing');
  const p = rt.O.deployments.ensure([far]);
  assert.ok(p, 'an outside day is fetched');
  assert.equal(await p, true);
  assert.deepEqual(rt.requests.slice(-1), ['/operations/deployments?from=' + far + '&to=' + far]);
  assert.equal(rt.ctx.TRIPS[far].boatA.route, 'r1');
  assert.equal(rt.ctx.TRIPS[far].boatB.route, 'r2');
  assert.equal(rt.O.deployments.ensure([far]), null, 'read once: no second request');
  const before = rt.requests.length;
  await rt.O.deployments.syncNow();
  assert.equal(rt.requests.filter((r) => /POST|DELETE/.test(r)).length, 0);
  assert.equal(rt.requests.length, before, 'the merged cells are "confirmed", so the sync sends nothing for them');
});

test('a cell the person already changed on that day is kept, not overwritten by the server read', async () => {
  const far = '2031-03-06';
  const rt = runtime((from) => (from === far ? [dep(far, 'boatA', 'r1')] : []));
  await rt.O.deployments.load();
  rt.ctx.TRIPS[far] = { boatA: { route: 'r9', type: 'normal', booked: 0 } };
  await rt.O.deployments.ensure([far]);
  assert.equal(rt.ctx.TRIPS[far].boatA.route, 'r9');
});

test('a failed read answers false, keeps what the screen has, and is retried next time', async () => {
  const far = '2031-03-07';
  let fail = true;
  const rt = runtime(() => []);
  rt.ctx.laOpsFetch = async (path) => { rt.requests.push(path); if (fail && /from=2031/.test(path)) throw new Error('down'); return { status: 200, ok: true, text: async () => JSON.stringify({ deployments: [] }) }; };
  await rt.O.deployments.load();
  assert.equal(await rt.O.deployments.ensure([far]), false);
  fail = false;
  assert.equal(await rt.O.deployments.ensure([far]), true, 'asked again after the failure');
});
