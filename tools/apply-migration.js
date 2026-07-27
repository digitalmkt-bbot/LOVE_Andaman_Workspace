#!/usr/bin/env node
// Apply a .sql migration to a Postgres database without needing psql installed.
//
//   set OPS_DATABASE_URL=postgres://...        (PowerShell: $env:OPS_DATABASE_URL="postgres://...")
//   node tools/apply-migration.js db/migrations/003_v_seat_availability.sql
//
// Add --check to connect and print the verification queries only, changing nothing.
//
// The connection string is read from the environment and never printed — not in output, not on
// error. Everything runs inside one transaction, so a failure anywhere leaves the database exactly
// as it was rather than half-migrated.

const fs = require('fs');
const path = require('path');

let Pool;
try { ({ Pool } = require('pg')); }
catch (_) {
  console.error('pg module not installed. Run:  npm install');
  process.exit(1);
}

const DB_URL = process.env.OPS_DATABASE_URL || process.env.DATABASE_URL || '';
if (!DB_URL) {
  console.error('Set OPS_DATABASE_URL (or DATABASE_URL) first. It is read from the environment and never printed.');
  process.exit(1);
}

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const file = args.find(a => !a.startsWith('--'));
if (!file && !checkOnly) {
  console.error('Usage: node tools/apply-migration.js <file.sql> [--check]');
  process.exit(1);
}

// Same SSL rule the app uses (server.js) so this behaves identically against Railway.
const pool = new Pool({
  connectionString: DB_URL,
  ssl: (/railway|rlwy/.test(DB_URL) || process.env.PGSSL) ? { rejectUnauthorized: false } : false,
});

// Verification lifted from the migration's own footer: the route/date that was failing in the B2C
// form, plus the unmapped-rows count, which must be 0 before the numbers can be trusted.
const CHECKS = [
  ['view exists',
   `SELECT to_regclass('operation_schemas.v_seat_availability') IS NOT NULL AS ok`],
  // Every route on the date the B2C form was failing on, not one route: POW-003 is r10 and
  // POW-004 is r12, and whichever is being tested, seeing the whole day makes a wrong number obvious.
  [(process.env.CHECK_DATE || '2026-07-27') + ' — all routes',
   `SELECT date, routeid, capacity, booked, locked, available, boats, board_exists
      FROM operation_schemas.v_seat_availability
     WHERE date = $1 ORDER BY routeid`,
   [process.env.CHECK_DATE || '2026-07-27']],
  ['unmapped trip rows (must be 0)',
   `SELECT count(*)::int AS unmapped, COALESCE(SUM(uncounted_pax), 0)::int AS uncounted_pax
      FROM operation_schemas.v_seat_availability_unmapped`],
  ['sample of any unmapped rows',
   `SELECT raw_date, count(*)::int AS rows
      FROM operation_schemas.v_seat_availability_unmapped
     GROUP BY 1 ORDER BY 2 DESC LIMIT 10`],
];

async function runChecks(c) {
  for (const [label, sql, params] of CHECKS) {
    process.stdout.write('\n-- ' + label + '\n');
    try {
      const { rows } = await c.query(sql, params || []);
      console.table(rows.length ? rows : [{ '(no rows)': '' }]);
    } catch (e) {
      console.log('   failed:', e.message, e.code ? '(' + e.code + ')' : '');
    }
  }
}

(async () => {
  const c = await pool.connect();
  try {
    if (checkOnly) {
      await runChecks(c);
      return;
    }
    const p = path.resolve(file);
    const sql = fs.readFileSync(p, 'utf8');
    console.log('applying ' + path.basename(p) + ' (' + sql.length + ' bytes)');

    await c.query('BEGIN');
    await c.query(sql);            // CREATE VIEW / FUNCTION are transactional in Postgres
    await c.query('COMMIT');
    console.log('committed.');

    await runChecks(c);
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch (_) {}
    console.error('\nFAILED — rolled back, nothing changed.');
    console.error('  ' + e.message);
    if (e.code)     console.error('  code:     ' + e.code);
    if (e.position) console.error('  position: ' + e.position + ' (character offset in the file)');
    if (e.hint)     console.error('  hint:     ' + e.hint);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
