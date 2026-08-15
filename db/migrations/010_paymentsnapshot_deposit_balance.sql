-- 010_paymentsnapshot_deposit_balance.sql  (2026-08-14)
--
-- Why this exists
-- ---------------
-- The B2C sync has always mapped paymentSnapshot.deposit and .balance (see the mapper in server.js,
-- `deposit: isFirstLine ? Number(h.bk_deposit) : 0`), but sb_bookings had no column for either, so
-- decomposeBlob dropped both on every write. Ops could see THAT a booking was part-paid — paidStatus
-- says 'deposit' on 10 of them — but never how much was taken or how much was still owed.
--
-- 92 of 98 B2C orders carry a deposit; 9 are genuinely part-paid. The largest, LOV-8581523, is
-- ฿320,553 total with ฿224,387 taken and ฿96,166 outstanding — money that was invisible on the ops
-- side entirely.
--
-- This is the same fault the 2026-07-30 note in server.js describes ("already being mapped with no
-- column to land in, so they were silently dropped by decomposeBlob"). That round added
-- paymentsnapshot_paid and paymentsnapshot_paidstatus and left these two behind.
--
-- bigint to match paymentsnapshot_paid: the mapper rounds to whole baht before writing.
--
-- MUST be applied BEFORE the code that adds these to operation_schemas_model.json ships. OS_COLS is
-- built from that model, not from the database, and it drives the INSERT column list for every save
-- — so a model naming a column the database lacks fails every write, not just this feature.
--
-- Idempotent: safe to re-run. Guarded on table existence.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'operation_schemas' AND table_name = 'sb_bookings') THEN
    ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS paymentsnapshot_deposit bigint;
    ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS paymentsnapshot_balance bigint;

    COMMENT ON COLUMN operation_schemas.sb_bookings.paymentsnapshot_deposit IS
      'B2C bookings.deposit — amount already taken. Order-level, so it lands on the first line of a multi-item order only.';
    COMMENT ON COLUMN operation_schemas.sb_bookings.paymentsnapshot_balance IS
      'B2C bookings.balance — amount still owed. Order-level, first line only, same as deposit.';
  END IF;
END $$;

-- Verify:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema='operation_schemas' AND table_name='sb_bookings'
--      AND column_name IN ('paymentsnapshot_deposit','paymentsnapshot_balance');
--   -- expect 2 rows, both bigint
