// DB-change freeze — until FREEZE_UNTIL (inclusive, Asia/Bangkok) any change that needs a
// database change must go through a pull request, never a direct push to lk-inbox (which IS prod:
// Railway deploys it and db/migrations/*.sql run against the live database on boot).
//
// Two gates use this module:
//   1. .claude/settings.json PreToolUse hook  →  `node tools/db-freeze.mjs claude-hook`
//      Stops a Claude Code session the moment it tries to write a migration / mapping / DDL, or
//      to push such a change to lk-inbox, and tells it to alert the user.
//   2. .githooks/pre-push                    →  `node tools/db-freeze.mjs pre-push <remote>`
//      Refuses `git push` to lk-inbox when the pushed commits carry a DB change, whoever pushes.
//      Enable once per clone: `git config core.hooksPath .githooks` (npm install does it).
//
// Working on the PR branch on purpose: start Claude with ALLOW_DB_CHANGE=1 to lift gate 1.
// Gate 2 still applies to lk-inbox; the PR merge on GitHub is the way in.
// After FREEZE_UNTIL both gates switch themselves off — delete this file and the hooks then.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const FREEZE_UNTIL = '2026-10-15';
const PROD_BRANCH = 'lk-inbox';

// Files whose every change is a DB change.
const DB_PATHS = [
  /^db\/migrations\//,
  /^db\/baseline\//,
  /^os-backend\/src\/mapping\/field_mapping\.json$/,
  /^os-backend\/src\/mapping\/operation_schemas_model\.json$/,
  /^platform\/packages\/db\/migrations\//,
];
// Files where only *new* DDL counts (server.js initDb runs ALTER/CREATE at boot).
const DDL_PATHS = [/^server\.js$/, /^os-backend\//, /^db\//, /^platform\/packages\/db\//, /^platform\/apps\/api\//, /\.sql$/i];

const DDL_RE = /\b(?:ALTER\s+TABLE|CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(?:TEMP(?:ORARY)?\s+)?(?:TABLE|INDEX|VIEW|MATERIALIZED\s+VIEW|SCHEMA|TYPE|SEQUENCE|FUNCTION|TRIGGER|EXTENSION)|DROP\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|INDEX|COLUMN|SCHEMA|TYPE|SEQUENCE|FUNCTION|TRIGGER|CONSTRAINT)|ADD\s+(?:COLUMN|CONSTRAINT)|RENAME\s+COLUMN|TRUNCATE\s+(?:TABLE\s+)?\w)/gi;

export function freezeActive(now = new Date()) {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD
  return today <= FREEZE_UNTIL;
}

const norm = (p) => String(p || '').replace(/\\/g, '/');
const ddlStatements = (text) => {
  const out = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    if (DDL_RE.test(line)) out.add(line.trim().replace(/\s+/g, ' '));
    DDL_RE.lastIndex = 0;
  }
  return out;
};
// DDL lines present in `after` that were not already in `before`.
const newDdl = (before, after) => [...ddlStatements(after)].filter((l) => !ddlStatements(before).has(l));

const isDbPath = (rel) => DB_PATHS.some((re) => re.test(rel));
const isDdlPath = (rel) => DDL_PATHS.some((re) => re.test(rel));

function message(reason) {
  return [
    `DB CHANGE FREEZE (until ${FREEZE_UNTIL}) - blocked: ${reason}`,
    '',
    'Any update that requires a database change (migration, field_mapping.json, new/altered',
    `table, column, view or index) must go through a PULL REQUEST until ${FREEZE_UNTIL}.`,
    `Do NOT push it to ${PROD_BRANCH} directly - ${PROD_BRANCH} is production and migrations run on the live DB at deploy.`,
    '',
    'STOP this task now and tell the user:',
    '  "This feature needs a database change. Until 15 Oct, DB changes must be opened as a PR',
    `   (branch from origin/${PROD_BRANCH}, open a PR into ${PROD_BRANCH}) for review - I have not made the change."`,
    'Do not look for a workaround (no client-only stand-in, no raw SQL, no other file).',
  ].join('\n');
}

// ---------- git range inspection (pre-push and Claude `git push`) ----------
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 << 20 });

export function dbChangesInRange(base, head, cwd = process.cwd()) {
  const hits = [];
  const files = git(['diff', '--name-only', base, head], cwd).split('\n').filter(Boolean);
  for (const f of files) {
    if (isDbPath(f)) { hits.push(f); continue; }
    if (!isDdlPath(f)) continue;
    const diff = git(['diff', '-U0', base, head, '--', f], cwd).split('\n');
    const side = (c) => diff.filter((l) => l[0] === c && !l.startsWith(c.repeat(3))).map((l) => l.slice(1)).join('\n');
    const ddl = newDdl(side('-'), side('+'));
    if (ddl.length) hits.push(`${f}: ${ddl[0].slice(0, 100)}`);
  }
  return hits;
}

// ---------- gate 1: Claude Code PreToolUse hook ----------
function claudeHook() {
  if (!freezeActive() || process.env.ALLOW_DB_CHANGE === '1') return 0;
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { return 0; }
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  const cwd = input.cwd || process.cwd();
  let root = cwd;
  try { root = git(['rev-parse', '--show-toplevel'], cwd).trim(); } catch {}
  const block = (reason) => { process.stderr.write(message(reason) + '\n'); return 2; };

  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const abs = ti.file_path || ti.notebook_path;
    if (!abs) return 0;
    const rel = norm(path.relative(root, path.resolve(cwd, abs)));
    if (rel.startsWith('..')) return 0;
    if (isDbPath(rel)) return block(`writing ${rel}`);
    if (!isDdlPath(rel)) return 0;
    let before = '', after = '';
    if (tool === 'Write') {
      before = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
      after = ti.content;
    } else if (tool === 'Edit') {
      before = ti.old_string; after = ti.new_string;
    } else if (tool === 'MultiEdit') {
      before = (ti.edits || []).map((e) => e.old_string).join('\n');
      after = (ti.edits || []).map((e) => e.new_string).join('\n');
    } else {
      after = ti.new_source;
    }
    const ddl = newDdl(before, after);
    return ddl.length ? block(`new DDL in ${rel}: ${ddl[0].slice(0, 100)}`) : 0;
  }

  if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(ti.command || '');
    if (/\bgit\b[^\n;|&]*\bpush\b/.test(cmd)) {
      let branch = '';
      try { branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).trim(); } catch {}
      const toProd = new RegExp(`(^|[\\s:/])${PROD_BRANCH}\\b`).test(cmd) || (branch === PROD_BRANCH && !/:/.test(cmd.split(/\bpush\b/)[1] || ''));
      if (!toProd) return 0;
      try {
        const hits = dbChangesInRange(`origin/${PROD_BRANCH}`, 'HEAD', cwd);
        if (hits.length) return block(`pushing a DB change to ${PROD_BRANCH}: ${hits.slice(0, 3).join(', ')}`);
      } catch {}
      return 0;
    }
    if (ddlStatements(cmd).size) return block('running DDL from the shell');
  }
  return 0;
}

// ---------- gate 2: git pre-push ----------
function prePush() {
  if (!freezeActive()) return 0;
  const ZERO = /^0+$/;
  const lines = readFileSync(0, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const [, localSha, remoteRef, remoteSha] = line.split(' ');
    if (remoteRef !== `refs/heads/${PROD_BRANCH}` || ZERO.test(localSha)) continue;
    const base = ZERO.test(remoteSha || '0') ? `refs/remotes/origin/${PROD_BRANCH}` : remoteSha;
    let hits;
    try { hits = dbChangesInRange(base, localSha); } catch { continue; }
    if (hits.length) {
      process.stderr.write('\n' + message(`push to ${PROD_BRANCH} contains a DB change:\n  ${hits.join('\n  ')}`) + '\n\n');
      return 1;
    }
  }
  return 0;
}

const mode = process.argv[2];
if (mode === 'claude-hook') process.exit(claudeHook());
if (mode === 'pre-push') process.exit(prePush());
