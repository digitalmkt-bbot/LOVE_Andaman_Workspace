import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';

/** Bookkeeping table. Created by the runner itself, never by a migration. */
export const MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Advisory lock id, so two runners (a deploy and a human) cannot apply the same
 * migration concurrently. Arbitrary but must stay stable.
 */
const LOCK_ID = 8_150_237;

const FILENAME = /^(\d{4})_([a-z0-9-]+)\.sql$/;

export interface Migration {
  version: string;
  name: string;
  file: string;
  sql: string;
  checksum: string;
}

export interface AppliedRow {
  version: string;
  checksum: string;
}

export type MigrationState = 'applied' | 'pending' | 'modified' | 'missing';

export interface MigrationStatus {
  version: string;
  name: string;
  state: MigrationState;
}

/**
 * sha256 over line-ending-normalised content.
 *
 * Normalising is not cosmetic: this repo is developed on Windows and tested on
 * Linux CI with git translating line endings on checkout. Hashing raw bytes
 * would make every migration read as `modified` on the other platform.
 */
export function checksum(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** Reads `NNNN_name.sql` files in version order. Anything else is an error, not a warning. */
export async function loadMigrations(dir: string): Promise<Migration[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const sql = entries.filter((f) => f.endsWith('.sql'));
  const bad = sql.filter((f) => !FILENAME.test(f));
  if (bad.length > 0) {
    throw new Error(
      `Migration filenames must look like 0001_add-thing.sql — rejected: ${bad.join(', ')}`,
    );
  }

  const migrations: Migration[] = [];
  for (const file of sql.sort()) {
    const m = FILENAME.exec(file);
    if (!m) continue;
    const body = await readFile(path.join(dir, file), 'utf8');
    migrations.push({
      version: m[1]!,
      name: m[2]!,
      file,
      sql: body,
      checksum: checksum(body),
    });
  }

  const seen = new Set<string>();
  for (const mig of migrations) {
    if (seen.has(mig.version)) throw new Error(`Duplicate migration version ${mig.version}`);
    seen.add(mig.version);
  }
  return migrations;
}

/**
 * Compares files on disk against what the database says it has applied.
 * Pure, so the interesting cases are unit-testable without a Postgres.
 */
export function diffMigrations(files: Migration[], applied: AppliedRow[]): MigrationStatus[] {
  const byVersion = new Map(applied.map((a) => [a.version, a]));
  const out: MigrationStatus[] = files.map((f) => {
    const row = byVersion.get(f.version);
    if (!row) return { version: f.version, name: f.name, state: 'pending' as const };
    return {
      version: f.version,
      name: f.name,
      state: row.checksum === f.checksum ? ('applied' as const) : ('modified' as const),
    };
  });

  // Recorded in the database but no longer on disk — someone deleted or renamed
  // an applied migration, so the database's history can no longer be reproduced.
  const onDisk = new Set(files.map((f) => f.version));
  for (const a of applied) {
    if (!onDisk.has(a.version)) {
      out.push({ version: a.version, name: '(file missing)', state: 'missing' });
    }
  }

  return out.sort((a, b) => a.version.localeCompare(b.version));
}

export async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ${MIGRATIONS_TABLE} (
      version       text primary key,
      name          text not null,
      checksum      text not null,
      applied_at    timestamptz not null default now(),
      execution_ms  integer not null
    )
  `);
}

export async function fetchApplied(pool: pg.Pool): Promise<AppliedRow[]> {
  const r = await pool.query<AppliedRow>(
    `select version, checksum from ${MIGRATIONS_TABLE} order by version`,
  );
  return r.rows;
}

export async function status(pool: pg.Pool, dir: string): Promise<MigrationStatus[]> {
  await ensureMigrationsTable(pool);
  return diffMigrations(await loadMigrations(dir), await fetchApplied(pool));
}

/**
 * Applies every pending migration, in order, each in its own transaction.
 *
 * Forward-only by design: there is no `down`. A bad migration is corrected by
 * writing the next one, so production history is always replayable from empty.
 */
export async function up(pool: pg.Pool, dir: string): Promise<MigrationStatus[]> {
  await ensureMigrationsTable(pool);
  const files = await loadMigrations(dir);

  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_ID]);

    const appliedRows = await pool.query<AppliedRow>(
      `select version, checksum from ${MIGRATIONS_TABLE} order by version`,
    );
    const diff = diffMigrations(files, appliedRows.rows);

    const tampered = diff.filter((d) => d.state === 'modified' || d.state === 'missing');
    if (tampered.length > 0) {
      const detail = tampered.map((t) => `  ${t.version}_${t.name}: ${t.state}`).join('\n');
      throw new Error(
        `Refusing to migrate — applied migrations no longer match the files:\n${detail}\n` +
          `An applied migration is history. Write a new migration instead of editing one.`,
      );
    }

    const applied: MigrationStatus[] = [];
    for (const mig of files) {
      if (diff.find((d) => d.version === mig.version)?.state !== 'pending') continue;

      const started = Date.now();
      try {
        await client.query('begin');
        await client.query(mig.sql);
        await client.query(
          `insert into ${MIGRATIONS_TABLE} (version, name, checksum, execution_ms)
           values ($1, $2, $3, $4)`,
          [mig.version, mig.name, mig.checksum, Date.now() - started],
        );
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw new Error(`Migration ${mig.file} failed and was rolled back: ${String(err)}`);
      }
      applied.push({ version: mig.version, name: mig.name, state: 'applied' });
    }
    return applied;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

/** Creates the next `NNNN_name.sql`, returning its path. */
export async function createMigration(dir: string, name: string): Promise<string> {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) throw new Error('Migration name must contain at least one letter or digit');

  const existing = await loadMigrations(dir);
  const next = String(
    (existing.length ? Number(existing[existing.length - 1]!.version) : 0) + 1,
  ).padStart(4, '0');
  const file = path.join(dir, `${next}_${slug}.sql`);

  await writeFile(
    file,
    `-- ${next}_${slug}\n` +
      `--\n` +
      `-- Forward-only. Once this has been applied anywhere, it is history:\n` +
      `-- correct it by writing the next migration, never by editing this file\n` +
      `-- (the runner checksums it and will refuse to continue).\n\n`,
    'utf8',
  );
  return file;
}

/**
 * psql meta-commands, which node-pg cannot execute.
 *
 * pg_dump 18 wraps its output in `\restrict`/`\unrestrict`, which guards against
 * a hostile dump injecting meta-commands during restore. We apply our own
 * schema-only baseline to a throwaway database through the pg protocol, where
 * meta-commands have no meaning at all, so dropping these lines removes nothing
 * that was protecting us — and avoids requiring a psql 18 client everywhere.
 */
function stripPsqlMetaCommands(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !/^\\(restrict|unrestrict)\b/.test(line))
    .join('\n');
}

/**
 * `CREATE SCHEMA x;` -> `CREATE SCHEMA IF NOT EXISTS x;`
 *
 * Every fresh Postgres already owns a `public` schema, so `public_*.sql`'s
 * unguarded CREATE aborts the whole dump. Guarding all four also makes re-running
 * the baseline against an already-seeded database a no-op rather than an error.
 */
function guardSchemaCreation(sql: string): string {
  return sql.replace(/^CREATE SCHEMA (?!IF NOT EXISTS)/gm, 'CREATE SCHEMA IF NOT EXISTS ');
}

/** Prepares a pg_dump file for execution over the pg protocol. Exported for testing. */
export function prepareBaselineSql(sql: string): string {
  return guardSchemaCreation(stripPsqlMetaCommands(sql));
}

/** Applies the P0-01 baseline dumps, in the given order, to an empty database. */
export async function applyBaseline(pool: pg.Pool, dir: string, files: string[]): Promise<void> {
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    await pool.query(prepareBaselineSql(sql));
  }
}

export const BASELINE_FILES = [
  'operation_schemas_20260820.sql',
  'love_kingdom_20260820.sql',
  'allotment_20260820.sql',
  'public_20260820.sql',
];
