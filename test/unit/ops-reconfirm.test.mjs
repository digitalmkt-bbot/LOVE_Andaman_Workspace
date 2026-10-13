import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/39-ops-reconfirm.js', 'utf8');

// A minimal stand-in for 00-ops-core.js: same surface, requests recorded, responses scripted by the test.
function runtime({ enabled = true, respond } = {}) {
  const calls = [];
  const failures = [];
  const upserts = [];
  const wrote = [];
  const window = {
    laOps: {
      enabled: () => enabled,
      call: (method, path, body) => {
        calls.push({ method, path, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)) });
        return respond(method, path, body);
      },
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (kind) => wrote.push(kind),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
      clone: (x) => (x == null ? x : JSON.parse(JSON.stringify(x))),
      bookings: { upsert: (ob) => upserts.push(ob) },
    },
    confirm: () => true,
    bookingV2Render: () => {},
  };
  const SB_BOOKINGS = [
    {
      id: 'bk_client_1', opsId: 'bk_srv_1', status: 'confirmed',
      trips: [{ date: '2026-10-12', routeId: 'r1' }], ops: {},
    },
    {
      id: 'bk_client_2', opsId: 'bk_srv_2', status: 'cancelled',
      trips: [{ date: '2026-10-12', routeId: 'r1' }], ops: {},
    },
    {
      id: 'bk_client_3', opsId: 'bk_srv_3', status: 'confirmed',
      trips: [{ date: '2026-10-12', routeId: 'r1' }], ops: { reconfirm: { status: 'done' } },
    },
    {
      id: 'bk_client_4', opsId: 'bk_srv_4', status: 'confirmed',
      trips: [{ date: '2026-10-12', routeId: 'r1' }], ops: {},
    },
  ];
  // Legacy originals, to prove legacy mode delegates exactly.
  const legacyCalls = [];
  window.bookingV2Reconfirm = (bkId, via) => { legacyCalls.push(['bookingV2Reconfirm', bkId, via]); return 'legacy'; };
  window.bookingV2ReconfirmClear = (bkId) => { legacyCalls.push(['bookingV2ReconfirmClear', bkId]); return 'legacy'; };
  window.bookingV2ReconfirmAll = (date, rid, via) => { legacyCalls.push(['bookingV2ReconfirmAll', date, rid, via]); return 'legacy'; };

  const ctx = {
    window, SB_BOOKINGS, console, Promise, JSON, Object, Array, String, Number, Math, Date,
    encodeURIComponent, parseInt,
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, SB_BOOKINGS, calls, failures, upserts, wrote, legacyCalls };
}

const serverBooking = (over = {}) => ({
  id: 'bk_srv_1', external_id: 'bk_client_1', version: 7, status: 'confirmed',
  reconfirm: { status: 'done', via: 'list', at: '2026-10-12T08:00:00Z', by: 'RM', sent: false, sent_at: null, sent_by: null },
  ...over,
});

test('reconfirm response maps to the legacy bk.ops.reconfirm shape', () => {
  const rt = runtime({ respond: async () => serverBooking() });
  const c = rt.window.__laOpsReconfirmCompat;
  assert.deepEqual(c.reconfirmFromServer(null), null);
  assert.deepEqual(JSON.parse(JSON.stringify(c.reconfirmFromServer({ status: 'wa', via: 'reconfirm', at: 'T', by: 'X', sent: true, sent_at: 'S', sent_by: 'Y' }))), {
    status: 'wa', via: 'reconfirm', at: 'T', by: 'X', sent: true, sentAt: 'S', sentBy: 'Y',
  });
});

test('ops mode: PUT /v1/bookings/:id/reconfirm with {status:"done", via} and no local change before the answer', async () => {
  let release;
  const rt = runtime({
    respond: () => new Promise((resolve) => { release = () => resolve(serverBooking()); }),
  });
  const pending = rt.window.bookingV2Reconfirm('bk_client_1', 'phone');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(rt.calls, [{ method: 'PUT', path: '/v1/bookings/bk_srv_1/reconfirm', body: { status: 'done', via: 'phone' } }]);
  assert.equal(rt.SB_BOOKINGS[0].ops.reconfirm, undefined, 'nothing is shown before the server answers');
  assert.equal(rt.upserts.length, 0);

  release();
  await pending;
  assert.equal(rt.SB_BOOKINGS[0].ops.reconfirm.status, 'done');
  assert.equal(rt.SB_BOOKINGS[0].ops.reconfirm.via, 'list');
  assert.equal(rt.SB_BOOKINGS[0].ops.reconfirm.sent, false);
  assert.equal(rt.upserts.length, 1);
  assert.deepEqual(rt.wrote, ['booking-reconfirm']);
});

test('ops mode: a via other than phone is sent as list (legacy default)', async () => {
  const rt = runtime({ respond: async () => serverBooking() });
  await rt.window.bookingV2Reconfirm('bk_client_1');
  assert.deepEqual(rt.calls[0].body, { status: 'done', via: 'list' });
});

test('ops mode: a rejected reconfirm leaves local state alone and reports the failure', async () => {
  const rt = runtime({
    respond: async () => { const e = new Error('Booking is cancelled'); e.status = 409; throw e; },
  });
  const before = JSON.stringify(rt.SB_BOOKINGS[0]);
  const out = await rt.window.bookingV2Reconfirm('bk_client_1', 'list');
  assert.equal(out, null);
  assert.equal(JSON.stringify(rt.SB_BOOKINGS[0]), before, 'no projection change after a refusal');
  assert.equal(rt.upserts.length, 0);
  assert.deepEqual(rt.wrote, []);
  assert.equal(rt.failures.length, 1);
  assert.equal(rt.failures[0].message, 'Booking is cancelled');
});

test('ops mode: clear sends DELETE ?all=true (legacy drops the whole record)', async () => {
  const rt = runtime({ respond: async () => serverBooking({ reconfirm: null }) });
  await rt.window.bookingV2ReconfirmClear('bk_client_1');
  assert.deepEqual(rt.calls, [{ method: 'DELETE', path: '/v1/bookings/bk_srv_1/reconfirm?all=true', body: undefined }]);
  assert.equal(rt.SB_BOOKINGS[0].ops.reconfirm, null);
});

test('ops mode: bulk sends one PUT per live, not-yet-done booking on that route and day', async () => {
  const rt = runtime({ respond: async (method, path) => serverBooking({ id: path.split('/')[3], external_id: null }) });
  assert.deepEqual(rt.window.__laOpsReconfirmCompat.bulkTargets('2026-10-12', 'r1').map((b) => b.id), ['bk_client_1', 'bk_client_4']);
  await rt.window.bookingV2ReconfirmAll('2026-10-12', 'r1', 'list');
  assert.deepEqual(rt.calls.map((c) => [c.method, c.path, c.body]), [
    ['PUT', '/v1/bookings/bk_srv_1/reconfirm', { status: 'done', via: 'list' }],
    ['PUT', '/v1/bookings/bk_srv_4/reconfirm', { status: 'done', via: 'list' }],
  ]);
  assert.deepEqual(rt.wrote, ['booking-reconfirm-all']);
});

test('ops mode: bulk stops at the first refusal and keeps what was already saved', async () => {
  let n = 0;
  const rt = runtime({
    respond: async (method, path) => {
      n++;
      if (n === 2) { const e = new Error('nope'); e.status = 403; throw e; }
      return serverBooking({ id: path.split('/')[3], external_id: null });
    },
  });
  await rt.window.bookingV2ReconfirmAll('2026-10-12', 'r1', 'phone');
  assert.equal(rt.calls.length, 2);
  assert.equal(rt.upserts.length, 1, 'the first booking is applied; the refused one is not');
  assert.equal(rt.failures.length, 1);
});

test('legacy mode: every wrapper delegates to the original and makes no API request', async () => {
  const rt = runtime({ enabled: false, respond: async () => { throw new Error('must not be called'); } });
  assert.equal(rt.window.bookingV2Reconfirm('bk_client_1', 'list'), 'legacy');
  assert.equal(rt.window.bookingV2ReconfirmClear('bk_client_1'), 'legacy');
  assert.equal(rt.window.bookingV2ReconfirmAll('2026-10-12', 'r1', 'list'), 'legacy');
  assert.deepEqual(rt.legacyCalls, [
    ['bookingV2Reconfirm', 'bk_client_1', 'list'],
    ['bookingV2ReconfirmClear', 'bk_client_1'],
    ['bookingV2ReconfirmAll', '2026-10-12', 'r1', 'list'],
  ]);
  assert.deepEqual(rt.calls, []);
});
