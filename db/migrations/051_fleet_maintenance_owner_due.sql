-- 051_fleet_maintenance_owner_due.sql  (2026-11-16) · §mjOwnerDue
--
-- Owner / Due / Parked on a maintenance job (MJ) never reached the database.
--
-- The job board (§flBoard, 2026-09-22) and the new-job form write m.owner, m.dueDate and m.parked,
-- but fleet_maintenance had no columns for them, so the save dropped the three fields and the next
-- load came back without them. Live data on 2026-11-16: 357 jobs, 0 with an owner, 0 with a due date,
-- 0 parked; the board shows "33 no owner" because every owner typed in is lost. Found while checking
-- MJ-361 (Aluminous1, Yamaha 250 swap, due 21 Nov typed in the form, gone after saving).
--
-- Three text columns (dueDate and parked hold YYYY-MM-DD strings, same as startdate / enddate).
-- Field mapping and the schema model gain the same three in the same commit.
--
-- Idempotent. Guarded on schema / table existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'fleet_maintenance') THEN
      EXECUTE format('ALTER TABLE %I.fleet_maintenance ADD COLUMN IF NOT EXISTS owner   text', sch);
      EXECUTE format('ALTER TABLE %I.fleet_maintenance ADD COLUMN IF NOT EXISTS duedate text', sch);
      EXECUTE format('ALTER TABLE %I.fleet_maintenance ADD COLUMN IF NOT EXISTS parked  text', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'fleet_maintenance'
--      AND column_name IN ('owner','duedate','parked');
