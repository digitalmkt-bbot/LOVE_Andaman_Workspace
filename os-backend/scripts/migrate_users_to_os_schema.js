'use strict';
// Migrate the `users` auth table: allotment.users -> operation_schemas.users (SAME database).
// Idempotent + non-destructive: creates operation_schemas.users if missing, upserts rows by
// username (ids preserved on first copy), fixes ownership/grants for role allotment_app, and
// leaves allotment.users untouched (rename/drop it manually AFTER the server.js cutover is
// deployed and verified).
//
//   DATABASE_URL='postgres://…' node scripts/migrate_users_to_os_schema.js            # migrate
//   DATABASE_URL='postgres://…' node scripts/migrate_users_to_os_schema.js --verify   # report only
//
// Pairs with server.js (feat/validation-deprecate-blob): USERS_T = 'operation_schemas.users'
// when DATA_BACKEND=relational. Run this BEFORE deploying that server.js; re-run right before
// deploy to pick up any users created in between (upsert makes re-runs safe).
const { Client } = require('pg');

const URL = process.env.DATABASE_URL;
if (!URL) { console.error('Set DATABASE_URL in env.'); process.exit(1); }
const VERIFY_ONLY = process.argv.includes('--verify');

const DST = 'operation_schemas.users';
const DDL = `CREATE TABLE IF NOT EXISTS ${DST} (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT now()
)`;
const ALTERS = [
  `ALTER TABLE ${DST} ADD COLUMN IF NOT EXISTS perms TEXT`,
  `ALTER TABLE ${DST} ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT true`,
  `ALTER TABLE ${DST} ADD COLUMN IF NOT EXISTS edit_areas TEXT`,
];
const COLS = 'id, username, pass_hash, name, role, created_at, perms, can_edit, edit_areas';

(async () => {
  const db = new Client({ connectionString: URL, ssl: (URL.includes('rlwy') || URL.includes('railway') || process.env.PGSSL) ? { rejectUnauthorized: false } : false });
  await db.connect();
  try {
    const reg = async (t) => (await db.query('SELECT to_regclass($1) r', [t])).rows[0].r;
    const src = (await reg('allotment.users')) ? 'allotment.users'
              : (await reg('public.users'))    ? 'public.users' : null;
    if (!src) { console.error('No source users table found (allotment.users / public.users).'); process.exit(1); }
    const dstExists = !!(await reg(DST));

    const cnt = async (t) => (await db.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
    const srcN = await cnt(src);
    console.log(`source: ${src} = ${srcN} row(s) · target: ${DST} ${dstExists ? '= ' + (await cnt(DST)) + ' row(s)' : '(missing)'}`);

    if (VERIFY_ONLY) {
      if (dstExists) {
        const miss = await db.query(`SELECT s.username FROM ${src} s LEFT JOIN ${DST} d USING (username) WHERE d.username IS NULL ORDER BY s.username`);
        console.log(miss.rows.length ? 'missing in target: ' + miss.rows.map(r => r.username).join(', ') : 'target has every source username.');
      }
      process.exit(0);
    }

    await db.query('BEGIN');
    await db.query(DDL);
    for (const a of ALTERS) await db.query(a);
    // server.js boot (as role allotment_app) runs ALTER TABLE on this table -> needs OWNERSHIP.
    // Grants in this DB are per-table (no default ACL), so fix both; best-effort if role differs.
    for (const g of [
      // server.js boot runs CREATE TABLE IF NOT EXISTS on this schema — Postgres checks CREATE
      // privilege even when the table already exists, so the app role needs it.
      `GRANT USAGE, CREATE ON SCHEMA operation_schemas TO allotment_app`,
      `ALTER TABLE ${DST} OWNER TO allotment_app`,
      `ALTER SEQUENCE operation_schemas.users_id_seq OWNER TO allotment_app`,
      `GRANT ALL ON ${DST} TO allotment_app`,
      `GRANT USAGE, SELECT ON SEQUENCE operation_schemas.users_id_seq TO allotment_app`,
    ]) { try { await db.query(g); } catch (e) { console.warn('  (skip) ' + g + ' -> ' + e.message); } }

    const { rows } = await db.query(`SELECT ${COLS} FROM ${src} ORDER BY id`);
    let n = 0;
    for (const r of rows) {
      await db.query(
        `INSERT INTO ${DST} (${COLS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (username) DO UPDATE SET
           pass_hash = EXCLUDED.pass_hash, name = EXCLUDED.name, role = EXCLUDED.role,
           perms = EXCLUDED.perms, can_edit = EXCLUDED.can_edit, edit_areas = EXCLUDED.edit_areas`,
        [r.id, r.username, r.pass_hash, r.name, r.role, r.created_at, r.perms, r.can_edit, r.edit_areas]
      );
      n++;
    }
    // ids were inserted explicitly -> bump the serial so future INSERTs don't collide
    await db.query(`SELECT setval('operation_schemas.users_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM ${DST}), 1))`);
    await db.query('COMMIT');
    console.log(`Migrated ${n} user row(s): ${src} -> ${DST} (upsert by username, ids preserved).`);
    console.log(`Target now: ${await cnt(DST)} row(s). Source left untouched — drop/rename ${src} only after the new server.js is live.`);
  } catch (e) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally { await db.end(); }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
