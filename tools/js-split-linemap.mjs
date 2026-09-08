#!/usr/bin/env node
/**
 * js-split-linemap.mjs
 *
 * On 2026-08-27 every inline <script> block was lifted out of allotment_v2/allotment_v2.html into
 * allotment_v2/js/*.js (byte-identical content, same order, classic scripts). Every `fn:NNNNN`
 * citation written before that date — in CLAUDE.md, allotment_v2/docs/**, BACKLOG.md, the
 * .agent-reports/*.json, old Jira tickets — points at a line in the PRE-SPLIT html.
 *
 * This translates those numbers. Note the citations degrade gracefully without it: they all carry
 * the function name, and `grep -rn bkV2InferZone allotment_v2/js/` finds it in one step.
 *
 * Usage:
 *   node tools/js-split-linemap.mjs 69054            -> js/08-app.js:29809
 *   node tools/js-split-linemap.mjs 69054 45332 9843 -> one line per input
 *   node tools/js-split-linemap.mjs --table          -> the whole block map
 *
 * Reverse (new -> old):
 *   node tools/js-split-linemap.mjs -r 08-app.js:29809
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP = JSON.parse(readFileSync(path.join(__dirname, 'js-split-map.json'), 'utf8'));

const args = process.argv.slice(2);

if (!args.length || args[0] === '-h' || args[0] === '--help') {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].split('\n').slice(1).join('\n'));
  process.exit(0);
}

if (args[0] === '--table') {
  console.log('| file | pre-split html lines | file lines | orig_line = file_line + offset |');
  console.log('|---|---|---|---|');
  for (const b of MAP) console.log(`| js/${b.name} | ${b.origStart}-${b.origEnd} | ${b.lines} | ${b.offset} |`);
  process.exit(0);
}

if (args[0] === '-r' || args[0] === '--reverse') {
  for (const a of args.slice(1)) {
    const m = /([^/\\:]+\.js):(\d+)/.exec(a);
    if (!m) { console.log(`${a}  -> not a <file>.js:<line> reference`); continue; }
    const b = MAP.find(b => b.name === m[1]);
    if (!b) { console.log(`${a}  -> unknown file`); continue; }
    console.log(`${a}  -> pre-split allotment_v2.html:${Number(m[2]) + b.offset}`);
  }
  process.exit(0);
}

for (const a of args) {
  const n = Number(a);
  if (!Number.isInteger(n) || n < 1) { console.log(`${a}  -> not a line number`); continue; }
  const b = MAP.find(b => n >= b.origStart && n <= b.origEnd);
  if (!b) { console.log(`${n}  -> markup/CSS, not inside any script block (still in allotment_v2.html, but renumbered)`); continue; }
  console.log(`${n}  -> js/${b.name}:${n - b.offset}`);
}
