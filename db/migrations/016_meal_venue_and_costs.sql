-- 016_meal_venue_and_costs.sql  (2026-08-15)
--
-- The three prices a per-trip P&L needs and the database had nowhere to put.
--
-- The costing page has carried a complete cost formula for months — park fee, meals, fuel, guide,
-- captain, crew, pier fee, depreciation — and it has never once been applied to a trip that
-- actually sailed. The per-trip P&L feeds that same formula real numbers instead of planning
-- numbers, so the two pages can never disagree. This migration adds the three things the formula
-- had no way to know.
--
-- meal_venues: the restaurants. Each route eats somewhere, the price per head differs by venue, and
-- adults and children are charged differently. Prices live on the venue, not on the trip, so a
-- price rise is one edit — and a trip that has already been closed keeps the amount it was closed
-- with, because closing records the money, not the venue name. Venues are deactivated rather than
-- deleted so old trips can still be read.
--
-- routes.mealvenueid: which venue a route eats at by default. Empty means the route has no lunch at
-- all (the sunset trips), which is different from a lunch that happens to cost nothing.
--
-- sb_vehicles.costperday: what one van costs for a day. Until now every van was charged at a flat
-- ฿1,200 buried in the code, which nobody could edit and which charged a company van — fuel and a
-- driver — the same as a van hired in from a partner. They are not the same money.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN

      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.meal_venues (
           id        text PRIMARY KEY,
           name      text,
           place     text,
           price_ad  numeric,
           price_ch  numeric,
           phone     text,
           note      text,
           active    boolean
         )', sch);

      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = sch AND table_name = 'routes') THEN
        EXECUTE format('ALTER TABLE %I.routes ADD COLUMN IF NOT EXISTS mealvenueid text', sch);
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = sch AND table_name = 'sb_vehicles') THEN
        EXECUTE format('ALTER TABLE %I.sb_vehicles ADD COLUMN IF NOT EXISTS costperday numeric', sch);
      END IF;

    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'meal_venues';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name IN ('routes','sb_vehicles')
--      AND column_name IN ('mealvenueid','costperday');
