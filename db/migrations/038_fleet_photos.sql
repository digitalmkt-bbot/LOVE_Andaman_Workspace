-- 038_fleet_photos.sql  (2026-10-18)   [§flPhoto]
--
-- Photos on maintenance jobs and problem reports.
--
-- Owner: "ตัว Fleet work ขอเพิ่มการเพิ่มรูปในงานหน่อย" · "ขอสามารถกลับไปแนบรูปตัวงานที่เสร็จไปแล้วด้วย"
--
-- The app now writes m.photos[] on fleet_maintenance rows and inc.photos[] on fleet_incidents rows:
--   { id, attId, url, mime, size, name, cap, stage, addedAt, by, removed?, removedBy?, removedAt? }
-- Only refs. The files themselves go through POST /api/attach into allotment.attachments, the same
-- pipe the booking slips and fleet_projects.docs (032) already use. Nothing base64 ever lands here.
--
-- One json_text column per table, same shape and reasoning as fleet_projects.docs in 032: the rows
-- are refs with an optional caption / stage / hidden flag, not a child table anyone queries by column.
--
-- ⚠ Ships with field_mapping.json + operation_schemas_model.json in the same push (§mapDrift):
--   without the mapping the save drops photos[] silently — "saved fine, gone after a refresh".
--
-- Idempotent · ADD COLUMN IF NOT EXISTS · no-op on a database that runs in blob mode.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'fleet_maintenance') THEN
        EXECUTE format('ALTER TABLE %I.fleet_maintenance ADD COLUMN IF NOT EXISTS photos text', sch);
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'fleet_incidents') THEN
        EXECUTE format('ALTER TABLE %I.fleet_incidents ADD COLUMN IF NOT EXISTS photos text', sch);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT table_name, column_name FROM information_schema.columns
--    WHERE table_schema='operation_schemas' AND column_name='photos'
--      AND table_name IN ('fleet_maintenance','fleet_incidents');   -- must return 2 rows
