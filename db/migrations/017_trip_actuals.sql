-- 017_trip_actuals.sql  (2026-08-15)
--
-- Where a trip records what it actually cost, as opposed to what the formula said it would.
--
-- The costing page can already say what a trip of this shape ought to cost. It cannot say what
-- this trip did cost, because there has never been anywhere to write that down. This table is that
-- place: one row per trip, keyed 'YYYY-MM-DD::boatId' — the same key the sailing grid, the fuel log
-- and the crew job sheet are already keyed on, so a trip is one thing across all four.
--
-- The first thing written here is the lunch. When the pier sends the food order to the restaurant,
-- the amount is recorded against the trip on the spot, by the person who actually knows who turned
-- up. The amount is stored, not just the restaurant's name — when the restaurant raises its prices
-- next month, trips that already sailed keep the money they were really charged.
--
-- Fuel, vans, park fees and crew will land in the same row as the P&L work continues, which is why
-- the value column is JSON rather than a column per cost line. The shape of a trip's actuals will
-- keep changing; the table should not have to.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.trip_actuals (
           id    text PRIMARY KEY,
           key   text,
           value text
         )', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'trip_actuals';
