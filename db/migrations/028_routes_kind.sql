-- 028_routes_kind.sql  (2026-09-10)   [§routeKind]
--
-- What kind of programme a route is, as its own field instead of a value smuggled into `pier`.
--
-- Migration 026 gave land programmes a seat quota, but the thing that made a route "land" was
-- pier = 'other' — a pier that does not exist. That worked, and it was marked in the code as a
-- temporary shortcut, because it spends a column on a fact it was not built to hold.
--
-- The cost is already visible in the data. transfer_services on the B2C side lists TR-004
-- "Private Transfer to Pier", whose five variants are Phuket → Visit Panwa, Khao Lak → Tub Lamu,
-- Ranong → Ranong Pier. Those are land programmes that genuinely relate to a pier — and the column
-- that would say which one is busy declaring "this is not a boat trip".
--
-- kind = 'marine' | 'land'. NULL means never set, and the client falls back to the old
-- pier = 'other' test, so a row this migration has not reached still behaves correctly. The
-- backfill below converts the existing land routes and frees their pier.
--
-- Nothing on the B2C side changes. B2C addresses programmes only by ops_route_id
-- (transfer_services.ops_route_id, programs_own.ops_route_id) and never reads pier or kind to
-- decide anything. Its own seat calendar does SELECT r.pier for display, and degrades through
-- _saPierMeta() to a two-letter fallback, so a blank pier shows as "Unknown" rather than breaking.
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
      EXECUTE format('ALTER TABLE %I.routes ADD COLUMN IF NOT EXISTS kind text', sch);
      -- every route that reached here through the pier shortcut becomes an explicit land route,
      -- and gives its pier column back. Marine routes are left alone: NULL keeps the fallback,
      -- which reads them as marine exactly as before.
      EXECUTE format($f$UPDATE %I.routes SET kind = 'land', pier = ''
                         WHERE pier = 'other' AND (kind IS NULL OR kind = '')$f$, sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT id, name, kind, pier, familyid FROM operation_schemas.routes
--    WHERE kind = 'land' OR pier = 'other' ORDER BY sort;
