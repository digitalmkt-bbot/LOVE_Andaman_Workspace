-- 023_trip_traveller_nationality.sql  (2026-09-05)
--
-- How many people on a trip are actually Thai — kept apart from which price they were sold at.
--
-- trips[].pax has carried two different facts in one set of boxes since it was written. ad_th /
-- ad_fr choose the seat price from the contract, and the pier's national-park sheet reads those
-- same boxes to decide who is Thai at the park gate. Most of the time the two answers agree, so
-- nobody noticed they were the same number.
--
-- They stop agreeing whenever a contract has no Thai column. Eight active rate types have none
-- (IRIS Natai, four Russian DMC rates, Special Rate DMC, NYM LOW SEASON 26, HOTEL 25% NYM). A Thai
-- customer booking through one of those must be keyed as a foreigner or the seat price comes out
-- wrong — and the park sheet then quietly buys them a foreigner's ticket: 400 baht where the ranger
-- would have taken 40, 200 where it would have been 20. The money is real and it is lost silently,
-- because the sheet has no way to know the seat bucket was a pricing decision rather than a fact
-- about the passenger.
--
-- nat.{ad,chd,inf,foc} is that fact, and only that fact: the number of Thai travellers of each
-- type. It never touches the price. The park sheet prefers it and falls back to the pax buckets
-- when it is absent, so every booking already in the database behaves exactly as it does today —
-- the columns are NULL and the fallback is the old code path.
--
-- All four NULL means "nobody said", not "no Thais": os_repo skips NULL columns when it rebuilds
-- the blob, so no nat object appears at all and the fallback stays in charge. Four zeros is a
-- statement — someone looked and there were none.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'sb_bookings__trips') THEN
      EXECUTE format('ALTER TABLE %I.sb_bookings__trips ADD COLUMN IF NOT EXISTS nat_ad  bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_bookings__trips ADD COLUMN IF NOT EXISTS nat_chd bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_bookings__trips ADD COLUMN IF NOT EXISTS nat_inf bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_bookings__trips ADD COLUMN IF NOT EXISTS nat_foc bigint', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'sb_bookings__trips'
--      AND column_name LIKE 'nat\_%';
