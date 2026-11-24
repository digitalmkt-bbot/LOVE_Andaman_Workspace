// UI parity · the page inventory of legacy (lk-inbox), as markdown
//
//   node test/uiparity/inventory.mjs <run-out-dir> [legacy-dir] > docs/ui-parity/inventory.md
//
// Two sources, both from legacy:
//   1. what run.mjs found in the running app (inventory.json): every sidebar page, and on each the toggles
//      (tabs, chips, pills, segments), selects, checkboxes and dialog openers it could see on opening
//   2. a static read of legacy's allotment_v2.html: the sidebar sections and the dialogs declared in the markup
//      (ids ending Modal/Dialog/Overlay/Sheet/Drawer). Dialogs built by JS at runtime show up only in (1).
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
const legacyDir = process.argv[3] || 'D:/projects/wt-uip-legacy';
if (!out) { console.error('usage: node test/uiparity/inventory.mjs <run-out-dir> [legacy-dir]'); process.exit(2); }
const inv = JSON.parse(fs.readFileSync(path.join(out, 'inventory.json'), 'utf8'));
const html = fs.readFileSync(path.join(legacyDir, 'allotment_v2/allotment_v2.html'), 'utf8');
const esc = (x) => String(x == null ? '' : x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const list = (xs, n = 40) => xs.length ? xs.slice(0, n).map((k) => '`' + esc(k.replace(/\|$/, '')).slice(0, 60) + '`').join(', ') + (xs.length > n ? ` … +${xs.length - n}` : '') : '–';

const L = [];
L.push('# Legacy UI inventory (lk-inbox `allotment_v2`)', '');
L.push(`Built by \`test/uiparity/inventory.mjs\` from the UI parity run in \`${path.basename(out)}\`. Pages come from legacy's sidebar;`,
  'the controls on each are the ones visible when the page opens (an admin login, Bangkok time, 1440×900).',
  'A key is `label|function` with digits as `#`, which is how run.mjs finds the same control in the new frontend.', '');
const pages = inv.pages;
const tot = (k) => pages.reduce((n, p) => n + (p[k] || []).length, 0);
L.push(`**${pages.length} pages** · ${tot('toggles')} toggles · ${tot('selects')} selects · ${tot('checks')} checkboxes · ${tot('dialogs')} dialog openers.`, '');

L.push('## Sidebar', '', '| section | page (data-view) | label | in new sidebar |', '|---|---|---|---|');
for (const p of pages) L.push(`| ${esc(String(p.section).replace(/[⌄▾▸›]/g, '').trim())} | \`${p.page}\` | ${esc(p.label)} | ${p.inNewSidebar ? 'yes' : '**no**'} |`);
L.push('', '## Topbar', '', list(inv.topbar || []), '');

L.push('## Toggles, filters and dialogs per page', '');
for (const p of pages) {
  L.push(`### ${esc(p.label)} · \`${p.page}\``, '');
  L.push(`- toggles (${p.toggles.length}): ${list(p.toggles)}`);
  L.push(`- selects (${p.selects.length}): ${list(p.selects)}`);
  L.push(`- checkboxes (${p.checks.length}): ${list(p.checks)}`);
  L.push(`- dialog openers (${p.dialogs.length}): ${list(p.dialogs)}`);
  if (p.newOnly && (p.newOnly.toggles.length || p.newOnly.dialogs.length)) L.push(`- only in the new frontend: ${list([...p.newOnly.toggles, ...p.newOnly.dialogs])}`);
  L.push('');
}

const dlg = [...new Set([...html.matchAll(/id="([A-Za-z0-9_-]*(?:[Mm]odal|[Dd]ialog|[Dd]lg|[Oo]verlay|[Ss]heet|[Dd]rawer)[A-Za-z0-9_-]*)"/g)].map((m) => m[1]))].sort();
L.push('## Dialogs declared in allotment_v2.html', '', `${dlg.length} ids. Dialogs that JS builds at runtime are not here; see the per-page dialog openers above.`, '', list(dlg, 200), '');
process.stdout.write(L.join('\n') + '\n');
