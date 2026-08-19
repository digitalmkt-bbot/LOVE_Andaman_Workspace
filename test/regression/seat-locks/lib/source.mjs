// Loads allotment_v2/allotment_v2.html ONCE and provides small, dependency-free
// extraction helpers used by every invariant test in test/regression/seat-locks/.
//
// LAM-26 note: this is a same-purpose sibling of tests/legacy/lib/source.mjs
// (LAM-77, origin/main only — that tree does not exist on this branch). LAM-26
// owns only test/regression/seat-locks/**, not test/helpers/**, so this file is
// a local, minimal re-implementation rather than an edit to a shared helper.
// A follow-up could promote a merged version of both into test/helpers/ once
// LAM-77's branch and this one share a base — see docs/development/tasks/LAM-26.md
// "Follow-ups".
//
// Design note (same as LAM-77): the production file is a single ~83.7k-line
// HTML+JS monolith with no module boundaries. To exercise its *actual* behavior
// (not a paraphrase of it) we pull the real source text for a specific function
// or a specific inline block straight out of the file at test-run time,
// `eval`-run it inside a fresh Node `vm` context with a minimal set of stub
// globals, and assert on its real output. This file only reads
// allotment_v2.html — it is never written to.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HTML_PATH = path.resolve(__dirname, '../../../../allotment_v2/allotment_v2.html');

let _cached = null;
export function getSource() {
  if (_cached === null) {
    // allotment_v2.html is saved with CRLF line endings. Normalize to LF so every
    // marker string used by extractBetween() can be written as a plain JS template
    // literal (with '\n') without silently failing to match on Windows checkouts.
    _cached = fs.readFileSync(HTML_PATH, 'utf8').replace(/\r\n/g, '\n');
  }
  return _cached;
}

// ── Brace-aware scanning (handles '...' "..." `...${ ... }...` // ... and /* ... */) ──
// Needed because the extracted functions contain Thai-language string literals,
// template literals, and nested object/array literals — naive line-slicing or a
// non-string-aware brace counter both mis-extract those.
function skipString(src, i, quote) {
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i;
    i++;
  }
  return i;
}

function skipTemplate(src, i) {
  i++; // past opening backtick
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`') return i;
    if (src[i] === '$' && src[i + 1] === '{') {
      const j = findMatchingBrace(src, i + 1);
      if (j === -1) return src.length - 1;
      i = j + 1;
      continue;
    }
    i++;
  }
  return i;
}

// src[openIdx] must be '{'. Returns the index of the matching '}', honoring
// strings/templates/comments so braces inside them don't throw off the count.
export function findMatchingBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; if (depth === 0) return i; continue; }
    if (c === "'" || c === '"') { i = skipString(src, i, c); continue; }
    if (c === '`') { i = skipTemplate(src, i); continue; }
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
  }
  return -1;
}

// Extracts the full source of a top-level `function NAME(...){ ... }` declaration.
export function extractFunction(name) {
  const src = getSource();
  const re = new RegExp('(^|\\n)function\\s+' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(');
  const m = re.exec(src);
  if (!m) throw new Error('extractFunction: not found — function ' + name + '(');
  const declStart = m.index + m[0].indexOf('function');
  const openParen = src.indexOf('(', declStart);
  // find the closing paren of the parameter list (params here never contain braces)
  let depth = 0, i = openParen;
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) break; }
  }
  const openBrace = src.indexOf('{', i);
  const closeBrace = findMatchingBrace(src, openBrace);
  if (closeBrace === -1) throw new Error('extractFunction: unbalanced braces for ' + name);
  return src.slice(declStart, closeBrace + 1);
}

// Extracts several top-level functions in one call, in the order given, joined
// by newlines — convenient for building a minimal dependency chain for the vm sandbox.
export function extractFunctions(names) {
  return names.map(extractFunction).join('\n');
}

// Extracts everything between two unique, literal substrings. Used for inline
// blocks that are not standalone functions (e.g. the anti-overbook guard inlined
// in bkV2CommitBooking). Throws if either marker is missing or appears more than
// once, so a source edit that breaks the anchor fails loudly instead of silently
// extracting the wrong span.
export function extractBetween(startMarker, endMarker, { includeStart = true, includeEnd = true } = {}) {
  const src = getSource();
  assertUnique(src, startMarker);
  assertUnique(src, endMarker);
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s + startMarker.length);
  if (e === -1) throw new Error('extractBetween: end marker not found after start — ' + endMarker.slice(0, 60));
  const from = includeStart ? s : s + startMarker.length;
  const to = includeEnd ? e + endMarker.length : e;
  return src.slice(from, to);
}

export function assertUnique(src, marker) {
  const first = src.indexOf(marker);
  if (first === -1) throw new Error('marker not found in allotment_v2.html: ' + marker.slice(0, 80));
  const second = src.indexOf(marker, first + marker.length);
  if (second !== -1) throw new Error('marker is not unique in allotment_v2.html (found at least twice): ' + marker.slice(0, 80));
  return first;
}

// Counts literal occurrences of a fixed string in the source — used to enumerate
// every status-exclusion literal / call site rather than assume there is exactly one.
export function occurrences(marker) {
  const src = getSource();
  let count = 0, idx = 0;
  while ((idx = src.indexOf(marker, idx)) !== -1) { count++; idx += marker.length; }
  return count;
}

export function lineOf(marker) {
  const src = getSource();
  const idx = src.indexOf(marker);
  if (idx === -1) return -1;
  return src.slice(0, idx).split('\n').length;
}
