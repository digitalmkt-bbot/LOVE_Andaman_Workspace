-- 021_boats_nameth_note.sql  (2026-08-20)
--
-- The Thai name of a boat, and the free-text note kept against it.
--
-- The boat form has asked for both for a long time. Neither had a column, so neither survived the
-- trip to the database: the form saved them, the page kept them until it reloaded, and the next
-- load came back without them. Nobody reported it because the two fields are the kind you fill in
-- once and only read months later.
--
-- nameTh is not decoration. Every document that goes to a Thai government office — the harbour
-- office, the marine department, the park permit — names the boat in Thai, and goBoatTh() builds
-- that name from this field, falling back to the English name when it is empty. So the boat that
-- prints as "Andaman Ryder" on a harbour form should print as "อันดามัน ไรเดอร์ (Andaman Ryder)",
-- and could not, because the Thai half never reached the database.
--
-- note is the ordinary remarks box on the boat form.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'boats') THEN
      EXECUTE format('ALTER TABLE %I.boats ADD COLUMN IF NOT EXISTS nameth text', sch);
      EXECUTE format('ALTER TABLE %I.boats ADD COLUMN IF NOT EXISTS note   text', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'boats'
--      AND column_name IN ('nameth','note');
