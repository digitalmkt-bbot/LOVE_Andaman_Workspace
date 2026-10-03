// §b2cMapMod · read-only access to the live B2C + ops databases for the B2C dev tools
// (b2c-fixture-capture.mjs, b2c-check-live.mjs). Needs B2C_DB_URL, OPS_DATABASE_URL and usually
// B2C_SCHEMA=love_kingdom.
//
// The B2C loaders (item SQL + traveller / catalog readers) live in server.js between the
// B2C_SCHEMA constant and opsRouteExtIdCatalog. Rather than copy them, run that slice in a sandbox
// with the two pools wired in — so the tools read exactly what relSyncB2C reads, and cannot drift.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
export const map = require_(path.join(ROOT, 'b2c-map.js'));

export async function openLive() {
  const { Pool } = require_('pg');
  const { B2C_DB_URL, OPS_DATABASE_URL } = process.env;
  if (!B2C_DB_URL || !OPS_DATABASE_URL) throw new Error('B2C_DB_URL and OPS_DATABASE_URL are required');
  const ssl = u => (/sslmode=disable|localhost|127\.0\.0\.1/.test(u) ? false : { rejectUnauthorized: false });
  const b2cPool = new Pool({ connectionString: B2C_DB_URL, ssl: ssl(B2C_DB_URL), max: 1 });
  const opsPool = new Pool({ connectionString: OPS_DATABASE_URL, ssl: ssl(OPS_DATABASE_URL), max: 1 });

  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const from = src.indexOf('const B2C_SCHEMA');
  const endFn = src.indexOf('async function opsRouteExtIdCatalog');
  const to = src.indexOf('\n}\n', endFn) + 3;
  if (from < 0 || endFn < 0) throw new Error('server.js layout changed — update the slice markers in tools/b2c-live.mjs');
  const ctx = vm.createContext({
    ...map, require: createRequire(path.join(ROOT, 'server.js')), process, console, Date, Math, JSON,
    Number, String, Array, Object, Set, Map, Promise, RegExp, Error, Boolean, Intl, parseFloat, parseInt, isNaN,
    pool: opsPool, DATA_BACKEND: 'relational',
    qic: s => '"' + String(s).replace(/"/g, '""') + '"',
  });
  vm.runInContext('const fqt = t => qic("operation_schemas") + "." + qic(t); let b2cPool = null;\n'
    + src.slice(from, to) + '\nthis.__set = p => { b2cPool = p; };'
    + '\nthis.__L = { B2C_ITEM_JOIN, B2C_SYNC_FROM, b2cPassengerRows, b2cAddonCatalog, b2cProgramRouteCatalog,'
    + ' b2cTransferRouteCatalog, opsRouteExtIdCatalog };', ctx);
  ctx.__set(b2cPool);
  const L = ctx.__L;

  // Everything relSyncB2C hands the mapper, for the given item rows.
  async function context(items) {
    const ids = [...new Set(items.map(r => String(r.booking_id)))];
    const paxByBooking = await L.b2cPassengerRows(ids);
    for (const [k, v] of map.b2cPassengersFromJson(items)) if (!paxByBooking.has(k)) paxByBooking.set(k, v);
    const [addonCat, progCat, trfCat, extCat] = await Promise.all([
      L.b2cAddonCatalog(), L.b2cProgramRouteCatalog(), L.b2cTransferRouteCatalog(), L.opsRouteExtIdCatalog()]);
    const { rows: areas } = await opsPool.query('SELECT id, name, zone FROM operation_schemas.sb_pickup_areas ORDER BY id');
    return { paxByBooking, addonCat, progCat, trfCat, extCat, areas, findArea: map.b2cFindArea(areas) };
  }

  return {
    L, b2cPool, opsPool, context,
    itemsFor: async id => (await b2cPool.query(L.B2C_ITEM_JOIN + ' AND bi.booking_id = $1 ORDER BY bi.line_no', [id])).rows,
    // Same window and order as a full relSyncB2C run (no row cap — this is a read-only report).
    itemsWindow: async () => (await b2cPool.query(L.B2C_ITEM_JOIN
      + ' AND COALESCE(bi.travel_date::text, b.travel_date::text) >= $1 ORDER BY bi.booking_id, bi.line_no', [L.B2C_SYNC_FROM()])).rows,
    close: async () => { await b2cPool.end(); await opsPool.end(); },
  };
}
