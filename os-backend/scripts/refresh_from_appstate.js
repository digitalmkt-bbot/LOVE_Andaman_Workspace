'use strict';
// One-shot: rebuild operation_schemas from the CURRENT public.app_state blob.
// Use this right before cutover so the structured tables hold live data (not the stale snapshot).
// Read public.app_state -> decomposeBlob -> DELETE+INSERT operation_schemas (one transaction).
// STAGING first. Prereq: DATABASE_URL set in env.
//   node scripts/refresh_from_appstate.js
const blobStore = require('../src/blobStore');
const rs = require('../src/relationalStore');

(async () => {
  console.log('Reading public.app_state …');
  const blob = await blobStore.loadState();
  const keys = Object.keys(blob || {});
  if (!keys.length) { console.error('app_state is empty — aborting (nothing to migrate).'); process.exit(1); }
  console.log(`Loaded blob with ${keys.length} top-level keys. Writing operation_schemas …`);
  await rs.saveState(blob);                       // decompose + DELETE+INSERT in a transaction
  const counts = await rs.rowCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Done. operation_schemas now holds ${total} rows across ${rs.TABLES.length} tables.`);
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
