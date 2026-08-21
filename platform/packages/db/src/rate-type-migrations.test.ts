import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool, SCHEMA } from './index.js';

/**
 * RT-01 · schema checks for migrations 0010–0013.
 *
 * These need a real Postgres. CI provides one; locally they skip rather than
 * fail, so `pnpm test` still works on a laptop with no database — the same
 * pattern as migrate.test.ts.
 *
 * The migrations are applied directly rather than through `up()`, so this test
 * neither writes to the `platform_migrations` ledger nor depends on the
 * migrations another workstream owns (0001–0009). Every statement in them is
 * `create ... if not exists`, so applying them repeatedly is a no-op.
 */
const dbUrl = process.env.DATABASE_URL;
const describeDb = dbUrl ? describe : describe.skip;

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);

const RT_MIGRATIONS = [
  '0010_rate-type-core.sql',
  '0011_rate-type-pricing.sql',
  '0012_rate-type-promo-overlay.sql',
  '0013_rate-type-backfill.sql',
];

/** Every table RT-01 is specified to deliver, plus the promo pair it adds. */
const RT_TABLES = [
  'rate_type',
  'rate_type_seat_rate',
  'rate_type_route_validity',
  'rate_type_route_bundle',
  'rate_type_charter_rate',
  'rate_type_addon',
  'rate_type_promo',
  'rate_type_promo_route',
];

describeDb('RT-01 migrations', () => {
  beforeAll(async () => {
    const pool = getPool(dbUrl!);
    for (const file of RT_MIGRATIONS) {
      await pool.query(await readFile(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
  });

  afterAll(async () => {
    await closePool();
  });

  it('creates every rate-type table', async () => {
    const pool = getPool(dbUrl!);
    for (const table of RT_TABLES) {
      const r = await pool.query('select to_regclass($1) as t', [`${SCHEMA.ops}.${table}`]);
      expect(r.rows[0]!.t, `${table} is missing`).not.toBeNull();
    }
  });

  it('applies cleanly a second time', async () => {
    const pool = getPool(dbUrl!);
    for (const file of RT_MIGRATIONS) {
      await expect(
        pool.query(await readFile(path.join(MIGRATIONS_DIR, file), 'utf8')),
      ).resolves.toBeTruthy();
    }
  });

  /**
   * The RT-01 acceptance criterion, enforced by the schema itself: the old flat
   * longtail shape (one price, no route) has nowhere to live, so no future
   * writer can reintroduce it and no reader has to re-normalise.
   */
  it('makes a route-less add-on price impossible to store', async () => {
    const pool = getPool(dbUrl!);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rt = await client.query<{ id: string }>(
        `insert into ${SCHEMA.ops}.rate_type (code, name) values ($1, $1) returning id`,
        [`RT-TEST-${Date.now()}`],
      );
      const rateTypeId = rt.rows[0]!.id;

      await expect(
        client.query(
          `insert into ${SCHEMA.ops}.rate_type_addon
             (rate_type_id, addon_key, route_id, variant, adult_price)
           values ($1, 'longtail', null, 'join', 400)`,
          [rateTypeId],
        ),
      ).rejects.toThrow(/route_id/);
    } finally {
      // Rolled back so the test leaves no rows behind, whatever it asserted.
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
  });

  it('rejects an unknown zone and an unknown pax type', async () => {
    const pool = getPool(dbUrl!);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rt = await client.query<{ id: string }>(
        `insert into ${SCHEMA.ops}.rate_type (code, name) values ($1, $1) returning id`,
        [`RT-TEST-${Date.now()}`],
      );
      const rateTypeId = rt.rows[0]!.id;

      // 'visitpanwa'-style near-misses are exactly how enum drift gets in.
      await client.query('savepoint before_bad_zone');
      await expect(
        client.query(
          `insert into ${SCHEMA.ops}.rate_type_seat_rate values ($1, 'r5', 'Phuket', 'adult_thai', 1000)`,
          [rateTypeId],
        ),
      ).rejects.toThrow(/zone_known/);
      // A failed statement aborts the whole transaction, so the next assertion
      // would otherwise fail with "current transaction is aborted" and prove
      // nothing about the constraint it is aiming at.
      await client.query('rollback to savepoint before_bad_zone');

      await expect(
        client.query(
          `insert into ${SCHEMA.ops}.rate_type_seat_rate values ($1, 'r5', 'PK', 'adult-fr', 1000)`,
          [rateTypeId],
        ),
      ).rejects.toThrow(/pax_type_known/);
    } finally {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
  });

  it('refuses a free bundle that carries a price', async () => {
    const pool = getPool(dbUrl!);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rt = await client.query<{ id: string }>(
        `insert into ${SCHEMA.ops}.rate_type (code, name) values ($1, $1) returning id`,
        [`RT-TEST-${Date.now()}`],
      );
      const rateTypeId = rt.rows[0]!.id;

      // A "free" bundle with a surcharge is a price nobody can see in the UI.
      await expect(
        client.query(
          `insert into ${SCHEMA.ops}.rate_type_route_bundle
             (rate_type_id, route_id, mode, adult_price) values ($1, 'r12', 'free', 500)`,
          [rateTypeId],
        ),
      ).rejects.toThrow(/free_is_free/);
    } finally {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
  });
});
