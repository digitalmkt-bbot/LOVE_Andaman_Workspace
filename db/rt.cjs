// Round-trip safety gate for os_repo.js against the LIVE operation_schemas.
// PASS = every table's row count is reproduced AND there is no real (order-insensitive) value diff.
// Run: node rt.cjs   (reads operation_schemas via the public proxy; read-only)
const { Client } = require('pg');
const { assembleBlob, decomposeBlob } = require('../os-backend/src/mapping/os_repo.js');
const model = require('../os-backend/src/mapping/operation_schemas_model.json');
const TABLES = Object.keys(model);
const url = process.env.DATABASE_URL || 'postgresql://postgres:vNGfOmzJOtsENizLaYdrIJHWFsRroCeD@reseau.proxy.rlwy.net:15797/railway';

function diff(a, b, path, out) {
  if (out.length > 40 || a === b) return;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'arr' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'arr' : typeof b;
  if (ta !== tb || (ta !== 'object' && ta !== 'arr')) { out.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], path + '.' + k, out);
}

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const live = {};
  for (const t of TABLES) { const r = await c.query(`SELECT * FROM operation_schemas."${t}"`); live[t] = r.rows; }
  const blob = assembleBlob(live);
  const rt = decomposeBlob(blob);
  const countDiffs = TABLES.filter(t => (live[t] || []).length !== (rt[t] || []).length)
    .map(t => `${t}: live ${(live[t] || []).length} -> rt ${(rt[t] || []).length}`);
  const valueDiffs = [];
  diff(blob, assembleBlob(rt), '', valueDiffs);
  const pass = countDiffs.length === 0 && valueDiffs.length === 0;
  console.log('tables:', TABLES.length);
  console.log('row-count parity:', countDiffs.length === 0 ? 'OK' : countDiffs.length + ' MISMATCH\n' + countDiffs.join('\n'));
  console.log('real value diffs:', valueDiffs.length === 0 ? '0' : valueDiffs.length + '\n' + valueDiffs.slice(0, 40).join('\n'));
  console.log(pass ? '\nGATE: PASS - round-trip is lossless, safe to write SQL' : '\nGATE: FAIL - do NOT enable relational writes');
  await c.end();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
