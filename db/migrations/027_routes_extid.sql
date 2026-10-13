-- 027_routes_extid.sql  (2026-09-10)   [§b2cCatalog]
--
-- Which B2C product a programme was created for, stored on the programme itself.
--
-- The link between the two systems already exists, but it only points one way: B2C keeps
-- programs_own.ops_route_id and server.js reads it back (b2cProgramRouteCatalog) to resolve every
-- imported day-trip line. Ops has never held the reverse. That was fine while every route was
-- typed in by hand in Config, and stops being fine the moment B2C can create one over the API:
--
--   · Idempotency. POST /api/b2c/routes has to be safe to retry. Without a key of B2C's own on the
--     row there is nothing to match a repeat call against, and a dropped response, a double submit
--     or a re-run import script each leave a second identical programme behind — which then splits
--     the seat pool, because capacity is per route.
--   · Provenance. "Where did this route come from and who owns its name?" is unanswerable from
--     inside ops today. A route that came from POW-008 should say so.
--
-- extid is B2C's id for the product or variant ('POW-008', 'POW-008-SPEEDBOAT'). NULL on every
-- route that predates this and on every route a human creates in Config — that is the normal state,
-- not a gap to backfill: those programmes have no B2C product behind them.
--
-- The partial unique index is what actually makes the create idempotent under concurrency: the
-- app-level "does this externalId exist" check runs before the write transaction takes its advisory
-- lock, so two simultaneous creates can both pass it. One of them then loses on the index, and the
-- endpoint turns that 23505 into the same success the winner got. NULLs are exempt (they are always
-- distinct in a Postgres unique index) and empty strings are excluded explicitly, so the hand-made
-- routes are untouched by it.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'routes') THEN
      EXECUTE format('ALTER TABLE %I.routes ADD COLUMN IF NOT EXISTS extid text', sch);
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS routes_extid_uq ON %I.routes (extid) WHERE extid IS NOT NULL AND extid <> %L',
        sch, '');
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'routes' AND column_name = 'extid';
--   SELECT indexname FROM pg_indexes
--    WHERE schemaname = 'operation_schemas' AND indexname = 'routes_extid_uq';
