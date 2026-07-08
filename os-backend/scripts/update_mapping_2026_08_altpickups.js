'use strict';
// Mapper update 2026-08 · cover the "รับหลายจุด" (altPickups) feature + van splits.
//
//   node scripts/update_mapping_2026_08_altpickups.js
//
// Both are nested arrays on sb_bookings that the generated mapping never covered, so the
// relational decompose was silently DROPPING them on save (booking saved, then the 3s cloud
// soft-refresh reloaded the stripped record → the "รับหลายจุด" flag disappeared).
//
// Fix = store each as a lossless json_text column on sb_bookings (same pattern as doccheck /
// attachments / approval.over added in update_mapping_2026_07.js):
//   sb_bookings.altpickups     ← booking.altPickups   [{who,qty,areaId,area,zone,place}]
//   sb_bookings.ops_vansplits  ← booking.ops.vanSplits [{pax,vanId,vanGroup,pickAreaId,pickHotel,pickZone,altWho,main,...}]
//
// Idempotent: re-running adds nothing new. Mirrors both field_mapping.json AND
// operation_schemas_model.json (the model drives the DDL migration).
//
// AFTER running this: run scripts/migrate_2026_08_altpickups.js against the DB (DEV then PROD)
// to ADD the two columns, THEN deploy the server. Order matters — the columns must exist before
// the new mapping tries to write them.
const fs = require('fs');
const MAPF = 'src/mapping/field_mapping.json', MODF = 'src/mapping/operation_schemas_model.json';
const MAP = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
const MOD = JSON.parse(fs.readFileSync(MODF, 'utf8'));

const modCols = cols => Object.entries(cols).map(([name, i]) => ({ name, type: i.db_type }));
const addCols = (table, defs) => {
  Object.assign(MAP[table], defs);
  const have = new Set(MOD[table].columns.map(c => c.name));   // idempotent: no duplicate model columns on re-run
  MOD[table].columns.push(...modCols(defs).filter(c => !have.has(c.name)));
};

addCols('sb_bookings', {
  altpickups:    { source: 'altPickups',    kind: 'json_text', db_type: 'text' },   // §altPickups · รับหลายจุด (บางคนรับคนละที่)
  ops_vansplits: { source: 'ops.vanSplits', kind: 'json_text', db_type: 'text' },    // van splits (manual + auto alt-pickup) · each split carries its own pickup location
});

fs.writeFileSync(MAPF, JSON.stringify(MAP, null, 1));
fs.writeFileSync(MODF, JSON.stringify(MOD, null, 1));
console.log('mapping updated · added sb_bookings.altpickups + sb_bookings.ops_vansplits (json_text)');
