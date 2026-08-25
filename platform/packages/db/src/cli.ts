#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getPool } from './index.js';
import {
  applyBaseline,
  BASELINE_FILES,
  createMigration,
  status,
  up,
  type MigrationStatus,
} from './migrate.js';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(PKG_ROOT, 'migrations');
/** platform/packages/db -> repo root -> db/baseline (the P0-01 dumps). */
const BASELINE_DIR = path.resolve(PKG_ROOT, '..', '..', '..', 'db', 'baseline');

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Never echo the value itself, here or on any error path.
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  return url;
}

function render(rows: MigrationStatus[]): void {
  if (rows.length === 0) {
    console.log('No migrations.');
    return;
  }
  for (const r of rows) console.log(`  ${r.state.padEnd(8)} ${r.version}_${r.name}`);
}

const [command, ...rest] = process.argv.slice(2);

async function main(): Promise<number> {
  switch (command) {
    case 'up': {
      const pool = getPool(requireDatabaseUrl());
      const applied = await up(pool, MIGRATIONS_DIR);
      if (applied.length === 0) console.log('Already up to date.');
      else {
        console.log(`Applied ${applied.length} migration(s):`);
        render(applied);
      }
      return 0;
    }

    case 'status': {
      const pool = getPool(requireDatabaseUrl());
      const rows = await status(pool, MIGRATIONS_DIR);
      render(rows);
      // A drifted or deleted migration is a failure, not a note, so `migrate
      // status` can be used as a CI gate on its own.
      return rows.some((r) => r.state === 'modified' || r.state === 'missing') ? 1 : 0;
    }

    case 'new': {
      const name = rest.join(' ').trim();
      if (!name) {
        console.error('Usage: migrate new <name>');
        return 1;
      }
      console.log(`Created ${await createMigration(MIGRATIONS_DIR, name)}`);
      return 0;
    }

    case 'baseline': {
      // Recreating the P0-01 schema dump over a live database would be
      // catastrophic, so this is opt-in and refuses to run in production.
      if (process.env.NODE_ENV === 'production' || process.env.ALLOW_BASELINE !== '1') {
        console.error(
          'Refusing to apply the baseline: set ALLOW_BASELINE=1 and do not run this in production.\n' +
            'It is intended for a throwaway CI or local database only.',
        );
        return 1;
      }
      const pool = getPool(requireDatabaseUrl());
      await applyBaseline(pool, BASELINE_DIR, BASELINE_FILES);
      console.log(`Applied ${BASELINE_FILES.length} baseline dump(s) from ${BASELINE_DIR}`);
      return 0;
    }

    default:
      console.error('Usage: migrate <up|status|new <name>|baseline>');
      return 1;
  }
}

let code = 1;
try {
  code = await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  code = 1;
} finally {
  await closePool().catch(() => undefined);
}
process.exit(code);
