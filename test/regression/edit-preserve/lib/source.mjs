// LAM-25: reads allotment_v2.html straight off disk and hands back small, literal-substring
// extraction helpers so the edit-preserve tests execute the REAL carry-over lines from the app,
// not a paraphrase of them.
//
// Read-only by design — this module (and everything in test/regression/edit-preserve/) never
// writes to allotment_v2.html. The default path resolves to the real, tracked file. For the
// "delete a carry-over line and confirm the suite goes red" verification proof, point
// EDIT_PRESERVE_HTML_PATH at a throwaway COPY (outside the repo) with one line removed instead —
// see docs/development/tasks/LAM-25.md "Verification" for the exact commands used.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveHtmlPath() {
  if (process.env.EDIT_PRESERVE_HTML_PATH) return path.resolve(process.env.EDIT_PRESERVE_HTML_PATH);
  // test/regression/edit-preserve/lib -> repo root is four levels up.
  return path.resolve(__dirname, '../../../../allotment_v2/allotment_v2.html');
}

const _cache = new Map();

export function getSource() {
  const p = resolveHtmlPath();
  if (!_cache.has(p)) {
    // allotment_v2.html is saved with CRLF line endings on this checkout. Normalize to LF so
    // every marker string below can be written as a plain JS string literal and still match.
    _cache.set(p, fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
  }
  return _cache.get(p);
}

// Clears the cached source for the CURRENT resolveHtmlPath() only — used by tests that swap
// EDIT_PRESERVE_HTML_PATH mid-process (none do today; kept for the manual mutation-proof runs
// documented in the task report, which instead swap the env var and spawn a fresh process).
export function resetCache() {
  _cache.delete(resolveHtmlPath());
}

export function assertUnique(src, marker) {
  const first = src.indexOf(marker);
  if (first === -1) {
    throw new Error(
      'edit-preserve marker not found in ' + resolveHtmlPath() + ' (the carry-over line was ' +
      'deleted, moved, or reworded): ' + JSON.stringify(marker.slice(0, 120))
    );
  }
  const second = src.indexOf(marker, first + marker.length);
  if (second !== -1) {
    throw new Error('edit-preserve marker is not unique (found at least twice): ' + JSON.stringify(marker.slice(0, 120)));
  }
  return first;
}

// A single, already-self-contained statement (e.g. `if(editing.X) newBk.X = editing.X;`).
// Asserts it exists verbatim, exactly once, in the source, then hands back that exact text to be
// executed as-is. This is what makes "delete this line in allotment_v2.html" mean "this one
// field's test fails loudly" — no line found => assertUnique throws => the test errors instead of
// silently running stale logic.
export function extractLine(marker) {
  const src = getSource();
  assertUnique(src, marker);
  return marker;
}

// Extracts everything between two unique, literal substrings (inclusive). Used for carry-over
// blocks that are not single self-contained statements (the b2cOverride else-if branch, the
// resolved-approval else-if branch, the decided-focApproval if-block).
export function extractBetween(startMarker, endMarker) {
  const src = getSource();
  assertUnique(src, startMarker);
  if (startMarker !== endMarker) assertUnique(src, endMarker);
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s + startMarker.length);
  if (e === -1) {
    throw new Error('extractBetween: end marker not found after start — ' + JSON.stringify(endMarker.slice(0, 80)));
  }
  return src.slice(s, e + endMarker.length);
}
