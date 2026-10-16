-- 037_rate_type_pt_routes.sql  (2026-10-16)   [§ptRoutes]
--
-- Rate Type · private transfer prices for EVERY route.
--
-- addOns.privateTransfer is { unit, <routeId>: { PK:{sedan,van}, KL:{sedan,van} }, … }. The generated
-- mapping gave it one child table per route id that existed at the time (sb_rate_types__addons__r4,
-- r5, r6, r10, r11, r12). Prices for any other route (r1/r2/r3/r7/r8/r9 and every route added since)
-- had nowhere to land: the save dropped them, so they showed on screen and were gone after a refresh.
-- Reported 2026-10-16 on "Russian DMC Special Rate Sayama 2026-2027".
--
--   sb_rate_types__ptroutes   one row per (rate type, route) · value = that route's zone map as JSON
--                             written for every route; on load a row here wins over the old r* tables
--
-- Same shape and reasoning as trips__boat. The old r* tables stay and are still written.
-- Prices already dropped by earlier saves are not in the database and cannot be recovered here;
-- they have to be keyed in again once this is live.
-- IF NOT EXISTS throughout · safe to re-run.

CREATE TABLE IF NOT EXISTS operation_schemas.sb_rate_types__ptroutes (
  row_pk            text PRIMARY KEY,
  sb_rate_types_id  text,
  "key"             text,
  "value"           text
);
CREATE INDEX IF NOT EXISTS idx_sb_rate_types_ptroutes ON operation_schemas.sb_rate_types__ptroutes (sb_rate_types_id);

-- children are replaced by deleting the parent row (ON DELETE CASCADE), same as every other sb_rate_types__* table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sb_rate_types_ptroutes') THEN
    ALTER TABLE operation_schemas.sb_rate_types__ptroutes
      ADD CONSTRAINT fk_sb_rate_types_ptroutes FOREIGN KEY (sb_rate_types_id)
      REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON TABLE operation_schemas.sb_rate_types__ptroutes IS
  'rate type private transfer · one row per (rate type, route) · value = zone map JSON · replaces the fixed sb_rate_types__addons__r* tables that only covered six routes';
