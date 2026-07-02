'use strict';
// Real-data round-trip against the STAGING database.
// Prereq: set DATABASE_URL (staging) in env, then:  node test/roundtrip.staging.js
// Checks (read-only — no writes):
//   1) row-count parity: decomposeBlob(assembleBlob(liveTables)) matches live per-table counts.
//   2) re-assemble stability: assembleBlob(decomposeBlob(blob)) deep-equals the assembled blob.
const rs = require('../src/relationalStore');
const { decomposeBlob, assembleBlob } = require('../src/mapping/os_repo');

(async () => {
  console.log('Loading live rows from operation_schemas …');
  const live = await rs.rowCounts();
  const blob = await rs.loadState();
  const rt = decomposeBlob(blob);

  let ok = true;
  const diffs = [];
  for (const t of rs.TABLES) {
    const a = live[t] || 0, b = (rt[t] || []).length;
    if (a !== b) { ok = false; diffs.push(`  ${t}: live=${a} roundtrip=${b}`); }
  }
  const stable = JSON.stringify(assembleBlob(rt)) === JSON.stringify(blob);

  console.log('\n1) row-count parity     :', ok ? 'PASS' : 'FAIL');
  if (!ok) console.log(diffs.join('\n'));
  console.log('2) re-assemble stability:', stable ? 'PASS' : 'FAIL');
  console.log('\ntotal tables:', rs.TABLES.length);
  process.exit(ok && stable ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
