'use strict';
// Clone the `users` auth table (structure + data) from one Postgres project to another.
// Re-runnable (upserts by username). Needs node + pg only — no psql required.
//
//   SRC_DATABASE_URL='postgres://…(source, has users)…' \
//   DST_DATABASE_URL='postgres://…(target, missing users)…' \
//   node scripts/clone_users.js
//
// Both URLs are the DBs' PUBLIC connection strings (…proxy.rlwy.net:port). You paste them
// (they contain passwords) — the script reads them from env, nothing is hardcoded.
const { Client } = require('pg');

const SRC = process.env.SRC_DATABASE_URL;
const DST = process.env.DST_DATABASE_URL;
if (!SRC || !DST) { console.error('Set SRC_DATABASE_URL and DST_DATABASE_URL in env.'); process.exit(1); }

const DDL = `CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT now()
)`;
const ALTERS = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS perms TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT true",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS edit_areas TEXT",
];

(async () => {
  const src = new Client({ connectionString: SRC });
  const dst = new Client({ connectionString: DST });
  await src.connect(); await dst.connect();
  try {
    await dst.query(DDL);
    for (const a of ALTERS) await dst.query(a);           // ensure all columns exist on target

    const { rows } = await src.query(
      'SELECT username, pass_hash, name, role, created_at, perms, can_edit, edit_areas FROM users ORDER BY id'
    );
    let n = 0;
    for (const r of rows) {
      await dst.query(
        `INSERT INTO users (username, pass_hash, name, role, created_at, perms, can_edit, edit_areas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (username) DO UPDATE SET
           pass_hash = EXCLUDED.pass_hash, name = EXCLUDED.name, role = EXCLUDED.role,
           perms = EXCLUDED.perms, can_edit = EXCLUDED.can_edit, edit_areas = EXCLUDED.edit_areas`,
        [r.username, r.pass_hash, r.name, r.role, r.created_at, r.perms, r.can_edit, r.edit_areas]
      );
      n++;
    }
    console.log(`Cloned ${n} user row(s): source -> target (upsert by username).`);
  } finally {
    await src.end(); await dst.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
