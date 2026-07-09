// Reorganize an existing .dbml file: separated by REAL database schema
// (operation_schemas / allotment) with domain sub-group comments inside.
// Keeps table bodies verbatim (incl. notes / collapsed columns). Refs kept at the bottom.
// Idempotent — safe to re-run. Usage: node regroup_dbml.js <file.dbml>
const fs = require('fs');
const { GROUPS, classify, banner, schemaBanner, EXTRA_TABLE_NAMES, EXTRA_SCHEMAS_DBML } = require('./dbml_groups');

const file = process.argv[2];
if (!file) { console.error('Usage: node regroup_dbml.js <file.dbml>'); process.exit(1); }
const src = fs.readFileSync(file, 'utf8');

// header = leading // comment lines before the first Table (drop old banners if re-run)
const headerLines = [];
for (const line of src.split('\n')) {
  if (/^\s*Table\s/.test(line)) break;
  if (/^\s*\/\//.test(line) && !/SCHEMA|═|█|────/.test(line)) headerLines.push(line.trimEnd());
}

const tables = [...src.matchAll(/Table\s+("?[\w]+"?)\s*\{[\s\S]*?\n\}/g)]
  .map(m => ({ name: m[1].replace(/"/g, ''), block: m[0] }))
  .filter(t => !EXTRA_TABLE_NAMES.includes(t.name)); // allotment tables re-emitted from EXTRA_SCHEMAS_DBML
const refLines = src.split('\n').filter(l => /^\s*Ref:/.test(l)).map(l => l.trim());

const byGroup = {};
for (const t of tables) (byGroup[classify(t.name)] ||= []).push(t);

let out = headerLines.join('\n');
out += `\n// Separated by real database schema (see dbml_groups.js for the layout)\n\n`;
out += schemaBanner('operation_schemas', `app data · ${tables.length} tables · accessed as role allotment_app`) + '\n';
for (const g of GROUPS) {
  const list = byGroup[g.id];
  if (!list || !list.length) continue;
  out += banner(g.label) + '\n' + list.map(t => t.block).join('\n\n') + '\n\n';
}
out += EXTRA_SCHEMAS_DBML + '\n';
for (const g of GROUPS) {
  const list = byGroup[g.id];
  if (!list || !list.length) continue;
  out += `TableGroup ${g.id} {\n${list.map(t => `  ${t.name}\n`).join('')}}\n\n`;
}
out += `TableGroup allotment_schema {\n  users\n  app_state\n  attachments\n}\n\n`;
out += refLines.join('\n') + '\n';

fs.writeFileSync(file, out);
console.log(`OK: ${tables.length} operation_schemas tables + ${EXTRA_TABLE_NAMES.length} allotment tables, ${refLines.length} refs -> ${file}`);
