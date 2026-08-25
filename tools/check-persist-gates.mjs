#!/usr/bin/env node
/**
 * check-persist-gates.mjs  (LAM-17)
 *
 * Static check for allotment_v2/allotment_v2.html's `laCanEditArea` permission gates.
 *
 * Background: `sbInvoicesPersist()` (gated on the 'accounting' area) and
 * `acctPersistBookings()` (gated on 'operations') both write into the same
 * SB_BOOKINGS-backed blob during a single business action (e.g. issuing an
 * invoice stamps bk.invoiceId/paymentStatus/history, then persists the
 * booking list). Before LAM-17, an accounting-only user's invoice write
 * would succeed while the sibling booking write silently no-op'd, leaving
 * bk.invoiceId/paymentStatus/history in RAM only — lost on refresh.
 *
 * This script guards against that class of bug recurring:
 *
 *  1. NESTED  — function A is itself a "*Persist*"-named helper gated on
 *     area-set Ga, and its own body directly calls another such helper B
 *     gated on area-set Gb. If Ga is not a subset of Gb (some area that lets
 *     you pass A's gate does NOT let you pass B's), that's a caller invoking
 *     a *stricter* callee — flagged as `nested-stricter-callee`.
 *
 *  2. SIBLING — any function F's body directly calls two or more distinct
 *     "*Persist*" helpers whose gated area-sets share no area in common.
 *     A user who satisfies only one of those areas will persist one write
 *     and silently drop the other — exactly LAM-17's shape. Flagged as
 *     `sibling-disjoint-gates`.
 *
 * Area-set extraction is a best-effort static heuristic (regex + brace
 * matching over the extracted main <script>), not a real JS interpreter:
 *   - A gate of the form `laCanEditArea('X')` found in the function's own
 *     guard clause contributes area X.
 *   - A gate expressed as `laCanEditArea('X') || laCanEditArea('Y')` (an
 *     OR-of-areas pattern, e.g. ckCanEdit's operations||pier) contributes
 *     both X and Y — either is sufficient to pass.
 *   - A function with NO detectable laCanEditArea call in its body (and no
 *     call to a *CanEdit helper we can resolve) is treated as UNGATED
 *     (area-set = null, meaning "always callable") — e.g. a thin wrapper
 *     that just delegates to another persist helper. Ungated callers/callees
 *     never produce a violation on their own (there is nothing to be
 *     stricter or looser than) — they're only meaningful as evidence when
 *     paired with a gated function on the other side of the check.
 *   - One level of indirection through helpers named /CanEdit$/ (e.g.
 *     ckCanEdit, poCanEdit) is resolved by scanning THAT helper's body for
 *     laCanEditArea('X') calls anywhere inside it (any branch), which is an
 *     intentionally permissive (superset) approximation.
 *
 * Usage:
 *   node tools/check-persist-gates.mjs [path/to/allotment_v2.html]
 *
 * Exit code 0 = no findings. Exit code 1 = findings printed to stderr.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGET = path.resolve(__dirname, '..', 'allotment_v2', 'allotment_v2.html');
const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_TARGET;

const html = readFileSync(targetPath, 'utf8');

// ---------------------------------------------------------------------------
// 1. Extract the main app <script> block (the one containing the persist
//    helpers). We can't just pair "<script>" / "</script>" by line-grep:
//    the file also builds printable HTML strings at runtime that contain
//    literal '<script>...<\/script>' text (escaped close, so it never
//    matches a plain "</script>" scan) — those produce spurious unmatched
//    opens. Instead we take the LAST real "</script>" in the file, which
//    closes the trailing main app script, and the nearest real "<script>"
//    open that precedes the first known persist-helper definition.
// ---------------------------------------------------------------------------
const lastCloseIdx = html.lastIndexOf('</script>');
if (lastCloseIdx === -1) {
  console.error('check-persist-gates: no </script> found in ' + targetPath);
  process.exit(2);
}
// Find the anchor function every version of this file is expected to define
// (sbInvoicesPersist), then walk backward to the nearest preceding "<script>".
const anchor = html.indexOf('function sbInvoicesPersist');
if (anchor === -1) {
  console.error('check-persist-gates: anchor function sbInvoicesPersist not found — file shape changed, update this tool.');
  process.exit(2);
}
const openIdx = html.lastIndexOf('<script>', anchor);
if (openIdx === -1 || openIdx > anchor) {
  console.error('check-persist-gates: could not locate the opening <script> tag for the main app script.');
  process.exit(2);
}
const scriptStart = openIdx + '<script>'.length;
const script = html.slice(scriptStart, lastCloseIdx);

// ---------------------------------------------------------------------------
// 2. Locate every top-level `function NAME(...) { ... }` definition whose
//    name contains "Persist" (case-sensitive, matches the codebase's own
//    naming convention — sbInvoicesPersist, acctPersistBookings, ckPersist,
//    bkV2PersistBookings, _docCheckPersist, ...) plus any `*CanEdit`
//    resolver helpers those gates delegate to (ckCanEdit, poCanEdit, ...).
//    Extract each one's full body via balanced-brace scanning.
// ---------------------------------------------------------------------------
function extractFunctions(src, namePattern) {
  const out = [];
  const re = new RegExp('function\\s+(' + namePattern + ')\\s*\\(', 'g');
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const parenStart = re.lastIndex - 1;
    let depth = 0, i = parenStart, parenEnd = -1;
    for (; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') { depth--; if (depth === 0) { parenEnd = i; break; } }
    }
    if (parenEnd === -1) continue;
    let braceStart = src.indexOf('{', parenEnd);
    if (braceStart === -1) continue;
    depth = 0;
    let bodyEnd = -1;
    for (i = braceStart; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { bodyEnd = i; break; } }
    }
    if (bodyEnd === -1) continue;
    const body = src.slice(braceStart + 1, bodyEnd);
    const lineNo = src.slice(0, m.index).split('\n').length;
    out.push({ name, body, line: lineNo });
  }
  return out;
}

const persistFns = extractFunctions(script, '\\w*Persist\\w*');
const canEditFns = extractFunctions(script, '\\w*CanEdit\\w*');
const canEditByName = new Map(canEditFns.map(f => [f.name, f]));

// ---------------------------------------------------------------------------
// 3. Area-set extraction.
// ---------------------------------------------------------------------------
function areasIn(body) {
  const areas = new Set();
  const re = /laCanEditArea\(\s*'([a-zA-Z0-9_]+)'\s*\)/g;
  let m;
  while ((m = re.exec(body))) areas.add(m[1]);
  return areas;
}

function resolveAreaSet(body) {
  // Direct laCanEditArea('X') calls in this function's own body.
  const direct = areasIn(body);
  if (direct.size > 0) return direct;
  // One level of indirection: a call to a *CanEdit helper (e.g. `if(!ckCanEdit())`,
  // `if(!poCanEdit())`), resolved by scanning THAT helper's own body.
  const callRe = /\b(\w*CanEdit\w*)\s*\(/g;
  let m;
  const resolved = new Set();
  while ((m = callRe.exec(body))) {
    const helper = canEditByName.get(m[1]);
    if (helper) for (const a of areasIn(helper.body)) resolved.add(a);
  }
  if (resolved.size > 0) return resolved;
  return null; // ungated (as far as this static heuristic can tell)
}

const gateInfo = new Map(); // name -> { areas: Set|null, line }
for (const fn of persistFns) {
  gateInfo.set(fn.name, { areas: resolveAreaSet(fn.body), line: fn.line, body: fn.body });
}

const persistNames = [...gateInfo.keys()];

// ---------------------------------------------------------------------------
// 4. Find direct calls from one persist helper's body to another persist
//    helper (NESTED), and direct calls from ANY function body (persist
//    helper or not) to 2+ persist helpers with disjoint gates (SIBLING).
//    For SIBLING we scan every top-level function in the script, not just
//    the persist helpers themselves, since the real-world bug (LAM-17) sits
//    in a *business* function (acctCreateInvoice) that calls two sibling
//    persist helpers directly, without a gate of its own.
// ---------------------------------------------------------------------------
function findCalls(body, candidateNames, selfName) {
  const found = [];
  for (const cand of candidateNames) {
    if (cand === selfName) continue;
    const re = new RegExp('\\b' + cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(');
    if (re.test(body)) found.push(cand);
  }
  return found;
}

function isSubset(a, b) {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

const findings = [];

// 4a. NESTED: persist-helper -> persist-helper
for (const fn of persistFns) {
  const callerInfo = gateInfo.get(fn.name);
  if (!callerInfo.areas) continue; // ungated caller can't be "stricter" than anything
  const calls = findCalls(fn.body, persistNames, fn.name);
  for (const calleeName of calls) {
    const calleeInfo = gateInfo.get(calleeName);
    if (!calleeInfo || !calleeInfo.areas) continue; // ungated callee always proceeds once reached
    if (!isSubset(callerInfo.areas, calleeInfo.areas)) {
      findings.push({
        kind: 'nested-stricter-callee',
        caller: fn.name, callerLine: fn.line, callerAreas: [...callerInfo.areas],
        callee: calleeName, calleeLine: calleeInfo.line, calleeAreas: [...calleeInfo.areas],
        detail: `${fn.name} (gated on [${[...callerInfo.areas].join(',')}]) calls ${calleeName} `
          + `(gated on [${[...calleeInfo.areas].join(',')}]) — an area sufficient to enter ${fn.name} `
          + `is not always sufficient to pass ${calleeName}'s own gate.`,
      });
    }
  }
}

// 4b. SIBLING: any function body calling 2+ persist helpers with disjoint gates.
const allTopLevelFns = extractFunctions(script, '\\w+');
for (const fn of allTopLevelFns) {
  const calls = findCalls(fn.body, persistNames, fn.name).filter(n => gateInfo.get(n) && gateInfo.get(n).areas);
  if (calls.length < 2) continue;
  for (let i = 0; i < calls.length; i++) {
    for (let j = i + 1; j < calls.length; j++) {
      const aName = calls[i], bName = calls[j];
      const aAreas = gateInfo.get(aName).areas, bAreas = gateInfo.get(bName).areas;
      const disjoint = ![...aAreas].some(x => bAreas.has(x));
      if (disjoint) {
        findings.push({
          kind: 'sibling-disjoint-gates',
          caller: fn.name, callerLine: fn.line,
          calleeA: aName, calleeAAreas: [...aAreas],
          calleeB: bName, calleeBAreas: [...bAreas],
          detail: `${fn.name} calls both ${aName} (gated on [${[...aAreas].join(',')}]) and ${bName} `
            + `(gated on [${[...bAreas].join(',')}]) with no area in common — a user holding only one `
            + `of those areas will persist one write and silently drop the other.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Report.
// ---------------------------------------------------------------------------
if (findings.length === 0) {
  console.log(`check-persist-gates: OK — ${persistFns.length} persist helper(s) scanned, no stricter-callee or disjoint-sibling gates found.`);
  process.exit(0);
}

console.error(`check-persist-gates: ${findings.length} finding(s):\n`);
for (const f of findings) {
  if (f.kind === 'nested-stricter-callee') {
    console.error(`[nested-stricter-callee] ${f.caller} (line ~${f.callerLine}) -> ${f.callee} (line ~${f.calleeLine})`);
  } else {
    console.error(`[sibling-disjoint-gates] ${f.caller} (line ~${f.callerLine}): ${f.calleeA} vs ${f.calleeB}`);
  }
  console.error('  ' + f.detail + '\n');
}
process.exit(1);
