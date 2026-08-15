-- 018_meal_venue_eta.sql  (2026-08-15)
--
-- Roughly what time the boat reaches the restaurant.
--
-- The pier now sends the restaurant a lunch order — how many adults, how many children, who is
-- vegetarian, what people are allergic to, and what it comes to. A kitchen reading that order needs
-- one more thing to act on it: when the boat is arriving. Food cooked two hours early is as much a
-- problem as food not started.
--
-- The system has never known this. It stores when a boat leaves the pier, not when it reaches an
-- island, and there is no honest way to derive one from the other — the crossing to Bamboo is not
-- the crossing to Similan, and neither is constant. So it is recorded where it is actually stable:
-- on the restaurant. A given venue sees the boat at about the same time every day, so it is set
-- once and rides on every order from then on. Left blank, the order simply goes out without a time,
-- which is what happens today anyway.
--
-- Idempotent. Guarded on schema and table existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'meal_venues') THEN
      EXECUTE format('ALTER TABLE %I.meal_venues ADD COLUMN IF NOT EXISTS eta text', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'meal_venues' AND column_name = 'eta';
