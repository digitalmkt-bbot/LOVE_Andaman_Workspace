#!/usr/bin/env node
'use strict';
/*
 * check-mapping-drift.mjs — LAM-28 (S2-04)
 *
 * Restores the capability of the deleted `os-backend/scripts/check_mapping_drift.js`
 * (removed at 094dde1, "chore: remove os-backend, erp, db/migrations, and stale mockups"),
 * but for a different, narrower purpose: the old script diffed a *live blob* through a
 * decompose/assemble round-trip. This one is a static structural check between the two
 * mapping source files themselves — it needs no database and no sample data, so it can run
 * in CI on every PR.
 *
 * A new persisted field needs FOUR registrations (allotment_v2/docs/workflows/
 * 07-data-persistence-api.md §4, §10 invariant 5): the store's persist helper, BOTH client
 * load paths, field_mapping.json, and operation_schemas_model.json — plus a real DB column.
 * This script cannot see the persist helper or the two load paths (those live inside the
 * ~46k-line HTML and are structural, not tabular), but it CAN catch the two mapping-file
 * registrations mechanically:
 *
 *   1. A column that exists in operation_schemas_model.json but has no matching entry in
 *      field_mapping.json for that table  -> "model field has no mapping entry".
 *   2. An entry in field_mapping.json that has no matching column in
 *      operation_schemas_model.json for that table -> "mapping entry has no column".
 *
 * Both files are hand/tool-maintained JSON, kept in sync manually today. This check is what
 * keeps them honest without a human re-diffing 130 tables by eye every time one changes.
 *
 * Usage:
 *   node tools/check-mapping-drift.mjs
 *   node tools/check-mapping-drift.mjs --mapping <path> --model <path>
 *
 * Exit code 0 = no drift. Exit code 1 = drift found (or the files could not be read/parsed).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function argVal(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

const MAPPING_PATH = path.resolve(REPO_ROOT, argVal('--mapping', 'os-backend/src/mapping/field_mapping.json'));
const MODEL_PATH = path.resolve(REPO_ROOT, argVal('--model', 'os-backend/src/mapping/operation_schemas_model.json'));

function loadJson(label, p) {
  let raw;
  try {
    raw = readFileSync(p, 'utf8');
  } catch (err) {
    console.error(`FAIL — could not read ${label} at ${p}: ${err.message}`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`FAIL — could not parse ${label} at ${p} as JSON: ${err.message}`);
    process.exit(1);
  }
}

const mapping = loadJson('field_mapping.json', MAPPING_PATH);
const model = loadJson('operation_schemas_model.json', MODEL_PATH);

const mappingTables = Object.keys(mapping);
const modelTables = Object.keys(model);
const allTables = [...new Set([...mappingTables, ...modelTables])].sort();

/** @type {string[]} */
const modelFieldsWithNoMappingEntry = [];
/** @type {string[]} */
const mappingEntriesWithNoColumn = [];
/** @type {string[]} */
const tablesOnlyInModel = [];
/** @type {string[]} */
const tablesOnlyInMapping = [];

for (const table of allTables) {
  const mapTable = mapping[table];
  const modelTable = model[table];

  if (!modelTable) {
    tablesOnlyInMapping.push(table);
    for (const field of Object.keys(mapTable || {})) {
      mappingEntriesWithNoColumn.push(`${table}.${field}`);
    }
    continue;
  }
  if (!mapTable) {
    tablesOnlyInModel.push(table);
    for (const col of modelTable.columns || []) {
      modelFieldsWithNoMappingEntry.push(`${table}.${col.name}`);
    }
    continue;
  }

  const mapFieldNames = new Set(Object.keys(mapTable));
  const modelColNames = new Set((modelTable.columns || []).map((c) => c.name));

  for (const col of modelTable.columns || []) {
    if (!mapFieldNames.has(col.name)) {
      modelFieldsWithNoMappingEntry.push(`${table}.${col.name}`);
    }
  }
  for (const field of Object.keys(mapTable)) {
    if (!modelColNames.has(field)) {
      mappingEntriesWithNoColumn.push(`${table}.${field}`);
    }
  }
}

const driftCount = modelFieldsWithNoMappingEntry.length + mappingEntriesWithNoColumn.length;

console.log('Mapping drift check');
console.log(`  field_mapping.json          : ${MAPPING_PATH} (${mappingTables.length} tables)`);
console.log(`  operation_schemas_model.json: ${MODEL_PATH} (${modelTables.length} tables)`);
console.log('');

if (driftCount === 0) {
  console.log(`OK — no drift. ${allTables.length} tables compared, every model column has a mapping entry and every mapping entry has a column.`);
  process.exit(0);
}

console.error('DRIFT DETECTED — field_mapping.json and operation_schemas_model.json disagree.');
console.error('');

if (tablesOnlyInModel.length) {
  console.error(`Tables only in operation_schemas_model.json (${tablesOnlyInModel.length}) — no field_mapping.json entry at all:`);
  for (const t of tablesOnlyInModel) console.error(`  ${t}`);
  console.error('');
}
if (tablesOnlyInMapping.length) {
  console.error(`Tables only in field_mapping.json (${tablesOnlyInMapping.length}) — no operation_schemas_model.json entry at all:`);
  for (const t of tablesOnlyInMapping) console.error(`  ${t}`);
  console.error('');
}
if (modelFieldsWithNoMappingEntry.length) {
  console.error(`Model column with no mapping entry (${modelFieldsWithNoMappingEntry.length}) — column exists in the DB model but field_mapping.json never says where it comes from:`);
  for (const p of modelFieldsWithNoMappingEntry) console.error(`  ${p}`);
  console.error('');
}
if (mappingEntriesWithNoColumn.length) {
  console.error(`Mapping entry with no column (${mappingEntriesWithNoColumn.length}) — field_mapping.json documents a source but operation_schemas_model.json has no matching column, so the value has nowhere to land:`);
  for (const p of mappingEntriesWithNoColumn) console.error(`  ${p}`);
  console.error('');
}

console.error(`Total drift: ${driftCount}. See allotment_v2/docs/workflows/07-data-persistence-api.md §4 and docs/development/four-registration-trap.md.`);
process.exit(1);
