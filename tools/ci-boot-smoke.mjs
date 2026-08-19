#!/usr/bin/env node
// LAM-16 · CI boot smoke test.
//
// Nothing in the repo caught S1-01 (os-backend deleted wholesale in 094dde1: server.js:34-35
// `require('./os-backend/src/mapping/os_repo.js')` is unconditional top-level code, so it breaks
// `require('./server.js')` in EVERY mode, not just DATA_BACKEND=relational). This script is the
// guard: it spawns the real `server.js` against a scratch Postgres, logs in, and inspects
// `/api/version` for the two other silent-data-loss classes documented in
// allotment_v2/docs/workflows/07-data-persistence-api.md §10 (invariants 5, 7, 18):
//   - map.tables / map.columns  — a table/column in operation_schemas_model.json that
//     field_mapping.json does not know how to read/write (data saves, vanishes on refresh).
//   - db.missing / db.extraInDb — a column the model expects that the real table doesn't have
//     (one missing column aborts the whole batched INSERT; the transaction rolls back silently).
//   - mig.failed / mig.pending  — a migration that did not apply cleanly, or hasn't run yet.
//
// Exit 0 only when the server boots, a login succeeds, and every one of those counters reads
// zero (mig.pending) / zero (map, db, mig.failed). Any other outcome — including "could not even
// log in" — is a boot failure and exits non-zero.
//
// Usage: DATABASE_URL=postgres://... node tools/ci-boot-smoke.mjs
// Requires Node >=18 (uses global fetch — see package.json "engines").

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.CI_SMOKE_PORT || 8934);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_USER = process.env.ADMIN_USER || 'ci_smoke_admin';
const ADMIN_PASS = process.env.ADMIN_PASS || ('ci_smoke_' + Math.random().toString(36).slice(2));
const BOOT_TIMEOUT_MS = Number(process.env.CI_SMOKE_BOOT_TIMEOUT_MS || 30000);
const LOGIN_TIMEOUT_MS = Number(process.env.CI_SMOKE_LOGIN_TIMEOUT_MS || 30000);
const SETTLE_TIMEOUT_MS = Number(process.env.CI_SMOKE_SETTLE_TIMEOUT_MS || 10000);
const POLL_INTERVAL_MS = 300;

function log(...a) { console.log('[ci-boot-smoke]', ...a); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Any HTTP response (even 401 — /api/version requires a session) proves the process is up and
// routing, without needing to grep stdout for a log line that could change.
async function waitForServer(child) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  let lastErr;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server.js exited early (code ${child.exitCode}) before it started listening`);
    }
    try {
      const r = await fetch(BASE + '/api/version', { redirect: 'manual' });
      if (r.status) return;
    } catch (e) { lastErr = e; }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`server did not start listening on ${BASE} within ${BOOT_TIMEOUT_MS}ms` + (lastErr ? `: ${lastErr.message}` : ''));
}

function parseSessionCookie(headers) {
  // Node's fetch folds multiple Set-Cookie headers into one comma-joined string; server.js only
  // ever sends one at a time on /api/login, so a plain regex on the raw value is enough here.
  const raw = headers.get('set-cookie');
  if (!raw) return null;
  const m = raw.match(/sess=[^;]+/);
  return m ? m[0] : null;
}

// initDb() seeds ADMIN_USER asynchronously, well after server.listen() fires (server.js:1409-1416,
// 1727-1732), so the first login attempt racing straight after waitForServer() is expected to 401 —
// retry instead of treating that as fatal.
async function loginWithRetry() {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE + '/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        const cookie = parseSessionCookie(r.headers);
        if (!cookie) throw new Error('login returned 200 but no session cookie');
        return cookie;
      }
      lastErr = new Error(`HTTP ${r.status} ${JSON.stringify(body)}`);
    } catch (e) { lastErr = e; }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `could not log in as ${ADMIN_USER} within ${LOGIN_TIMEOUT_MS}ms (last error: ${lastErr && lastErr.message}). ` +
    'If this is a fresh scratch DB, check whether db/migrations/ exists and applied cleanly — ' +
    'DATA_BACKEND=relational needs the operation_schemas.* tables migrations create before the admin ' +
    'user seed step runs (server.js initDb(), ~:1572-1750).'
  );
}

async function fetchVersion(cookie) {
  const r = await fetch(BASE + '/api/version', { headers: { cookie } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`/api/version failed: HTTP ${r.status} ${JSON.stringify(body)}`);
  return body;
}

function evaluate(version) {
  const problems = [];
  const map = version.map || {};
  const db = version.db || {};
  const mig = version.mig || {};
  if ((map.tables || 0) !== 0) problems.push(`map.tables = ${map.tables} (expected 0) — ${map.detail || ''}`);
  if ((map.columns || 0) !== 0) problems.push(`map.columns = ${map.columns} (expected 0) — ${map.detail || ''}`);
  if ((db.missing || 0) !== 0) problems.push(`db.missing = ${db.missing} (expected 0) — ${db.detail || ''}`);
  if ((db.extraInDb || 0) !== 0) problems.push(`db.extraInDb = ${db.extraInDb} (expected 0)`);
  if ((mig.failed || 0) !== 0) problems.push(`mig.failed = ${mig.failed} (expected 0) — ${mig.lastError || ''}`);
  if ((mig.pending || 0) > 0) problems.push(`mig.pending = ${mig.pending} (expected 0)`);
  return problems;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[ci-boot-smoke] DATABASE_URL is not set — this script needs a scratch Postgres. ' +
      'See .github/workflows/ci-boot-smoke.yml for the service container that provides it.');
    process.exitCode = 2;
    return;
  }

  const env = {
    ...process.env,
    DATA_BACKEND: process.env.DATA_BACKEND || 'relational',
    PORT: String(PORT),
    ADMIN_USER,
    ADMIN_PASS,
    SESSION_SECRET: process.env.SESSION_SECRET || 'ci-boot-smoke-secret',
  };

  log(`spawning: node server.js (PORT=${PORT}, DATA_BACKEND=${env.DATA_BACKEND})`);
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[server] ${d}`));

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { child.kill('SIGTERM'); } catch (_) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  try {
    await waitForServer(child);
    log('server is listening — logging in');
    const cookie = await loginWithRetry();
    log('logged in — fetching /api/version');

    // The DDL/migration/drift-check chain in initDb() runs asynchronously after listen() fires
    // (server.js:1409-1416), so poll briefly for `mig.ran` to flip true instead of racing the very
    // first response, which can otherwise read as a false-clean zeroed-out default.
    let version = await fetchVersion(cookie);
    const settleDeadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (!(version.mig && version.mig.ran) && Date.now() < settleDeadline) {
      await sleep(POLL_INTERVAL_MS);
      version = await fetchVersion(cookie);
    }

    log('version payload:', JSON.stringify(version));
    const problems = evaluate(version);
    if (problems.length) {
      console.error(`[ci-boot-smoke] FAIL — ${problems.length} problem(s):`);
      for (const p of problems) console.error('  - ' + p);
      process.exitCode = 1;
    } else {
      log('PASS — server booted, logged in, and map/db drift counters are 0 with no failed/pending migrations');
    }
  } catch (e) {
    console.error('[ci-boot-smoke] FAIL —', e.message);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

main();
