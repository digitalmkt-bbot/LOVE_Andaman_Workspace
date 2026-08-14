-- 011_pier_staff_ord.sql  (2026-08-14)
--
-- Row order inside a roster section.
--
-- Until now the people inside a section came out in whatever order they were entered into the
-- staff register, which carries no meaning: a manager and their assistant sit in whichever order
-- someone happened to key them in, and there was no way to change it short of deleting and
-- re-adding the whole group. `ord` holds the order the user arranges by dragging names, or with
-- the up/down buttons next to each name.
--
-- Nullable on purpose. A NULL ord means "never arranged", and the client treats that as +Infinity
-- so those rows keep falling back to register order exactly as before. Defaulting to 0 would jump
-- every unarranged person to the top of their section the moment this runs.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = sch AND table_name = 'pier_staff') THEN
      EXECUTE format('ALTER TABLE %I.pier_staff ADD COLUMN IF NOT EXISTS ord bigint', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT table_schema, column_name FROM information_schema.columns
--    WHERE table_name = 'pier_staff' AND column_name = 'ord';
