import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// lk-inbox sync 2026-11-04 (§vanLog / §vanGuard): the van history and the reason for taking a van off a picked-up booking are the
// server's (operation-backend van-audit). The browser asks for the reason when the server refuses without one, and its own scan is off.
const REFUSAL = 'These bookings were already picked up by van (or the trip date has passed).\n'
  + 'Removing or changing their outbound van changes the van bill and the pickup record.\n\n'
  + '- GYG2Q88XBVYH · 3 Nov · van checked in · Van 7 -> (none)\n\nSend the reason (header X-Van-Reason) to continue.';
const refuseOnce = () => {
  let n = 0;
  return () => (++n === 1 ? { status: 409, body: { message: REFUSAL, code: 'van_reason_required' } } : { status: 204 });
};
const local = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

test('§vanGuard: a van command refused for a reason asks once, then sends it again with the reason (URI-encoded header)', async () => {
  const asked = [];
  const r = runtime({ handlers: { 'DELETE /operations/van-groups/g1': refuseOnce() }, globals: { localStorage: local, prompt: (m) => { asked.push(m); return '  ลูกค้าย้ายโรงแรม '; } } });
  await r.O.del('/operations/van-groups/g1');
  assert.equal(asked.length, 1);
  assert.match(asked[0], /GYG2Q88XBVYH · 3 Nov · van checked in/);
  assert.doesNotMatch(asked[0], /X-Van-Reason/, 'the header name is not for staff');
  assert.match(asked[0], /press Cancel to keep the van/);
  assert.deepEqual(r.requests.map((q) => (q.headers || {})['X-Van-Reason'] || null), [null, encodeURIComponent('ลูกค้าย้ายโรงแรม')]);
});

test('§vanGuard: Cancel (or a blank reason) keeps the van: nothing is sent again, the caller gets the refusal as declined', async () => {
  for (const answer of [null, '   ']) {
    const r = runtime({ handlers: { 'DELETE /operations/van-groups/g1': refuseOnce() }, globals: { localStorage: local, prompt: () => answer } });
    const e = await r.O.del('/operations/van-groups/g1').then(() => null, (x) => x);
    assert.equal(e.code, 'van_reason_required');
    assert.equal(e.declined, true);
    assert.equal(r.requests.length, 1);
  }
});

test('§vanGuard: a refusal that still comes back with a reason is not asked again', async () => {
  let asked = 0;
  const r = runtime({ handlers: { 'POST /operations/van-groups/clear': { status: 409, body: { message: REFUSAL, code: 'van_reason_required' } } },
    globals: { localStorage: local, prompt: () => { asked++; return 'x'; } } });
  const e = await r.O.post('/operations/van-groups/clear', { service_date: '2026-11-03', route_id: 'r1' }).then(() => null, (x) => x);
  assert.equal(e.code, 'van_reason_required');
  assert.deepEqual([asked, r.requests.length], [1, 2]);
});

test('§vanGuard: other refusals are untouched', async () => {
  let asked = 0;
  const r = runtime({ handlers: { 'DELETE /operations/van-groups/g1': { status: 409, body: { message: 'no', code: 'cancelled' } } }, globals: { localStorage: local, prompt: () => { asked++; return 'x'; } } });
  const e = await r.O.del('/operations/van-groups/g1').then(() => null, (x) => x);
  assert.deepEqual([e.code, !!e.declined, asked], ['cancelled', false, 0]);
});

test('§vanLog: in ops mode the browser\'s own van scan does nothing (the server writes the lines); with ops off it runs', () => {
  const pre = 'var scans = 0; function bkVanAuditScan(){ scans++; return 1; }';
  const on = runtime({ files: ['34-ops-vans.js'], pre, globals: { localStorage: local } });
  assert.deepEqual([on.ctx.bkVanAuditScan(), on.ctx.scans], [0, 0]);
  const off = runtime({ files: ['34-ops-vans.js'], pre, enabled: false, globals: { localStorage: local } });
  assert.deepEqual([off.ctx.bkVanAuditScan(), off.ctx.scans], [1, 1]);
  assert.deepEqual(plain(on.requests), []);
});
