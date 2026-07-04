'use strict';
// Export/import the full operation_schemas state as an app_state blob JSON.
//   DATABASE_URL=<db> node scripts/copy_state.js export <file.json>
//   DATABASE_URL=<db> node scripts/copy_state.js import <file.json>
// export = read-only assembleBlob · import = decompose + DELETE+INSERT (one txn)
const fs = require('fs');
const rs = require('../src/relationalStore');

const [mode, file] = process.argv.slice(2);
if (!['export', 'import'].includes(mode) || !file) {
  console.error('Usage: copy_state.js export|import <file.json>'); process.exit(1);
}

(async () => {
  if (mode === 'export') {
    const blob = await rs.loadState();
    fs.writeFileSync(file, JSON.stringify(blob));
    console.log(`Exported ${Object.keys(blob).length} top-level keys → ${file} (${(fs.statSync(file).size/1048576).toFixed(2)} MB)`);
  } else {
    const blob = JSON.parse(fs.readFileSync(file, 'utf8'));
    await rs.saveState(blob);
    const counts = await rs.rowCounts();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`Imported ${file} → DB now holds ${total} rows across ${rs.TABLES.length} tables.`);
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
