-- 019_pier_sheet.sql  (2026-08-20)
--
-- The pier's issue-and-return sheet: who took which gear, and the deposit money against it.
--
-- Stock movements already had a home in pier_moves, but a movement only says "eleven pairs of fins
-- left the store". It cannot say which booking took them, and it has nowhere to put the deposit the
-- customer left. That detail was written on paper, and at six in the evening — when a mask has not
-- come back and someone has to be asked for it — the paper is the only thing that knows who to ask.
--
-- One row per trip, keyed 'YYYY-MM-DD::boatId', the same key trip_actuals, pier_job and fleet_daily
-- already use, so a trip stays one thing across all of them. The value holds the whole sheet as
-- JSON: rows[] (one per booking, with issued and returned counts per equipment kind, deposit taken,
-- deposit returned, amount withheld, a note), size{} (how each kind's total splits across the sizes
-- that stock is actually held in), and wrote{} (what this sheet has already posted to pier_moves,
-- so re-posting writes only the difference).
--
-- The sheet is a record of intent and of money; pier_moves stays the ledger that stock is counted
-- from. The two are deliberately separate — a sheet can be saved as a draft all morning without
-- touching stock, and posted once when the numbers are final.
--
-- JSON rather than a column per field on purpose. The columns of this sheet are the pier's
-- equipment categories, which the pier edits itself in pier_kinds; a relational shape would need a
-- migration every time they add life jackets.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.pier_sheet (
           id    text PRIMARY KEY,
           key   text,
           value text
         )', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'pier_sheet';
