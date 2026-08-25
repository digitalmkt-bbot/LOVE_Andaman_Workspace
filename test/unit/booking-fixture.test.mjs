// Unit tests for the DOM-free booking fixture (test/fixtures/booking.mjs).
// Zero external dependencies — uses only Node's built-in test runner and assert module
// (stable since Node 18), so this always runs in CI with no devDependency additions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBooking, buildTrip, buildPassenger, zzTestId, CANCELLED_STATUSES } from '../fixtures/booking.mjs';

test('buildBooking() produces a record with every field the relational write path reads', () => {
  const bk = buildBooking();
  assert.equal(typeof bk.id, 'string');
  assert.ok(bk.id.startsWith('zz_test_'), 'fixture ids must be scratch-prefixed (CLAUDE.md §4)');
  assert.equal(typeof bk.schemaVer, 'number');
  assert.equal(typeof bk.leadPax, 'string');
  assert.ok(Array.isArray(bk.trips) && bk.trips.length > 0);
  assert.ok(Array.isArray(bk.passengers) && bk.passengers.length > 0);
  assert.ok(Array.isArray(bk.history) && bk.history.length > 0);
  assert.ok(bk.priceBreakdown && typeof bk.priceBreakdown.total === 'number');
  assert.ok(bk.paymentSnapshot && typeof bk.paymentSnapshot.method === 'string');
  assert.ok(bk.ops && typeof bk.ops === 'object');
});

test('buildBooking() defaults to a non-cancelled status', () => {
  const bk = buildBooking();
  assert.ok(!CANCELLED_STATUSES.includes(bk.status), 'default fixture must be counted by aggregates, not excluded');
});

test('buildBooking() top-level overrides win, unspecified fields keep their default', () => {
  const bk = buildBooking({ status: 'pending_approval', leadPax: 'Custom Lead' });
  assert.equal(bk.status, 'pending_approval');
  assert.equal(bk.leadPax, 'Custom Lead');
  assert.equal(bk.hotelName, 'Zz Test Hotel', 'fields not overridden keep the fixture default');
});

test('buildBooking() honors an explicit id instead of generating one', () => {
  const bk = buildBooking({ id: 'zz_test_fixed_id' });
  assert.equal(bk.id, 'zz_test_fixed_id');
});

test('two default fixtures never collide on id', () => {
  const a = buildBooking();
  const b = buildBooking();
  assert.notEqual(a.id, b.id);
});

test('buildTrip() matches the sb_bookings__trips pax split (field_mapping.json)', () => {
  const trip = buildTrip();
  assert.equal(typeof trip.routeId, 'string');
  assert.match(trip.date, /^\d{4}-\d{2}-\d{2}$/, 'date must be plain YYYY-MM-DD, no time/zone suffix');
  assert.ok(trip.pax);
  for (const k of ['ad_fr', 'ad_th', 'chd_fr', 'chd_th', 'inf_fr', 'inf_th', 'foc_fr', 'foc_th']) {
    assert.equal(typeof trip.pax[k], 'number', `trip.pax.${k} must be a number`);
  }
  assert.equal(trip.bookingMode, 'seat');
});

test('buildTrip() overrides support charter mode without carrying seat-mode assumptions', () => {
  const trip = buildTrip({ bookingMode: 'charter', charterBoatId: 'zz_test_boat', pax: { ad: 12 } });
  assert.equal(trip.bookingMode, 'charter');
  assert.equal(trip.charterBoatId, 'zz_test_boat');
});

test('buildPassenger() defaults are a valid sb_bookings__passengers row', () => {
  const p = buildPassenger();
  assert.equal(typeof p.name, 'string');
  assert.equal(typeof p.nationality, 'string');
  assert.equal(typeof p.foc, 'boolean');
});

test('zzTestId() is prefixed and unique across calls', () => {
  const ids = new Set(Array.from({ length: 50 }, () => zzTestId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.ok(id.startsWith('zz_test_'));
});
