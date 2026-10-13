#!/usr/bin/env node
// Re-derive the allotment_v2.html JS/CSS split.
//
// The split (a382cde for the JS, a6488c8 for the CSS) was a one-off, but it has to be repeatable,
// because lk-inbox still carries the monolithic HTML and every merge from it brings 100k lines of
// inline <script>/<style> back against the eight <script src> one-liners here. Git cannot resolve
// that textually — the 2026-09-07 merge produced six conflict hunks covering 96,722 of 99,682
// lines. What works instead is to split BOTH sides with this script and merge in split space,
// three-way, one artifact at a time, against a merge-base that has been split the same way.
//
//   node tools/split-inline-assets.mjs <input.html> <outDir>
//     → <outDir>/allotment_v2.html + <outDir>/js/*.js + <outDir>/css/*.css
//
//   node tools/split-inline-assets.mjs --verify
//     → replays the split against the pre-split HTML in git and checks all eleven outputs
//       byte-for-byte against what the original commits produced. Run this before trusting it.
//
// Merging a fresh lk-inbox, in outline:
//   git merge origin/lk-inbox                       # conflicts on allotment_v2.html only
//   <this> <base HTML from the merge base> baseDir  # git show <mergebase>:allotment_v2/...
//   <this> <their HTML>                  theirsDir
//   for each of the 11 files: git merge-file ours baseDir/f theirsDir/f
// Do it on blob content (git show / git cat-file), not on working-tree files: with core.autocrlf
// on Windows the working copies are CRLF and the blobs are LF, and merging across that difference
// makes every line conflict.
//
// Boundary detection is the real content of this script. It cannot be a line-number map (upstream
// moves every line) and it cannot be a naive scan for <script>: js/04-data-core.js contains the
// string `<script>` inside the restoreScript template literal, ~7,700 lines into its own block.
// It follows the actual HTML rule instead — a script element ends at the first `</script` followed
// by whitespace, `>` or `/`, wherever it appears — which is correct by construction, because a
// browser applies exactly that rule and the file has to load in a browser. Quoted attribute values
// and comments are skipped so a `<script` inside either is not mistaken for a tag.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Load order, and the reason it is fixed: these are classic scripts sharing one global scope, so
// renaming or reordering breaks the ~2,500 inline onclick= handlers. See allotment_v2/js/README.md.
const JS_NAMES = ['01-auth-sync.js', '02-sidebar.js', '03-topbar-nav.js', '04-data-core.js',
                  '05-fleet.js', '06-engine-assign.js', '07-charter.js', '08-app.js'];

export function scan(html) {
  const out = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    const m = /^<(script|style)(?=[\s>/])/i.exec(html.slice(lt, lt + 8));
    if (!m) { i = lt + 1; continue; }
    const kind = m[1].toLowerCase();
    let j = lt + 1 + kind.length, q = null;
    while (j < n) {                                   // end of the open tag, respecting quotes
      const c = html[j];
      if (q) { if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
      j++;
    }
    if (j >= n) break;
    const openEnd = j, attrs = html.slice(lt + 1 + kind.length, openEnd), bodyStart = openEnd + 1;
    const rm = new RegExp('</' + kind + '(?=[\\s>/])', 'i').exec(html.slice(bodyStart));
    if (!rm) { i = bodyStart; continue; }
    const bodyEnd = bodyStart + rm.index;
    let k = bodyEnd;
    while (k < n && html[k] !== '>') k++;
    out.push({ kind, attrs, tagStart: lt, bodyStart, bodyEnd, closeEnd: k + 1 });
    i = k + 1;
  }
  return out;
}

export function splitJs(html) {
  const els = scan(html).filter(e => e.kind === 'script' && !/\bsrc\s*=/i.test(e.attrs));
  if (els.length !== JS_NAMES.length)
    throw new Error(`expected ${JS_NAMES.length} inline <script> blocks, found ${els.length} — ` +
                    'the block structure changed; do not guess, work out which block moved first');
  const files = {};
  let out = '', cur = 0;
  els.forEach((e, i) => {
    files[JS_NAMES[i]] = html.slice(e.bodyStart, e.bodyEnd);   // verbatim, no reformatting
    out += html.slice(cur, e.tagStart) + `<script src="js/${JS_NAMES[i]}"></script>`;
    cur = e.closeEnd;
  });
  return { html: out + html.slice(cur), files };
}

export function splitCss(html) {
  const headEnd = html.search(/<\/head\s*>/i);
  if (headEnd < 0) throw new Error('no </head>');
  // Head <style> only. The two view-scoped blocks in <body> stay inline on purpose — they are small
  // and not worth a render-blocking request.
  const els = scan(html).filter(e => e.kind === 'style' && e.tagStart < headEnd);
  if (els.length < 3) throw new Error(`only ${els.length} head <style> block(s) — expected the two ` +
                                      'anonymous base blocks plus the id="*-skin" layers');
  // First two anonymous blocks are the base sheet; everything after is a re-skin layer, each kept
  // behind a marker so a layer can still be reverted by deleting marker-to-marker.
  const [base, skins] = [els.slice(0, 2), els.slice(2)];
  for (const s of skins) {
    const m = /id\s*=\s*"([^"]+)"/i.exec(s.attrs);
    if (!m) throw new Error('head <style> after the base blocks has no id=: ' + s.attrs.trim());
    s.id = m[1];
  }
  const body = e => html.slice(e.bodyStart, e.bodyEnd);
  const baseCss = base.map(body).join('');
  const skinCss = skins.map(e => `/* ==== ${e.id} ==== */\n` + body(e)).join('');

  let out = '', cur = 0;
  els.forEach((e, i) => {
    out += html.slice(cur, e.tagStart);
    if (i === 0) out += '<link rel="stylesheet" href="css/01-base.css">\n' +
                        '<link rel="stylesheet" href="css/02-skins.css">';
    let end = e.closeEnd;
    if (html[end] === '\r') end++;
    if (html[end] === '\n') end++;
    else if (i === 0) throw new Error('the first head <style> is not newline-terminated');
    cur = end;
    if (i === 0) out += '\n';
  });
  return { html: out + html.slice(cur), base: baseCss, skins: skinCss };
}

export function split(html) {
  const a = splitJs(html);
  const b = splitCss(a.html);
  return { html: b.html, js: a.files, css: { '01-base.css': b.base, '02-skins.css': b.skins } };
}

function write(outDir, r) {
  fs.mkdirSync(path.join(outDir, 'js'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'css'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'allotment_v2.html'), r.html);
  for (const [n, c] of Object.entries(r.js)) fs.writeFileSync(path.join(outDir, 'js', n), c);
  for (const [n, c] of Object.entries(r.css)) fs.writeFileSync(path.join(outDir, 'css', n), c);
}

// Replay against history: split the HTML as it was immediately before the JS split, and require
// every output to match the blob the original commits actually produced. a382cde is the JS split,
// a6488c8 the CSS split; the tree at a6488c8 is the first that has all eleven files.
function verify() {
  const git = (...a) => execFileSync('git', a, { encoding: 'buffer', maxBuffer: 1 << 30 });
  const html = git('show', 'a382cde^:allotment_v2/allotment_v2.html').toString('utf8');
  const r = split(html);
  const got = { 'allotment_v2.html': r.html };
  for (const [n, c] of Object.entries(r.js)) got['js/' + n] = c;
  for (const [n, c] of Object.entries(r.css)) got['css/' + n] = c;

  let bad = 0;
  for (const [rel, content] of Object.entries(got)) {
    const want = git('rev-parse', `a6488c8:allotment_v2/${rel}`).toString().trim();
    const mine = execFileSync('git', ['hash-object', '--stdin'], { input: content }).toString().trim();
    const ok = want === mine;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${rel}`);
  }
  console.log(bad ? `\n${bad} file(s) differ from the original split` : '\nall 11 byte-identical');
  process.exit(bad ? 1 : 0);
}

const [, , a1, a2] = process.argv;
if (a1 === '--verify') verify();
else if (!a1 || !a2) {
  console.error('usage: split-inline-assets.mjs <input.html> <outDir>   |   --verify');
  process.exit(2);
} else {
  write(a2, split(fs.readFileSync(a1, 'utf8')));
  console.log('wrote ' + a2);
}
