-- 024_ts_cot_slips.sql  (2026-09-09)
--
-- Payment-slip references for the Cash-on-Tour settlement (§cotSlip).
--
-- The COT column on the Travel Summary closing sheet already records the decision (deduct the whole
-- amount / part of it / don't deduct / pay out / couldn't collect) and a free-text reference number.
-- What it never had was the picture: the person closing the day photographs the transfer slip, drops
-- it in a Line chat, and accounting goes looking for it weeks later.
--
-- The file itself goes where every other slip in this app goes — the attachments table, via
-- /api/attach, tied to the booking. ts_cot only keeps the reference list
-- ([{id,name,mime,size,at,by}]), same shape as sb_extras.slips and pier_payments.slips.
--
-- Without this column the mapping entry ts_cot.slips has nowhere to land and the slip list is
-- dropped silently on the way to the server — the browser would keep it until the next reload.
--
-- Idempotent. Guarded on schema/table existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'ts_cot') THEN
      EXECUTE format('ALTER TABLE %I.ts_cot ADD COLUMN IF NOT EXISTS slips text', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'ts_cot' AND column_name = 'slips';
