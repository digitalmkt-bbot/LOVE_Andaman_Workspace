-- 010_pier_sections.sql  (2026-08-14)
--
-- Why this exists
-- ---------------
-- /api/load rebuilds the client blob from the mapped tables. A key the mapping does not know is
-- simply absent when the app reloads, so the value looks saved, survives until refresh, and then
-- vanishes. That is what happened to the roster sections: created, saved, gone on reload.
--
-- Four things the client now writes and the database has nowhere to keep:
--   pier_sect         · roster section headings, per pier, user-named and user-ordered
--   pier_staff.sect   · which section a person belongs to
--   pier_staff.note   · the REMARKS column in the roster (resigned · back for high season)
--   routes.code       · short route code shown in the roster (PP · SL · SR · KB · WS)
--                       a missing code still falls back to a guess from the route name,
--                       so only a manual override is lost — but it is lost silently
--
-- Run this BEFORE deploying the matching client build. Deploying first means the app writes
-- these fields and every reload throws them away, which reads to staff as "it did not save".
--
-- Idempotent: safe to re-run. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN

      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.pier_sect (
           id   text PRIMARY KEY,
           pier text,
           name text,
           ord  bigint
         )', sch);

      IF EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = sch AND table_name = 'pier_staff') THEN
        EXECUTE format('ALTER TABLE %I.pier_staff ADD COLUMN IF NOT EXISTS sect text', sch);
        EXECUTE format('ALTER TABLE %I.pier_staff ADD COLUMN IF NOT EXISTS note text', sch);
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = sch AND table_name = 'routes') THEN
        EXECUTE format('ALTER TABLE %I.routes ADD COLUMN IF NOT EXISTS code text', sch);
      END IF;

    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'pier_sect';
--   SELECT table_schema, column_name FROM information_schema.columns
--    WHERE table_name = 'pier_staff' AND column_name IN ('sect','note');
--   SELECT table_schema, column_name FROM information_schema.columns
--    WHERE table_name = 'routes' AND column_name = 'code';
--   -- expect one row per existing schema for each
