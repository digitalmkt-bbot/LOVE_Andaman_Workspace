// §cxWhy (ops/41-ops-cancel-reason.js): the reason of a booking cancelled without one goes to POST /v1/bookings/{id}/cancel-reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

function setup({ handler, picked = { c: 'sick', n: 'fever' }, legacy = [] } = {}) {
  const bk = { id: 'BK-1', opsId: 'bk_1', opsVersion: 7, status: 'cancelled' };
  const inputs = { 'cxw-c-0': { value: picked.c }, 'cxw-n-0': { value: picked.n } };
  const drawn = [], upserts = [];
  const r = runtime({
    globals: {
      SB_BOOKINGS: [bk], setTimeout: () => 0, clearTimeout: () => {},
      document: { getElementById: (id) => inputs[id] || null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
      cxwSave: (...a) => { legacy.push(a); return 'legacy'; },
      cxwNeed: (b) => !b.cancelCategory, cxwCanEdit: () => true,
      cxwRender: () => drawn.push('dialog'), bookingV2Render: () => drawn.push('booking'),
    },
    handlers: { 'POST /v1/bookings/bk_1/cancel-reason': handler || ((body) => ({ body: { id: 'bk_1', version: 8, status: 'cancelled', cancellation: { category: body.category } } })) },
    pre: 'window.laOps = window.laOps || {};',
  });
  r.O.bookings = { upsert: (ob) => { upserts.push(plain(ob)); bk.cancelCategory = ob.cancellation.category; return true; } };
  r.load('41-ops-cancel-reason.js');
  return { ...r, bk, drawn, upserts, legacy };
}

test('the picked reason is sent with the version read; the answer replaces the booking and the screen redraws', async () => {
  const { ctx, requests, bk, drawn, upserts } = setup();
  assert.equal(await ctx.cxwSave('BK-1', 0), true);
  assert.deepEqual(requests.map((q) => [q.method, q.path, q.body, q.headers['If-Match']]), [['POST', '/v1/bookings/bk_1/cancel-reason', { category: 'sick', note: 'fever' }, '"7"']]);
  assert.equal(bk.opsVersion, 8);
  assert.equal(upserts[0].cancellation.category, 'sick');
  assert.ok(drawn.includes('dialog') && drawn.includes('booking'));
});

test('"other" needs a note and nothing is sent without one; a refusal says so and changes nothing', async () => {
  const noNote = setup({ picked: { c: 'other', n: '' } });
  assert.equal(await noNote.ctx.cxwSave('BK-1', 0), false);
  assert.deepEqual(noNote.alerts, ['Please add a note for "Other".']);
  assert.equal(noNote.requests.length, 0);

  const refused = setup({ handler: () => ({ status: 409, body: { statusCode: 409, code: 'reason_set', message: 'Booking bk_1 already has a cancellation reason' } }) });
  assert.equal(await refused.ctx.cxwSave('BK-1', 0), false);
  assert.equal(refused.upserts.length, 0);
  assert.equal(refused.bk.cancelCategory, undefined);
  assert.ok(refused.toasts.some((t) => /already has a cancellation reason/.test(JSON.stringify(t))), JSON.stringify(refused.toasts));
});

// §cxwList · the red bar's list is the server's (GET /v1/bookings/cancelled-without-reason), not what this browser loaded.
function listSetup({ pier = '' } = {}) {
  const served = [
    { id: 'lg_b2c_LOV-1_1', external_id: 'b2c_LOV-1_1', version: 3, code: 'b2c_LOV-1_1', voucher_ref: 'LOV-1', lead_pax: 'Ann', agent_id: 'a_b2c', b2c: true,
      last_date: '2026-10-02', route_id: 'r10', route_name: 'Phi Phi', route_ids: ['r10'], pax: 2, cancelled_at: '2026-10-01T03:00:00.000Z' },
    { id: 'bk_9', external_id: null, version: 5, code: 'BK-9', voucher_ref: null, lead_pax: 'Bob', agent_id: 'a1', b2c: false,
      last_date: '2026-10-05', route_id: 'r1', route_name: 'Racha', route_ids: ['r1'], pax: 3, cancelled_at: null },
  ];
  const inputs = { 'cxw-c-0': { value: 'sick' }, 'cxw-n-0': { value: '' } };
  const drawn = [];
  const r = runtime({
    globals: {
      SB_BOOKINGS: [], setTimeout: () => 0, clearTimeout: () => {},
      document: { getElementById: (id) => inputs[id] || null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
      laMyPier: () => pier,
      cxwList: () => ['legacy'], cxwIsB2C: (b) => /^b2c_/.test(String((b && b.id) || '')),
      cxwSave: () => 'legacy', cxwNeed: (b) => b.status === 'cancelled' && !b.cancelCategory, cxwCanEdit: () => true,
      cxwRender: () => drawn.push('dialog'), bookingV2Render: () => drawn.push('booking'),
    },
    handlers: {
      'GET /v1/bookings/cancelled-without-reason': () => ({ body: { as_of: '2026-11-24', from: '2026-09-25', days: 60, count: served.length, pax: 5, b2c_count: 1, bookings: served } }),
      'POST /v1/bookings/bk_9/cancel-reason': (body) => ({ body: { id: 'bk_9', version: 6, status: 'cancelled', cancellation: { category: body.category } } }),
    },
    pre: 'window.laOps = window.laOps || {};',
  });
  r.O.bookings = { upsert: () => true };
  r.load('41-ops-cancel-reason.js');
  return { ...r, drawn };
}

test('cxwList answers with the server’s rows, shaped as legacy’s bookings; the first answer redraws the Booking screen', async () => {
  const { ctx, requests, settle, drawn } = listSetup();
  assert.deepEqual(plain(ctx.cxwList()), [], 'nothing until the server answers');
  await settle();
  assert.deepEqual(requests.map((q) => [q.method, q.path]), [['GET', '/v1/bookings/cancelled-without-reason']]);
  assert.ok(drawn.includes('booking'), 'the answer redraws the bar and the badge');
  const list = plain(ctx.cxwList());
  assert.equal(requests.length, 1, 'a fresh list is not asked again');
  assert.deepEqual(list.map((b) => [b.id, b.opsId, b.opsVersion, b.voucherRef, b.leadPax, b.trips[0].routeId, b.trips[0].date, b.trips[0].pax.ad, b.cancelledAt]), [
    ['b2c_LOV-1_1', 'lg_b2c_LOV-1_1', 3, 'LOV-1', 'Ann', 'r10', '2026-10-02', 2, '2026-10-01T03:00:00.000Z'],
    ['bk_9', 'bk_9', 5, '', 'Bob', 'r1', '2026-10-05', 3, ''],
  ]);
  assert.deepEqual(list.map((b) => ctx.cxwIsB2C(b)), [true, false], 'B2C as the server says');
});

test('a pier login asks for its pier; a reason saved for a row the browser never loaded goes with its version and leaves the list', async () => {
  const { ctx, requests, settle } = listSetup({ pier: 'ranong' });
  ctx.cxwList(); await settle();
  assert.equal(requests[0].path, '/v1/bookings/cancelled-without-reason?pier=ranong');
  assert.equal(await ctx.cxwSave('bk_9', 0), true);
  const post = requests.find((q) => q.method === 'POST');
  assert.deepEqual([post.path, post.body, post.headers['If-Match']], ['/v1/bookings/bk_9/cancel-reason', { category: 'sick' }, '"5"']);
  assert.deepEqual(plain(ctx.cxwList()).map((b) => b.id), ['b2c_LOV-1_1']);
});
