import pg from 'pg';

/**
 * Schemas in the production database, as measured by the P0-01 baseline dump
 * (2026-08-20, PostgreSQL 18.4). See db/baseline/REPORT.md at the repo root.
 *
 *   operation_schemas  133 tables — the ops app. Booking tables are reshaped here.
 *   love_kingdom        39 tables — B2C / ERP. READ-ONLY during Phase 1; B2C keeps writing it.
 *   allotment            4 tables — holds the live booking `attachments` table (3,038 rows).
 *   public               8 tables — mostly empty duplicates; classify in P0-08 before using.
 */
export const SCHEMA = {
  ops: 'operation_schemas',
  b2c: 'love_kingdom',
  allotment: 'allotment',
  public: 'public',
} as const;

export type SchemaName = (typeof SCHEMA)[keyof typeof SCHEMA];

/**
 * One pool per distinct connection string.
 *
 * Keyed deliberately: an earlier single-pool version memoised on first call and
 * then ignored its own argument, so the first caller that followed the
 * "use a READ-ONLY role for anything that only reads" advice on DATABASE_URL
 * silently got the read-write pool back and wrote through it unchecked.
 */
const pools = new Map<string, pg.Pool>();

/** Lazily-created pool for `connectionString`. `apps/api` is the only intended caller. */
export function getPool(connectionString: string): pg.Pool {
  let existing = pools.get(connectionString);
  if (!existing) {
    existing = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pools.set(connectionString, existing);
  }
  return existing;
}

/** Closes every pool. Safe to call more than once. */
export async function closePool(): Promise<void> {
  const open = [...pools.values()];
  pools.clear();
  await Promise.all(open.map((p) => p.end()));
}

/** Liveness probe used by /readyz. */
export async function ping(p: pg.Pool): Promise<boolean> {
  const r = await p.query('select 1 as ok');
  return r.rows[0]?.ok === 1;
}
