#!/usr/bin/env node
// LAM-27 · guard: fail if a new inline duplicate of the cancelled/rejected/cancelled_weather
// status triple shows up in allotment_v2.html instead of using the shared ACCT_EXCLUDED_STATES
// constant (declared once, near the very top of the file, in the first <script> block — see the
// comment above its declaration for why it lives there instead of next to the accounting helpers
// that used to own it as ACCT_PAID_STATES).
//
// Standalone Node script — NOT wired into package.json or CI. The worker that owns this task
// (LAM-27) does not own the root package.json or .github/workflows, so wiring this into `npm test`
// or a workflow file is out of scope here and is declared as a dependency for whoever owns those
// files (see docs/development/tasks/LAM-27.md).
//
// Usage:
//   node tools/check-excluded-states.mjs [path-to-html]
// Exit code 0  = clean (no new inline duplicates found).
// Exit code 1  = one or more inline duplicates found (see stdout for file:line).
// Exit code 2  = the target file could not be read, or the ACCT_EXCLUDED_STATES declaration
//                itself could not be found (the guard has nothing to anchor against — treat as a
//                setup problem, not "clean").

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const target = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(repoRoot, 'allotment_v2', 'allotment_v2.html');

if (!existsSync(target)) {
  console.error(`[check-excluded-states] cannot find target file: ${target}`);
  process.exit(2);
}

const STATUSES = ['cancelled', 'rejected', 'cancelled_weather'];
const QUOTED = STATUSES.map((s) => `(?:'${s}'|"${s}")`);

// Any 3-element array literal whose entries are exactly {cancelled, rejected, cancelled_weather}
// in ANY order (each STATUSES value used exactly once) — e.g. ['cancelled','rejected','cancelled_weather']
// or ['cancelled_weather','cancelled','rejected'], single- or double-quoted, any inner whitespace.
function buildArrayLiteralRegex() {
  const perms = permutations(QUOTED);
  const alts = perms.map((p) => `\\[\\s*${p.join(',\\s*')}\\s*\\]`);
  return new RegExp(alts.join('|'), 'g');
}

// A chained `x.status === 'a' || x.status === 'b' || x.status === 'c'` (or `==`, no-space `===`)
// using the same object/property expression each time, covering the same 3 values in any order.
// One regex per permutation (each needs its own \1 backreference to the repeated object
// expression) — a single alternation would misnumber the capture groups across alternatives.
function buildChainedComparisonRegexes() {
  const perms = permutations(STATUSES);
  const expr = "([A-Za-z_$][A-Za-z0-9_$.]*\\.status)";
  return perms.map(
    (p) =>
      new RegExp(
        `${expr}\\s*===?\\s*'${p[0]}'\\s*\\|\\|\\s*\\1\\s*===?\\s*'${p[1]}'\\s*\\|\\|\\s*\\1\\s*===?\\s*'${p[2]}'`,
        'g'
      )
  );
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

const html = readFileSync(target, 'utf8');
const lines = html.split('\n');

const declLineIdx = lines.findIndex((l) => /const\s+ACCT_EXCLUDED_STATES\s*=/.test(l));
if (declLineIdx === -1) {
  console.error(
    '[check-excluded-states] could not find "const ACCT_EXCLUDED_STATES = ..." in the target file — ' +
      'has it been renamed or removed? The guard has nothing to anchor against.'
  );
  process.exit(2);
}

const arrayRe = buildArrayLiteralRegex();
const chainedRegexes = buildChainedComparisonRegexes();

const hits = [];
lines.forEach((line, idx) => {
  const lineNo = idx + 1;
  if (idx === declLineIdx) return; // the single source of truth itself is not a violation

  arrayRe.lastIndex = 0;
  let m;
  while ((m = arrayRe.exec(line))) {
    hits.push({ line: lineNo, kind: 'array-literal', snippet: m[0] });
  }

  for (const re of chainedRegexes) {
    re.lastIndex = 0;
    while ((m = re.exec(line))) {
      hits.push({ line: lineNo, kind: 'chained-comparison', snippet: m[0] });
    }
  }
});

if (hits.length) {
  console.error(
    `[check-excluded-states] FAIL — found ${hits.length} new inline duplicate(s) of the ` +
      `cancelled/rejected/cancelled_weather triple in ${path.relative(repoRoot, target)}.\n` +
      'Use the ACCT_EXCLUDED_STATES constant (declared near the top of the file) instead:\n'
  );
  for (const h of hits) {
    console.error(`  ${path.relative(repoRoot, target)}:${h.line}  [${h.kind}]  ${h.snippet}`);
  }
  console.error(
    '\nIf this site is intentionally NOT the same set (e.g. it also matches "completed", or it ' +
      'deliberately checks only 2 of the 3 statuses), leave it as a literal and do not add it to ' +
      'ACCT_EXCLUDED_STATES — but do not write out all 3 exact values either; extract the differing ' +
      'subset/superset to its own named constant instead so this guard has something precise to allow.'
  );
  process.exit(1);
}

console.log(
  `[check-excluded-states] OK — no inline duplicates of the excluded-status triple in ${path.relative(
    repoRoot,
    target
  )} (single source of truth: ACCT_EXCLUDED_STATES, line ${declLineIdx + 1}).`
);
process.exit(0);
