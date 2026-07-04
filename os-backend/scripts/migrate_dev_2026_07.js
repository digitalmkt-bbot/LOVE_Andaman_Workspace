'use strict';
// One-shot DDL migration for the 2026-07 mapper update. Run against the DEV DB:
//   DATABASE_URL=<dev> node scripts/migrate_dev_2026_07.js
// Reshaped tables are DROP/CREATEd (their data is rebuilt by the next blob import).
const { Client } = require('pg');
const MOD = require('../src/mapping/operation_schemas_model.json');

const S = 'operation_schemas';
const qi = id => '"' + String(id).replace(/"/g, '""') + '"';
const fq = t => qi(S) + '.' + qi(t);

// tables whose shape changed entirely → drop + recreate from the model
const RECREATE = ['sb_market_stats','nat_learn','insurance_overrides','vanjob_sreq','vanjob_th_flag','vanjob_sent',
                  'agent_artifacts','routes__overrides','sb_vehicles__dayroute','sb_vehicles__daystatus','fleet_daily__trips'];
// dead child tables (mapping removed)
const DROP = ['sb_agents__contracthistory__addonservices__variants','sb_agents__contracthistory__programperiods',
              'sb_agents__contracthistory__addonservices','sb_agents__contracthistory__prices'];
// tables that only gained columns → ALTER ADD from the model
const EXTEND = ['sb_bookings','sb_bookings__trips','sb_payments','sb_seat_locks','sb_seat_locks__log','sb_agents__contracthistory'];
// columns to drop (converted to child tables)
const DROPCOLS = { routes: /^overrides_/, sb_vehicles: /^(daystatus|dayroute)_/ };

function createSql(t) {
  const m = MOD[t];
  const cols = m.columns.map(c => `${qi(c.name)} ${c.type}`).join(', ');
  const pk = m.primary_key ? `, PRIMARY KEY (${qi(m.primary_key)})` : '';
  const fks = (m.foreign_keys || []).map(f => {
    const [pt, pc] = f.references.split('.');
    return `, FOREIGN KEY (${qi(f.column)}) REFERENCES ${fq(pt)} (${qi(pc)}) ON DELETE CASCADE`;
  }).join('');
  return `CREATE TABLE ${fq(t)} (${cols}${pk}${fks})`;
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN');
  for (const t of [...DROP, ...RECREATE]) await c.query(`DROP TABLE IF EXISTS ${fq(t)} CASCADE`);
  for (const t of RECREATE) { await c.query(createSql(t)); console.log('created', t); }
  for (const [t, re] of Object.entries(DROPCOLS)) {
    const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`, [S, t]);
    for (const { column_name } of r.rows) if (re.test(column_name)) await c.query(`ALTER TABLE ${fq(t)} DROP COLUMN ${qi(column_name)}`);
    console.log('dropped', t, 'columns matching', String(re));
  }
  for (const t of EXTEND) {
    const have = new Set((await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`, [S, t])).rows.map(x => x.column_name));
    for (const col of MOD[t].columns) if (!have.has(col.name)) { await c.query(`ALTER TABLE ${fq(t)} ADD COLUMN ${qi(col.name)} ${col.type}`); console.log('added', t + '.' + col.name); }
  }
  await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${qi(S)} TO allotment_app`);
  await c.query('COMMIT');
  console.log('migration complete · grants refreshed for allotment_app');
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
