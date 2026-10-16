import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/28-ops-hotel-names.js', 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));

function runtime({ enabled = true, answers = {}, confirmAnswer = true } = {}) {
  const calls = [], failures = [], toasts = [], reloads = [], legacy = [], renders = [];
  const SB_BOOKINGS = [
    { id: 'b1', opsId: 's1', status: 'confirmed', hotelName: 'Patong  Beach Hotel' },
    { id: 'b2', opsId: 's2', status: 'confirmed', hotelName: 'Other', dropoffHotelName: 'patong beach hotel' },
    { id: 'b3', opsId: 's3', status: 'cancelled', hotelName: 'Patong Beach Hotel' },
    { id: 'b4', opsId: 's4', status: 'confirmed', hotelName: 'Unrelated' },
  ];
  const respond = async (method, path, body) => {
    calls.push({ method, path, body });
    const a = answers[method + ' ' + path];
    if (a instanceof Error) throw a;
    return a;
  };
  const window = {
    laOps: {
      enabled: () => enabled,
      get: (p, q) => respond('GET', p + (q && q.q ? '?q=' + q.q : '')),
      post: (p, b) => respond('POST', p, b),
      queue: (fn) => Promise.resolve().then(fn),
      wrote: () => {},
      toast: (o) => toasts.push(o),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
      bookings: { reload: async (id) => { reloads.push(id); } },
    },
    bookingV2HotelNameList: () => { legacy.push('list'); return ['LocalOnly']; },
    bookingV2HotelDDRender: () => { legacy.push('render'); },
    psuHotelMerge: () => { legacy.push('merge'); return 'legacy'; },
  };
  const ctx = {
    window, SB_BOOKINGS, console, Promise, Array, Object, Error, String, Date,
    document: { getElementById: () => null, activeElement: null },
    confirm: () => confirmAnswer, alert: () => {},
    psuHotelGroups: () => [{ id: 'g1', keep: 'Patong Beach Hotel', items: [{ name: 'Patong Beach Hotel' }, { name: 'Patong  Beach Hotel' }, { name: 'patong beach hotel' }] }],
    _psuHotelPick: {},
    renderPickupSetup: () => renders.push(1),
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, ctx, calls, failures, toasts, reloads, legacy, renders };
}
const tick = () => new Promise((r) => setImmediate(r));

test('merge POSTs from_names/to_name, then reloads the affected live bookings (no hand edit)', async () => {
  const rt = runtime({ answers: { 'POST /v1/hotels/merge': { changed: 2 } } });
  await rt.window.psuHotelMerge('g1');
  assert.deepEqual(rt.calls.map((c) => c.method + ' ' + c.path), ['POST /v1/hotels/merge']);
  assert.deepEqual(plain(rt.calls[0].body), { from_names: ['Patong  Beach Hotel', 'patong beach hotel'], to_name: 'Patong Beach Hotel' });
  assert.deepEqual(rt.reloads.sort(), ['b1', 'b2']);        // not the cancelled one, not the unrelated one
  assert.equal(rt.ctx.SB_BOOKINGS[0].hotelName, 'Patong  Beach Hotel');   // untouched locally: the reload owns it
  assert.match(rt.toasts[0].title, /2 booking/);
  assert.equal(rt.renders.length, 1);
  assert.equal(rt.failures.length, 0);
});

test('a refused merge is a red toast and nothing local changes', async () => {
  const rt = runtime({ answers: { 'POST /v1/hotels/merge': Object.assign(new Error('operations only'), { status: 403 }) } });
  await rt.window.psuHotelMerge('g1');
  assert.equal(rt.failures.length, 1);
  assert.match(rt.failures[0].message, /operations only/);
  assert.equal(rt.reloads.length, 0);
  assert.equal(rt.toasts.length, 0);
  assert.equal(rt.renders.length, 0);
});

test('cancelling the confirm sends nothing', async () => {
  const rt = runtime({ confirmAnswer: false });
  await rt.window.psuHotelMerge('g1');
  assert.equal(rt.calls.length, 0);
});

test('legacy mode delegates merge, list and render', async () => {
  const rt = runtime({ enabled: false });
  assert.equal(rt.window.psuHotelMerge('g1'), 'legacy');
  assert.deepEqual(plain(rt.window.bookingV2HotelNameList()), ['LocalOnly']);
  rt.window.bookingV2HotelDDRender('pat');
  assert.deepEqual(rt.legacy, ['merge', 'list', 'render']);
  assert.equal(rt.calls.length, 0);
});

test('suggestions come from GET /v1/hotel-names (q = typed prefix); filtered tiers stay local', async () => {
  const rt = runtime({ answers: {
    'GET /v1/hotel-names?q=pat': { names: [{ name: 'Patong Beach Hotel', count: 9 }, { name: 'Patong Bay', count: 2 }] },
  } });
  assert.deepEqual(plain(rt.window.bookingV2HotelNameList()), ['LocalOnly']);   // cold cache: legacy
  rt.window.bookingV2HotelDDRender('pat');
  await tick(); await tick();
  assert.deepEqual(rt.calls.map((c) => c.method + ' ' + c.path), ['GET /v1/hotel-names?q=pat']);
  assert.deepEqual(plain(rt.window.bookingV2HotelNameList()), ['Patong Bay', 'Patong Beach Hotel']);
  assert.deepEqual(plain(rt.window.bookingV2HotelNameList(null, 'area1')), ['LocalOnly']);
});

test('a failed suggestion fetch falls back to the legacy list', async () => {
  const rt = runtime({ answers: { 'GET /v1/hotel-names?q=pat': new Error('down') } });
  rt.window.bookingV2HotelDDRender('pat');
  await tick(); await tick();
  assert.deepEqual(plain(rt.window.bookingV2HotelNameList()), ['LocalOnly']);
});
