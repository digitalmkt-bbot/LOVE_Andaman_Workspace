import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// §b2cFeed · the change feed draws legacy's new-B2C-booking card (_laB2CAlert) for a created b2c_ booking.
const SOURCE = fs.readFileSync('allotment_v2/js/ops/70-ops-changes.js', 'utf8');

async function feed(changes, { me = 'staff', bookings = {} } = {}) {
  const alerts = [], toasts = [], reads = [], timers = [];
  let calls = 0;
  const window = { LA_LEGACY_UNAVAILABLE: true, LA_ME: { username: me } };
  window._laB2CAlert = (list) => alerts.push(JSON.parse(JSON.stringify(list)));
  window.bookingV2FromOpsBooking = (ob) => ({ id: ob.external_id || ob.id, status: ob.status, voucherRef: ob.voucher_ref, leadPax: ob.lead, trips: ob.trips, priceBreakdown: { total: ob.total }, paymentSnapshot: { paidStatus: ob.paid } });
  window.laOps = {
    enabled: () => true, state: { loaded: true }, changed: () => {}, wrote: () => {}, onChange: () => {},
    toast: (t) => toasts.push(t),
    get: async (path, q) => {
      if (path === '/v1/changes') { calls += 1; return calls === 1 ? { version: 5, changes: [] } : { version: 9, changes }; }
      reads.push(path);
      const id = decodeURIComponent(path.split('/').pop());
      if (!bookings[id]) throw new Error('404');
      return bookings[id];
    },
  };
  const document = { hidden: false, addEventListener: () => {}, querySelector: () => null };
  const ctx = { window, document, console, Promise, Number, Array, String, Object, JSON, Math, Date, RegExp,
    ROUTES: [{ id: 'r5', name: 'Phi Phi Islands', pier: 'tublamu' }],
    setInterval: () => 0, setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {} };
  vm.runInNewContext(SOURCE, ctx);
  await window.laOps.changes.pull();      // baseline
  await new Promise((r) => setImmediate(r));
  await window.laOps.changes.pull();      // the changes
  await new Promise((r) => setImmediate(r));
  timers.splice(0).forEach((f) => f());   // the burst timer
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  return { alerts, toasts, reads };
}
const B2C = (id, extra = {}) => ({ id, external_id: id, status: 'confirmed', voucher_ref: 'BK-' + id.split('-')[1].slice(0, 3), lead: 'ANNA K', total: 3200, paid: 'paid',
  trips: [{ date: '2026-11-02', routeId: 'r5', pax: { ad_fr: 2, chd_fr: 1 } }], ...extra });

test('a created b2c_ booking draws the card with its route, pier, pax, total and lead; no generic toast', async () => {
  const { alerts, toasts, reads } = await feed([{ kind: 'booking', action: 'created', entity_id: 'b2c_BK-001_1', version: 6, changed_by: 'lk-site' }], { bookings: { 'b2c_BK-001_1': B2C('b2c_BK-001_1') } });
  assert.deepEqual(reads, ['/v1/bookings/b2c_BK-001_1']);
  assert.equal(alerts.length, 1);
  assert.deepEqual(alerts[0], [{ id: 'b2c_BK-001_1', ref: 'BK-001', route: 'Phi Phi Islands', port: 'Tub Lamu', date: '2026-11-02', pax: 3, total: 3200, lead: 'ANNA K', paid: 'paid', trips: 1 }]);
  assert.equal(toasts.length, 0, 'the card replaces the generic New booking toast');
});

test('a burst of created b2c_ bookings is one card; a cancelled one is left out', async () => {
  const { alerts } = await feed([
    { kind: 'booking', action: 'created', entity_id: 'b2c_BK-002_1', version: 6 },
    { kind: 'booking', action: 'created', entity_id: 'b2c_BK-003_1', version: 7 },
    { kind: 'booking', action: 'created', entity_id: 'b2c_BK-004_1', version: 8 },
  ], { bookings: { 'b2c_BK-002_1': B2C('b2c_BK-002_1'), 'b2c_BK-003_1': B2C('b2c_BK-003_1'), 'b2c_BK-004_1': B2C('b2c_BK-004_1', { status: 'cancelled' }) } });
  assert.equal(alerts.length, 1);
  assert.deepEqual(alerts[0].map((x) => x.id), ['b2c_BK-002_1', 'b2c_BK-003_1']);
});

test('a staff booking, an update of a b2c booking, and a change made by this login draw no card and read nothing', async () => {
  const { alerts, toasts, reads } = await feed([
    { kind: 'booking', action: 'created', entity_id: 'bk_77', version: 6, changed_by: 'other' },
    { kind: 'booking', action: 'updated', entity_id: 'b2c_BK-005_1', version: 7 },
    { kind: 'booking', action: 'created', entity_id: 'b2c_BK-006_1', version: 8, changed_by: 'staff' },
  ]);
  assert.equal(alerts.length, 0);
  assert.equal(reads.length, 0);
  assert.ok(toasts.length >= 1, 'a staff booking still gets the ordinary toast');
});
