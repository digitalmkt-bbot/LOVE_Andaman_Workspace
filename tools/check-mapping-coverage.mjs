#!/usr/bin/env node
/**
 * check-mapping-coverage.mjs
 *
 * The REVERSE of the §mapDrift check in server.js.
 *
 * server.js already warns when operation_schemas_model.json has a table or column
 * that field_mapping.json does not map. That check only compares the two server
 * files against each other. It is blind to the failure that has now bitten this
 * codebase four times:
 *
 *   2026-07-25  ops.vanCheckin / ops.pierCheckin
 *   2026-08-02  bk.pierPayments[] and the sb_extras payment fields
 *   2026-08-14  pier_sect + pier_staff.sect/note + routes.code
 *   2026-09-29  sb_seat_locks.dateFrom / dateTo / dow / usedBy (§lkBulk)
 *
 * Every one of them is the same shape: the app started writing a NEW field into
 * the blob, and nobody added a column for it. The field is in neither the model
 * nor the mapping, so the two server files agree with each other and the boot
 * check stays quiet. decomposeBlob drops the field on save, assembleBlob has
 * nothing to return on load, and the user sees the one symptom this project has
 * now debugged four separate times:
 *
 *     "บันทึกแล้ว รีเฟรชหาย" — saved fine, gone after a refresh, no error anywhere.
 *
 * This script closes that hole from the other side. It takes a REAL blob, pushes
 * it through decomposeBlob -> assembleBlob (byte for byte the production save and
 * load path), and deep-diffs the result against the input. Anything that does not
 * survive is data the app is writing into a hole.
 *
 * Usage:
 *   node tools/check-mapping-coverage.mjs [blob.json ...]
 *
 * With no arguments it walks every export in allotment_v2/data_exports/.
 * Exit 1 if any non-empty value is lost, so CI fails on the NEXT unmapped field
 * instead of a user losing a day of work to it.
 *
 * Only NON-EMPTY values count as lost. null / '' / [] / {} are skipped on the way
 * out by design (a column cannot tell "no note" from "an empty note"), so
 * reporting those would drown the real losses in thousands of harmless lines.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const osRepo = require(join(ROOT, 'os-backend/src/mapping/os_repo.js'));
const osModel = require(join(ROOT, 'os-backend/src/mapping/operation_schemas_model.json'));

const PLAN = osRepo._plan || {};
// appKey -> table, for the top-level entities the REST API exposes (server.js REST_RES)
const BY_APPKEY = {};
for (const [t, pl] of Object.entries(PLAN)) {
  if (!pl.isChild && (pl.container === 'array' || pl.container === 'map') && pl.appKey) BY_APPKEY[pl.appKey] = t;
}

const empty = v => v === undefined || v === null || v === ''
  || (Array.isArray(v) && v.length === 0)
  || (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

// A value survives if it comes back equal. Deliberate tolerances:
//   null <-> missing   : buildElement skips SQL NULLs rather than fabricating null
//   number <-> string  : _bindVal coerces into bigint/numeric columns
function same(a, b) {
  if (a === b) return true;
  if (empty(a) && empty(b)) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    const x = Number(a), y = Number(b);
    if (Number.isFinite(x) && Number.isFinite(y)) return x === y;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) if (!same(a[k], b[k])) return false;
    return true;
  }
  return false;
}

// Walk the ORIGINAL value and record every leaf path whose round-tripped twin differs.
// Array indices collapse to [] so 3,700 bookings report one path, not 3,700.
function diff(orig, back, path, out) {
  if (empty(orig)) return;                                  // nothing to lose
  if (Array.isArray(orig)) {
    const b = Array.isArray(back) ? back : [];
    if (!Array.isArray(back)) { hit(out, path, orig); return; }
    for (let i = 0; i < orig.length; i++) diff(orig[i], b[i], path + '[]', out);
    return;
  }
  if (typeof orig === 'object') {
    if (back === undefined || back === null || typeof back !== 'object') { hit(out, path, orig); return; }
    for (const k of Object.keys(orig)) diff(orig[k], back[k], path ? path + '.' + k : k, out);
    return;
  }
  if (!same(orig, back)) hit(out, path, orig);
}
function hit(out, path, sample) {
  const e = out[path] || (out[path] = { n: 0, sample: undefined });
  e.n++;
  if (e.sample === undefined) e.sample = JSON.stringify(sample).slice(0, 90);
}

function checkBlob(name, blob) {
  const lost = {}, skipped = [];
  for (const key of Object.keys(blob)) {
    const table = BY_APPKEY[key];
    if (!table) { skipped.push(key); continue; }             // no table -> app_meta as whole JSON, lossless
    const val = blob[key];
    if (empty(val)) continue;
    let rows, back;
    try {
      rows = osRepo.decomposeBlob({ [key]: val });
      back = osRepo.assembleBlob(rows)[key];
    } catch (e) { hit(lost, key + ' (decompose/assemble threw)', e.message); continue; }
    const per = {};
    diff(val, back, '', per);
    for (const [p, e] of Object.entries(per)) {
      const full = key + (!p ? '' : (p[0] === '[' ? p : '.' + p));
      const t = lost[full] || (lost[full] = { n: 0, sample: undefined });
      t.n += e.n; if (t.sample === undefined) t.sample = e.sample;
    }
  }
  return { name, lost, skipped };
}

// ---- report ----
const args = process.argv.slice(2);
let files = args;
if (!files.length) {
  const dir = join(ROOT, 'allotment_v2/data_exports');
  files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).map(f => join(dir, f)) : [];
}
if (!files.length) {
  console.error('no blob to check · pass a blob JSON path, or put one in allotment_v2/data_exports/');
  process.exit(2);
}

const all = {};
let checked = 0;
for (const f of files) {
  let blob;
  try { blob = JSON.parse(readFileSync(f, 'utf8')); }
  catch (e) { console.error('[skip] ' + basename(f) + ': ' + e.message); continue; }
  const r = checkBlob(basename(f), blob);
  checked++;
  const paths = Object.keys(r.lost);
  console.log('[blob] ' + basename(f) + ' · ' + Object.keys(blob).length + ' top-level key(s) · '
    + paths.length + ' path(s) lost');
  for (const p of paths) {
    const t = all[p] || (all[p] = { n: 0, sample: undefined, files: new Set() });
    t.n += r.lost[p].n; t.files.add(basename(f));
    if (t.sample === undefined) t.sample = r.lost[p].sample;
  }
}
if (!checked) { console.error('no readable blob'); process.exit(2); }

// also name model tables/columns the blobs never exercised, so a silent hole in a
// rarely-used entity is not mistaken for coverage
const exercised = new Set(Object.keys(all).map(p => p.split('.')[0].split('[')[0]));

const paths = Object.keys(all).sort();
if (!paths.length) {
  console.log('\n[map] every non-empty value in ' + checked + ' blob(s) survived decompose -> assemble');
  process.exit(0);
}
console.log('\n[map] ' + paths.length + ' blob path(s) DO NOT survive the SQL round-trip.');
console.log('      The app writes them, the save drops them, the next load cannot return them.');
console.log('      Users see this as "saved fine, gone after a refresh", with no error anywhere.\n');
const w = Math.max(...paths.map(p => p.length));
for (const p of paths) {
  const t = all[p];
  console.log('  ' + p.padEnd(w) + '  x' + String(t.n).padEnd(6) + ' e.g. ' + t.sample);
}
console.log('\n  Fix each one in THREE places, or it stays broken:');
console.log('    1. os-backend/src/mapping/field_mapping.json         (so os_repo reads/writes it)');
console.log('    2. os-backend/src/mapping/operation_schemas_model.json (so the INSERT includes the column)');
console.log('    3. server.js initDb()  ALTER TABLE ... ADD COLUMN IF NOT EXISTS  (so the column exists)');
console.log('\n  Tables in the model that these blob(s) never exercised (not proven either way): '
  + Object.keys(osModel).filter(t => !t.includes('__') && PLAN[t] && PLAN[t].appKey
      && !exercised.has(PLAN[t].appKey)).length);
process.exit(1);
