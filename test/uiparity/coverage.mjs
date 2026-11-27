// UI parity · check 5, coverage: how much of legacy do checks 1, 3 and 4 look at?
//
//   node test/uiparity/coverage.mjs --runs=<run-dir>[,<run-dir>…] [--scenarios=<scenarios-out-dir>,…]
//        [--legacy-dir=D:/projects/wt-uip-legacy] [--out=<dir>]          → <out>/coverage.md + coverage.json
//
// The denominator is a list of everything legacy can do, read from legacy's own code (allotment_v2.html and the
// js/ files it loads, from a checkout of origin/lk-inbox):
//   handler  every function named in an onclick= / onchange= / oninput= attribute (static markup and the
//            template strings the JS builds) · one item per function name
//   page     every sidebar page (.nav-item[data-view])
//   dialog   every dialog element (ids ending Modal / Dialog / Dlg / Overlay / Sheet / Drawer)
// Each item gets a kind: view (no write), dialog, action (writes), print, or none (dev tools, legacy-only sync,
// dead code; never counted). The kind is a first guess from the name; coverage-kinds.json corrects it.
//
// Covered by:
//   view, dialog, print · a check-1 run (run.mjs) ran the handler, opened the page or showed the dialog element
//   action              · a check-4 scenario (scenarios.mjs) ran the handler on the legacy side
//   any                 · a check-3 replay named for it in coverage-kinds.json "replays"
// An uncovered item needs a written reason (coverage-kinds.json "uncovered") before the check passes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WRITE = /save|delete|del[A-Z(]|remove|rm[A-Z(]|cancel|confirm|commit|submit|reset|import|upload|approve|reject|void|send|push|sync|apply|bulk|lock|unlock|assign|archive|restore|create|add[A-Z(]|new[A-Z(]|copy|dup|clone|move|swap|merge|split|close[A-Z]*Day|pay|refund|charge|post[A-Z(]|mark|set[A-Z][a-z]*Status|toggleEdit|logout|checkin|checkIn|noshow|noShow|deploy|release/;
const PRINT = /print|pdf|export|download|xlsx|csv|excel|Dl$|dlCsv/i;
const DIALOG = /^(open|show|close|hide|view)[A-Z_]|Modal|Dialog|Dlg|Popup|Sheet|Drawer|Detail|Overlay|Lightbox|Picker|Panel/;
const DLG_ID = /^[A-Za-z0-9_-]*(?:[Mm]odal|[Dd]ialog|[Dd]lg|[Oo]verlay|[Ss]heet|[Dd]rawer)$/;   // ids that END with it
// camelCase words that write, whatever their case in the name (agEditSave, flImportData)
const WRITE_WORDS = new Set('save delete del remove rm confirm commit submit approve reject void send upload assign unassign archive restore create refund charge lock unlock release deploy checkin noshow import apply publish duplicate dup clone add new pay paid bump drop undo fill bulk reset hold swap move merge split resolve'.split(' '));
const words = (n) => n.replace(/^_+/, '').split(/(?=[A-Z])|_/).map((w) => w.toLowerCase()).filter(Boolean);

// ── the item list, from legacy's code ──
export function legacyItems(legacyDir) {
  const base = path.join(legacyDir, 'allotment_v2');
  const html = fs.readFileSync(path.join(base, 'allotment_v2.html'), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"?]+)/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
  const src = { 'allotment_v2.html': html };
  for (const s of scripts) { const f = path.join(base, s); if (fs.existsSync(f)) src[s] = fs.readFileSync(f, 'utf8'); }

  // functions legacy defines (only these count as handlers: builtins and dotted calls are not legacy items)
  const defs = new Map();               // name → [{file, pos}]
  const fnPos = {};                     // file → sorted [pos, name] of declarations (to find the enclosing one)
  for (const [f, s] of Object.entries(src)) {
    fnPos[f] = [];
    const re = /(?:\bfunction\s+([A-Za-z_$][\w$]*)\s*\(|(?:window\.|\b(?:const|let|var)\s+)([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/g;
    for (const m of s.matchAll(re)) {
      const n = m[1] || m[2];
      if (!defs.has(n)) defs.set(n, []);
      defs.get(n).push({ file: f, pos: m.index });
      // a local helper (esc, fmt, pill, …) is not the function that builds a screen: skip it as an owner
      if (n.length > 4 && !/^(escape|escapeHTML|escHtml|fmtD|fmtDate|money|label|chip|pill|badge|row|cell|button|option)$/i.test(n)) fnPos[f].push([m.index, n]);
    }
  }
  const owner = (f, pos) => { const a = fnPos[f]; let lo = 0, hi = a.length - 1, r = null; while (lo <= hi) { const mid = (lo + hi) >> 1; if (a[mid][0] < pos) { r = a[mid][1]; lo = mid + 1; } else hi = mid - 1; } return r; };

  const handlers = new Map();
  let dynamic = 0;
  for (const [f, s] of Object.entries(src)) {
    const re = /\bon(click|change|input)\s*=\s*(\\?)(["'`])/g;
    for (const m of s.matchAll(re)) {
      const close = m[2] + m[3], start = m.index + m[0].length;
      let end = start;
      for (;;) { end = s.indexOf(close, end); if (end < 0 || close.length === 2 || s[end - 1] !== '\\') break; end++; }
      if (end < 0) continue;
      let val = s.slice(start, Math.min(end, start + 600));
      // drop the code the JS splices into the attribute ('+x+' and ${x}): only the attribute's own calls count
      val = val.replace(/\$\{[^}]*\}/g, ' ').replace(/'\s*\+[^']*?\+\s*'/g, ' ').replace(/"\s*\+[^"]*?\+\s*"/g, ' ');
      const calls = [...val.matchAll(/(?<![\w$.])((?:window\.)?[A-Za-z_$][\w$]*)\s*\(/g)].map((c) => c[1].replace(/^window\./, '')).filter((n) => defs.has(n));
      if (!calls.length) { dynamic++; continue; }
      const own = owner(f, m.index);
      for (const n of new Set(calls)) {
        const e = handlers.get(n) || { type: 'handler', name: n, events: new Set(), sites: 0, files: new Set(), owners: new Set() };
        e.events.add(m[1]); e.sites++; e.files.add(f); if (own && own !== n) e.owners.add(own);
        handlers.set(n, e);
      }
    }
  }
  const pages = [...html.matchAll(/<[^>]*class="nav-item[^"]*"[^>]*>/g)].map((m) => {
    const v = /data-view="([^"]+)"/.exec(m[0]); if (!v) return null;
    return v[1] + (/data-citytour="1"/.test(m[0]) ? '#citytour' : '');
  }).filter(Boolean);
  const dialogs = new Map();
  for (const [f, s] of Object.entries(src)) {
    for (const m of s.matchAll(/\bid\s*=\s*\\?["']([A-Za-z0-9_-]+)\\?["']/g)) {
      if (!DLG_ID.test(m[1])) continue;
      const e = dialogs.get(m[1]) || { type: 'dialog', name: m[1], files: new Set(), owners: new Set() };
      e.files.add(f); const own = f === 'allotment_v2.html' ? null : owner(f, m.index); if (own) e.owners.add(own);
      dialogs.set(m[1], e);
    }
  }
  const items = [
    ...[...new Set(pages)].map((p) => ({ type: 'page', name: p, id: 'page:' + p })),
    ...[...handlers.values()].map((h) => ({ ...h, id: h.name, events: [...h.events], files: [...h.files], owners: [...h.owners].slice(0, 6) })),
    ...[...dialogs.values()].map((d) => ({ ...d, id: 'dialog:' + d.name, files: [...d.files], owners: [...d.owners].slice(0, 6) })),
  ];
  return { items, dynamic, files: Object.keys(src) };
}

export function guessKind(it) {
  if (it.type === 'page') return { kind: 'view', why: 'sidebar page' };
  if (it.type === 'dialog') return { kind: 'dialog', why: 'dialog element' };
  const n = it.name;
  if (/^(dev|debug|mock|test[A-Z])/i.test(n) || /Debug|DevTool/.test(n)) return { kind: 'none', why: 'dev / debug tool (name)' };
  if (PRINT.test(n)) return { kind: 'print', why: 'name looks like print / export' };
  const w = words(n);
  if (WRITE.test(n) || w.some((x) => WRITE_WORDS.has(x)) || (w.includes('set') && w.includes('status')) || (w.includes('cancel') && !w.some((x) => /^(name|type|cap|edit|form)$/.test(x)))) return { kind: 'action', why: 'name looks like a write' };
  if (DIALOG.test(n) || /(Open|Close|Show|Hide|Preview)(?![a-z])/.test(n)) return { kind: 'dialog', why: 'name opens / closes a dialog' };
  if (/(^edit|Edit)(?![a-z])|^startEdit|Toggle[A-Z]?Edit/.test(n)) return { kind: 'action', why: 'starts or runs an edit' };
  // a field handler in an editor (typing a value) is part of an action, unless it is a filter or a search
  if (!it.events.includes('click') && !/filter|search|sort|tab|view|mode|month|year|week|date|day|range|period|show|toggle|render|refresh|load|page|scope|zoom|q$|Q$/i.test(n)) return { kind: 'action', why: 'edits a field (oninput/onchange only)' };
  if (DIALOG.test(n)) return { kind: 'dialog', why: 'name opens / closes a dialog' };
  return { kind: 'view', why: 'no write in the name' };
}

// ── covered by ──
function loadSeen(dirs) {
  const s = { calls: {}, dialogIds: {}, pages: {} };
  for (const d of dirs) {
    const f = path.join(d, 'seen.json');
    if (!fs.existsSync(f)) { console.error(`! ${f} missing (a run before coverage was recorded?)`); continue; }
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const k of ['calls', 'dialogIds', 'pages']) for (const [n, v] of Object.entries(j[k] || {})) s[k][n] = s[k][n] || v;
  }
  return s;
}

export function coverage({ legacyDir, runs, scenarios, kindsFile }) {
  const { items, dynamic, files } = legacyItems(legacyDir);
  const over = fs.existsSync(kindsFile) ? JSON.parse(fs.readFileSync(kindsFile, 'utf8')) : {};
  const k1 = loadSeen(runs), k4 = loadSeen(scenarios);
  const pats = (over.patterns || []).map((p) => ({ ...p, re: new RegExp(p.re) }));
  for (const it of items) {
    const o = (over.kinds || {})[it.id] || pats.find((p) => p.type ? p.type === it.type && p.re.test(it.name) : p.re.test(it.id));
    Object.assign(it, o ? { kind: o.kind, why: o.why, by: 'override' } : { ...guessKind(it), by: 'guess' });
    const rep = (over.replays || {})[it.id];
    const ran1 = it.type === 'page' ? k1.pages[it.name] : it.type === 'dialog' ? k1.dialogIds[it.name] : k1.calls[it.name];
    const ran4 = it.type === 'page' ? k4.pages[it.name] : it.type === 'dialog' ? k4.dialogIds[it.name] : k4.calls[it.name];
    it.coveredBy = [];
    if (ran1 && it.kind !== 'action') it.coveredBy.push('check 1');
    if (ran4) it.coveredBy.push('check 4');
    if (rep) it.coveredBy.push('check 3: ' + rep);
    it.ranInCheck1 = !!ran1;
    it.where = (ran4 && [].concat(ran4)[0]) || (ran1 && [].concat(ran1)[0]) || null;
    it.uncoveredWhy = (over.uncovered || {})[it.id] || null;
    // the page an item belongs to: where it (or the function that builds its markup) ran in a run
    const ownerPage = (it.owners || []).map((o) => k1.calls[o] || k4.calls[o]).find(Boolean);
    it.page = it.type === 'page' ? it.name : (it.where || (ownerPage && [].concat(ownerPage)[0]) || '').split(' · ')[0] || `(not reached) ${(it.files || [])[0] || ''} › ${(it.owners || [])[0] || '?'}`;
  }
  const kinds = ['view', 'dialog', 'action', 'print'];
  const per = {};
  for (const k of kinds) { const xs = items.filter((i) => i.kind === k); per[k] = { items: xs.length, covered: xs.filter((i) => i.coveredBy.length).length }; }
  const counted = items.filter((i) => i.kind !== 'none');
  const total = { items: counted.length, covered: counted.filter((i) => i.coveredBy.length).length };
  const unexplained = counted.filter((i) => !i.coveredBy.length && !i.uncoveredWhy);
  return { items, per, total, unexplained, dynamic, files, runs, scenarios };
}

export function coverageMd(c) {
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '–';
  const esc = (x) => String(x == null ? '' : x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const L = ['# Coverage · how much of legacy checks 1, 3 and 4 look at (check 5)', '',
    `Items from legacy's code (${c.files.length} files: ${c.files.join(', ')}); runs: ${c.runs.map((d) => '`' + path.basename(d) + '`').join(', ') || '–'}; scenarios: ${c.scenarios.map((d) => '`' + path.basename(d) + '`').join(', ') || '–'}.`,
    `${c.dynamic} attribute sites name no function of their own (\`onclick="\${fn}"\`, inline code) and are not items.`, '',
    `**Total ${c.total.covered} / ${c.total.items} = ${pct(c.total.covered, c.total.items)}** (ready bar ≥ 95%, every uncovered item with a written reason · ${c.unexplained.length} uncovered without one).`, '',
    '| kind | items | covered | % |', '|---|---|---|---|'];
  for (const [k, v] of Object.entries(c.per)) L.push(`| ${k} | ${v.items} | ${v.covered} | ${pct(v.covered, v.items)} |`);
  L.push(`| none (not counted) | ${c.items.filter((i) => i.kind === 'none').length} | – | – |`, '');
  // by item type too: handlers, pages, dialog elements
  L.push('| item type | items | covered | % |', '|---|---|---|---|');
  for (const t of ['page', 'handler', 'dialog']) { const xs = c.items.filter((i) => i.type === t && i.kind !== 'none'); const n = xs.filter((i) => i.coveredBy.length).length; L.push(`| ${t} | ${xs.length} | ${n} | ${pct(n, xs.length)} |`); }
  L.push('', '## Actions check 1 saw run but no scenario performs yet', '', 'Check 1 never accepts a write, so these ran only as a side effect of a screen (or a dialog it dismissed).', '');
  const seenAct = c.items.filter((i) => i.kind === 'action' && i.ranInCheck1 && !i.coveredBy.length);
  L.push(seenAct.length ? seenAct.map((i) => '`' + i.name + '`').join(', ') : '–', '');
  // largest uncovered areas: by page (or the file › function that builds the markup when no run reached it)
  const unc = c.items.filter((i) => i.kind !== 'none' && !i.coveredBy.length);
  const byPage = {};
  for (const i of unc) (byPage[i.page] = byPage[i.page] || []).push(i);
  const areas = Object.entries(byPage).sort((a, b) => b[1].length - a[1].length);
  L.push('## Uncovered, by page', '', `${unc.length} items in ${areas.length} areas, largest first. "(not reached) file › fn" = no run reached the function that builds the control.`, '',
    '| page / area | uncovered | view | dialog | action | print | items |', '|---|---|---|---|---|---|---|');
  for (const [p, xs] of areas) {
    const n = (k) => xs.filter((i) => i.kind === k).length;
    L.push(`| ${esc(p)} | ${xs.length} | ${n('view')} | ${n('dialog')} | ${n('action')} | ${n('print')} | ${esc(xs.slice(0, 30).map((i) => (i.type === 'handler' ? '' : i.type + ':') + i.name + (i.uncoveredWhy ? ' (reason given)' : '')).join(', '))}${xs.length > 30 ? ' … +' + (xs.length - 30) : ''} |`);
  }
  L.push('', '## Not counted (kind none)', '', '| item | why |', '|---|---|', ...c.items.filter((i) => i.kind === 'none').map((i) => `| ${esc(i.id)} | ${esc(i.why)} |`), '');
  return L.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const list = (s) => (s ? s.split(',').filter(Boolean) : []);
  const runs = list(arg('runs', '')), scenarios = list(arg('scenarios', ''));
  if (!runs.length) { console.error('usage: node test/uiparity/coverage.mjs --runs=<run-dir>[,…] [--scenarios=<dir>,…] [--legacy-dir=…] [--out=<dir>]'); process.exit(2); }
  const c = coverage({ legacyDir: arg('legacy-dir', process.env.LEGACY_DIR || 'D:/projects/wt-uip-legacy'), runs, scenarios, kindsFile: arg('kinds', path.join(HERE, 'coverage-kinds.json')) });
  const out = arg('out', runs[0]);
  fs.mkdirSync(out, { recursive: true });   // a new --out folder
  fs.writeFileSync(path.join(out, 'coverage.md'), coverageMd(c));
  fs.writeFileSync(path.join(out, 'coverage.json'), JSON.stringify({ per: c.per, total: c.total, items: c.items }, null, 1));
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) : '0';
  console.log(`coverage ${c.total.covered}/${c.total.items} = ${pct(c.total.covered, c.total.items)}% · ` + Object.entries(c.per).map(([k, v]) => `${k} ${v.covered}/${v.items}`).join(' · ') + ` · ${c.unexplained.length} uncovered without a reason · ${path.join(out, 'coverage.md')}`);
  process.exit(c.total.items && c.total.covered / c.total.items >= 0.95 && !c.unexplained.length ? 0 : 1);
}
