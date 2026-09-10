-- 025_routes_familyid.sql  (2026-09-10)
--
-- Which family a route belongs to, as a stored fact instead of a guess about its name.
--
-- "Family" is the group a program is filed under on the Booking calendar — Similan, Phi Phi,
-- Whale Shark and so on. Until now it was never stored anywhere. bkV2RouteFamily() worked it out
-- at render time by reading route.name and searching it for words:
--
--     if(n.includes('Similan')) return _BKV2_FAMILIES[0];
--
-- Two consequences, both live today. A route whose name matches nothing returns null and does not
-- appear on the Booking calendar at all — which is exactly what happens to the first program that
-- is not a boat trip. And renaming a route in Config can silently drop it out of the calendar,
-- because the grouping was never anything more than the spelling of its name.
--
-- A second keyword table exists in the costing module (CT_FAMKEY) with different keywords again —
-- it knows 'bamboo' and 'james bond' and some Thai, the booking one does not. That one stays: it
-- matches free-text costing PLAN names, a different input. But its route→family lookup
-- (ctRouteFamId) delegates to bkV2RouteFamily, so it inherits this column too.
--
-- familyid holds the family id ('similan', 'phiphi', …). Three states, and they differ:
--   NULL  = never set. bkV2RouteFamily falls back to the name guess, so behaviour is unchanged.
--   ''    = deliberately no family. Respected, never guessed over.
--   'xxx' = that family.
--
-- The client backfills NULL rows in memory on load, writing the same value the guess already
-- returns, so nothing moves on screen. It does not persist on its own — the value reaches this
-- column the next time Config is saved, or when the route is edited. Nothing is rewritten: the
-- backfill only ever fills a route that has never carried the field.
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
      EXECUTE format('ALTER TABLE %I.routes ADD COLUMN IF NOT EXISTS familyid text', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'routes'
--      AND column_name = 'familyid';
