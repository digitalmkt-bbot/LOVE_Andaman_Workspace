-- 046_rate_seat_rn.sql  (2026-11-11)
--
-- Seat rates for the Ranong pickup zone (RN) on a Rate Type.
--
-- The Rate Type editor has offered an RN row for Ranong routes since the pickup-zone work (§rnZone2:
-- a Ranong route prices as RN + No transfer, not PK/KL). sb_rate_types__seatrates only had columns for
-- PK, KL and NoTransfer, so the RN figures never reached the database: the editor saved them, the page
-- kept them until it reloaded, and the next load came back without them. Reported 2026-11-11 on
-- RANONG-RT ("user Edit rate type ของ RN แต่ระบบไม่เซฟให้").
--
-- Booking pricing already tries RN first on Ranong routes with a pickup (bkNetRate · §rnZone) and
-- fell back to another zone because RN was always empty.
--
-- Six bigint columns, same shape as the pk_/kl_/notransfer_ groups. Field mapping and the schema
-- model gain the same six in the same commit.
--
-- Idempotent. Guarded on schema existence so it is a no-op on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'sb_rate_types__seatrates') THEN
      EXECUTE format('ALTER TABLE %I.sb_rate_types__seatrates ADD COLUMN IF NOT EXISTS rn_adult_thai  bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_rate_types__seatrates ADD COLUMN IF NOT EXISTS rn_adult_fr    bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_rate_types__seatrates ADD COLUMN IF NOT EXISTS rn_child_thai  bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_rate_types__seatrates ADD COLUMN IF NOT EXISTS rn_child_fr    bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_rate_types__seatrates ADD COLUMN IF NOT EXISTS rn_infant_thai bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_rate_types__seatrates ADD COLUMN IF NOT EXISTS rn_infant_fr   bigint', sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'operation_schemas' AND table_name = 'sb_rate_types__seatrates'
--      AND column_name LIKE 'rn\_%';
