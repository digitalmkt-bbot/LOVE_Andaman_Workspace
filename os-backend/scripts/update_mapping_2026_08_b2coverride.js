'use strict';
// Mapper update 2026-08 · §b2cOwn field-level ops override.
//
// B2C bookings arrive through relSyncB2C, which re-upserts every B2C_OWN_BK column on every
// poll (45s). That is right while nobody has touched the booking, and wrong the moment ops
// corrects something the source got wrong — the correction was silently reverted seconds later.
//
// b2cOverride is the list of DB column names ops has deliberately taken ownership of on that
// booking. The sync skips exactly those columns and keeps applying B2C's value to the rest,
// so a later genuine change from the source still flows in everywhere ops has not intervened.
//
// Stored as json_text (a plain array of lowercase column names) so the sync can test it with a
// LIKE against the serialised array — no extra table, no join, readable straight out of psql.
const fs = require('fs');
const MAPF = 'src/mapping/field_mapping.json', MODF = 'src/mapping/operation_schemas_model.json';
const MAP = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
const MOD = JSON.parse(fs.readFileSync(MODF, 'utf8'));

const modCols = cols => Object.entries(cols).map(([name, i]) => ({ name, type: i.db_type }));
const addCols = (table, defs) => {
  Object.assign(MAP[table], defs);
  const have = new Set(MOD[table].columns.map(c => c.name));   // idempotent: re-running adds nothing
  MOD[table].columns.push(...modCols(defs).filter(c => !have.has(c.name)));
};

addCols('sb_bookings', {
  b2coverride: { source: 'b2cOverride', kind: 'json_text', db_type: 'text' },
});

fs.writeFileSync(MAPF, JSON.stringify(MAP, null, 2));
fs.writeFileSync(MODF, JSON.stringify(MOD, null, 2));
console.log('OK · sb_bookings.b2coverride added');
