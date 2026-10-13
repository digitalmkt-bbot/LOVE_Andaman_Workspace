#!/usr/bin/env node
// Pull lk-inbox into the refactor branch without losing upstream fixes to code we've moved.
//
// The problem: lk-inbox keeps editing functions inside js/08-app.js (bkV2Foo) that this branch has
// renamed and moved out into their own files (js/booking/bookingV2Foo.js, see fca9909). A plain
// `git merge` sees "upstream edited lines we deleted" and either conflicts in 3,000-line hunks or,
// worse, gets resolved to ours — and the upstream fix silently never reaches the moved copy.
//
// What this does instead, for the range from = merge-base(HEAD, upstream) .. to = upstream:
//
//   1. Function port. Every top-level function upstream that tools/refactor-manifest.json says we
//      moved is diffed from→to. Changed ones are three-way merged INTO OUR MOVED COPY
//      (base = upstream@from, theirs = upstream@to, both put through the manifest renames;
//      ours = the function in its new file). New upstream functions matching a manifest pattern get
//      their own file + <script> tag; removed ones are reported.
//   2. Everything else. Every other file upstream touched is three-way merged in "our space":
//      base and theirs have the renames applied and the moved functions cut out, so they line up
//      with our files and only real edits conflict.
//   3. Records it as a proper merge (`git merge -s ours --no-commit` + our computed tree), so the
//      next run's merge-base moves forward and nothing is ported twice.
//
//   node tools/sync-upstream.mjs                 # report only, touches nothing
//   node tools/sync-upstream.mjs --apply         # do it; leaves conflicts marked, does not commit
//   node tools/sync-upstream.mjs --to <ref> --from <sha>   # override the range
//   node tools/sync-upstream.mjs --selftest      # check the transform reproduces our tree
//   --ops-spec <url|file>  operation-backend OpenAPI for the "Backend impact" section (default <OPS_BACKEND>/docs/json)
//   --no-spec              skip fetching it
//
// All content is read from git blobs (LF), never the CRLF working copy — merging across that
// difference makes every line conflict.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const MANIFEST_PATH = path.join(ROOT, 'tools/refactor-manifest.json');
const JS_DIR = 'allotment_v2/js';
const HTML = 'allotment_v2/allotment_v2.html';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const git = (a, o = {}) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30, ...o });
const show = (ref, p) => { try { return git(['show', `${ref}:${p}`], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const lsTree = (ref, dir) => git(['ls-tree', '-r', '--name-only', ref, '--', dir]).split('\n').filter(Boolean);

// ---------- manifest ----------
// {
//   "upstream": "origin/lk-inbox",
//   "renames": [{"from":"bkV2","to":"bookingV2"}],            // identifier prefix renames, word-start only
//   "patterns": [{"match":"^bkV2", "dir":"allotment_v2/js/booking", "insertBefore":"js/09-action-board.js"}],
//   "functions": {"bkV2Foo": "allotment_v2/js/booking/bookingV2Foo.js", ...}
// }
// A function entry may also be {"file": "...", "name": "ourName"} when it was renamed beyond `renames`.
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

function renameText(s) {
  for (const r of manifest.renames || []) {
    // (?<![\w$]) keeps `_bkV2` (an unrelated state object) untouched — same rule as fca9909.
    s = s.replace(new RegExp(`(?<![\\w$])${r.from}`, 'g'), r.to);
  }
  return s;
}
const renameName = (n) => renameText(n);
function entryFor(upName) {
  const e = manifest.functions[upName];
  if (!e) return null;
  return typeof e === 'string' ? { file: e, name: renameName(upName) } : { name: renameName(upName), ...e };
}

// ---------- parsing ----------
function topLevelFunctions(src, file) {
  let ast;
  try {
    ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true });
  } catch (e) {
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch { throw new Error(`parse failed: ${file}: ${e.message}`); }
  }
  // A function owns the comment block above it, back to the previous top-level statement — that is
  // how fca9909 split them (js/booking/bookingV2GetArea.js starts with 08-app.js's "── Helpers ──").
  // A trailing comment on the previous statement's own line stays with that statement.
  const out = new Map();
  let prevEnd = 0;
  for (const node of ast.body) {
    const fn = node.type === 'FunctionDeclaration' ? node
      : (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') && node.declaration?.type === 'FunctionDeclaration' ? node.declaration
      : null;
    if (fn?.id) {
      let s = prevEnd;
      if (prevEnd > 0) { const nl = src.indexOf('\n', prevEnd); s = nl < 0 || nl > node.start ? node.start : nl + 1; }
      while (s < node.start && /\s/.test(src[s])) s++;
      out.set(fn.id.name, { start: s, end: node.end, text: src.slice(s, node.end) });
    }
    prevEnd = node.end;
  }
  return out;
}

// Every top-level function across js/*.js (not subdirs — upstream has none) at a ref.
function upstreamFunctions(ref) {
  const fns = new Map();
  for (const p of lsTree(ref, JS_DIR).filter((p) => /^allotment_v2\/js\/[^/]+\.js$/.test(p))) {
    const src = show(ref, p);
    for (const [name, f] of topLevelFunctions(src, `${ref}:${p}`)) fns.set(name, { ...f, path: p });
  }
  return fns;
}

const isTracked = (upName) => !!manifest.functions[upName];
const patternFor = (upName) => (manifest.patterns || []).find((p) => new RegExp(p.match).test(upName));

// Cut tracked functions out of an upstream file (whole lines they occupy), then apply renames.
// Result should line up with our version of the same file.
function toOurSpace(src, p) {
  if (src == null) return null;
  if (p.endsWith('.js') && p.startsWith(JS_DIR + '/') && !p.slice(JS_DIR.length + 1).includes('/')) {
    const fns = [...topLevelFunctions(src, p).entries()].filter(([n]) => isTracked(n)).map(([, f]) => f);
    fns.sort((a, b) => b.start - a.start);
    for (const f of fns) {
      let s = f.start, e = f.end;
      // take the whole line(s): leading indentation and the trailing newline
      while (s > 0 && (src[s - 1] === ' ' || src[s - 1] === '\t')) s--;
      // eat `  ;\n` after the closing brace, but leave `}   // note` alone — the note stays put
      let e2 = e;
      while (e2 < src.length && (src[e2] === ' ' || src[e2] === '\t' || src[e2] === ';')) e2++;
      if (src[e2] === '\n') e = e2 + 1;
      src = src.slice(0, s) + src.slice(e);
    }
  }
  return renameText(src);
}

// ?v= cache-bust hashes differ on every upstream push and would conflict on every sync. On this
// branch tools/build-assets.mjs re-stamps them from the built bytes at deploy, so the source value is
// meaningless — take ours for any asset both sides reference.
const ASSET_RE = /((?:src|href)="((?:js|css)\/[^"?]+\.(?:js|css)))\?v=[^"]*"/g;
function keepOurAssetVer(text, ours) {
  const mine = new Map([...ours.matchAll(ASSET_RE)].map((m) => [m[2], m[0]]));
  return text.replace(ASSET_RE, (whole, _a, rel) => mine.get(rel) ?? whole);
}

// ---------- three-way merge ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-upstream-'));
let tmpN = 0;
function merge3(ours, base, theirs, label) {
  const d = path.join(TMP, String(tmpN++));
  fs.mkdirSync(d);
  const [o, b, t] = ['ours', 'base', 'theirs'].map((n) => path.join(d, n));
  fs.writeFileSync(o, ours); fs.writeFileSync(b, base); fs.writeFileSync(t, theirs);
  let conflicts = 0, text;
  try {
    text = execFileSync('git', ['merge-file', '-p', '--diff3', '-L', `ours:${label}`, '-L', 'base', '-L', 'upstream', o, b, t],
      { encoding: 'utf8', maxBuffer: 1 << 30 });
  } catch (e) {
    if (typeof e.status === 'number' && e.status > 0 && e.stdout != null) { conflicts = e.status; text = e.stdout; }
    else throw e;
  }
  return { text, conflicts };
}

// ---------- plan ----------
function plan(from, to) {
  const fromFns = upstreamFunctions(from);
  const toFns = upstreamFunctions(to);
  const ports = [], added = [], removed = [], untracked = [];

  for (const [name, t] of toFns) {
    const f = fromFns.get(name);
    const e = entryFor(name);
    if (e) {
      if (!f) { added.push({ name, e, t, reason: 'tracked but new upstream?' }); continue; }
      if (f.text === t.text) continue;
      const oursSrc = show('HEAD', e.file);
      if (oursSrc == null) { ports.push({ name, e, status: 'missing-ours' }); continue; }
      const ourFn = topLevelFunctions(oursSrc, e.file).get(e.name);
      if (!ourFn) { ports.push({ name, e, status: 'missing-ours-fn' }); continue; }
      const m = merge3(ourFn.text, renameText(f.text), renameText(t.text), e.file);
      const newFile = oursSrc.slice(0, ourFn.start) + m.text.replace(/\n$/, ourFn.text.endsWith('\n') ? '\n' : '') + oursSrc.slice(ourFn.end);
      ports.push({ name, e, status: m.conflicts ? 'conflict' : 'clean', conflicts: m.conflicts, newFile,
        upstreamOnly: ourFn.text === renameText(f.text) });
    } else if (!f && patternFor(name)) {
      added.push({ name, t, pat: patternFor(name) });
    } else if (!f) {
      untracked.push(name);
    }
  }
  for (const [name] of fromFns) if (!toFns.has(name) && isTracked(name)) removed.push({ name, e: entryFor(name) });

  // §loadOrder: a new file loads AFTER 08-app.js. If upstream calls the function from top-level code
  // (outside any function body) it runs while 08-app.js is still loading -> ReferenceError, 08-app.js
  // stops mid-file, everything declared below it is in TDZ (499f2c2). Flag it; a human decides placement.
  for (const a of added.filter((x) => x.pat)) {
    const re = new RegExp(`(?<![\\w$])${a.name}(?![\\w$])`);
    for (const p of new Set([...toFns.values()].map((f) => f.path))) {
      const src = show(to, p);
      const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
      if (ast.body.some((n) => n.type !== 'FunctionDeclaration' && re.test(src.slice(n.start, n.end)))) {
        a.loadOrder = p;
        break;
      }
    }
  }

  // New pattern-matched functions become tracked for the rest of the plan, so they're cut from 08-app.js too.
  for (const a of added) if (a.pat) manifest.functions[a.name] = `${a.pat.dir}/${renameName(a.name)}.js`;

  // Non-function files.
  const changed = git(['diff', '--name-status', '--no-renames', from, to]).split('\n').filter(Boolean)
    .map((l) => { const [st, p] = l.split('\t'); return { st, p }; });
  const files = [];
  for (const { st, p } of changed) {
    const base = show(from, p), theirs = show(to, p), ours = show('HEAD', p);
    if (st === 'A') {
      if (ours == null) files.push({ p, status: 'add', text: toOurSpace(theirs, p) });
      else { const m = merge3(ours, '', toOurSpace(theirs, p), p); files.push({ p, status: m.conflicts ? 'conflict' : 'clean', ...m }); }
    } else if (st === 'D') {
      if (ours == null) continue;
      if (ours === toOurSpace(base, p)) files.push({ p, status: 'delete' });
      else files.push({ p, status: 'delete-modified' });
    } else {
      if (ours == null) { files.push({ p, status: 'ours-deleted' }); continue; }
      let b = toOurSpace(base, p), t = toOurSpace(theirs, p);
      if (p === HTML) { b = keepOurAssetVer(b, ours); t = keepOurAssetVer(t, ours); }
      if (b === t) continue; // the upstream change was entirely inside moved functions
      const m = merge3(ours, b, t, p);
      files.push({ p, status: m.conflicts ? 'conflict' : 'clean', ...m });
    }
  }
  return { ports, added, removed, untracked, files, fromFns, toFns };
}

// ---------- backend impact ----------
// This branch has no server.js (deleted 2026-10-12): static-server.js serves files only and the browser
// talks to operation-backend. Whatever upstream builds on lk-inbox's backend is dead here and fails quietly:
//   - an '/api/…' call is a 404;
//   - a write into the localStorage blob (LS_KEY, *Persist(), save()) never leaves the browser, because
//     the blob only reached a server through /api/save.
// So every new or changed upstream function doing either is listed, with operation-backend endpoints
// that look related (from its live OpenAPI spec), for a human to wire through js/ops/ or to build.
const OPS_BACKEND = process.env.OPS_BACKEND || 'https://operationbackend-production.up.railway.app';
const API_LIT = /(['"`])(\/api\/[^'"`\s?#]*)/g;
const BLOB_WRITE = [/\bLS_KEY\b/, /(?<![\w$.])\w*Persist\w*\s*\(/, /(?<![\w$.])(?:save|flSave)\s*\(/];
// lk-inbox files that run on its server, not in the browser
const SERVER_SIDE = /^(server\.js|api-proxy\.js|auth\/|db\/|os-backend\/|b2c-[\w-]+\.js$)/;

async function loadOpsSpec() {
  if (flag('--no-spec')) return { error: 'skipped (--no-spec)' };
  const src = opt('--ops-spec', `${OPS_BACKEND}/docs/json`);
  try {
    const json = /^https?:/.test(src)
      ? await (await fetch(src, { signal: AbortSignal.timeout(10000) })).json()
      : JSON.parse(fs.readFileSync(src, 'utf8'));
    const ops = [];
    for (const [p, o] of Object.entries(json.paths || {})) for (const m of Object.keys(o)) ops.push(`${m.toUpperCase()} ${p}`);
    return { src, ops };
  } catch (e) { return { src, error: e.message }; }
}

const GENERIC = new Set(['api', 'v1', 'get', 'set', 'save', 'load', 'render', 'open', 'close', 'new', 'list', 'all', 'data',
  'persist', 'sync', 'item', 'items', 'row', 'rows', 'css', 'html', 'init', 'show', 'hide', 'tab', 'view', 'go', 'do', 'the']);
function tokens(...names) {
  const out = new Set();
  for (const n of names) for (const t of String(n).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/)) {
    if (t.length >= 3 && !GENERIC.has(t) && !/^\d+$/.test(t)) out.add(t.replace(/s$/, ''));
  }
  return [...out];
}
function candidates(spec, toks) {
  if (!spec.ops || !toks.length) return [];
  return spec.ops.map((o) => ({ o, n: toks.filter((t) => o.toLowerCase().includes(t)).length }))
    .filter((x) => x.n).sort((a, b) => b.n - a.n || a.o.length - b.o.length).slice(0, 4).map((x) => x.o);
}

// '/api/…' route a line of server.js belongs to: the nearest `u === '/api/x'` / `u.startsWith('/api/x')` above it.
function serverRoutes(from, to) {
  const src = show(to, 'server.js');
  if (src == null) return [];
  const lines = src.split('\n');
  const routeAt = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(/\bu\s*(?:===\s*|\.startsWith\(\s*)['"`](\/api\/[^'"`]*)/) || l.match(/\.test\(\s*u\s*\).*?(\/api\/[\w/-]*)/);
    if (m) cur = m[1] + (/req\.method\s*===\s*'(\w+)'/.test(l) ? ` ${l.match(/req\.method\s*===\s*'(\w+)'/)[1]}` : '');
    routeAt.push(cur);
  }
  const hunks = git(['diff', '-U0', from, to, '--', 'server.js']).split('\n').filter((l) => l.startsWith('@@'));
  const old = show(from, 'server.js') || '';
  const touched = new Map();
  for (const h of hunks) {
    const [, s, n = '1'] = h.match(/\+(\d+)(?:,(\d+))?/);
    const a = +s, b = a + Math.max(+n, 1) - 1;
    for (let i = a; i <= b; i++) {
      const r = routeAt[i - 1] || '(top level, before any route)';
      if (!touched.has(r)) touched.set(r, r.startsWith('(') || old.includes(`'${r.split(' ')[0]}'`) ? 'changed' : 'NEW');
    }
  }
  return [...touched].map(([route, kind]) => ({ route, kind }));
}

function backendImpact(from, to, P, spec) {
  // functions our js/ops/ adapters replace (wrap('name', …) / window.name = …)
  const wrapped = new Map();
  for (const p of lsTree('HEAD', `${JS_DIR}/ops`)) {
    const src = show('HEAD', p) || '';
    for (const m of src.matchAll(/\bwrap\(\s*['"]([\w$]+)['"]|window\.([\w$]+)\s*=\s*function/g)) wrapped.set(m[1] || m[2], p);
  }
  // our copy of an upstream function (moved file per the manifest, else the same path) — does it already
  // reach operation-backend? Then the upstream blob write is not the whole story here.
  const parsed = new Map();
  const ourFn = (name, upPath) => {
    const e = entryFor(name), p = e ? e.file : upPath;
    if (!parsed.has(p)) { const s = show('HEAD', p); parsed.set(p, s == null ? new Map() : topLevelFunctions(s, p)); }
    return parsed.get(p).get(renameName(name));
  };
  const OPS_CALL = /\blaOps\b|laOpsFetch|ToOpsBackend|OpsEnsure|EnsureOps/;
  const fns = [];
  for (const [name, t] of P.toFns) {
    const f = P.fromFns.get(name);
    if (f && f.text === t.text) continue;
    const before = f ? f.text : '';
    const api = [...new Set([...t.text.matchAll(API_LIT)].map((m) => m[2]))]
      .map((a) => before.includes(a) ? a : `${a} (new)`);
    const blob = BLOB_WRITE.some((re) => re.test(t.text));
    // reads every booking: here SB_BOOKINGS holds only the date ranges some view has loaded
    const allBk = /\bSB_BOOKINGS\b/.test(t.text);
    const ours = renameName(name), adapter = wrapped.get(ours) || wrapped.get(name);
    // new code leaning on a function an adapter replaced: the adapter may not serve what it now asks
    // (e.g. a month view calling a per-day reader whose adapter caches one day)
    const before2 = f ? f.text : '';
    const callsWrapped = [...wrapped.keys()].filter((w) => w !== ours && w !== name && !/^render/.test(w)   // a redraw, not a data read
      && new RegExp(`(?<![\\w$.])${w.replace(/\$/g, '\\$')}\\s*\\(`).test(t.text)
      && !new RegExp(`(?<![\\w$.])${w.replace(/\$/g, '\\$')}\\s*\\(`).test(before2));
    if (!api.length && !blob && !allBk && !adapter && !callsWrapped.length) continue;
    const mine = ourFn(name, t.path), opsHere = !!(mine && OPS_CALL.test(mine.text));
    if (!api.length && !blob && !adapter && !callsWrapped.length && opsHere) continue;   // only reads bookings, and ours loads them
    fns.push({ name, ours, path: t.path, isNew: !f, api, blob, allBk, adapter, opsHere,
      callsWrapped: callsWrapped.map((w) => `${w} (${wrapped.get(w).replace(JS_DIR + '/', '')})`),
      cand: candidates(spec, tokens(...api.map((a) => a.replace(' (new)', '')), ...(api.length ? [] : [name]))) });
  }
  const server = git(['diff', '--name-only', from, to]).split('\n').filter((p) => p && SERVER_SIDE.test(p));
  return { fns, server, routes: server.includes('server.js') ? serverRoutes(from, to) : [], spec };
}

function reportBackend(B) {
  const L = (s = '') => console.log(s);
  L();
  L(`## Backend impact (no server.js on this branch: /api/* is a 404, blob writes stay in the browser)`);
  L(`  operation-backend spec: ${B.spec.error ? `NOT LOADED (${B.spec.error}) — check ${OPS_BACKEND}/docs by hand` : `${B.spec.ops.length} operations from ${B.spec.src}`}`);
  if (B.server.length) {
    L(`  lk-inbox server-side files changed (not merged into anything that runs here):`);
    for (const p of B.server) L(`    ${p}`);
  }
  if (B.routes.length) {
    L(`  server.js routes touched upstream:`);
    for (const r of B.routes) L(`    ${r.kind.padEnd(8)} ${r.route}`);
  }
  if (!B.fns.length) { L(`  no new/changed upstream function calls /api/*, writes the blob, or is replaced by js/ops/`); return; }
  for (const x of B.fns) {
    const what = [x.api.length && `calls ${x.api.join(', ')}`,
      x.blob && (x.opsHere ? 'writes the legacy blob, but our copy already calls operation-backend — check the change is carried'
        : 'writes the legacy blob (local-only here)'),
      x.callsWrapped.length && `newly calls ${x.callsWrapped.join(', ')} — check the adapter serves these calls (dates, ranges)`,
      x.allBk && !x.opsHere && 'reads SB_BOOKINGS (only loaded date ranges here — misses the rest unless it loads them or the server answers)',
      x.adapter && `WRAPPED HERE by ${x.adapter.replace(JS_DIR + '/', '')} — read it: if it calls the original the change flows through, if it replaces it port the change`].filter(Boolean).join(' · ');
    L(`  ${x.isNew ? 'NEW' : 'chg'} ${x.ours}  [${x.path.replace(JS_DIR + '/', '')}]  ${what}`);
    if ((x.api.length || x.blob || x.allBk) && !x.adapter && !x.opsHere) L(`        operation-backend candidates: ${x.cand.length ? x.cand.join(' | ') : '(none matched by name — check /docs)'}`);
  }
}

// ---------- report ----------
function report(from, to, P) {
  const L = (s = '') => console.log(s);
  L(`upstream ${to}  from ${from.slice(0, 9)}  (${git(['rev-list', '--count', `${from}..${to}`]).trim()} commits)`);
  L();
  L(`## Moved functions changed upstream: ${P.ports.length}`);
  for (const x of P.ports) {
    const tag = { clean: 'ported', conflict: `CONFLICT x${x.conflicts}`, 'missing-ours': 'OUR FILE MISSING', 'missing-ours-fn': 'OUR FN NOT FOUND' }[x.status];
    L(`  ${tag.padEnd(16)} ${x.name} -> ${x.e.file}${x.upstreamOnly ? '' : x.status === 'clean' ? '  (merged with our edits)' : ''}`);
  }
  L();
  L(`## New upstream functions -> new files: ${P.added.length}`);
  for (const a of P.added) {
    L(`  + ${a.name} -> ${a.pat ? `${a.pat.dir}/${renameName(a.name)}.js` : a.reason}`);
    if (a.loadOrder) L(`      LOAD ORDER: referenced from top-level code in ${a.loadOrder} — may need its <script> tag moved above it (see §loadOrder in the HTML)`);
  }
  L();
  L(`## Moved functions deleted upstream: ${P.removed.length}`);
  for (const r of P.removed) L(`  - ${r.name}  (still at ${r.e.file} — delete it + its <script> tag if truly unused)`);
  L();
  const by = (s) => P.files.filter((f) => f.status === s);
  L(`## Other files: ${P.files.length}`);
  for (const s of ['conflict', 'clean', 'add', 'delete', 'delete-modified', 'ours-deleted']) {
    const fs_ = by(s); if (!fs_.length) continue;
    const label = { conflict: 'CONFLICT', clean: 'merged', add: 'added', delete: 'deleted', 'delete-modified': 'UPSTREAM DELETED, WE EDITED', 'ours-deleted': 'we deleted, upstream edited (kept deleted)' }[s];
    L(`  ${label}:`);
    for (const f of fs_) L(`    ${f.p}${f.conflicts ? `  x${f.conflicts}` : ''}`);
  }
  if (P.untracked.length) {
    L();
    L(`## New upstream functions NOT covered by the manifest (stay where upstream put them): ${P.untracked.length}`);
    L('  ' + P.untracked.join(', '));
  }
}

// ---------- apply ----------
function apply(to, P) {
  if (git(['status', '--porcelain', '--untracked-files=no']).trim()) throw new Error('working tree not clean — commit or WIP-commit first');
  git(['merge', '-s', 'ours', '--no-ff', '--no-commit', to]);
  const write = (p, text) => { const f = path.join(ROOT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  const conflicted = [];

  for (const x of P.ports) if (x.newFile != null) { write(x.e.file, x.newFile); if (x.status === 'conflict') conflicted.push(x.e.file); }

  // files first (HTML may be among them), then add new function files + their tags on top
  for (const f of P.files) {
    if (f.status === 'add') write(f.p, f.text);
    else if (f.status === 'clean' || f.status === 'conflict') { write(f.p, f.text); if (f.status === 'conflict') conflicted.push(f.p); }
    else if (f.status === 'delete') fs.rmSync(path.join(ROOT, f.p));
    else if (f.status === 'delete-modified') conflicted.push(f.p);
  }

  if (P.added.some((a) => a.pat)) {
    let html = fs.readFileSync(path.join(ROOT, HTML), 'utf8');
    for (const a of P.added.filter((a) => a.pat)) {
      const file = `${a.pat.dir}/${renameName(a.name)}.js`;
      write(file, renameText(a.t.text) + '\n');
      const src = file.replace(/^allotment_v2\//, '');
      if (html.includes(`src="${src}"`)) continue;
      const anchor = html.search(new RegExp(`<script src="${a.pat.insertBefore.replace(/[.?]/g, '\\$&')}[^"]*"></script>`));
      if (anchor < 0) { conflicted.push(`${HTML} (no anchor for ${src})`); continue; }
      html = html.slice(0, anchor) + `<script src="${src}"></script>\n` + html.slice(anchor);
    }
    write(HTML, html);
    // keep the manifest in step
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  }

  git(['add', '-A', '--', 'allotment_v2', 'tools/refactor-manifest.json']);
  for (const f of P.files.filter((f) => f.status !== 'ours-deleted' && !f.p.startsWith('allotment_v2/'))) {
    if (fs.existsSync(path.join(ROOT, f.p))) git(['add', '--', f.p]); else git(['rm', '-q', '--cached', '--ignore-unmatch', '--', f.p]);
  }
  if (conflicted.length) git(['reset', '-q', '--', ...conflicted.filter((c) => !c.includes(' ('))]);

  console.log();
  console.log(conflicted.length
    ? `Merge staged with ${conflicted.length} file(s) needing hand resolution (diff3 markers, left unstaged):\n  ${conflicted.join('\n  ')}`
    : 'Merge staged cleanly.');
  console.log('Next: resolve markers -> node --check touched js -> git add -> git commit (it is a merge commit).');
  console.log('Abort: git merge --abort' + (conflicted.length ? ' && git checkout HEAD -- ' + conflicted.filter((c) => !c.includes(' (')).join(' ') : '') + '   (merge --abort keeps unstaged files)');
}

// ---------- selftest ----------
// Reproduce our current js/08-app.js + 04-data-core.js from upstream@merge-base. Whatever differs is
// either our own deliberate edits or a transform bug; a big diff here means sync results can't be trusted.
function selftest(from) {
  for (const p of [`${JS_DIR}/08-app.js`, `${JS_DIR}/04-data-core.js`, HTML]) {
    const mine = show('HEAD', p), theirs = toOurSpace(show(from, p), p);
    const d = path.join(TMP, 'st'); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'a'), theirs); fs.writeFileSync(path.join(d, 'b'), mine);
    let out = '';
    const verbose = flag('--verbose');
    try {
      out = execFileSync('git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--ignore-blank-lines', verbose ? '-U1' : '--numstat',
        path.join(d, 'a'), path.join(d, 'b')], { encoding: 'utf8', maxBuffer: 1 << 30 });
    } catch (e) { out = e.stdout || ''; }
    if (verbose) { console.log(`===== ${p}\n${out}`); continue; }
    const [add = 0, del = 0] = out.trim().split(/\s+/).map(Number);
    console.log(`${p}: ${add} lines only ours, ${del} lines only upstream-transformed (blank lines ignored)`);
  }
}

// ---------- main ----------
const to = opt('--to', manifest.upstream || 'origin/lk-inbox');
if (!flag('--no-fetch') && to.startsWith('origin/')) git(['fetch', '-q', 'origin']);
const from = opt('--from', git(['merge-base', 'HEAD', to]).trim());
try {
  if (flag('--selftest')) selftest(from);
  else {
    const P = plan(from, to);
    report(from, to, P);
    reportBackend(backendImpact(from, to, P, await loadOpsSpec()));
    if (flag('--apply')) apply(to, P);
  }
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
