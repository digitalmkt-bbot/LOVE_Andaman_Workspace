'use strict';
// Fast import: decompose an app_state blob JSON into operation_schemas using
// batched multi-row INSERTs (one txn). ~200 queries instead of ~13k — usable
// over the public Railway proxy.
//   DATABASE_URL=<db> node scripts/fast_import.js <file.json>
const fs = require('fs');
const { getPool } = require('../src/db');
const cfg = require('../src/config');
const model = require('../src/mapping/operation_schemas_model.json');
const { decomposeBlob } = require('../src/mapping/os_repo');

const file = process.argv[2];
if (!file) { console.error('Usage: fast_import.js <file.json>'); process.exit(1); }

const TABLES = Object.keys(model);
const qi = (id) => '"' + String(id).replace(/"/g, '""') + '"';
const fq = (t) => qi(cfg.DB_SCHEMA) + '.' + qi(t);
const depth = (t) => t.split('__').length - 1;

(async () => {
  const blob = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tables = decomposeBlob(blob);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of [...TABLES].sort((a, b) => depth(b) - depth(a))) await client.query(`DELETE FROM ${fq(t)}`);
    let total = 0;
    for (const t of [...TABLES].sort((a, b) => depth(a) - depth(b))) {
      const rows = tables[t] || [];
      if (!rows.length) continue;
      const cols = model[t].columns.map((c) => c.name);
      // ponytail: undefined -> NULL (row-level column omission not preserved; these tables have no defaults that matter)
      const batch = Math.max(1, Math.floor(60000 / cols.length));
      for (let i = 0; i < rows.length; i += batch) {
        const chunk = rows.slice(i, i + batch);
        const vals = [], ph = [];
        chunk.forEach((row, ri) => {
          ph.push('(' + cols.map((_, ci) => '$' + (ri * cols.length + ci + 1)).join(',') + ')');
          cols.forEach((c) => vals.push(row[c] === undefined ? null : row[c]));
        });
        await client.query(`INSERT INTO ${fq(t)} (${cols.map(qi).join(',')}) VALUES ${ph.join(',')}`, vals);
      }
      total += rows.length;
    }
    await client.query('COMMIT');
    console.log(`Imported ${total} rows across ${TABLES.length} tables from ${file}`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
