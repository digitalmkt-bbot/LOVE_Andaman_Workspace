#!/usr/bin/env node
'use strict';
/*
 * scaffold-registration.mjs — LAM-28 (S2-04)
 *
 * "A new persisted field needs FOUR registrations — persist helper, both client load paths,
 * field_mapping.json, operation_schemas_model.json — plus a real column. Miss any one and the
 * data silently disappears." (allotment_v2/docs/workflows/07-data-persistence-api.md §4,
 * §10 invariant 5; see docs/development/four-registration-trap.md for the full walkthrough.)
 *
 * This tool does not edit anything — os-backend/src/mapping/*.json are live persistence
 * mappings and a script has no business rewriting them unattended. It PRINTS the checklist
 * and the exact snippets a developer needs to paste into each of the five places by hand,
 * pre-filled from the flags given, so nobody re-derives the four-registration checklist (or
 * forgets a step of it) from scratch.
 *
 * Usage:
 *   node tools/scaffold-registration.mjs \
 *     --client-path "ops.pierNote" \
 *     --column ops_piernote \
 *     --kind json_text \
 *     --db-type text \
 *     --tables sb_bookings,sb_bookings__trips \
 *     --persist-helper sbBookingsPersist \
 *     --load-fn _laReloadData
 *
 * Every flag has a sane default so it can also be run with no arguments as a template.
 */

function argVal(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}
function argList(flag, fallback) {
  const v = argVal(flag, null);
  if (!v) return fallback;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

const clientPath = argVal('--client-path', 'ops.newField');
const column = argVal('--column', clientPath.replace(/\./g, '_').replace(/[A-Z]/g, (m) => m.toLowerCase()));
const kind = argVal('--kind', 'json_text');
const dbType = argVal('--db-type', 'text');
const tables = argList('--tables', ['sb_bookings']);
const persistHelper = argVal('--persist-helper', '<store persist helper, e.g. sbBookingsPersist>');
const loadFn = argVal('--load-fn', 'window._laReloadData');

const KIND_HINT = {
  scalar: 'a plain value (string/number/bool) that fits one column',
  json_text: "a nested object/array you don't want to shred into a child table — stash the whole blob as JSON text",
  map_key: 'the key half of an open-ended keyed map (dates, ids) — pairs with a map_value_json column, not one column per key',
  map_value_json: 'the value half of an open-ended keyed map',
  pk: 'the record id / primary key column',
  fk: 'a foreign-key link column, e.g. "(link) <table>.id"',
  synthetic: 'a generated ordering column (e.g. array index), not present on the client object',
  'synthetic-pk': 'a generated child-row primary key, not present on the client object',
  array_scalar: 'one element of a client array of scalars, one row per element',
};

const kindHint = KIND_HINT[kind] || '(unrecognized kind — check field_mapping.json for the valid kind values)';

console.log('='.repeat(78));
console.log('FOUR-REGISTRATION CHECKLIST');
console.log(`Field: ${clientPath}  →  column: ${column}  (${kind}: ${kindHint})`);
console.log('Tables:', tables.join(', '));
console.log('='.repeat(78));

console.log(`
1) CLIENT GLOBAL — add the field with a default; never rename/delete an existing field.
   Example:
     bk.${clientPath.split('.').pop()} = bk.${clientPath.split('.').pop()} || null; // or {} / [] as appropriate

2) PERSIST — extend the store's existing persist helper. Read-modify-write; only touch your keys.
   Helper: ${persistHelper}()
   (Do not write a new persist path — reuse the one that already writes this store's key.)

3) LOAD — in BOTH places, or the value survives a hard reload and then vanishes on the next
   colleague's save (SSE refresh calls the second path only):
     a. the store's own boot IIFE / flLoad() / loadData()
     b. ${loadFn}  (allotment_v2.html:41535 — "ต้องโหลดตรงนี้ด้วย ไม่งั้น key ที่ persist แล้ว
        แต่ไม่มีใครโหลด = หายทุกครั้งที่ refresh")
   Load condition — arrays: if(Array.isArray(d.k)) G = d.k;  (empty array must stay empty, not
   revert to seed). Maps: if(d.k) G = d.k;

4) field_mapping.json — os-backend/src/mapping/field_mapping.json (DO NOT let a script write this
   file — it is a live persistence mapping; paste this by hand after review), for EACH table:
`);

for (const t of tables) {
  console.log(`   "${t}": {`);
  console.log(`     "${column}": {`);
  console.log(`       "source": "${t === tables[0] ? clientPath : 'trips[].' + clientPath}",`);
  console.log(`       "kind": "${kind}",`);
  console.log(`       "db_type": "${dbType}"`);
  console.log('     }');
  console.log('   }');
}

console.log(`
5) operation_schemas_model.json — os-backend/src/mapping/operation_schemas_model.json (same
   caution — hand-edit only), add the matching column to EACH table's "columns" array:
`);
for (const t of tables) {
  console.log(`   "${t}".columns += { "name": "${column}", "type": "${dbType}" }`);
}

console.log(`
6) DATABASE COLUMN — create it for real, one of:
   a. a new file in db/migrations/ (auto-run at boot), or
   b. an ALTER TABLE in the initDb() relational block (server.js ~:1590-1723), idempotent:
`);
for (const t of tables) {
  console.log(`      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "${column}" ${dbType};`);
}

console.log(`
7) If this field lives on a booking (ops.*, upgrades, feeItems, etc.), also check
   bkV2CommitBooking's "if(editing)" block carries it over — that function rebuilds a fresh
   object on every edit, so anything not explicitly copied there is silently wiped
   (CLAUDE.md §3.4; allotment_v2/docs/workflows/07-data-persistence-api.md §4.1).

8) REDEPLOY and check /api/version: map.tables / map.columns and db.missing must all be 0.
   Then run:  npm run check:mapping-drift
`);

console.log('='.repeat(78));
console.log('This tool only prints the checklist — it makes no file edits.');
console.log('Full walkthrough: docs/development/four-registration-trap.md');
console.log('='.repeat(78));
