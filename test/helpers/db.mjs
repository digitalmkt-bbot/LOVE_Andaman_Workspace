// Thin Postgres helpers for the e2e write-path test. Uses the `pg` package, which is already a
// root dependency (package.json `dependencies.pg`) — no new dependency needed for this file.
//
// Every helper here is read-only introspection or scratch-record cleanup; nothing here creates
// schema. Creating operation_schemas.* tables is a migration concern (db/migrations/002_add_operation_schemas.sql),
// which does not exist on this branch — see docs/development/tasks/LAM-22.md for why.
import pg from 'pg';

const { Pool } = pg;

let _pool = null;
export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    // Mirror server.js's own Pool setup exactly (server.js:1411): only ask for TLS against a
    // managed Railway Postgres. node-postgres treats a truthy `ssl` option as "TLS required", so
    // passing it unconditionally breaks against a local/CI Postgres that doesn't speak TLS at all.
    const needsSsl = /rlwy|railway/.test(url) || !!process.env.PGSSL;
    _pool = new Pool({
      connectionString: url,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return _pool;
}

export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * True when `operation_schemas.sb_bookings` (and its trip/passenger children) already exist —
 * i.e. some migration or manual provisioning step has created the relational booking schema.
 * This is the harness's single precondition gate for every schema-dependent test: everything
 * downstream (seeding a user, writing a booking, reading it back) needs these tables, and none
 * of them exist on this branch until LAM-73 restores/rebuilds db/migrations.
 */
export async function hasBookingSchema(pool) {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'operation_schemas'
        AND table_name = ANY($1::text[])`,
    [['sb_bookings', 'sb_bookings__trips', 'sb_bookings__passengers', 'users']]
  );
  const found = new Set(rows.map((r) => r.table_name));
  return ['sb_bookings', 'sb_bookings__trips', 'sb_bookings__passengers', 'users'].every((t) => found.has(t));
}

/** Delete a scratch booking (and its children, which cascade per server.js's FK setup) by id.
 *  Only ever call this with a zz_test_ id — see CLAUDE.md §4 scratch-record convention. */
export async function deleteBooking(pool, id) {
  if (!id || !id.startsWith('zz_test_')) {
    throw new Error('deleteBooking: refusing to delete a non-scratch id: ' + id);
  }
  await pool.query('DELETE FROM operation_schemas.sb_bookings WHERE id = $1', [id]);
}

/** Fetch the raw row (and trip/passenger children) for one booking id, straight from Postgres —
 *  bypassing the app entirely, so the e2e proof asserts against the actual durable store and not
 *  just the HTTP response the write endpoint happened to echo back. */
export async function fetchBookingRow(pool, id) {
  const bk = await pool.query('SELECT * FROM operation_schemas.sb_bookings WHERE id = $1', [id]);
  const trips = await pool.query(
    'SELECT * FROM operation_schemas.sb_bookings__trips WHERE sb_bookings_id = $1 ORDER BY idx',
    [id]
  );
  const passengers = await pool.query(
    'SELECT * FROM operation_schemas.sb_bookings__passengers WHERE sb_bookings_id = $1 ORDER BY idx',
    [id]
  );
  return { booking: bk.rows[0] || null, trips: trips.rows, passengers: passengers.rows };
}
