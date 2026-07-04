'use strict';
// Mapper update 2026-07: cover every structure the app added since the mapping was generated.
// Converts open-ended maps from fixed per-key columns to key-value rows, and adds json_text
// columns for new nested fields. Mirrors every change into operation_schemas_model.json.
const fs = require('fs');
const MAPF = 'src/mapping/field_mapping.json', MODF = 'src/mapping/operation_schemas_model.json';
const MAP = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
const MOD = JSON.parse(fs.readFileSync(MODF, 'utf8'));

const modCols = cols => Object.entries(cols).map(([name, i]) => ({ name, type: i.db_type }));
function setModel(table, cols, pk, fks){ MOD[table] = { columns: modCols(cols), primary_key: pk, foreign_keys: fks || [], rows: 0 }; }

// ── 1) top-level open-ended maps → key-value tables with JSON value ──
const topJsonMap = key => ({
  id:    { source: key + ' map key (generated id)', kind: 'pk',             db_type: 'text' },
  key:   { source: key + ' map key (original)',     kind: 'map_key',        db_type: 'text' },
  value: { source: key + '[key] value',             kind: 'map_value_json', db_type: 'text' },
});
for (const k of ['sb_market_stats','nat_learn','insurance_overrides','vanjob_sreq','vanjob_th_flag','vanjob_sent','agent_artifacts']) {
  MAP[k] = topJsonMap(k); setModel(k, MAP[k], 'id');
}

// ── 2) routes[].overrides : fixed per-date columns → child key-value table ──
for (const c of Object.keys(MAP.routes)) if (c.startsWith('overrides_')) delete MAP.routes[c];
MAP['routes__overrides'] = {
  routes_id: { source: '(link) routes.id',               kind: 'fk',             db_type: 'text' },
  key:       { source: '(map key of routes.overrides)',  kind: 'map_key',        db_type: 'text' },
  row_pk:    { source: '(generated child key)',          kind: 'synthetic-pk',   db_type: 'text' },
  value:     { source: 'routes.overrides[key] value',    kind: 'map_value_json', db_type: 'text' },   // json: value may be a string today, an object tomorrow — and pg mangles raw arrays
};
setModel('routes__overrides', MAP['routes__overrides'], 'row_pk', [{ column: 'routes_id', references: 'routes.id' }]);
MOD.routes.columns = MOD.routes.columns.filter(c => !c.name.startsWith('overrides_'));

// ── 3) sb_vehicles day maps : fixed per-date columns → child key-value tables ──
for (const c of Object.keys(MAP.sb_vehicles)) if (/^(daystatus|dayroute)_/.test(c)) delete MAP.sb_vehicles[c];
MOD.sb_vehicles.columns = MOD.sb_vehicles.columns.filter(c => !/^(daystatus|dayroute)_/.test(c.name));
for (const [t, field] of [['sb_vehicles__dayroute','dayRoute'], ['sb_vehicles__daystatus','dayStatus']]) {
  MAP[t] = {
    sb_vehicles_id: { source: '(link) sb_vehicles.id',                 kind: 'fk',           db_type: 'text' },
    key:            { source: '(map key of sb_vehicles.' + field + ')', kind: 'map_key',     db_type: 'text' },
    row_pk:         { source: '(generated child key)',                 kind: 'synthetic-pk',   db_type: 'text' },
    value:          { source: 'sb_vehicles.' + field + '[key] value',  kind: 'map_value_json', db_type: 'text' },   // dayRoute values can be arrays (2 routes/day)
  };
  setModel(t, MAP[t], 'row_pk', [{ column: 'sb_vehicles_id', references: 'sb_vehicles.id' }]);
}

// ── 4) new booking / trip / payment / seat-lock fields ──
const addCols = (table, defs) => {
  Object.assign(MAP[table], defs);
  const have = new Set(MOD[table].columns.map(c => c.name));   // idempotent: no duplicate model columns on re-run
  MOD[table].columns.push(...modCols(defs).filter(c => !have.has(c.name)));
};
addCols('sb_bookings', {
  doccheck:     { source: 'docCheck',      kind: 'json_text', db_type: 'text' },
  attachments:  { source: 'attachments',   kind: 'json_text', db_type: 'text' },
  paymentslips: { source: 'paymentSlips',  kind: 'json_text', db_type: 'text' },
  incomplete:   { source: 'incomplete',    kind: 'json_text', db_type: 'text' },
  approval_over:{ source: 'approval.over', kind: 'json_text', db_type: 'text' },
});
addCols('sb_bookings__trips', {
  lockdrawsel: { source: 'trips[].lockDrawSel', kind: 'json_text', db_type: 'text' },
  lockdraws:   { source: 'trips[].lockDraws',   kind: 'json_text', db_type: 'text' },
});
addCols('sb_payments', { slips: { source: 'slips', kind: 'json_text', db_type: 'text' } });
addCols('sb_seat_locks', {
  scope:     { source: 'scope',     kind: 'scalar', db_type: 'text' },
  month:     { source: 'month',     kind: 'scalar', db_type: 'text' },
  monthfrom: { source: 'monthFrom', kind: 'scalar', db_type: 'text' },
  monthto:   { source: 'monthTo',   kind: 'scalar', db_type: 'text' },
  parentid:  { source: 'parentId',  kind: 'scalar', db_type: 'text' },
  subname:   { source: 'subName',   kind: 'scalar', db_type: 'text' },
  releasedaysbefore: { source: 'releaseDaysBefore', kind: 'scalar', db_type: 'bigint' },
  releasetime:       { source: 'releaseTime',       kind: 'scalar', db_type: 'text' },
});
addCols('sb_seat_locks__log', {
  at:        { source: 'sb_seat_locks[].log[].at',        kind: 'scalar', db_type: 'text' },
  by:        { source: 'sb_seat_locks[].log[].by',        kind: 'scalar', db_type: 'text' },
  bookingid: { source: 'sb_seat_locks[].log[].bookingId', kind: 'scalar', db_type: 'text' },
  sub:       { source: 'sb_seat_locks[].log[].sub',       kind: 'scalar', db_type: 'boolean' },
  note:      { source: 'sb_seat_locks[].log[].note',      kind: 'scalar', db_type: 'text' },
});

// ── 5) contractHistory snapshot arrays: generic engine can't reach nested-object arrays →
//       store as JSON on the contracthistory row; drop the dead child tables (always emitted 0 rows) ──
addCols('sb_agents__contracthistory', {
  snapshot_programperiods: { source: 'contractHistory[].snapshot.programPeriods', kind: 'json_text', db_type: 'text' },
  snapshot_addonservices:  { source: 'contractHistory[].snapshot.addonServices',  kind: 'json_text', db_type: 'text' },
  snapshot_prices:         { source: 'contractHistory[].snapshot.prices',         kind: 'json_text', db_type: 'text' },
});
for (const t of ['sb_agents__contracthistory__programperiods','sb_agents__contracthistory__addonservices',
                 'sb_agents__contracthistory__addonservices__variants','sb_agents__contracthistory__prices']) {
  delete MAP[t]; delete MOD[t];
}

// ── 6) fleet_daily__trips : engines_e* columns → (boat, key, value-JSON) rows (see os_repo special case) ──
MAP.fleet_daily__trips = {
  fleet_daily_id: { source: '(link) fleet_daily.id',                     kind: 'fk',           db_type: 'text' },
  boat:           { source: 'fleet_daily[key].trips[key].boat',          kind: 'scalar',       db_type: 'text' },
  key:            { source: '(map key of fleet_daily[key].boat.trips)',  kind: 'map_key',      db_type: 'text' },
  row_pk:         { source: '(generated child key)',                     kind: 'synthetic-pk', db_type: 'text' },
  value:          { source: 'fleet_daily[key].trips[key] value',         kind: 'json_text',    db_type: 'text' },
};
setModel('fleet_daily__trips', MAP.fleet_daily__trips, 'row_pk', [{ column: 'fleet_daily_id', references: 'fleet_daily.id' }]);

// ── 7) pg value-coercion fixes ──
// app_meta values keep their JS types (true stayed boolean, not "true")
MAP.app_meta.value.kind = 'map_value_json';
// seatrates: leftover whole-zone scalar column (generated when the sample had KL = null everywhere)
// received the whole KL OBJECT on decompose → pg stringified it → assemble overwrote the nested
// object with that string. json_text parses it back (and skip-null ignores it when KL is null).
if (MAP.sb_rate_types__seatrates && MAP.sb_rate_types__seatrates.kl) MAP.sb_rate_types__seatrates.kl.kind = 'json_text';

fs.writeFileSync(MAPF, JSON.stringify(MAP, null, 1));
fs.writeFileSync(MODF, JSON.stringify(MOD, null, 1));
console.log('mapping updated · tables:', Object.keys(MAP).length, '· model tables:', Object.keys(MOD).length);
