import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/77-ops-van-job-list.js', 'utf8');
const D = '2026-11-23';

function hook(jobs) {
  const ctx = { console, Object, Array, String, Number, JSON, Math };
  ctx.window = ctx;
  ctx.laOps = { enabled: () => true, vanJobs: { dayRead: (d) => (d === D ? { jobs, unassigned: {}, return_unarranged: [], self_arrive: [], struck: 0 } : null), jobKey: (d, k) => d + '::' + k } };
  vm.runInNewContext(SOURCE, ctx);
  return ctx.opsVanJobsList(D);
}

test('§vjRetExtra: the "↩ ขากลับ N" badge is the job\'s ret_extra_pax / ret_extra_bookings (no sheet read)', () => {
  const out = hook([
    { van_id: 'veh1', route_id: 'r1', has_out: true, has_ret: true, pax: 7, bookings: 3, struck: 0, ret_extra_pax: 4, ret_extra_bookings: 2 },
    { van_id: 'veh2', route_id: 'r1', has_out: true, has_ret: true, pax: 5, bookings: 2, struck: 0, ret_extra_pax: 0, ret_extra_bookings: 0 },
  ]);
  assert.equal(out.agg['veh1~r1'].pax, 7);
  assert.deepEqual([out.aggRet['veh1~r1'].pax, out.aggRet['veh1~r1'].bk], [4, 2]);
  assert.equal(out.aggRet['veh2~r1'], undefined, 'no extra on the way back: no badge');
});

test('a return-only job still counts its whole return load', () => {
  const out = hook([{ van_id: 'veh3', route_id: 'r2', has_out: false, has_ret: true, ret_pax: 6, bookings: 2, struck: 1 }]);
  assert.deepEqual([out.aggRet['veh3~r2'].pax, out.aggRet['veh3~r2'].bk, out.aggRet['veh3~r2'].sx], [6, 2, 1]);
  assert.equal(out.agg['veh3~r2'], undefined);
});

test('parity M2: one fleet side only (legacy §rnVan2 laFleetRouteOk): a Ranong programme is left out of the Phuket side', () => {
  const ctx = { console, Object, Array, String, Number, JSON, Math };
  ctx.window = ctx;
  ctx.laFleetRouteOk = (rid) => rid !== 'rRN';
  const day = { jobs: [{ van_id: 'v1', route_id: 'r6', has_out: true, pax: 4, bookings: 1, struck: 0 }, { van_id: 'v2', route_id: 'rRN', has_out: true, pax: 9, bookings: 1, struck: 0 }],
    unassigned: { pax: 96, by_route: [{ route_id: 'r6', pax: 39 }, { route_id: 'rRN', pax: 57 }] },
    return_unarranged: [{ route_id: 'rRN', pax: 2, lead_pax: 'X' }], self_arrive: [{ route_id: 'rRN', booking_id: 'b1' }, { route_id: 'r6', booking_id: 'b2' }], struck: 0 };
  ctx.laOps = { enabled: () => true, vanJobs: { dayRead: () => day, jobKey: (d, k) => d + '::' + k } };
  vm.runInNewContext(SOURCE, ctx);
  const out = ctx.opsVanJobsList(D);
  assert.equal(out.unTot, 39, 'a wrong 96 counts the Ranong side');
  assert.deepEqual(Object.keys(out.unByRoute), ['r6']);
  assert.deepEqual(Object.keys(out.agg), ['v1~r6']);
  assert.equal(out.unRet, 0);
  assert.deepEqual(out.selfWarn.map((r) => r.vc), ['b2']);
});
