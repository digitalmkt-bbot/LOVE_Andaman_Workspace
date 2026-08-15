-- 012_pier_kinds.sql  (2026-08-14)
--
-- Equipment categories in the pier stock register, as data instead of code.
--
-- The register had three hard-coded categories — fins, masks, towels. Anything else the pier
-- actually holds (life jackets, snorkels, tanks) had to be filed under one of those three, which
-- gave it the wrong unit of count ("2 pairs of life jacket") and merged unrelated things in the
-- stock bars and issue slips.
--
-- id keeps the original keys 'fin', 'mask', 'towel' for the seeded rows, so every existing
-- pier_items.kind still resolves. Categories are shared across piers on purpose: the same kind of
-- item should be counted in the same unit at every pier.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.pier_kinds (
           id     text PRIMARY KEY,
           name   text,
           unit   text,
           color  text,
           ord    bigint,
           active boolean
         )', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'pier_kinds';
