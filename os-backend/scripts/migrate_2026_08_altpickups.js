'use strict';
// DDL migration for the 2026-08 altPickups mapper update.
// Adds two json_text columns to operation_schemas.sb_bookings so รับหลายจุด (altPickups) and
// van splits (ops.vanSplits) persist instead of being dropped on relational save.
//
//   DATABASE_URL=<dev>  node scripts/migrate_2026_08_altpickups.js     # run on DEV first
//   DATABASE_URL=<prod> node scripts/migrate_2026_08_altpickups.js     # then PROD
//
// Idempotent + non-destructive: only ADDs missing columns, reshapes nothing, touches no data.
// Run this BEFORE deploying the server build that carries the updated field_mapping.json
// (the columns must exist before the mapping writes to them).
const { Client } = require('pg');

const S = 'operation_schemas';
const qi = id => '"' + String(id).replace(/"/g, '""') + '"';
const fq = t => qi(S) + '.' + qi(t);
const TABLE = 'sb_bookings';
const COLS = [['altpickups', 'text'], ['ops_vansplits', 'text']];

(async () => {
  if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL'); process.exit(1); }
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN');
  const have = new Set((await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
    [S, TABLE])).rows.map(x => x.column_name));
  for (const [name, type] of COLS) {
    if (!have.has(name)) { await c.query(`ALTER TABLE ${fq(TABLE)} ADD COLUMN ${qi(name)} ${type}`); console.log('added ' + TABLE + '.' + name); }
    else console.log('skip (already exists) ' + TABLE + '.' + name);
  }
  await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${qi(S)} TO allotment_app`);
  await c.query('COMMIT');
  console.log('migration complete · grants refreshed for allotment_app');
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
