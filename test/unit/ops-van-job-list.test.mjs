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
