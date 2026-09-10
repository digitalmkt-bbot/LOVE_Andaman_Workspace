-- 026_routes_dailycap.sql  (2026-09-10)   [§cityTourPier]
--
-- A per-day seat quota for programmes that are not boat trips.
--
-- Capacity in this system has always been derived, never stored: getAllotment() reads which boats
-- Boat Operation assigned to a route that day and sums boat.cap. That works because a marine
-- programme cannot happen without a boat, so the boat board is a truthful record of what is
-- running.
--
-- A city tour has no boat. Under the old code its allotment came back hasAllotment:false, and
-- every capacity guard in bkV2CommitBooking begins:
--
--     if(!al || !al.hasAllotment) return;
--
-- so the locked-seat block, the over-cap approval queue and the licence block were all skipped.
-- The route would sell without limit and without warning, showing only a grey PROVISIONAL chip
-- that reads to staff as "fine".
--
-- dailycap is the substitute ceiling for those programmes: seats sellable per day, counted against
-- the same seatsConsumed and seat locks as a boat route. Setting it switches the guards back on —
-- going over it now queues for approval rather than passing silently.
--
-- It is deliberately NOT a licence ceiling. A boat carries boat.licensePax, a legal figure from the
-- marine department that hard-blocks with no override. A rented van has no equivalent — if a city
-- tour picks up four more guests, ops rents another vehicle the same morning. So for land routes
-- getAllotment sets licenseCapacity = capacity, and the only ceiling is this soft one.
--
-- NULL / absent = no quota. The programme sells freely, which is the behaviour these routes have
-- today, and the booking form says "NO LIMIT" instead of "PROVISIONAL" so it does not read as a
-- missing boat assignment. Only land routes consult this column; a marine route still gets its
-- capacity from the boats on the board, and this column is ignored for it.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'routes') THEN
      EXECUTE format('ALTER TABLE %I.routes ADD COLUMN IF NOT EXISTS dailycap bigint', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'routes'
--      AND column_name = 'dailycap';
