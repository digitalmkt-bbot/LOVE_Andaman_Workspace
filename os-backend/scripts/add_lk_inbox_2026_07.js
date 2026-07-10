'use strict';
// LK Inbox (Phase 1) migration — 2026-07-09.
// 1) Mapping whitelist: add top-level key-value map `lk_product_map`
//    (key = love_kingdom product id e.g. POW-002/PR-004 · value = operation route id e.g. "r5")
//    to field_mapping.json + operation_schemas_model.json (same topJsonMap pattern as update_mapping_2026_07).
// 2) DB: CREATE TABLE operation_schemas.lk_product_map + per-table grant to allotment_app
//    (grants are explicit per table in this DB — no default ACL).
// 3) DB: GRANT read access on the love_kingdom schema (bookings/booking_items/customers)
//    to allotment_app so /api/lk/bookings can read it.
// Idempotent — safe to re-run. Prereq: DATABASE_URL env (postgres role).
//   node scripts/add_lk_inbox_2026_07.js
const fs = require('fs');
const path = require('path');
const MAPF = path.join(__dirname, '../src/mapping/field_mapping.json');
const MODF = path.join(__dirname, '../src/mapping/operation_schemas_model.json');
const MAP = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
const MOD = JSON.parse(fs.readFileSync(MODF, 'utf8'));

const KEY = 'lk_product_map';
const topJsonMap = key => ({
  id:    { source: key + ' map key (generated id)', kind: 'pk',             db_type: 'text' },
  key:   { source: key + ' map key (original)',     kind: 'map_key',        db_type: 'text' },
  value: { source: key + '[key] value',             kind: 'map_value_json', db_type: 'text' },
});
const modCols = cols => Object.entries(cols).map(([name, i]) => ({ name, type: i.db_type }));

let mapChanged = false;
if (!MAP[KEY]) {
  MAP[KEY] = topJsonMap(KEY);
  MOD[KEY] = { columns: modCols(MAP[KEY]), primary_key: 'id', foreign_keys: [], rows: 0 };
  fs.writeFileSync(MAPF, JSON.stringify(MAP, null, 1));
  fs.writeFileSync(MODF, JSON.stringify(MOD, null, 1));
  mapChanged = true;
}
console.log('mapping whitelist:', mapChanged ? 'added ' + KEY : KEY + ' already present');

(async () => {
  if (!process.env.DATABASE_URL) { console.log('no DATABASE_URL — mapping files updated, DB skipped'); return; }
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL,
    ssl: /rlwy|railway/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false });
  await c.connect();
  await c.query(`CREATE TABLE IF NOT EXISTS operation_schemas.${KEY} (
    "id" text PRIMARY KEY, "key" text, "value" text)`);
  await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON operation_schemas.${KEY} TO allotment_app`);
  await c.query('GRANT USAGE ON SCHEMA love_kingdom TO allotment_app');
  await c.query('GRANT SELECT ON love_kingdom.bookings, love_kingdom.booking_items, love_kingdom.customers TO allotment_app');
  const chk = await c.query(`SELECT
    (SELECT count(*) FROM information_schema.tables WHERE table_schema='operation_schemas' AND table_name='${KEY}') AS tbl,
    has_schema_privilege('allotment_app','love_kingdom','USAGE') AS lk_usage,
    has_table_privilege('allotment_app','love_kingdom.bookings','SELECT') AS lk_sel,
    has_table_privilege('allotment_app','operation_schemas.${KEY}','INSERT') AS map_ins`);
  console.log('DB:', JSON.stringify(chk.rows[0]));
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
