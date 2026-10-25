-- 039_fleet_batteries.sql  (2026-10-22)   [§flBat]
--
-- Boat batteries as company assets · one row per battery.
--
-- Owner: "เดี๋ยวเราจะมีการเพิ่มแบตเตอรี่ของเรือลำนั้น ๆ และจะได้มีการเช็คอายุแบตด้วย ติดตั้งวันไหน
--         และมีการถ่ายรูปไว้ เรือนึงลำใช้หลายลูก"
--
-- Lives beside fleet_engines / fleet_gearboxes / fleet_propellers (Company Asset → Batteries).
-- A boat carries several: pos = Port / Std / House / Bow / Other. status = installed | spare | retired.
-- Age = today − installdate against lifemonths (app default 18, per battery); the app warns 3 months
-- ahead. photos (json_text) are refs into allotment.attachments, the same pipe as fleet_maintenance.photos
-- (038) — nothing base64 here. log (json_text) = install / move / remove / replace / retire / volt entries.
-- Amounts are not derived; nothing else references this table.
--
-- Ships with field_mapping.json + operation_schemas_model.json in the same push (a mapped table without
-- its migration takes /api/load down). IF NOT EXISTS throughout · safe to re-run.

CREATE TABLE IF NOT EXISTS operation_schemas.fleet_batteries (
  id              text PRIMARY KEY,
  boatid          text,
  pos             text,
  brand           text,
  model           text,
  cap             text,
  volt            text,
  serial          text,
  cost            double precision,
  supplier        text,
  status          text,
  installdate     text,
  buydate         text,
  lifemonths      bigint,
  warrantymonths  bigint,
  sparelocation   text,
  memono          text,
  replacedid      text,
  replacedbyid    text,
  retireddate     text,
  retiredreason   text,
  note            text,
  photos          text,
  log             text
);
CREATE INDEX IF NOT EXISTS idx_fleet_batteries_boat ON operation_schemas.fleet_batteries (boatid);

COMMENT ON TABLE operation_schemas.fleet_batteries IS
  'boat batteries · one row per battery · status installed/spare/retired · age from installdate vs lifemonths · photos/log are JSON text';

-- Verify:
--   SELECT count(*) FROM information_schema.columns WHERE table_schema='operation_schemas' AND table_name='fleet_batteries';  -- 24
