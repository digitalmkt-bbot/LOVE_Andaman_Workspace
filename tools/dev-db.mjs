#!/usr/bin/env node
// Local development Postgres — provision, don't just start.
//
// `docker compose up` alone gives an EMPTY database, and server.js cannot bootstrap one: initDb()
// creates only `users` and `app_state`, then ALTERs entity tables that nothing in the boot path
// ever creates (`ALTER TABLE operation_schemas."sb_markets" ADD COLUMN ... "sort"`). On an empty DB
// that throws, and every step after it is skipped — including the admin seed, runMigrations(), and
// the drift check. The app still listens and serves, so it looks healthy; only the log says
// otherwise. So the schema has to be loaded before the first boot, which is what this script does.
//
// Ordering trap, and the reason this does the migrations itself rather than leaving them to the
// boot runner: runMigrations() BASELINES — records as applied without running — every file in
// db/migrations/ whenever the ledger is empty and operation_schemas already has tables
// (server.js, `[mig] baseline · N existing migration(s) recorded as applied without running`).
// Loading the baseline dump satisfies exactly that condition, so any migration NEWER than the dump
// is silently marked done and never runs. That is not hypothetical: the 2026-08-20 dump predates
// 019-023, and a plain `up` left boats.nameth, sb_bookings__trips.nat_* and pier_sheet missing while
// the ledger claimed all five were applied. Applying them here, before the server ever connects,
// means the ledger is already non-empty at first boot and the baseline branch never fires.
//
// Migrations are applied with ON_ERROR_STOP and a failure is fatal. They are expected to be
// idempotent (ADD COLUMN IF NOT EXISTS etc.), so re-running one the baseline already contains is a
// no-op; a file that fails is reported rather than quietly baselined, because "recorded as applied
// but never run" is the failure this whole script exists to avoid.
//
//   npm run db:up      (up)     start + provision the database (idempotent — safe to re-run)
//   npm run dev:local  (run)    start the app against it, in the foreground
//   npm run db:reset   (reset)  destroy the volume and provision from scratch
//   npm run db:down    (down)   stop the container, keep the volume
//   npm run db:psql    (psql)   open a psql shell on it
//
// Day to day that is two commands — `npm run db:up` once (again after a Docker restart), then
// `npm run dev:local` — and http://localhost:8791/allotment_v2/allotment_v2.html, admin / admin123.
//
// Verify a provisioned database with the existing smoke test, which boots the real server.js
// against it and fails on any map/db drift or failed/pending migration:
//   DATABASE_URL=<printed by `up`> DATA_BACKEND=relational node tools/ci-boot-smoke.mjs

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COMPOSE = path.join(ROOT, 'docker-compose.yml');
const SERVICE = 'db';
const DB = 'la_dev';
const USER = 'postgres';
const URL = `postgres://postgres:devpass@127.0.0.1:55432/${DB}`;
const APP_PORT = Number(process.env.PORT || 8791);   // the app's own port, not the database's

// The four schemas the 2026-08-20 production dump captured. public goes first: its dump opens with
// a bare `CREATE SCHEMA public`, which collides with the one initdb already made, so the schema is
// dropped immediately before. operation_schemas is the ops app; love_kingdom is the B2C/ERP writer;
// allotment holds attachments and the legacy users table.
const SCHEMAS = ['public', 'operation_schemas', 'love_kingdom', 'allotment'];

const log = (...a) => console.log('[dev-db]', ...a);
const die = (m) => { console.error('[dev-db] ' + m); process.exit(1); };

function compose(args, opts = {}) {
  return spawnSync('docker', ['compose', '-f', COMPOSE, ...args],
                   { cwd: ROOT, encoding: 'utf8', ...opts });
}

// psql inside the container, so nothing here needs a Postgres client on the host.
function psql(args, input) {
  const r = compose(['exec', '-T', SERVICE, 'psql', '-U', USER, '-d', DB, ...args],
                    { input, env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
  return r;
}

function query(sql) {
  const r = psql(['-tAqc', sql]);
  if (r.status !== 0) die(`query failed: ${sql}\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

function runSqlFile(file, label) {
  // -v ON_ERROR_STOP=1 so a mid-file failure is an error, not a half-loaded schema that looks fine.
  const r = psql(['-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], fs.readFileSync(file));
  if (r.status !== 0) die(`${label} failed (${path.basename(file)}):\n${(r.stderr || r.stdout).trim()}`);
}

// Synchronous sleep — this script is a straight line of spawnSync calls, so there is no event loop
// to await on.
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function waitHealthy() {
  const deadline = Date.now() + 90_000;
  let last = '';
  while (Date.now() < deadline) {
    const r = compose(['exec', '-T', SERVICE, 'pg_isready', '-U', USER, '-d', DB]);
    if (r.status === 0) return;
    last = (r.stderr || r.stdout || '').trim();
    // A container that exited is never going to become ready — fail now with its log rather than
    // spending 90s on it. This is how the /var/lib/postgresql mount-point bug presented.
    const ps = compose(['ps', '-a', '--format', '{{.State}}', SERVICE]).stdout.trim();
    if (/exited|dead/i.test(ps)) {
      const logs = compose(['logs', '--tail', '15', SERVICE]).stdout || '';
      die(`the database container exited instead of starting:\n${logs}`);
    }
    sleep(1000);
  }
  die(`database did not become ready within 90s (${last}) — check \`docker compose logs db\``);
}

// Newest dump per schema, so a re-dumped baseline is picked up without editing this file.
function baselineFor(schema) {
  const dir = path.join(ROOT, 'db', 'baseline');
  const hits = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.startsWith(schema + '_') && f.endsWith('.sql')).sort()
    : [];
  return hits.length ? path.join(dir, hits[hits.length - 1]) : null;
}

function loadBaseline() {
  log('loading the production schema baseline (schema only, no rows)');
  for (const s of SCHEMAS) {
    const f = baselineFor(s);
    if (!f) { log(`  ${s}: no dump in db/baseline/ — skipped`); continue; }
    if (s === 'public') query('DROP SCHEMA IF EXISTS public CASCADE');
    runSqlFile(f, `baseline ${s}`);
    log(`  ${s}: ${path.basename(f)}`);
  }
}

// Disarm the baseline shortcut, and let the server run the migrations itself.
//
// They cannot be applied here, before the first boot: 020_v_seat_availability_trips_boat.sql builds
// a view over operation_schemas.trips__boat, and that table is not in the baseline dump — initDb()
// creates it. Applying migrations against a freshly-loaded baseline therefore fails with
// `relation "operation_schemas.trips__boat" does not exist`.
//
// server.js already does this in the right order — initDb() creates and patches the entity tables,
// and runMigrations() runs after it. The only thing wrong with letting it do the work is the
// baseline branch, which fires when the ledger is EMPTY and operation_schemas already has tables,
// and marks every migration applied without running it. So seed one sentinel row: the ledger is no
// longer empty, the baseline branch is skipped, and every real migration is applied for real, after
// initDb has created what it depends on. The runner only ever iterates the files on disk, so a row
// that matches no file is inert.
const SENTINEL = '000_dev_db_provisioned.sentinel';

// Same filter as runMigrations(): *.sql, sorted, rollback files are manual-only.
function migrationFiles() {
  const dir = path.join(ROOT, 'db', 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.sql$/i.test(f) && !/rollback/i.test(f)).sort();
}

function armMigrations() {
  // Created unqualified, exactly as the boot runner creates it, so both write and read the same
  // table. Under the postgres role that resolves to public.schema_migrations.
  query(`CREATE TABLE IF NOT EXISTS schema_migrations (
           name text PRIMARY KEY, sha1 text, applied_at timestamptz DEFAULT now(),
           baseline boolean DEFAULT false, ms integer, err text)`);
  query(`INSERT INTO schema_migrations(name, baseline, err)
         VALUES('${SENTINEL}', false, 'not a migration · tools/dev-db.mjs marker that keeps
runMigrations() from baselining the real files on a freshly provisioned database')
         ON CONFLICT (name) DO NOTHING`);
}

const DEV_ENV = { DATABASE_URL: URL, DATA_BACKEND: 'relational', B2C_SCHEMA: 'love_kingdom',
                  ADMIN_USER: 'admin', ADMIN_PASS: 'admin123',
                  SESSION_SECRET: 'dev-only-not-a-secret' };

// Provisioning is only finished once a server has booted against the database, because that boot is
// what creates the entity tables (initDb) and then runs the migrations.
//
// This waits on the migration ledger rather than on the server's own readiness, because they are
// not the same event: runMigrations() is kicked off after the listener is up, so the server answers
// requests — and /api/version reports mig.ran = true — while the files are still going in. Killing
// the process at that point leaves the ledger half-written. Poll until every file on disk has a row.
function bootToMigrate() {
  const files = migrationFiles();
  const before = new Set(query('SELECT name FROM schema_migrations').split('\n').filter(Boolean));
  const todo = files.filter(f => !before.has(f));
  log(todo.length
    ? `booting server.js to create the entity tables and apply ${todo.length} migration(s) …`
    : `booting server.js to create the entity tables (all ${files.length} migration(s) already recorded) …`);
  const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT, env: { ...process.env, ...DEV_ENV, PORT: '8935' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  proc.stdout.on('data', d => { out += d; });
  proc.stderr.on('data', d => { out += d; });

  try {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (proc.exitCode !== null) die(`server.js exited (code ${proc.exitCode}) while provisioning:\n${out}`);
      const have = new Set(query('SELECT name FROM schema_migrations').split('\n').filter(Boolean));
      if (files.every(f => have.has(f))) {
        const failed = query(`SELECT name FROM schema_migrations WHERE err IS NOT NULL AND name <> '${SENTINEL}'`);
        if (failed) die(`migration(s) failed: ${failed.split('\n').join(', ')}\n${out}`);
        if (todo.length) log('applied: ' + todo.join(', '));
        return;
      }
      sleep(500);
    }
    die(`migrations did not finish within 120s:\n${out}`);
  } finally {
    proc.kill();
  }
}

// Then assert it with the smoke test that already exists — it boots the real server.js, logs in,
// and fails on any map/db drift or failed/pending migration. ADMIN_USER/ADMIN_PASS are passed
// through so the account it seeds is the one printed below rather than ci-boot-smoke's own
// throwaway; the seed only fires while the users table is empty, so there is one chance to get it
// right (and bootToMigrate above has usually already taken it).
//
// One expected difference: db.extraInDb. ci-boot-smoke wants it at 0, which is right for CI, where
// the schema is built from migrations alone and an undeclared column means the model and the
// database have drifted. A dev database seeded from a PRODUCTION dump is a different case — it
// inherits whatever legacy columns production still carries (as of the 2026-08-20 baseline:
// fleet_fuelprice.b2/b6/b10/b13 and .panwa, fleet_drlock.panwa — the fixed per-boat columns).
// Those are columns the mapping never reads or writes, so they cost nothing here, and they are not
// this script's to fix. Reported, not fatal. Everything else ci-boot-smoke checks — db.missing,
// map.tables/columns, mig.failed/pending — stays fatal, because those are the silent-data-loss ones.
function verify() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'ci-boot-smoke.mjs')], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...DEV_ENV },
  });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  if (r.status === 0) return;

  const problems = out.split('\n').filter(l => /^\s+- \S+ = /.test(l)).map(l => l.trim());
  if (problems.length && problems.every(p => p.startsWith('- db.extraInDb'))) {
    log(`ignoring ${problems[0].replace(/^- /, '')} — expected on a database seeded from the ` +
        'production baseline, see the comment above verify() in this file');
    return;
  }
  die('the database is up but server.js did not come up clean against it (see above)');
}

function provision() {
  const n = Number(query(
    `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'operation_schemas'`));
  if (n > 0) log(`operation_schemas already has ${n} tables — leaving the data alone`);
  else loadBaseline();
  armMigrations();
  bootToMigrate();
  if (!process.argv.includes('--no-verify')) verify();

  const tables = query(`SELECT s || ' ' || n FROM (
                          SELECT table_schema AS s, count(*) AS n FROM information_schema.tables
                          WHERE table_schema NOT IN ('pg_catalog','information_schema')
                          GROUP BY table_schema) t ORDER BY s`).split('\n').join(' · ');
  log('schemas: ' + tables);
  console.log(`
  Ready. Start the app against it:

    npm run dev:local          → http://localhost:${APP_PORT}/allotment_v2/allotment_v2.html
                                 sign in as admin / admin123

  ADMIN_USER/ADMIN_PASS only seed while the users table is empty — on a database that already has
  users they do nothing, and the password has to be reset through POST /api/users/password.

  Verify:  DATABASE_URL=${URL} DATA_BACKEND=relational node tools/ci-boot-smoke.mjs
`);
}

// `run` · start server.js in the foreground with the dev environment already set.
//
// A wrapper rather than a .env file, for two reasons: npm's "dev" script reads .env, which on this
// machine already holds a PGURL pointing at PRODUCTION — putting a local DATABASE_URL beside it
// invites running one while thinking you are on the other. And an inline `FOO=bar node server.js`
// in package.json does not work on Windows, where npm runs scripts through cmd.exe.
// Ctrl-C stops it. The database keeps running; `npm run db:down` stops that.
function run() {
  // Without this the server still starts and still serves the page — it just answers 401 on every
  // /api call, which reads as a login bug rather than "the database is not running".
  if (compose(['ps', '--format', '{{.State}}', SERVICE]).stdout.trim() !== 'running')
    die('the dev database is not running — start it with `npm run db:up` first');
  const url = `http://localhost:${APP_PORT}/allotment_v2/allotment_v2.html`;
  log(`starting server.js on ${APP_PORT} against the dev database`);
  log(`open ${url}  ·  admin / admin123  ·  Ctrl-C to stop`);
  const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...DEV_ENV, PORT: String(APP_PORT) },
  });
  proc.on('exit', code => process.exit(code ?? 0));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => proc.kill(sig));
}

const cmd = process.argv[2] || 'up';
if (!fs.existsSync(COMPOSE)) die(`no docker-compose.yml at ${COMPOSE}`);
if (spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8' }).status !== 0)
  die('docker is not running (or not on PATH)');

if (cmd === 'down') {
  compose(['down'], { stdio: 'inherit' });
} else if (cmd === 'psql') {
  spawnSync('docker', ['compose', '-f', COMPOSE, 'exec', SERVICE, 'psql', '-U', USER, '-d', DB],
            { cwd: ROOT, stdio: 'inherit' });
} else if (cmd === 'run') {
  run();
} else if (cmd === 'up' || cmd === 'reset') {
  if (cmd === 'reset') { log('destroying the volume'); compose(['down', '-v'], { stdio: 'inherit' }); }
  const r = compose(['up', '-d'], { stdio: 'inherit' });
  if (r.status !== 0) die('docker compose up failed');
  waitHealthy();
  provision();
} else {
  die(`unknown command "${cmd}" — expected up | reset | run | down | psql`);
}
