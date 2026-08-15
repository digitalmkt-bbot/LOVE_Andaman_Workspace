-- 015_pier_kind_name_en.sql  (2026-08-15)
--
-- An English name for each equipment category, alongside the Thai one.
--
-- The sign sheet the pier prints is signed by the guests, who are almost all foreign, so the whole
-- sheet is in English. Its equipment columns were the one exception: they were headed ตีนกบ and
-- ผ้าเช็ดตัว, because those headings come from the stock register, which Thai staff fill in and read
-- on screen all day.
--
-- Renaming the categories to English would have fixed the paper and broken the screen. So the
-- category now carries both names: name stays Thai and keeps driving every screen, name_en is what
-- gets printed on an English document. Neither side has to give anything up.
--
-- The three seeded categories get FINS / MASK / TOWEL filled in from the client on load, matched on
-- id rather than on name, because the Thai name is the user's to change at any time and the id is
-- not. Categories the pier added themselves are left empty; the sheet falls back to the Thai name,
-- which is better than a blank column heading.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'pier_kinds') THEN
      EXECUTE format('ALTER TABLE %I.pier_kinds ADD COLUMN IF NOT EXISTS name_en text', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'pier_kinds';
