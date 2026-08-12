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

// §missingTable (2026-08-12) · ตารางที่อยู่ใน model แต่ยังไม่มีใน DB → ข้าม ไม่ล้มทั้งคำขอ
//   เดิม loadState() SELECT ทุกตารางใน operation_schemas_model.json ตรง ๆ
//   เจอตารางที่ migration ยังไม่ได้รัน → 42P01 → /api/load ตอบ 500 → ทั้งแอปเปิดไม่ได้
//   (เจอจริง 12 ส.ค. 2026 · เพิ่ม pier_* เข้า model แล้ว deploy ก่อนรัน 005/006)
//   ตอนนี้ตารางที่หายถือเสมือนว่าว่าง และขึ้น warn บอกชื่อตารางที่ขาดให้ไปรัน migration
const UNDEFINED_TABLE = '42P01';
let _warnedMissing = '';
function _noteMissing(list) {
  const key = list.join(',');
  if (!list.length || key === _warnedMissing) return;
  _warnedMissing = key;
  console.warn('[relationalStore] table(s) in operation_schemas_model.json but not in the database: '
    + key + ' — run the matching migration in db/migrations. Treating them as empty for now.');
}

async function loadState() {
  const pool = getPool();
  const data = {};
  const missing = [];
  for (const t of TABLES) {
    try {
      const r = await pool.query(`SELECT * FROM ${fq(t)}`);
      data[t] = r.rows;
    } catch (e) {
      if (e && e.code === UNDEFINED_TABLE) { data[t] = []; missing.push(t); }
      else throw e;
    }
  }
  _noteMissing(missing);
  return assembleBlob(data);
}

// §missingTable · เช็คว่ามีตารางไหนจริงบ้าง "ก่อน" เปิด transaction
//   ใน Postgres คำสั่งที่ error กลาง transaction จะทำให้ทั้ง transaction abort (25P02)
//   ดัก 42P01 ทีละคำสั่งข้างในจึงใช้ไม่ได้ — ต้องรู้ล่วงหน้าแล้วข้ามไปเลย
async function existingTables(db) {
  const r = await db.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = $1', [cfg.DB_SCHEMA]);
  return new Set(r.rows.map((x) => x.table_name));
}

async function saveState(blob) {
  const pool = getPool();
  const tables = decomposeBlob(blob);
  const have = await existingTables(pool);
  const missing = TABLES.filter((t) => !have.has(t));
  _noteMissing(missing);
  // ตารางที่หายแต่ "มีข้อมูลจะเขียน" ต้องดัง error ไม่ใช่ข้ามเงียบ ๆ ไม่งั้นข้อมูลหายโดยไม่มีใครรู้
  const blocked = missing.filter((t) => ((tables[t] || []).length > 0));
  if (blocked.length) {
    throw new Error('cannot save: table(s) missing in the database but hold data: ' + blocked.join(', ')
      + ' — run the matching migration in db/migrations first');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of byDepthDesc) { if (have.has(t)) await client.query(`DELETE FROM ${fq(t)}`); }  // children first (FK-safe)
    for (const t of byDepthAsc) {                                                   // parents first
      if (!have.has(t)) continue;
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
    try {
      const r = await pool.query(`SELECT count(*)::int AS n FROM ${fq(t)}`);
      out[t] = r.rows[0].n;
    } catch (e) {
      if (e && e.code === UNDEFINED_TABLE) out[t] = null;                           // null = ยังไม่มีตารางนี้ใน DB
      else throw e;
    }
  }
  return out;
}

module.exports = { loadState, saveState, rowCounts, TABLES };
