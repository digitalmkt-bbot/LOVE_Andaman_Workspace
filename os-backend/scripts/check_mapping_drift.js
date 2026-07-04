'use strict';
// Mapping drift check: blob → decompose → assemble → deep-diff against the original.
// Run after ANY app feature that adds fields, and before trusting a relational import:
//   node scripts/check_mapping_drift.js <blob.json>
// Exits 1 if any REAL value is lost or changed (empty containers like [] / {} are tolerated —
// the app treats a missing key and an empty container the same).
const fs = require('fs');
const os = require('../src/mapping/os_repo.js');

const file = process.argv[2];
if (!file) { console.error('Usage: check_mapping_drift.js <blob.json>'); process.exit(1); }
const blob = JSON.parse(fs.readFileSync(file, 'utf8'));
const back = os.assembleBlob(os.decomposeBlob(blob));

const isEmpty = v => v === null || v === '' ||
  (Array.isArray(v) && v.every(isEmpty)) ||
  (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isEmpty));   // deep: {trips:{},fuel:null} carries no information

const lost = [], changed = [];
function walk(a, b, path) {
  if (a === b) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of Object.keys(a)) {
      if (!(k in b)) { if (!isEmpty(a[k])) lost.push(path + '.' + k); }
      else walk(a[k], b[k], path + '.' + k);
    }
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) changed.push(path + ' (len ' + a.length + '->' + b.length + ')');
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) walk(a[i], b[i], path + '[' + i + ']');
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(path + '  ' + JSON.stringify(a).slice(0, 40) + ' -> ' + JSON.stringify(b).slice(0, 40));
}
for (const k of Object.keys(blob)) { if (!(k in back)) { if (!isEmpty(blob[k])) lost.push(k); } else walk(blob[k], back[k], k); }

const pat = {};
for (const p of lost) {
  const P = p.replace(/\[\d+\]/g, '[]').replace(/\.[0-9]{4}-[0-9]{2}-[0-9]{2}/g, '.<date>');
  pat[P] = (pat[P] || 0) + 1;
}
if (lost.length || changed.length) {
  console.error('DRIFT DETECTED — mapping does not round-trip this blob losslessly.');
  console.error('LOST real values:', lost.length);
  Object.entries(pat).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.error('  ' + n + '\t' + p));
  console.error('CHANGED values:', changed.length);
  changed.slice(0, 15).forEach(c => console.error('  ' + c));
  process.exit(1);
}
console.log('OK — lossless round-trip. Keys:', Object.keys(blob).length, '· blob chars:', JSON.stringify(blob).length);
