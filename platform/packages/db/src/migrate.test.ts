import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from './index.js';
import {
  checksum,
  createMigration,
  diffMigrations,
  loadMigrations,
  prepareBaselineSql,
  status,
  up,
  type Migration,
} from './migrate.js';

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'la-migrate-'));
}

function fakeMigration(version: string, sql: string): Migration {
  return { version, name: 'thing', file: `${version}_thing.sql`, sql, checksum: checksum(sql) };
}

describe('checksum', () => {
  it('ignores line-ending differences', () => {
    // Windows dev machine vs Linux CI with git translating line endings — without
    // this, every migration reads as tampered on the other platform.
    expect(checksum('create table a();\nselect 1;\n')).toBe(
      checksum('create table a();\r\nselect 1;\r\n'),
    );
  });

  it('still notices a real content change', () => {
    expect(checksum('select 1;')).not.toBe(checksum('select 2;'));
  });
});

describe('loadMigrations', () => {
  it('reads files in version order', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, '0002_second.sql'), 'select 2;');
    await writeFile(path.join(dir, '0001_first.sql'), 'select 1;');

    const found = await loadMigrations(dir);
    expect(found.map((m) => m.version)).toEqual(['0001', '0002']);
    expect(found[0]!.name).toBe('first');
  });

  it('rejects a filename that does not follow the convention', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'add_stuff.sql'), 'select 1;');
    await expect(loadMigrations(dir)).rejects.toThrow(/0001_add-thing\.sql/);
  });

  it('returns nothing for a directory that does not exist yet', async () => {
    expect(await loadMigrations(path.join(tmpdir(), 'la-does-not-exist-xyz'))).toEqual([]);
  });
});

describe('diffMigrations', () => {
  const first = fakeMigration('0001', 'select 1;');
  const second = fakeMigration('0002', 'select 2;');

  it('marks unapplied files pending', () => {
    expect(diffMigrations([first, second], [])).toEqual([
      { version: '0001', name: 'thing', state: 'pending' },
      { version: '0002', name: 'thing', state: 'pending' },
    ]);
  });

  it('marks a matching applied migration applied', () => {
    const d = diffMigrations([first], [{ version: '0001', checksum: first.checksum }]);
    expect(d[0]!.state).toBe('applied');
  });

  it('detects a tampered migration', () => {
    const d = diffMigrations([first], [{ version: '0001', checksum: 'not-the-same' }]);
    expect(d[0]!.state).toBe('modified');
  });

  it('detects an applied migration whose file was deleted', () => {
    const d = diffMigrations([], [{ version: '0007', checksum: 'abc' }]);
    expect(d).toEqual([{ version: '0007', name: '(file missing)', state: 'missing' }]);
  });
});

describe('prepareBaselineSql', () => {
  it('drops the psql meta-commands pg_dump 18 emits', () => {
    const out = prepareBaselineSql('\\restrict abc123\nCREATE TABLE t ();\n\\unrestrict abc123\n');
    expect(out).not.toContain('\\restrict');
    expect(out).not.toContain('\\unrestrict');
    expect(out).toContain('CREATE TABLE t ();');
  });

  it('guards CREATE SCHEMA so the always-present public schema does not abort the dump', () => {
    expect(prepareBaselineSql('CREATE SCHEMA public;')).toBe('CREATE SCHEMA IF NOT EXISTS public;');
    expect(prepareBaselineSql('CREATE SCHEMA operation_schemas;')).toBe(
      'CREATE SCHEMA IF NOT EXISTS operation_schemas;',
    );
  });

  it('leaves an already-guarded statement alone', () => {
    expect(prepareBaselineSql('CREATE SCHEMA IF NOT EXISTS x;')).toBe(
      'CREATE SCHEMA IF NOT EXISTS x;',
    );
  });
});

describe('createMigration', () => {
  it('numbers sequentially and slugifies the name', async () => {
    const dir = await tempDir();
    await createMigration(dir, 'Add booking table');
    await createMigration(dir, 'Add seat locks!');
    expect((await readdir(dir)).sort()).toEqual([
      '0001_add-booking-table.sql',
      '0002_add-seat-locks.sql',
    ]);
  });

  it('refuses a name with nothing usable in it', async () => {
    await expect(createMigration(await tempDir(), '!!!')).rejects.toThrow(/at least one letter/);
  });
});

/**
 * These need a real Postgres. CI provides one; locally they skip rather than
 * fail, so `pnpm test` still works on a laptop with no database.
 */
const dbUrl = process.env.DATABASE_URL;
const describeDb = dbUrl ? describe : describe.skip;

describeDb('against a real database', () => {
  afterAll(async () => {
    await closePool();
  });

  it('applies pending migrations, is idempotent, and refuses tampering', async () => {
    const pool = getPool(dbUrl!);
    const dir = await tempDir();
    const table = `mig_test_${Date.now()}`;

    await pool.query('drop table if exists schema_migrations');
    await writeFile(
      path.join(dir, '0001_create.sql'),
      `create table ${table} (id int primary key);`,
    );

    const applied = await up(pool, dir);
    expect(applied.map((a) => a.version)).toEqual(['0001']);

    // The migration really ran, not just got recorded.
    const exists = await pool.query('select to_regclass($1) as t', [table]);
    expect(exists.rows[0]!.t).not.toBeNull();

    // Running again applies nothing.
    expect(await up(pool, dir)).toEqual([]);
    expect((await status(pool, dir))[0]!.state).toBe('applied');

    // Editing an applied migration is refused — the P0-05 acceptance criterion.
    await writeFile(
      path.join(dir, '0001_create.sql'),
      `create table ${table} (id int primary key, extra text);`,
    );
    expect((await status(pool, dir))[0]!.state).toBe('modified');
    await expect(up(pool, dir)).rejects.toThrow(/no longer match the files/);

    await pool.query(`drop table if exists ${table}`);
    await pool.query('drop table if exists schema_migrations');
  });
});
