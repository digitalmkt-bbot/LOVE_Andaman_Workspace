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
