// The one required end-to-end proof (LAM-22 / S1-08): create a booking through the REAL write
// path — an actual HTTP request into server.js's /api/v1/_batch handler, the same endpoint
// bkV2CommitBooking hits in the browser — and assert the row landed in Postgres by reading it
// back with a separate, independent connection (not the app's own response echo).
//
// Preconditions this test needs and cannot fabricate:
//   1. DATABASE_URL pointing at a reachable Postgres.
//   2. operation_schemas.sb_bookings (+ trip/passenger children) + operation_schemas.users already
//      provisioned. That schema is created by db/migrations/002_add_operation_schemas.sql, which
//      does NOT exist on this branch (removed at 094dde1; LAM-73 decides whether it is rebuilt
//      from pg_get_viewdef, restored as-is, or abandoned — see CLAUDE.md and docs/development/tasks/LAM-22.md).
//
// Verified behavior (see LAM-22.md "Verification" for the exact commands): booted server.js in
// DATA_BACKEND=relational against a bare ephemeral Postgres with NEITHER of the above tables
// present. Boot does not crash — initDb() logs
//   [db] init failed at step "sb_markets.sort col": relation "operation_schemas.sb_markets" does not exist
// and stops before the admin-user seed step ever runs, so /api/login correctly (and safely)
// rejects every credential with a normal 401, never a crash. This test's precondition check
// (hasBookingSchema) mirrors that exact gap so it skips with a clear reason instead of hanging or
// producing a confusing low-level failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, closePool, hasBookingSchema, fetchBookingRow, deleteBooking } from '../helpers/db.mjs';
import { startServer, loginClient } from '../helpers/server.mjs';
import { buildBooking } from '../fixtures/booking.mjs';

const pool = getPool();
let schemaReady = false;
let precheckError = null;
if (pool) {
  try {
    schemaReady = await hasBookingSchema(pool);
  } catch (e) {
    precheckError = e;
  }
}

const skipReason = !process.env.DATABASE_URL
  ? 'DATABASE_URL not set — no Postgres reachable from this environment'
  : precheckError
    ? 'could not query information_schema on DATABASE_URL: ' + precheckError.message
    : !schemaReady
      ? 'operation_schemas.sb_bookings/users not provisioned on this DATABASE_URL — blocked on LAM-73 ' +
        '(db/migrations was removed at 094dde1 and not yet rebuilt/restored)'
      : false;

test(
  'creates a booking through the real write path (/api/v1/_batch) and the row lands in Postgres',
  { skip: skipReason },
  async () => {
    const port = 8792;
    const adminUser = 'zz_test_admin_' + Date.now().toString(36);
    const adminPass = 'zz-test-' + Math.random().toString(36).slice(2);

    const server = await startServer({
      port,
      env: {
        DATABASE_URL: process.env.DATABASE_URL,
        DATA_BACKEND: 'relational',
        SESSION_SECRET: 'zz-test-session-secret',
        ADMIN_USER: adminUser,
        ADMIN_PASS: adminPass,
      },
    });

    let bookingId = null;
    try {
      const client = await loginClient(server.baseUrl, adminUser, adminPass);

      const fixture = buildBooking();
      bookingId = fixture.id;

      const putRes = await client.request('/api/v1/_batch', {
        method: 'POST',
        body: { baseVersion: -1, ops: [{ op: 'put', r: 'sb_bookings', id: fixture.id, body: fixture }] },
      });
      assert.equal(putRes.status, 200, 'batch write should succeed: ' + JSON.stringify(putRes.body));
      assert.ok(putRes.body.ok, 'batch response should report ok:true');

      // Read back via an independent Postgres connection — proves the write is durable in the
      // real store, not just accepted and echoed by the HTTP layer.
      const row = await fetchBookingRow(pool, fixture.id);
      assert.ok(row.booking, 'booking row must exist in operation_schemas.sb_bookings');
      assert.equal(row.booking.leadpax, fixture.leadPax);
      assert.equal(row.booking.status, fixture.status);
      assert.equal(row.trips.length, fixture.trips.length);
      assert.equal(row.trips[0].routeid, fixture.trips[0].routeId);
      assert.equal(row.passengers.length, fixture.passengers.length);
    } finally {
      if (bookingId) await deleteBooking(pool, bookingId).catch(() => {});
      await server.stop();
    }
  }
);

test.after(async () => {
  await closePool();
});
