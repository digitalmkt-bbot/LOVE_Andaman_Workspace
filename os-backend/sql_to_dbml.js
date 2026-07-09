// Convert operation_schemas_structure.sql -> operation_schemas.dbml for dbdiagram.io
// Usage: node sql_to_dbml.js [in.sql] [out.dbml]
const fs = require('fs');
const { GROUPS, classify, banner, schemaBanner, EXTRA_SCHEMAS_DBML } = require('./dbml_groups');

const inFile = process.argv[2] || 'operation_schemas_structure.sql';
const outFile = process.argv[3] || 'operation_schemas.dbml';
const sql = fs.readFileSync(inFile, 'utf8');

// ---- tables ----
const tables = [];
const tableRe = /CREATE TABLE operation_schemas\."([^"]+)"\s*\(([\s\S]*?)\);/g;
let m;
while ((m = tableRe.exec(sql))) {
  const name = m[1];
  const body = m[2];
  const cols = [];
  let pk = [];
  for (let line of body.split('\n')) {
    line = line.trim().replace(/,$/, '');
    if (!line) continue;
    const pkm = line.match(/^PRIMARY KEY \(([^)]+)\)/);
    if (pkm) { pk = pkm[1].split(',').map(s => s.trim().replace(/"/g, '')); continue; }
    const cm = line.match(/^"([^"]+)"\s+(.+)$/);
    if (cm) cols.push({ name: cm[1], type: cm[2].trim() });
  }
  tables.push({ name, cols, pk });
}

// ---- foreign keys ----
const refs = [];
const fkRe = /ALTER TABLE operation_schemas\."([^"]+)" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("([^"]+)"\) REFERENCES operation_schemas\."([^"]+)" \("([^"]+)"\)/g;
while ((m = fkRe.exec(sql))) {
  refs.push({ child: m[1], childCol: m[2], parent: m[3], parentCol: m[4] });
}

// ---- emit DBML ----
const typeMap = t => t
  .replace(/^double precision$/, 'double')
  .replace(/^timestamp with time zone$/, 'timestamptz')
  .replace(/^character varying/, 'varchar');

const q = s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : `"${s}"`;

let out = `// generated from ${inFile}\n// ${tables.length} tables · ${refs.length} refs\n// Separated by real database schema (see dbml_groups.js for the layout)\n\n`;
out += schemaBanner('operation_schemas', `app data · ${tables.length} tables · accessed as role allotment_app`) + '\n';
const byGroup = {};
for (const t of tables) (byGroup[classify(t.name)] ||= []).push(t);
for (const g of GROUPS) {
  const list = byGroup[g.id];
  if (!list || !list.length) continue;
  out += banner(g.label) + '\n';
  for (const t of list) {
    out += `Table ${q(t.name)} {\n`;
    for (const c of t.cols) {
      const flags = t.pk.includes(c.name) ? ' [pk]' : '';
      out += `  ${q(c.name)} ${typeMap(c.type)}${flags}\n`;
    }
    out += `}\n\n`;
  }
}
out += EXTRA_SCHEMAS_DBML + '\n';
// TableGroup blocks — dbdiagram.io draws a box around each group
for (const g of GROUPS) {
  const list = byGroup[g.id];
  if (!list || !list.length) continue;
  out += `TableGroup ${g.id} {\n${list.map(t => `  ${q(t.name)}\n`).join('')}}\n\n`;
}
out += `TableGroup allotment_schema {\n  users\n  app_state\n  attachments\n}\n\n`;
for (const r of refs) {
  out += `Ref: ${q(r.child)}.${q(r.childCol)} > ${q(r.parent)}.${q(r.parentCol)}\n`;
}

fs.writeFileSync(outFile, out);
console.log(`OK: ${tables.length} tables, ${refs.length} refs -> ${outFile}`);
