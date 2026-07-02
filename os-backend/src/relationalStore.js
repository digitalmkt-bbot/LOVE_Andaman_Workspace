'use strict';
// relational backend: read = assembleBlob(SELECT * from every operation_schemas table)
//                     write = decomposeBlob(blob) -> DELETE+INSERT all tables in ONE transaction.
// Touches ONLY the operation_schemas schema. Never public.app_state.
const { getPool } = require('./db');
const cfg = require('./config');
const model = require('./mapping/operation_schemas_model.json');
const { assembleBlob, decomposeBlob } = require('./mapping/os_repo');

const TABLES = Object.keys(model);
const COLS = {};
for (const t of TABLES) COLS[t] = model[t].columns.map((c) => c.name);
const qi = (id) => '"' + String(id).replace(/"/g, '""') + '"';
const fq = (t) => qi(cfg.DB_SCHEMA) + '.' + qi(t);
const depth = (t) => t.split('__').length - 1;                 // 0 = top, 1 = child, 2 = grandchild
const byDepthAsc = [...TABLES].sort((a, b) => depth(a) - depth(b));
const byDepthDesc = [...TABLES].sort((a, b) => depth(b) - depth(a));

async function loadState() {
  const pool = getPool();
  const data = {};
  for (const t of TABLES) {
    const r = await pool.query(`SELECT * FROM ${fq(t)}`);
    data[t] = r.rows;
  }
  return assembleBlob(data);
}

async function saveState(blob) {
  const pool = getPool();
  const tables = decomposeBlob(blob);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of byDepthDesc) await client.query(`DELETE FROM ${fq(t)}`);        // children first (FK-safe)
    for (const t of byDepthAsc) {                                                   // parents first
      const rows = tables[t] || [];
      const cols = COLS[t];
      for (const row of rows) {
        const use = cols.filter((c) => row[c] !== undefined);
        if (!use.length) continue;
        const ph = use.map((_, i) => '$' + (i + 1)).join(',');
        await client.query(
          `INSERT INTO ${fq(t)} (${use.map(qi).join(',')}) VALUES (${ph})`,
          use.map((c) => row[c])
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// diagnostics: per-table row counts from the live schema (for the round-trip acceptance check)
async function rowCounts() {
  const pool = getPool();
  const out = {};
  for (const t of TABLES) {
    const r = await pool.query(`SELECT count(*)::int AS n FROM ${fq(t)}`);
    out[t] = r.rows[0].n;
  }
  return out;
}

module.exports = { loadState, saveState, rowCounts, TABLES };
